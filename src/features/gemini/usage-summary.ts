// Pure rollups over grouped ledger rows.
//
// summarizeUsage answers "what did I spend" for one person (Settings).
// summarizeAdoption answers "who uses what" for admins — and deliberately
// lists EVERY registered feature, because the unused rows are the whole
// point of the panel: a feature nobody touched is the one to fix.

import { AI_FEATURES, type AiFeatureId } from '@/features/gemini/ai-features'
import { estimateCostUsd } from '@/features/gemini/pricing'

export type UsageAggRow = {
  feature: string
  model: string
  keyTier: string | null
  calls: number
  inputTokens: number
  outputTokens: number
}

export type FeatureUsageSummary = {
  featureId: AiFeatureId
  calls: number
  tokens: number
  valueUsd: number
  paidChargeUsd: number
}

const SLUG_TO_FEATURE = new Map<string, AiFeatureId>(
  AI_FEATURES.flatMap((f) => f.slugs.map((s) => [s as string, f.id] as const)),
)

export function summarizeUsage(rows: UsageAggRow[], at: Date): FeatureUsageSummary[] {
  const acc = new Map<AiFeatureId, FeatureUsageSummary>()
  for (const row of rows) {
    const featureId = SLUG_TO_FEATURE.get(row.feature)
    if (!featureId) continue // retired slug — old rows must not crash the page
    const cost =
      estimateCostUsd({
        model: row.model,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        at,
      }) ?? 0
    const entry = acc.get(featureId) ?? {
      featureId,
      calls: 0,
      tokens: 0,
      valueUsd: 0,
      paidChargeUsd: 0,
    }
    entry.calls += row.calls
    entry.tokens += row.inputTokens + row.outputTokens
    entry.valueUsd += cost
    if (row.keyTier === 'paid') entry.paidChargeUsd += cost
    acc.set(featureId, entry)
  }
  return [...acc.values()]
}

export function totalsFor(summaries: FeatureUsageSummary[]) {
  return summaries.reduce(
    (t, s) => ({
      calls: t.calls + s.calls,
      tokens: t.tokens + s.tokens,
      valueUsd: t.valueUsd + s.valueUsd,
      paidChargeUsd: t.paidChargeUsd + s.paidChargeUsd,
    }),
    { calls: 0, tokens: 0, valueUsd: 0, paidChargeUsd: 0 },
  )
}

export type AdoptionAggRow = {
  feature: string
  userCount: number
  calls: number
  lastUsedAt: Date | null
}

export type FeatureAdoption = {
  featureId: AiFeatureId
  label: string
  users: number
  calls: number
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
  const byFeature = new Map<AiFeatureId, { users: number; calls: number; lastUsedAt: Date | null }>()
  for (const row of rows) {
    const featureId = SLUG_TO_FEATURE.get(row.feature)
    if (!featureId) continue
    const entry = byFeature.get(featureId) ?? { users: 0, calls: 0, lastUsedAt: null }
    // Distinct-user counts of two slugs cannot be added (the same person
    // usually triggers both), so the largest per-slug count is the honest
    // floor for "how many people touched this feature".
    entry.users = Math.max(entry.users, row.userCount)
    entry.calls += row.calls
    if (row.lastUsedAt && (!entry.lastUsedAt || row.lastUsedAt > entry.lastUsedAt)) {
      entry.lastUsedAt = row.lastUsedAt
    }
    byFeature.set(featureId, entry)
  }

  return AI_FEATURES.map((f) => {
    const entry = byFeature.get(f.id) ?? { users: 0, calls: 0, lastUsedAt: null }
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
      adoptionPct,
      lastUsedAt: entry.lastUsedAt,
      verdict,
    }
  })
}
