/**
 * The set of AI calls the live meter is currently accountable for.
 *
 * `ai-meter.ts` decides what ONE call may honestly say at a given moment.
 * This decides what happens when there are several of them, which is the
 * normal case rather than the corner: a meeting analyses for minutes while
 * someone drafts a worklog note, asks the workspace a question and hits read
 * aloud. A dock built around a single in-flight task would either drop those
 * or lie about which one it is showing.
 *
 * Kept pure and free of React for the usual reason, and one extra: the rules
 * below are the ones a component is most tempted to fudge under layout
 * pressure — "just show the newest", "just auto-hide the errors so the corner
 * stays tidy". Written here they are testable, and a change to them is a
 * change somebody has to make on purpose.
 */

import type { AiFeatureId } from './ai-features'
import type { MeterPhase, MeterUsage } from './ai-meter'

/**
 * A fourth phase the single-call view does not need.
 *
 * `recordAiUsage` (usage.ts) schedules its insert through `after()`, so the
 * server action returns BEFORE the ledger row exists. That gap is real, it is
 * the only place the app can read token counts from, and it is not "running"
 * (the model has answered) nor "done" (nothing has been read back yet).
 * Naming it is what stops the UI filling the gap with a zero.
 */
export type MeterTaskPhase = MeterPhase | 'settling'

/** Where the flight starts: the triggering control's centre, in viewport coordinates. */
export type MeterOriginPoint = { x: number; y: number }

/**
 * What this app recorded for one task, read back from its own ledger.
 *
 * Not what Gemini charged, and never described as such: these are the rows
 * `ai_usage_events` holds for this user and this feature's slugs since the
 * task began, which is also exactly what Settings reports. One source, so the
 * meter and the usage page cannot disagree about the same call.
 */
export type MeterSettlement = {
  calls: number
  okCalls: number
  usage: MeterUsage
  /** The model that answered the most of this task's calls. */
  model: string | null
  /** Every model that answered, when a fallback chain fell through mid-task. */
  models: string[]
  /**
   * 'unknown' is a real answer: a call that failed before reaching a key
   * records a null key_id, and so does a key deleted since. See MeterInput's
   * note in ai-meter.ts — neither may be folded into 'free'.
   */
  keyTier: 'free' | 'paid' | 'unknown'
  /** Whether the key spent belonged to the caller, or a teammate's shared one. */
  ownKey: boolean
  /** Local, app-only, no denominator — see localSpend in ai-meter.ts. */
  today: { calls: number; tokens: number }
}

export type MeterTask = {
  id: string
  featureId: AiFeatureId
  featureLabel: string
  /** Quick / Analysis / Synthesis / Voice / Live — the registry's own grouping. */
  chain: string
  /** The feature's published per-use estimate label, e.g. "per meeting hour". */
  estimateLabel: string | null
  /** The feature's published per-use estimate in dollars, or null if unpriced. */
  estimateUsd: number | null
  /** The model this task will ask for first — a request, not a result. */
  requestedModel: string | null
  startedAt: number
  /** When the action returned. Null while running. */
  endedAt: number | null
  phase: MeterTaskPhase
  origin: MeterOriginPoint | null
  settlement: MeterSettlement | null
  /**
   * True when the settle window closed with no ledger rows for this task.
   * An honest, visible state: the call happened, and this app cannot say what
   * it cost. Silence here would read as "free".
   */
  unrecorded: boolean
  /** The failure the user needs to see, verbatim from the action. */
  error: string | null
}

/**
 * How many meters the dock renders before it collapses the rest to a count.
 *
 * Three because the dock sits over page content it must not bury, and because
 * past three the individual numbers stop being read anyway. The overflow is
 * counted, never dropped — see dockView.
 */
export const MAX_VISIBLE_TASKS = 3

/**
 * A finished, successful meter stays this long, then leaves on its own.
 *
 * Long enough to read a token count and a cost without hurrying, short enough
 * that a busy morning does not silt the corner up. Failures are excluded
 * deliberately (see expireSettled): an error nobody dismissed is an error
 * nobody has seen.
 */
export const DONE_LINGER_MS = 12_000

/**
 * How long to keep asking the ledger for a finished task's rows.
 *
 * `after()` normally lands within a second; this is generous enough to cover a
 * slow insert and short enough that "we cannot say" arrives while the person
 * is still looking. Past it the task is marked `unrecorded` rather than left
 * spinning, because an indefinite "reading…" is just a spinner that lies.
 */
