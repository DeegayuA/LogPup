/**
 * How far along a meeting's processing is, how much longer it has, and how
 * many takes it is made of.
 *
 * WHY THIS FEATURE GETS A TIME ESTIMATE WHEN NO OTHER AI FEATURE DOES.
 * The meter's PACE module estimates from the median duration of past calls to
 * the same feature, and it deliberately exempts meeting analysis: a meeting
 * runs anywhere from five minutes to three hours, so "the median meeting
 * analysis" is a number that describes no meeting anybody actually had.
 *
 * That exemption is right about PACE's denominator and wrong to stop there,
 * because a better one exists HERE and nowhere else. Segments are cut to a
 * fixed target length (SEGMENT_TARGET_MS in recording-segments.ts), so they are
 * near-uniform units of work. Time remaining is therefore segments-left times
 * the seconds-per-segment THIS RUN has actually been achieving — a rate
 * measured from the machine, the network and the model in front of the user,
 * not from a historical average of unlike things. A twenty-minute meeting and
 * a three-hour one converge on their own rate within two segments.
 *
 * Everything here is pure. The counts arrive as data, the clock arrives as a
 * parameter.
 */

export type SegmentState = 'pending' | 'uploading' | 'done' | 'failed'

/** One segment as the progress view needs it. */
export type SegmentSnapshot = {
  index: number
  state: SegmentState
  /**
   * How long this segment took to transcribe, in milliseconds — present only
   * once it is done. This is the ONLY input to the estimate, which is why it
   * is a measurement and not a guess: nothing here models how long a segment
   * "should" take.
   */
  tookMs?: number
}

export type TakeSnapshot = {
  takeIndex: number
  label: string | null
  startedAt: number
  /** Null while still recording — also how an interrupted take is spotted. */
  endedAt: number | null
  segments: readonly SegmentSnapshot[]
}

export type TakeProgress = {
  takeIndex: number
  label: string | null
  startedAt: number
  endedAt: number | null
  total: number
  done: number
  failed: number
  /**
   * Null when nothing has been cut yet — NOT zero. A take whose first segment
   * has not closed has no denominator, and "0%" would claim it had one and was
   * at the bottom of it.
   */
  percent: number | null
  /** Still recording, or still has segments to transcribe. */
  active: boolean
}

/**
 * How many finished segments before a rate is worth quoting.
 *
 * Two. One segment tells you how long one segment took, which on a cold start
 * includes the model warming and the first upload negotiating — a rate built
 * from it alone would overstate the remaining time on every meeting. Two is
 * the smallest number that can disagree with itself, which is what makes a
 * median meaningful at all.
 */
export const MIN_RATE_SAMPLES = 2

/**
 * The observed cost of one segment, as a median over what this run has done.
 *
 * Median, not mean, for the reason it is a median everywhere else in this
 * codebase: one segment that hit a retry storm would drag a mean past every
 * number the user could act on, and the estimate would then be wrong in the
 * direction that matters — telling somebody to wait when they need not.
 */
export function observedMsPerSegment(durations: readonly number[]): number | null {
  const usable = durations.filter((d) => Number.isFinite(d) && d > 0)
  if (usable.length < MIN_RATE_SAMPLES) return null
  const sorted = [...usable].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export type MeetingProcessing = {
  /** Live takes only — a deleted one is not a round this meeting still has. */
  rounds: number
  /** Rounds still recording or still transcribing. */
  roundsActive: number
  takes: TakeProgress[]
  total: number
  done: number
  failed: number
  /**
   * Whole percent, or null when nothing has been cut. Capped at 99 while any
   * work remains: a bar reading 100% beside a spinner is the UI contradicting
   * itself, and the last segment is exactly when somebody is watching.
   */
  percent: number | null
  /**
   * Milliseconds left, or null when there is no honest figure — fewer than
   * MIN_RATE_SAMPLES finished segments, or nothing left to do.
   */
  remainingMs: number | null
  /**
   * True when work remains but no rate has been established yet. The UI's cue
   * to say "working" rather than to show a countdown it would have to invent.
   */
  estimatePending: boolean
}

export function meetingProcessing(takes: readonly TakeSnapshot[]): MeetingProcessing {
  const takeProgress: TakeProgress[] = takes.map((take) => {
    const total = take.segments.length
    const done = take.segments.filter((s) => s.state === 'done').length
    const failed = take.segments.filter((s) => s.state === 'failed').length
    return {
      takeIndex: take.takeIndex,
      label: take.label,
      startedAt: take.startedAt,
      endedAt: take.endedAt,
      total,
      done,
      failed,
      percent: total === 0 ? null : capPercent(done, total),
      active: take.endedAt === null || done + failed < total,
    }
  })

  const total = takeProgress.reduce((sum, t) => sum + t.total, 0)
  const done = takeProgress.reduce((sum, t) => sum + t.done, 0)
  const failed = takeProgress.reduce((sum, t) => sum + t.failed, 0)

  // A failed segment is still outstanding work: it is retried, not abandoned
  // (SEGMENT_UPLOAD_ATTEMPTS), so counting it as finished would promise a
  // finish line the run has not reached.
  const remaining = Math.max(0, total - done)
  const perSegment = observedMsPerSegment(
    takes.flatMap((t) => t.segments.map((s) => s.tookMs).filter((d): d is number => d !== undefined)),
  )

  return {
    rounds: takes.length,
    roundsActive: takeProgress.filter((t) => t.active).length,
    takes: takeProgress,
    total,
    done,
    failed,
    percent: total === 0 ? null : capPercent(done, total),
    remainingMs: remaining === 0 || perSegment === null ? null : Math.round(remaining * perSegment),
    estimatePending: remaining > 0 && perSegment === null,
  }
}

/**
 * Whole percent, held one short of complete until everything really is.
 *
 * The cap is not cosmetic. A meeting's last segment is the one somebody sits
 * and watches, and a bar that reaches 100% while a synthesis pass is still
 * running teaches the reader that the number is decorative — after which none
 * of the honest numbers beside it are believed either.
 */
function capPercent(done: number, total: number): number {
  if (done >= total) return 100
  return Math.min(Math.floor((done / total) * 100), 99)
}

/**
 * The estimate in the words a waiting person reads, or null when there is none.
 *
 * Rounded outward at the low end — "under a minute" rather than a countdown of
 * seconds. A per-second estimate implies a precision the rate does not have,
 * and watching it jump from 12s to 40s when one segment runs slow is worse
 * than not having been told.
 */
export function formatRemaining(ms: number | null): string | null {
  if (ms === null) return null
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return 'under a minute left'
  const minutes = Math.round(seconds / 60)
  if (minutes === 1) return 'about a minute left'
  if (minutes < 60) return `about ${minutes} minutes left`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `about ${hours}h left` : `about ${hours}h ${rest}m left`
}
