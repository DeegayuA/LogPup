'use server'

/**
 * What the live AI meter is allowed to read, and from where.
 *
 * THE SHAPE OF THIS FILE IS DECIDED BY ONE FACT: token counts are not in the
 * return value of any AI action. `client.ts` reads them off `usageMetadata`
 * when a call returns and hands them to `recordAiUsage`, which writes a row to
 * `ai_usage_events`. Nothing threads them back to the caller, and threading
 * them through all fifteen call slugs would mean fifteen changed action
 * signatures reporting a number the ledger already holds — and then two
 * sources that can disagree about the same call.
 *
 * So the meter reads the ledger. That is not a workaround: it is the same row
 * Settings and the adoption panel report, so a cost the meter shows and a cost
 * the usage page shows are the same number by construction.
 *
 * The cost of that choice is a gap, and the gap is handled honestly rather
 * than hidden. `recordAiUsage` schedules its insert through `after()`, so the
 * action returns before the row lands — see MeterTaskPhase 'settling'. This
 * returns null while there is nothing yet, the client asks again, and if the
 * window closes empty the meter says it cannot tell you rather than showing a
 * zero that reads as "free".
 */

import { z } from 'zod'
import { and, eq, gte, inArray, sum, count } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { aiUsageEvents, geminiKeys } from '@/db/schema'
import { AI_FEATURES, type AiFeatureId } from '@/features/gemini/ai-features'
import { getAiPrefs } from '@/features/gemini/prefs'
import { toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { zonedDayStartMs } from '@/features/meetings/calendar-grid'
import { ok, err, type ActionResult } from '@/lib/action-result'

/**
 * How far back a settle read may look, whatever the client asks for.
 *
 * `since` arrives from the browser, so it is an input, not a fact. The query
 * is already fenced to the caller's own rows — no clamp is protecting anybody
 * else's data — but an unclamped `since` would let a stale tab sweep hours of
 * unrelated calls into one meter and present the total as the cost of the
 * thing just clicked. Two hours because a meeting-hour analysis genuinely
 * runs for many minutes; nothing this app does runs longer.
 */
const MAX_LOOKBACK_MS = 2 * 60 * 60 * 1000

/** Rows one task can plausibly produce: ~13 for a meeting hour. Well clear. */
const MAX_WINDOW_ROWS = 300

const settleInput = z.object({
  featureId: z.enum(AI_FEATURES.map((f) => f.id) as [AiFeatureId, ...AiFeatureId[]]),
  sinceIso: z.iso.datetime(),
})

/**
 * The tier of the key a call actually spent.
 *
 * 'unknown' is a real outcome, not padding. A call that failed before it
 * reached any key writes a ledger row with a null key_id (recordFailure in
 * client.ts), and a key deleted since the call leaves the same null behind.
 * Both join to no tier. Folding those into 'free' would print "nothing
 * charged" over a call whose billing this app cannot see.
 */
export type MeterKeyTier = 'free' | 'paid' | 'unknown'

export type MeterKeyPicture = {
  /** Active keys the caller owns, by the tier the owner declared. */
  ownFree: number
  ownPaid: number
  /**
   * Teammates' ACTIVE SHARED keys that rotation can fall through to once the
   * caller's own are exhausted. Counted, never named: who shares a key is the
   * AI engine card's disclosure to make, not a corner popup's.
   */
  sharedPool: number
}

export type MeterContext = {
  keys: MeterKeyPicture
  /** Per-feature model choice; null means the feature's own default chain. */
  models: Record<AiFeatureId, string | null>
  /** This workspace's own recorded spend since 00:00 Asia/Colombo. */
  today: { calls: number; tokens: number }
}

/**
 * Ledger slugs whose token counts are ESTIMATES, not measurements.
 *
 * `live.session` is the only one, and it is not a rounding matter: the Live
 * API streams browser-direct, so no `usageMetadata` ever reaches this app.
 * mintLiveToken writes `AUDIO_TOKENS_PER_SECOND x the token's TTL` — a
 * reservation for a slice somebody may not use half of — and its own comment
 * states the rule this set exists to keep: every UI that surfaces a
 * live.session row must say "approximately".
 */
const ESTIMATED_TOKEN_SLUGS = new Set<string>(['live.session'])

export type MeterSettlementDto = {
  calls: number
  okCalls: number
  inputTokens: number
  outputTokens: number
  /** The model that answered the most of these calls. */
  model: string | null
  /** Every model that answered — longer than one when a chain fell through. */
  models: string[]
  keyTier: MeterKeyTier
  /** True when every key spent was the caller's own. */
  ownKey: boolean
  /**
   * True when any row here came from a slug whose tokens are estimated rather
   * than reported by Gemini. The card must then say so — the whole point of
   * this meter is that a number nobody measured never appears as one.
   */
  tokensEstimated: boolean
  today: { calls: number; tokens: number }
}

/**
 * Everything the running phase needs, fetched once instead of per task.
 *
 * The running meter is otherwise entirely derivable in the browser — label,
 * chain and published estimate are static registry data — so a round trip per
 * click would add latency to the one moment the UI is meant to feel
 * immediate. The two things it cannot know are which model this user pinned
 * and what keys exist, and neither changes between clicks.
 */
export async function meterContext(): Promise<ActionResult<MeterContext>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')
  const userId = session.user.id

  const [prefs, keys, today] = await Promise.all([
    getAiPrefs(userId),
    db
      .select({ userId: geminiKeys.userId, tier: geminiKeys.tier, shared: geminiKeys.shared })
      .from(geminiKeys)
      .where(eq(geminiKeys.active, true)),
    spentToday(userId),
  ])

  const models = {} as Record<AiFeatureId, string | null>
  for (const feature of AI_FEATURES) models[feature.id] = prefs[feature.id]?.model ?? null

  const own = keys.filter((k) => k.userId === userId)
  return ok({
    keys: {
      ownFree: own.filter((k) => k.tier !== 'paid').length,
      ownPaid: own.filter((k) => k.tier === 'paid').length,
      sharedPool: keys.filter((k) => k.userId !== userId && k.shared).length,
    },
    models,
    today,
  })
}

