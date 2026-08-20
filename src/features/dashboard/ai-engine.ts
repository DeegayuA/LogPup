// The dashboard's AI engine roll-up: which Gemini model actually serves each
// feature FOR THIS PERSON, what Google lists that model at, and what their own
// last-30-days ledger says it came to.
//
// Every figure here is already true somewhere else — the chain comes from
// model-choice.ts, the rate from pricing.ts, the counts from the ledger. This
// file invents nothing; it only JOINS them, which is exactly where a dashboard
// usually starts making numbers up. Keeping the join pure is what lets a test
// pin the honest cases: an unpriced model must not read as free, a feature
// switched off must not read as unused, and a model the user pinned must be
// named as pinned rather than presented as the product's choice.

import {
  AI_FEATURES,
  MODEL_CHOICES,
  estimatePerUseCostUsd,
  type AiFeatureId,
} from '@/features/gemini/ai-features'
import { resolveChain } from '@/features/gemini/model-choice'
import type { AiPrefValue } from '@/features/gemini/prefs'
import { priceForModel, type ModelPrice } from '@/features/gemini/pricing'
import type { FeatureUsageSummary } from '@/features/gemini/usage-summary'

/**
 * What kind of promise a model id carries, straight from MODEL_CHOICES.
 *
 * `unlisted` is the fourth state and it is not a bug: a feature's DEFAULT
 * chain may lead with a model the per-feature picker does not offer (the
 * picker is a curated catalog, the chain is what the call sites pass). Saying
 * "unlisted" is honest; silently calling it stable would not be.
 */
export type ModelStability = 'stable' | 'preview' | 'alias' | 'unlisted'

type ModelFacts = { label: string; stability: ModelStability }

/**
 * Built once from the same catalog the pickers render, across all three
 * kinds — a model id means the same thing whichever feature reached it.
 */
const MODEL_FACTS = new Map<string, ModelFacts>(
  Object.values(MODEL_CHOICES).flatMap((choices) =>
    choices.map((c) => [c.id, { label: c.label, stability: c.stability as ModelStability }] as const),
  ),
)

/** Human label for a model id, falling back to the id itself — never a guess. */
export function modelFactsFor(model: string): ModelFacts {
  return MODEL_FACTS.get(model) ?? { label: model, stability: 'unlisted' }
}

/**
 * What a feature with no resolvable chain reads as.
 *
 * This is a REAL state, not a defensive nicety. AI_FEATURES and
 * model-choice.ts's DEFAULT_CHAIN are two hand-maintained maps over the same
 * ids, edited by different people on different days, and a feature registered
 * in one but not yet the other has already happened. When it does, this panel
 * must say "not routed" — which is exactly the fact worth surfacing — rather
 * than throw and take the whole dashboard zone down with it.
 *
 * `defaultChainFor` now THROWS on that gap rather than returning undefined
 * (model-choice.ts, deliberately: the Record's type lies at runtime and a bare
 * spread of undefined named neither the feature nor the file). That is the
 * right behaviour for an AI action, where the request must fail. It is the
 * wrong behaviour for THIS panel, whose job is to report on every registered
 * feature including the broken ones — so the throw is caught per row. A
 * dashboard that dies because one of eight features is mis-wired tells the
 * reader nothing about the other seven.
 */
const UNROUTED: ModelFacts = { label: 'Not routed', stability: 'unlisted' }

export type AiEngineRow = {
  featureId: AiFeatureId
  label: string
  description: string
  /** Registry chain name — Quick / Analysis / Synthesis / Voice / Live. */
  chain: string
  /** False when the user switched this feature off in Settings. */
  enabled: boolean
  /**
   * The model this person's next call to this feature would actually try
   * first, or null when no chain is registered for it at all.
   */
  model: string | null
  modelLabel: string
  stability: ModelStability
  /** True when that first model is the user's own pin rather than the default. */
  pinned: boolean
  /** How many more models sit behind it before the call gives up. */
  fallbacks: number
  /** Google's list price for the serving model, or null when unpublished. */
  price: ModelPrice | null
  /** Indicative cost of one representative use, under this person's choice. */
  perUseUsd: number | null
  /** What "one use" means for this feature — "per meeting hour", "per draft". */
  perUseLabel: string
  /** Successful calls in the window. */
  calls: number
  /** Calls blocked before they ever reached Google. */
  failedCalls: number
  tokens: number
  valueUsd: number
  /** Successful calls on a model with no published price — unknown, not zero. */
  unpricedCalls: number
}

/**
 * One row per registered feature, ALWAYS — the unused rows are half the point
 * of the panel, the same argument summarizeAdoption makes for admins. A
 * feature nobody ran still tells you what it would run on and what that costs.
 */
