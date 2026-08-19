// Pure rollups over grouped ledger rows.
//
// summarizeUsage answers "what did I spend" for one person (Settings).
// summarizeAdoption answers "who uses what" for admins — and deliberately
// lists EVERY registered feature, because the unused rows are the whole
// point of the panel: a feature nobody touched is the one to fix.
//
// Both rollups split the ledger on `status`: a blocked call (recordFailure)
// is an ATTEMPT, counted and reported on its own, never folded into calls,
// tokens, dollars or adoption. Neither may treat a failure as usage.

import { AI_FEATURES, type AiFeatureId } from '@/features/gemini/ai-features'
import { estimateCostUsd } from '@/features/gemini/pricing'

export type UsageAggRow = {
  feature: string
  model: string
  keyTier: string | null
  /**
   * Whether the key that SERVED these calls belongs to the person reading the
   * summary. Rotation falls through to a teammate's org-shared key when the
   * caller's own keys are exhausted, so the serving key's tier says nothing
   * about who Google invoices — only the owner does. Paid charge is gated on
   * this: a teammate's paid key bills the teammate, never the caller.
   */
  isOwnKey: boolean
  /**
   * False for a blocked call (recordFailure writes a row for every one). Those
   * are ATTEMPTS, not usage: they burned no tokens and cost no money, and
   * counting them as usage makes a wholly-failing feature look popular.
   */
  ok: boolean
  calls: number
  inputTokens: number
  outputTokens: number
}

export type FeatureUsageSummary = {
  featureId: AiFeatureId
  /** Successful calls only. */
  calls: number
  /** Calls that were blocked before they ran — shown separately, never as usage. */
  failedCalls: number
  tokens: number
  valueUsd: number
  /** Only what the viewer's OWN paid keys ran — the one figure that is real money. */
  paidChargeUsd: number
  /**
   * Successful calls on a model absent from PRICE_TABLE (a renamed Gemini
   * preview, say). Their tokens are counted but their dollars are unknowable,
   * so they are excluded from valueUsd/paidChargeUsd rather than silently
   * priced at $0 — the caller must say the figures cover priced calls only.
   */
  unpricedCalls: number
}

const SLUG_TO_FEATURE = new Map<string, AiFeatureId>(
  AI_FEATURES.flatMap((f) => f.slugs.map((s) => [s as string, f.id] as const)),
)

export function summarizeUsage(rows: UsageAggRow[], at: Date): FeatureUsageSummary[] {
  const acc = new Map<AiFeatureId, FeatureUsageSummary>()
  for (const row of rows) {
    const featureId = SLUG_TO_FEATURE.get(row.feature)
    if (!featureId) continue // retired slug — old rows must not crash the page
    const entry = acc.get(featureId) ?? {
      featureId,
      calls: 0,
      failedCalls: 0,
      tokens: 0,
      valueUsd: 0,
      paidChargeUsd: 0,
      unpricedCalls: 0,
    }
    acc.set(featureId, entry)
    if (!row.ok) {
      entry.failedCalls += row.calls
      continue // a blocked call spent nothing: no tokens, no value, no charge
    }
    entry.calls += row.calls
    entry.tokens += row.inputTokens + row.outputTokens
    const cost = estimateCostUsd({
      model: row.model,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      at,
    })
    if (cost === null) {
      // "We don't know this model's price" must not read as "it was free".
      entry.unpricedCalls += row.calls
      continue
    }
    entry.valueUsd += cost
    // Paid tier alone is not enough: the row must also be on a key this
    // person owns, or the charge lands on the wrong person's card.
    if (row.isOwnKey && row.keyTier === 'paid') entry.paidChargeUsd += cost
  }
  return [...acc.values()]
}

export function totalsFor(summaries: FeatureUsageSummary[]) {
  return summaries.reduce(
    (t, s) => ({
      calls: t.calls + s.calls,
      failedCalls: t.failedCalls + s.failedCalls,
      tokens: t.tokens + s.tokens,
      valueUsd: t.valueUsd + s.valueUsd,
      paidChargeUsd: t.paidChargeUsd + s.paidChargeUsd,
      unpricedCalls: t.unpricedCalls + s.unpricedCalls,
    }),
    { calls: 0, failedCalls: 0, tokens: 0, valueUsd: 0, paidChargeUsd: 0, unpricedCalls: 0 },
  )
}

export type AdoptionAggRow = {
  feature: string
  /**
   * False for rows recordFailure wrote — one group per failure code. A blocked
   * call proves somebody TRIED the feature, which is worth seeing, but it is
   * the opposite of usage: six people pressing Analyze with no key on file is
   * a feature nobody has used, not a feature six people adopted.
   */
  ok: boolean
  userCount: number
  calls: number
  lastUsedAt: Date | null
}

export type FeatureAdoption = {
  featureId: AiFeatureId
  label: string
  /** People with at least one call that actually ran. */
  users: number
  /** Calls that actually ran. */
  calls: number
  /** Calls blocked before they ran. */
  failedCalls: number
  /** People whose attempts were blocked. Non-zero with users 0 = broken, not unwanted. */
  failedUsers: number
  adoptionPct: number
  lastUsedAt: Date | null
  verdict: 'strong' | 'partial' | 'unused'
}

/** A feature counts as adopted-strongly once half the team has used it. */
const STRONG_ADOPTION_SHARE = 0.5

export function summarizeAdoption(
  rows: AdoptionAggRow[],
  activeUserCount: number,
): FeatureAdoption[] {
  type Entry = {
    users: number
    calls: number
    failedUsers: number
    failedCalls: number
    lastUsedAt: Date | null
  }
  const empty = (): Entry => ({ users: 0, calls: 0, failedUsers: 0, failedCalls: 0, lastUsedAt: null })
  const byFeature = new Map<AiFeatureId, Entry>()
  for (const row of rows) {
    const featureId = SLUG_TO_FEATURE.get(row.feature)
    if (!featureId) continue
    const entry = byFeature.get(featureId) ?? empty()
    byFeature.set(featureId, entry)
    // Distinct-user counts of two slugs (or two failure codes) cannot be
    // added — the same person usually triggers both — so the largest
    // per-group count is the honest floor for "how many people".
    if (!row.ok) {
      entry.failedUsers = Math.max(entry.failedUsers, row.userCount)
      entry.failedCalls += row.calls
      continue
    }
    entry.users = Math.max(entry.users, row.userCount)
    entry.calls += row.calls
    if (row.lastUsedAt && (!entry.lastUsedAt || row.lastUsedAt > entry.lastUsedAt)) {
      entry.lastUsedAt = row.lastUsedAt
    }
  }

  return AI_FEATURES.map((f) => {
    const entry = byFeature.get(f.id) ?? empty()
    const adoptionPct =
      activeUserCount > 0 ? Math.round((entry.users / activeUserCount) * 100) : 0
    const verdict: FeatureAdoption['verdict'] =
      entry.users === 0
        ? 'unused'
        : entry.users >= activeUserCount * STRONG_ADOPTION_SHARE
          ? 'strong'
          : 'partial'
    return {
      featureId: f.id,
      label: f.label,
      users: entry.users,
      calls: entry.calls,
      failedCalls: entry.failedCalls,
      failedUsers: entry.failedUsers,
      adoptionPct,
      lastUsedAt: entry.lastUsedAt,
      verdict,
    }
  })
}
