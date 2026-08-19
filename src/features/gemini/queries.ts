import { and, asc, count, countDistinct, desc, eq, gte, max, ne, or, sql, sum } from 'drizzle-orm'
import { db } from '@/db'
import { aiUsageEvents, geminiKeys, users } from '@/db/schema'
import type { KeyHealth } from '@/features/gemini/readiness'
import type { AdoptionAggRow, UsageAggRow } from '@/features/gemini/usage-summary'

export type GeminiKeyRow = {
  id: string
  label: string
  last4: string
  active: boolean
  shared: boolean
  tier: string
  failCount: number
  lastUsedAt: Date | null
  createdAt: Date
}

/**
 * Masked key rows for the settings UI — the key itself never leaves the server.
 *
 * OWN KEYS ONLY, deliberately: this backs the /profile card, which lets the
 * caller toggle, share, and DELETE each row — so it must never widen to
 * include a teammate's key, however tempting that looks once shared/active
 * keys exist. The pool a caller can actually transact on (their own keys plus
 * other people's active-and-shared ones) is a separate, read-only view — see
 * getRecordingReadiness in actions.ts — and has no business in a UI with a
 * delete button on every row.
 */
export async function listGeminiKeys(userId: string): Promise<GeminiKeyRow[]> {
  return db
    .select({
      id: geminiKeys.id,
      label: geminiKeys.label,
      last4: geminiKeys.last4,
      active: geminiKeys.active,
      shared: geminiKeys.shared,
      tier: geminiKeys.tier,
      failCount: geminiKeys.failCount,
      lastUsedAt: geminiKeys.lastUsedAt,
      createdAt: geminiKeys.createdAt,
    })
    .from(geminiKeys)
    .where(eq(geminiKeys.userId, userId))
    .orderBy(asc(geminiKeys.createdAt))
}

/**
 * Health columns for every key this caller can actually transact on — THE one
 * row set any "is my AI ready?" answer is allowed to be computed from.
 *
 * It exists because there used to be two: /settings assessed readiness over
 * listGeminiKeys (own keys only) while the recording panel assessed it over
 * the pool, so a user with no key of their own but a teammate's shared one was
 * told "no key is active" on one screen and "one key, working" on the next —
 * one click apart, and the pool answer was the true one, because their calls
 * did succeed. Every readiness caller now reads this.
 *
 * Row selection mirrors callGeminiCore's own key set (client.ts): the caller's
 * own keys, plus other people's keys that are BOTH active and shared. That
 * "both" matters — a teammate's paused or private key is not part of the pool
 * this caller can call into and must not inflate their readiness. The caller's
 * OWN keys are unfiltered by `active`: a paused key of your own is worth
 * surfacing as "there but off", whereas a teammate's paused key is simply not
 * available to you at all.
 *
 * No key material, encrypted or otherwise, is selected.
 */
export async function listPoolKeyHealth(userId: string): Promise<KeyHealth[]> {
  return db
    .select({
      id: geminiKeys.id,
      label: geminiKeys.label,
      active: geminiKeys.active,
      failCount: geminiKeys.failCount,
      lastUsedAt: geminiKeys.lastUsedAt,
    })
    .from(geminiKeys)
    .where(
      or(
        eq(geminiKeys.userId, userId),
        and(eq(geminiKeys.active, true), eq(geminiKeys.shared, true)),
      ),
    )
}

/**
 * One person's ledger since `since`, grouped for summarizeUsage. Joins the
 * key's CURRENT tier (deleted key -> null -> treated as free, i.e. $0
 * charged — the honest floor, since a deleted key's tier is unknowable).
 *
 * The join is on keyId ALONE and therefore says nothing about who pays: when
 * this caller's own keys are exhausted, rotation serves them on a teammate's
 * org-shared key, and that key's tier arrives here unchanged. So the row also
 * carries `isOwnKey`, computed from the ledger's own keyOwnerId snapshot —
 * summarizeUsage charges the caller only for keys the caller owns. Without it
 * a teammate's paid key would invoice the wrong person on screen.
 *
 * `status` rides along too, so blocked calls stay countable but stay out of
 * the usage, token and dollar figures.
 */
