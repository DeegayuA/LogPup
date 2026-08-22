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
  /**
   * These token counts are estimates the app wrote, not counts Gemini
   * reported — true for live sessions, which stream browser-direct and never
   * return usageMetadata at all. The card must label them.
   */
  tokensEstimated: boolean
  /** Local, app-only, no denominator — see localSpend in ai-meter.ts. */
  today: { calls: number; tokens: number }
}

/**
 * Real, countable work inside one task — server-acknowledged steps, reported
 * by the call site that owns the count (a meeting's transcribed segments).
 * This is the FIRST of the two denominators the dock's no-progress-bar rule
 * admits; pace (meter-pace.ts) is the second. In-flight tokens and quota
 * remaining stay forbidden — nothing measures either.
 */
export type MeterSteps = {
  done: number
  total: number
  failed: number
}

export type MeterTask = {
  id: string
  featureId: AiFeatureId
  featureLabel: string
  /** Quick / Analysis / Synthesis / Voice / Live — the registry's own grouping. */
  chain: string
  /** The feature's published per-use estimate label, e.g. "per meeting hour". */
  estimateLabel: string | null
  startedAt: number
  /** When the action returned. Null while running. */
  endedAt: number | null
  phase: MeterTaskPhase
  origin: MeterOriginPoint | null
  /**
   * The transform the card starts at, measured against the dock when the task
   * was created — i.e. in the click handler, which is the only moment the
   * button's rect exists AND the only place a ref may be read.
   *
   * Null means no flight: no origin to fly from, or a click that landed on the
   * dock itself.
   */
  flight: { x: number; y: number } | null
  settlement: MeterSettlement | null
  /**
   * True when the settle window closed with no ledger rows for this task.
   * An honest, visible state: the call happened, and this app cannot say what
   * it cost. Silence here would read as "free".
   */
  unrecorded: boolean
  /** The failure the user needs to see, verbatim from the action. */
  error: string | null
  /** Countable progress reported by the call site, or null for the normal
   *  single-opaque-call task. See MeterSteps. */
  steps: MeterSteps | null
  /**
   * This browser's median duration for this feature+model (meter-pace.ts),
   * FROZEN when the task was created: a denominator that shifted mid-run —
   * because a concurrent task of the same feature finished — would move the
   * goalposts of a bar someone is watching.
   */
  typical: { p50: number; samples: number } | null
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
 * Counted from when the CALL RETURNED, never from when the task started:
 * `after()` only runs once the response is sent, so the wait for a row begins
 * at the end. A window anchored to the start would already be spent before the
 * first poll for anything slower than this — which is every meeting write-up
 * there is.
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
 * A call site reporting where its countable work stands.
 *
 * Identity-preserving when nothing changed: reporters fire from render-adjacent
 * effects, and returning the same array for the same numbers is what keeps a
 * re-report from being a re-render of every card in the dock.
 */
export function reportSteps(
  tasks: readonly MeterTask[],
  id: string,
  steps: MeterSteps,
): MeterTask[] {
  const task = tasks.find((t) => t.id === id)
  // THE SAME ARRAY, not a copy: React's setState bails out only on reference
  // equality, so `[...tasks]` here would have been a re-render of every card
  // per identical report — the exact thing this branch exists to prevent.
  // (The cast is safe: the array is returned unmodified.)
  if (!task) return tasks as MeterTask[]
  const current = task.steps
  if (
    current &&
    current.done === steps.done &&
    current.total === steps.total &&
    current.failed === steps.failed
  ) {
    return tasks as MeterTask[]
  }
  return patchTask(tasks, id, { steps })
}

/**
 * Floor, then hold at 99 while anything is outstanding — the same rule as
 * queueProgress in src/features/meetings/segment-queue.ts, restated here
 * because importing meetings into gemini would cross the feature boundary.
 * The duplication is the cheaper debt; the RULE must not drift: a closed bar
 * beside outstanding work is the number somebody walks away on.
 */
export function stepPercent(steps: MeterSteps): number {
  if (steps.total <= 0) return 0
  const raw = Math.floor((steps.done / steps.total) * 100)
  const outstanding = steps.total - steps.done
  return outstanding > 0 ? Math.min(raw, 99) : raw
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
 * The settle window closed with no ledger rows for this task.
 *
 * Sets `unrecorded` rather than inventing a zero-token settlement, because
 * those are different claims: one says the call cost nothing, the other says
 * this app does not know what it cost. Only the second is true.
 *
 * AND it moves the task off 'settling', which is the part that is easy to
 * forget and expensive to get wrong: only a 'done' task is ever swept by
 * expireSettled, so a task left settling would sit in the corner claiming to
 * be reading the ledger for the rest of the session. A failure stays failed —
 * it did not become a success by going unrecorded.
 */
export function closeSettleWindow(tasks: readonly MeterTask[], id: string): MeterTask[] {
  return tasks.map((task) =>
    task.id === id
      ? { ...task, unrecorded: true, phase: task.phase === 'failed' ? 'failed' : 'done' }
      : task,
  )
}

/** Rows the stack renders before overflowing — a 40px row costs a third of a
 *  card, so capacity rises without burying more of the page under the dock. */
export const MAX_VISIBLE_STACK = 5

export type DockView = {
  /** Newest first — the one that just started is the one being waited on. */
  visible: MeterTask[]
  /** Real tasks the dock is carrying but not rendering. Never dropped. */
  hiddenCount: number
  runningCount: number
  failedCount: number
  /** Nothing to show; the dock renders no chrome at all. */
  empty: boolean
  /**
   * One task renders as today's full card; two or more collapse to rows with
   * one expanded, because three stacked cards bury the page the dock is
   * required not to. The rule lives here so a component under layout pressure
   * has to change it on purpose.
   */
  density: 'cards' | 'stack'
  /**
   * Which task the stack opens with: the first visible one — failures sort
   * ahead of everything and newest-first breaks ties, so this is "the thing
   * most worth looking at". A person's own click overrides it in the dock.
   */
  defaultExpandedId: string | null
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
  const ordered = [...tasks].sort((a, b) => {
    const aFailed = a.phase === 'failed' ? 1 : 0
    const bFailed = b.phase === 'failed' ? 1 : 0
    if (aFailed !== bFailed) return bFailed - aFailed
    return b.startedAt - a.startedAt
  })
  const density: DockView['density'] = ordered.length >= 2 ? 'stack' : 'cards'
  const maxVisible = opts.maxVisible ?? (density === 'stack' ? MAX_VISIBLE_STACK : MAX_VISIBLE_TASKS)
  const visible = ordered.slice(0, maxVisible)
  return {
    visible,
    hiddenCount: Math.max(0, ordered.length - visible.length),
    runningCount: tasks.filter((t) => t.phase === 'running' || t.phase === 'settling').length,
    failedCount: tasks.filter((t) => t.phase === 'failed').length,
    empty: tasks.length === 0,
    density,
    defaultExpandedId: density === 'stack' ? (visible[0]?.id ?? null) : null,
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
/**
 * A card's nominal height, used only to aim the flight.
 *
 * The dock's anchor is a zero-height placeholder: it gives an exact x and a
 * top, but no centre. This supplies the missing half, and is approximate on
 * purpose — the card is laid out at its real position from the first frame and
 * only ever moves by `transform`, so being a few pixels out changes where the
 * flight STARTS, never where anything ends up.
 */
export const CARD_FLIGHT_HEIGHT = 88

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
