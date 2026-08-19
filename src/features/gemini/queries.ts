import { and, asc, count, countDistinct, desc, eq, gte, max, ne, sql, sum } from 'drizzle-orm'
import { db } from '@/db'
import { aiUsageEvents, geminiKeys, users } from '@/db/schema'
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
 * One person's ledger since `since`, grouped for summarizeUsage. Joins the
 * key's CURRENT tier (deleted key -> null -> treated as free, i.e. $0
 * charged — the honest floor, since a deleted key's tier is unknowable).
 */
export async function aggregateAiUsage(userId: string, since: Date): Promise<UsageAggRow[]> {
  const rows = await db
    .select({
      feature: aiUsageEvents.feature,
      model: aiUsageEvents.model,
      keyTier: geminiKeys.tier,
      calls: count(),
      inputTokens: sum(aiUsageEvents.inputTokens).mapWith(Number),
      outputTokens: sum(aiUsageEvents.outputTokens).mapWith(Number),
    })
    .from(aiUsageEvents)
    .leftJoin(geminiKeys, eq(aiUsageEvents.keyId, geminiKeys.id))
    .where(and(eq(aiUsageEvents.userId, userId), gte(aiUsageEvents.createdAt, since)))
    .groupBy(aiUsageEvents.feature, aiUsageEvents.model, geminiKeys.tier)
  return rows.map((r) => ({
    ...r,
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

/** Org-wide, per-slug: how many DISTINCT people used it and how often. */
export async function aggregateAdoption(since: Date): Promise<AdoptionAggRow[]> {
  return db
    .select({
      feature: aiUsageEvents.feature,
      userCount: countDistinct(aiUsageEvents.userId),
      calls: count(),
      lastUsedAt: max(aiUsageEvents.createdAt),
    })
    .from(aiUsageEvents)
    .where(gte(aiUsageEvents.createdAt, since))
    .groupBy(aiUsageEvents.feature)
}

/** Per-person feature usage, for the admin drill-down. */
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
    .where(gte(aiUsageEvents.createdAt, since))
    .groupBy(aiUsageEvents.userId, users.name, aiUsageEvents.feature)
    .orderBy(desc(count()))
}
