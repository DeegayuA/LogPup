import { priceForModel } from './pricing'

/**
 * What a live AI meter is allowed to say, at each moment of a call.
 *
 * THE CONSTRAINT THIS MODULE EXISTS FOR: token counts do not exist until the
 * response arrives. `client.ts` reads them from `json.usageMetadata` when the
 * call returns, and there is no streaming client anywhere in this codebase.
 * So a meter showing tokens climbing while a request is in flight is not
 * reporting a measurement — it is animating a number it invented.
 *
 * That is this repo's recurring defect in its most convincing costume. A form
 * that said "Saved" while nothing revalidated, a page advertising a price
 * nothing derived, a panel claiming to re-read on every open: each was copy
 * outrunning its mechanism. A moving progress bar is worse than all of them,
 * because motion reads as evidence.
 *
 * So this decides, per phase, which fields the UI may render — returning
 * nothing for the ones not yet knowable, rather than a zero that looks like a
 * reading.
 */

export type MeterPhase = 'running' | 'done' | 'failed'

/** Real usage, as it arrives with the response. Absent until then. */
export type MeterUsage = {
  inputTokens: number
  outputTokens: number
}

export type MeterInput = {
  /** The AI_FEATURES label, e.g. "Daily briefing". */
  featureLabel: string
  /**
   * The model that ANSWERED, not the first in the fallback chain. A chain can
   * fall through several models, and naming the one tried first misattributes
   * both the cost and the capability.
   */
  model: string | null
  phase: MeterPhase
  /** Milliseconds since the call began — the one thing genuinely live. */
  elapsedMs: number
  /** The feature's own published estimate, e.g. "per meeting hour". */
  estimateLabel: string | null
  /** Present only once the response has returned. */
  usage?: MeterUsage
  /** From gemini_keys.tier. There is no "unlimited": a paid key is metered. */
  keyTier: 'free' | 'paid'
  /** When to price against — rates are effective-dated and promos expire. */
  at: Date
}

export type MeterView = {
  featureLabel: string
  model: string | null
  phase: MeterPhase
  elapsed: string
  /**
   * Shown WHILE RUNNING and only then. It is the feature's published guess,
   * not a measurement, and the UI must label it as one.
   */
  estimateLabel: string | null
  /** Real counts, or null while the answer is still in flight. */
  tokens: { input: number; output: number; total: number } | null
  /**
   * Indicative only: tokens x list price, never a bill. Null whenever tokens
   * are unknown OR the model has no published rate — a missing rate must read
   * as "not known", never as free.
   */
  costUsd: number | null
  /** True whenever a number on screen is inferred rather than measured. */
  indicative: boolean
  /** Who pays. Free-tier keys are not billed; paid keys bill their owner. */
  billing: 'free-tier' | 'billed-to-key-owner'
}

/**
 * Elapsed time at the resolution a person reads, not the resolution a clock
 * has. Milliseconds tick faster than the eye and turn a calm panel into a slot
 * machine; seconds are what someone waiting actually wants.
 */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

/**
 * The whole view, derived rather than assembled by the component.
 *
 * Deriving is what stops the UI filling a gap with a plausible zero: if a field
 * is null here there is no honest value for it yet, and the component's only
 * correct move is to render nothing in its place.
 */
export function meterView(input: MeterInput): MeterView {
  // Usage arriving on a 'running' input is ignored rather than trusted: it
  // cannot exist yet, so something upstream is guessing.
  const usage = input.phase === 'running' ? undefined : input.usage

  const tokens = usage
    ? {
        input: usage.inputTokens,
        output: usage.outputTokens,
        total: usage.inputTokens + usage.outputTokens,
      }
    : null

  /* A model with no published rate yields null, never 0. Zero on a cost line
     reads as "this was free", which is a different and far more comforting
     claim than "we do not know what this cost". */
  const price = tokens && input.model ? priceForModel(input.model, input.at) : null
  const costUsd =
    tokens && price
      ? (tokens.input / 1_000_000) * price.inputPer1M +
        (tokens.output / 1_000_000) * price.outputPer1M
      : null

  return {
    featureLabel: input.featureLabel,
    model: input.model,
    phase: input.phase,
    elapsed: formatElapsed(input.elapsedMs),
    // The estimate is a running-state affordance. Once real numbers exist,
    // showing the guess beside them invites the reader to average two things
    // that are not the same kind of claim.
    estimateLabel: input.phase === 'running' ? input.estimateLabel : null,
    tokens,
    costUsd,
    // Cost is always inferred — list price, not an invoice — so any view
    // carrying one is indicative, and a running view is indicative because the
    // estimate is.
    indicative: costUsd !== null || input.phase === 'running',
    billing: input.keyTier === 'free' ? 'free-tier' : 'billed-to-key-owner',
  }
}

/**
 * What this workspace has spent through THIS app in a period.
 *
 * Deliberately not called "quota remaining", and deliberately returns no
 * denominator. Google enforces the free tier per PROJECT, per minute and per
 * day, and exposes no endpoint for what is left — so a remaining figure would
 * be inferred from local records and wrong the moment the same key is used
 * from anywhere else, including a script or a second deployment.
 *
 * A progress bar needs a denominator it can defend. This returns a numerator
 * and says so, which is the honest shape of the only thing the app knows.
 */
export function localSpend(
  events: readonly { inputTokens: number; outputTokens: number }[],
): { calls: number; tokens: number } {
  return {
    calls: events.length,
    tokens: events.reduce((sum, event) => sum + event.inputTokens + event.outputTokens, 0),
  }
}