export function buildAiEngineRows(args: {
  prefs: Record<AiFeatureId, AiPrefValue>
  summaries: FeatureUsageSummary[]
  at: Date
}): AiEngineRow[] {
  const { prefs, summaries, at } = args
  const used = new Map(summaries.map((s) => [s.featureId, s]))

  return AI_FEATURES.map((feature) => {
    // `?? { enabled: true, model: null }` mirrors resolvePrefs' documented
    // absent-means-default contract rather than trusting the map to be total:
    // a stale id off the wire must not report an enabled feature as off.
    const pref = prefs[feature.id] ?? { enabled: true, model: null }
    const chain = chainFor(feature.id, pref.model)
    const model = chain[0] ?? null
    const facts = model ? modelFactsFor(model) : UNROUTED
    const stats = used.get(feature.id)

    return {
      featureId: feature.id,
      label: feature.label,
      description: feature.description,
      chain: feature.chain,
      enabled: pref.enabled,
      model,
      modelLabel: facts.label,
      stability: facts.stability,
      // Not `pref.model !== null`: a user who pinned exactly the default has
      // not overridden anything, and badging that as "pinned" would invite
      // them to go un-pin a choice that changes nothing.
      //
      // Suppressed entirely when the feature is unrouted. The row already says
      // "wiring gap, not a setting"; a Pinned badge beside it points the reader
      // straight at the one thing they could change that would NOT help.
      pinned: model !== null && pref.model !== null && pref.model !== defaultLeadFor(feature.id),
      fallbacks: Math.max(0, chain.length - 1),
      price: model ? priceForModel(model, at) : null,
      // Null when unrouted, NOT the registry estimate. estimatePerUseCostUsd
      // prices the static token shape on `estimate.tokens.model`, which is
      // independent of the chain — so an unroutable feature would otherwise
      // quote a confident "≈$0.0028 per draft" for work that cannot run at
      // all. That is precisely the made-up-figure-in-a-mono-column this card
      // exists to avoid.
      perUseUsd: model ? estimatePerUseCostUsd(feature.estimate, pref.model, at) : null,
      perUseLabel: feature.estimate.label,
      calls: stats?.calls ?? 0,
      failedCalls: stats?.failedCalls ?? 0,
      tokens: stats?.tokens ?? 0,
      valueUsd: stats?.valueUsd ?? 0,
      unpricedCalls: stats?.unpricedCalls ?? 0,
    }
  })
}

/**
 * resolveChain, reduced to a value this panel can render.
 *
 * Both failure shapes collapse to an empty chain: the throw defaultChainFor
 * raises for an unregistered feature, and a bare undefined (what the same gap
 * produced before that guard existed, and what any future caller returning one
 * would produce again). Neither is re-raised — see UNROUTED.
 */
function chainFor(featureId: AiFeatureId, chosenModel: string | null): readonly string[] {
  try {
    return resolveChain(featureId, chosenModel) ?? []
  } catch {
    return []
  }
}

/** The model a feature leads with when the user has chosen nothing. */
function defaultLeadFor(featureId: AiFeatureId): string | null {
  return chainFor(featureId, null)[0] ?? null
}

/**
 * Reading order: what this person actually uses, most-used first, then the
 * rest in registry order. Ties break on tokens then label so the list is
 * stable between renders — a table whose rows reshuffle on equal counts reads
 * as live data changing when nothing changed.
 */
export function sortAiEngineRows(rows: AiEngineRow[]): AiEngineRow[] {
  const order = new Map(AI_FEATURES.map((f, i) => [f.id as AiFeatureId, i]))
  return [...rows].sort((a, b) => {
    if (a.calls !== b.calls) return b.calls - a.calls
    if (a.tokens !== b.tokens) return b.tokens - a.tokens
    return (order.get(a.featureId) ?? 0) - (order.get(b.featureId) ?? 0)
  })
}

export type AiEngineTotals = {
  /** Features with at least one successful call in the window. */
  featuresUsed: number
  /** Features registered — the denominator, so "2 of 8" can be said. */
  featuresTotal: number
  /** Features the user has switched off. */
  featuresOff: number
  /** Distinct models the person's own settings currently route to. */
  modelsInUse: number
  /** Features whose serving model is a preview id Google can retire. */
  previewFeatures: number
  /** Features whose serving model has no published price. */
  unpricedFeatures: number
  /** Features registered with no model chain at all — a wiring gap, not a choice. */
  unroutedFeatures: number
}

export function aiEngineTotals(rows: AiEngineRow[]): AiEngineTotals {
  return {
    featuresUsed: rows.filter((r) => r.calls > 0).length,
    featuresTotal: rows.length,
    featuresOff: rows.filter((r) => !r.enabled).length,
    // Unrouted features contribute no model — counting `null` as one would
    // report a broken feature as a routing destination.
    modelsInUse: new Set(rows.map((r) => r.model).filter((m): m is string => m !== null)).size,
    previewFeatures: rows.filter((r) => r.stability === 'preview').length,
    unpricedFeatures: rows.filter((r) => r.model !== null && r.price === null).length,
    unroutedFeatures: rows.filter((r) => r.model === null).length,
  }
}

/**
 * Token counts, shortened. A dashboard column of seven-digit integers is a
 * column nobody reads; the exact figure stays available as the tile's meta
 * line, so nothing is lost by rounding the headline.
 */
export function formatTokenCount(tokens: number): string {
  // Rounded in INTEGER space, then formatted — never `(n / 1e6).toFixed(1)`.
  // toFixed rounds half away from zero on the DECIMAL it is handed, but the
  // decimal it is handed is a binary float: 1.45 is stored as
  // 1.4499999999999999556, genuinely below the halfway point, so 1_450_000
  // formats as "1.4M" while 2_450_000 formats as "2.5M". Two same-shaped
  // inputs disagreeing is the kind of display bug nobody can reproduce.
  // Scaling to tenths first puts the rounding on an exact integer division.
  if (tokens >= 1_000_000) return `${(Math.round(tokens / 100_000) / 10).toFixed(1)}M`
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}k`
  return String(tokens)
}

/**
 * "$0.75 / $3.75 per 1M" — the two halves of a rate belong together; input
 * alone is the number that makes an output-heavy feature look cheap.
 * Null price returns null, never "$0.00": see pricing.ts's contract.
 */
export function formatRate(price: ModelPrice | null): string | null {
  if (!price) return null
  return `$${trimRate(price.inputPer1M)} in / $${trimRate(price.outputPer1M)} out · 1M`
}

function trimRate(value: number): string {
  return value.toFixed(2).replace(/\.00$/, '')
}