/**
 * The ledger rows one finished task produced, or null if none have landed.
 *
 * Null is the "ask again" signal, and it is deliberately not an error: the
 * common reason for it is that `after()` has not run yet, which is a normal
 * second of a normal call, not a fault worth reporting to anyone.
 */
export async function meterSettlement(
  featureId: AiFeatureId,
  sinceIso: string,
): Promise<ActionResult<MeterSettlementDto | null>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')
  const userId = session.user.id

  const parsed = settleInput.safeParse({ featureId, sinceIso })
  if (!parsed.success) return err('Bad meter window')

  const feature = AI_FEATURES.find((f) => f.id === parsed.data.featureId)
  if (!feature) return err('Unknown AI feature')

  const asked = new Date(parsed.data.sinceIso).getTime()
  const floor = Date.now() - MAX_LOOKBACK_MS
  const since = new Date(Math.max(asked, floor))

  const [rows, today] = await Promise.all([
    db
      .select({
        feature: aiUsageEvents.feature,
        model: aiUsageEvents.model,
        inputTokens: aiUsageEvents.inputTokens,
        outputTokens: aiUsageEvents.outputTokens,
        status: aiUsageEvents.status,
        keyOwnerId: aiUsageEvents.keyOwnerId,
        keyTier: geminiKeys.tier,
      })
      .from(aiUsageEvents)
      .leftJoin(geminiKeys, eq(aiUsageEvents.keyId, geminiKeys.id))
      .where(
        and(
          eq(aiUsageEvents.userId, userId),
          inArray(aiUsageEvents.feature, [...feature.slugs]),
          gte(aiUsageEvents.createdAt, since),
        ),
      )
      .limit(MAX_WINDOW_ROWS),
    spentToday(userId),
  ])

  if (rows.length === 0) return ok(null)

  // The model that answered MOST of this task's calls, not the first one
  // tried and not the last one seen: a meeting analysis is a dozen segment
  // calls plus one synthesis pass, and naming the synthesis model as "the"
  // model would misattribute both the capability and the bulk of the cost.
  const perModel = new Map<string, number>()
  for (const row of rows) perModel.set(row.model, (perModel.get(row.model) ?? 0) + 1)
  const models = [...perModel.entries()].sort((a, b) => b[1] - a[1]).map(([model]) => model)

  const tiers = new Set(rows.map((r) => (r.keyTier === 'paid' ? 'paid' : r.keyTier === 'free' ? 'free' : 'unknown')))
  // Any paid key in the window means something here bills somebody. Reporting
  // the mixture as 'free' because most of it was free would understate the
  // only part of the figure that is an actual charge.
  const keyTier: MeterKeyTier = tiers.has('paid') ? 'paid' : tiers.has('unknown') ? 'unknown' : 'free'

  return ok({
    calls: rows.length,
    okCalls: rows.filter((r) => r.status === 'ok').length,
    inputTokens: rows.reduce((sum, r) => sum + r.inputTokens, 0),
    outputTokens: rows.reduce((sum, r) => sum + r.outputTokens, 0),
    model: models[0] ?? null,
    models,
    keyTier,
    // A null owner is a row that never reached a key, or one whose key is
    // gone. "Not mine" is the honest floor — the same rule aggregateAiUsage
    // applies for the usage page, so the two cannot disagree.
    ownKey: rows.every((r) => r.keyOwnerId === userId),
    tokensEstimated: rows.some((r) => ESTIMATED_TOKEN_SLUGS.has(r.feature)),
    today,
  })
}

/**
 * This app's own recorded spend since midnight in the team's timezone.
 *
 * A NUMERATOR WITH NO DENOMINATOR, on purpose. Google enforces the free tier
 * per project, per minute and per day, and publishes no endpoint for what is
 * left; the same key used from a script or a second deployment spends quota
 * this table never sees. So this is what LogPup recorded, said as exactly
 * that — and it is why nothing downstream draws a progress bar, which would
 * imply a limit somebody measured.
 */
async function spentToday(userId: string): Promise<{ calls: number; tokens: number }> {
  const dayIso = toIsoDateInTimeZone(new Date())
  const since = new Date(zonedDayStartMs(dayIso))
  const [row] = await db
    .select({
      calls: count(),
      inputTokens: sum(aiUsageEvents.inputTokens).mapWith(Number),
      outputTokens: sum(aiUsageEvents.outputTokens).mapWith(Number),
    })
    .from(aiUsageEvents)
    .where(and(eq(aiUsageEvents.userId, userId), gte(aiUsageEvents.createdAt, since)))
  return {
    calls: row?.calls ?? 0,
    tokens: (row?.inputTokens ?? 0) + (row?.outputTokens ?? 0),
  }
}