export const SETTLE_WINDOW_MS = 15_000

export function addTask(tasks: readonly MeterTask[], task: MeterTask): MeterTask[] {
  return [...tasks, task]
}

export function patchTask(
  tasks: readonly MeterTask[],
  id: string,
  patch: Partial<MeterTask>,
): MeterTask[] {
  return tasks.map((task) => (task.id === id ? { ...task, ...patch } : task))
}

export function dismissTask(tasks: readonly MeterTask[], id: string): MeterTask[] {
  return tasks.filter((task) => task.id !== id)
}

/**
 * Drops finished, SUCCESSFUL meters once they have had their moment.
 *
 * `paused` is what a pointer resting on the dock does: someone reading a cost
 * is not someone who wants the number to vanish mid-sentence. Failures never
 * expire on any timer — the only way one leaves is somebody dismissing it,
 * which is the difference between reporting an error and disposing of one.
 */
export function expireSettled(
  tasks: readonly MeterTask[],
  now: number,
  opts: { lingerMs?: number; paused?: boolean } = {},
): MeterTask[] {
  if (opts.paused) return [...tasks]
  const lingerMs = opts.lingerMs ?? DONE_LINGER_MS
  return tasks.filter((task) => {
    if (task.phase !== 'done') return true
    if (task.endedAt === null) return true
    return now - task.endedAt < lingerMs
  })
}

/**
 * A finished task with no ledger rows to show for it.
 *
 * Returns `unrecorded` rather than inventing a zero-token settlement, because
 * those are different claims: one says the call cost nothing, the other says
 * this app does not know what it cost. Only the second is true.
 */
export function markUnrecorded(tasks: readonly MeterTask[], id: string): MeterTask[] {
  return patchTask(tasks, id, { unrecorded: true })
}

export type DockView = {
  /** Newest first — the one that just started is the one being waited on. */
  visible: MeterTask[]
  /** Real tasks the dock is carrying but not rendering. Never dropped. */
  hiddenCount: number
  runningCount: number
  failedCount: number
  /** Nothing to show; the dock renders no chrome at all. */
  empty: boolean
}

/**
 * What the dock renders, given everything it is tracking.
 *
 * Ordering is newest-first and the overflow falls off the OLD end, so the
 * meter someone just triggered is always the one they can see. Failures are
 * pulled to the front of that order regardless of age: a hidden error is the
 * one outcome the dock exists to prevent.
 */
export function dockView(
  tasks: readonly MeterTask[],
  opts: { maxVisible?: number } = {},
): DockView {
  const maxVisible = opts.maxVisible ?? MAX_VISIBLE_TASKS
  const ordered = [...tasks].sort((a, b) => {
    const aFailed = a.phase === 'failed' ? 1 : 0
    const bFailed = b.phase === 'failed' ? 1 : 0
    if (aFailed !== bFailed) return bFailed - aFailed
    return b.startedAt - a.startedAt
  })
  const visible = ordered.slice(0, maxVisible)
  return {
    visible,
    hiddenCount: Math.max(0, ordered.length - visible.length),
    runningCount: tasks.filter((t) => t.phase === 'running' || t.phase === 'settling').length,
    failedCount: tasks.filter((t) => t.phase === 'failed').length,
    empty: tasks.length === 0,
  }
}

/**
 * The flight vector, as a transform from the dock back to the button.
 *
 * Returned as a delta the card starts at and animates AWAY from, so the card
 * is laid out at its final position from the first frame and only ever moves
 * via `transform` — never `top`/`left`/`width`, which would relayout the page
 * sixty times a second for decoration.
 *
 * Null whenever there is no honest origin (a keyboard shortcut, a background
 * retry, a task started while the tab was hidden). The dock's answer to that
 * is to appear in place, not to fly in from a corner it made up.
 */
export function flightDelta(
  origin: MeterOriginPoint | null,
  dock: { left: number; top: number; width: number; height: number } | null,
): { x: number; y: number } | null {
  if (!origin || !dock) return null
  const dockCentreX = dock.left + dock.width / 2
  const dockCentreY = dock.top + dock.height / 2
  const x = origin.x - dockCentreX
  const y = origin.y - dockCentreY
  // A click that landed within a few pixels of the dock has no flight worth
  // animating; treating it as one produces a twitch, not a movement.
  if (Math.abs(x) < 8 && Math.abs(y) < 8) return null
  return { x, y }
}
