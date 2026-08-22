import type { AiFeatureId } from '@/features/gemini/ai-features'
import type { MeterSteps } from '@/features/gemini/meter-tasks'

/**
 * Pace: the one honest way to put a percentage on an opaque AI call.
 *
 * Gemini reports no progress and Google publishes no quota remaining — the
 * two forbidden denominators ai-meter.ts exists to refuse. What IS measured,
 * by this app itself, is how long its own past calls of the same feature
 * took: the provider clocks every task it tracks. A median of those is a
 * defensible denominator for "percent of typical" — which is a claim about
 * PACE, never about completion, and every rendering of it says so ("of
 * typical", "~15s left", never "complete").
 *
 * Pure. The ring buffers live in localStorage (per browser, and labelled as
 * such in the UI — "median of your last N runs (this browser)"); the provider
 * owns the IO, this owns every rule worth testing.
 */

/** Enough for a stable median, small enough to track a model change quickly. */
export const MAX_DURATION_SAMPLES = 12

/** Below this, no pace line at all — two runs are an anecdote, not a typical. */
export const MIN_PACE_SAMPLES = 3

/**
 * Features whose duration has no "typical". A meeting write-up scales with
 * the meeting (it has REAL steps instead) and a live session runs as long as
 * the conversation does; a median for either would be fiction with a unit.
 */
export const PACE_EXEMPT: ReadonlySet<AiFeatureId> = new Set<AiFeatureId>([
  'meeting-intel',
  'live-captions',
])

/**
 * Keyed by `${featureId}:${model ?? 'default'}` — a pinned Pro model must not
 * inherit Flash's typical; they differ severalfold and the mislabel would
 * survive until the ring buffer turned over.
 */
export type DurationHistory = Record<string, number[]>

export function paceKey(featureId: AiFeatureId, model: string | null): string {
  return `${featureId}:${model ?? 'default'}`
}

/**
 * One finished task's duration, into that feature's ring buffer. Failures are
 * never recorded — their duration measures the error path (retries, backoff,
 * a dead key), and feeding them in would teach the meter that failing slowly
 * is normal.
 */
export function recordDuration(
  history: DurationHistory,
  key: string,
  ms: number,
): DurationHistory {
  if (!Number.isFinite(ms) || ms <= 0) return history
  const next = [...(history[key] ?? []), Math.round(ms)]
  return { ...history, [key]: next.slice(-MAX_DURATION_SAMPLES) }
}

/** Median of this browser's own completed runs, or null while too few exist. */
export function typicalMs(
  history: DurationHistory,
  key: string,
): { p50: number; samples: number } | null {
  const samples = history[key] ?? []
  if (samples.length < MIN_PACE_SAMPLES) return null
  const sorted = [...samples].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const p50 = sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
  return { p50, samples: samples.length }
}

export type PaceView = {
  /** 0–99. Held below 100 for the same reason queueProgress holds it: a
   *  closed bar is a claim of completion, and pace can never make one. */
  percent: number
  /** Milliseconds to typical, or null once elapsed passes it — never zero,
   *  never negative, because a countdown that hits zero and keeps running has
   *  already lied once. Formatting happens in ai-meter.ts (type-only imports
   *  here keep gemini's view modules cycle-free). */
  remainingMs: number | null
  overrun: boolean
}

export function paceView(elapsedMs: number, p50: number): PaceView {
  if (p50 <= 0) return { percent: 0, remainingMs: null, overrun: false }
  const overrun = elapsedMs > p50
  return {
    percent: Math.min(Math.floor((elapsedMs / p50) * 100), 99),
    remainingMs: overrun ? null : p50 - elapsedMs,
    overrun,
  }
}

/**
 * ETA for a task with REAL steps, from the rate this task itself has shown:
 * elapsed over done, times what's left. Needs two finished steps — one is a
 * sample, not a rate — and the rendering must carry "at this pace", which is
 * the honest name of the inference.
 */
export function stepsRemainingMs(steps: MeterSteps, elapsedMs: number): number | null {
  if (steps.done < 2 || elapsedMs <= 0) return null
  const outstanding = steps.total - steps.done - steps.failed
  if (outstanding <= 0) return null
  return Math.round((elapsedMs / steps.done) * outstanding)
}

const STORAGE_KEY = 'logpup.ai-meter.durations.v1'

/** The provider's localStorage codec — every caller wraps IO in try/catch. */
export const durationStorage = {
  key: STORAGE_KEY,
  parse(raw: string | null): DurationHistory {
    if (!raw) return {}
    try {
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null) return {}
      const out: DurationHistory = {}
      for (const [key, value] of Object.entries(parsed)) {
        if (!Array.isArray(value)) continue
        const numbers = value.filter((v): v is number => Number.isFinite(v) && v > 0)
        if (numbers.length > 0) out[key] = numbers.slice(-MAX_DURATION_SAMPLES)
      }
      return out
    } catch {
      return {}
    }
  },
  serialize(history: DurationHistory): string {
    return JSON.stringify(history)
  },
}