export async function aggregateAiUsage(userId: string, since: Date): Promise<UsageAggRow[]> {
  const rows = await db
    .select({
      feature: aiUsageEvents.feature,
      model: aiUsageEvents.model,
      keyTier: geminiKeys.tier,
      keyOwnerId: aiUsageEvents.keyOwnerId,
      status: aiUsageEvents.status,
      calls: count(),
      inputTokens: sum(aiUsageEvents.inputTokens).mapWith(Number),
      outputTokens: sum(aiUsageEvents.outputTokens).mapWith(Number),
    })
    .from(aiUsageEvents)
    .leftJoin(geminiKeys, eq(aiUsageEvents.keyId, geminiKeys.id))
    .where(and(eq(aiUsageEvents.userId, userId), gte(aiUsageEvents.createdAt, since)))
    .groupBy(
      aiUsageEvents.feature,
      aiUsageEvents.model,
      geminiKeys.tier,
      aiUsageEvents.keyOwnerId,
      aiUsageEvents.status,
    )
  return rows.map((r) => ({
    feature: r.feature,
    model: r.model,
    keyTier: r.keyTier,
    // A null owner (pre-ledger row, or a failure row that never reached a
    // key) is not this person's bill — the honest floor is "not mine".
    isOwnKey: r.keyOwnerId === userId,
    ok: r.status === 'ok',
    calls: r.calls,
    inputTokens: r.inputTokens ?? 0,
    outputTokens: r.outputTokens ?? 0,
  }))
}

/** Who spent an owner's shared keys — the per-key "used by" breakdown. */
export async function sharedKeyUsageByCaller(ownerId: string, since: Date) {
  return db
    .select({
      keyId: aiUsageEvents.keyId,
      keyLast4: aiUsageEvents.keyLast4,
      callerName: users.name,
      calls: count(),
      tokens: sql<number>`coalesce(sum(${aiUsageEvents.inputTokens} + ${aiUsageEvents.outputTokens}), 0)`.mapWith(Number),
    })
    .from(aiUsageEvents)
    .innerJoin(users, eq(aiUsageEvents.userId, users.id))
    .where(
      and(
        eq(aiUsageEvents.keyOwnerId, ownerId),
        ne(aiUsageEvents.userId, ownerId),
        gte(aiUsageEvents.createdAt, since),
      ),
    )
    .groupBy(aiUsageEvents.keyId, aiUsageEvents.keyLast4, users.name)
}

/**
 * Org-wide, per-slug: how many DISTINCT people used it and how often.
 *
 * Grouped by `status` as well as slug, so summarizeAdoption can keep blocked
 * calls visible without letting them masquerade as adoption. The ledger holds
 * a row per blocked call, so an ungrouped count would report a feature that
 * failed for everybody as the most-used thing in the product.
 */
export async function aggregateAdoption(since: Date): Promise<AdoptionAggRow[]> {
  const rows = await db
    .select({
      feature: aiUsageEvents.feature,
      status: aiUsageEvents.status,
      userCount: countDistinct(aiUsageEvents.userId),
      calls: count(),
      lastUsedAt: max(aiUsageEvents.createdAt),
    })
    .from(aiUsageEvents)
    .where(gte(aiUsageEvents.createdAt, since))
    .groupBy(aiUsageEvents.feature, aiUsageEvents.status)
  return rows.map((r) => ({
    feature: r.feature,
    ok: r.status === 'ok',
    userCount: r.userCount,
    calls: r.calls,
    lastUsedAt: r.lastUsedAt,
  }))
}

/**
 * Per-person feature usage, for the admin drill-down — successful calls only.
 * This list answers "who actually uses this"; someone whose every attempt was
 * blocked has used nothing, and the per-feature table above reports their
 * attempts. Dropping the status filter would list people as users of features
 * that have never once run for them.
 */
export async function perUserFeatureUsage(since: Date) {
  return db
    .select({
      userId: aiUsageEvents.userId,
      userName: users.name,
      feature: aiUsageEvents.feature,
      calls: count(),
      lastUsedAt: max(aiUsageEvents.createdAt),
    })
    .from(aiUsageEvents)
    .innerJoin(users, eq(aiUsageEvents.userId, users.id))
    .where(and(gte(aiUsageEvents.createdAt, since), eq(aiUsageEvents.status, 'ok')))
    .groupBy(aiUsageEvents.userId, users.name, aiUsageEvents.feature)
    .orderBy(desc(count()))
}
