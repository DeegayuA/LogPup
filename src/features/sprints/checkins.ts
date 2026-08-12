// Pure, unit-testable check-in math: what a person's task board says their
// progress is, and how far their self-reported number sits from it. Kept free
// of DB/session/React on purpose, same as sprint-date-range.ts and
// recording-segments.ts — the action layer (checkin-actions.ts) and the
// meeting-prep surface both import these to decide what a check-in MEANS, not
// how to fetch one.

export type TaskForProgress = { assigneeId: string | null; status: string }

export type ComputedProgress = {
  /** This person's tasks with status 'done'. */
  done: number
  /** This person's tasks in the sprint, any status. */
  total: number
  /** Whole-number 0..100, or null when the person has no tasks at all.
   *  Null is load-bearing: "no tasks assigned" and "0% of my tasks done"
   *  are different situations at standup (the first says the BOARD is
   *  missing something, the second says the WORK is), and collapsing them
   *  to 0 would flag every unassigned person as maximally behind. */
  percent: number | null
}

/**
 * What `userId`'s slice of the sprint board says their progress is: done
 * tasks over total tasks, as a rounded whole percentage. Only tasks assigned
 * to this exact person count — unassigned tasks (assigneeId null) belong to
 * nobody's number, not everybody's.
 *
 * Statuses other than 'done' all count as not-done rather than being
 * enumerated: an in-progress task is incomplete for this purpose, and a new
 * status added to the enum later should default to "not finished yet"
 * instead of silently inflating percentages.
 */
export function computeTaskProgress(
  tasks: TaskForProgress[],
  userId: string,
): ComputedProgress {
  const mine = tasks.filter((task) => task.assigneeId !== null && task.assigneeId === userId)
  const done = mine.filter((task) => task.status === 'done').length
  const total = mine.length
  return {
    done,
    total,
    percent: total === 0 ? null : Math.round((done / total) * 100),
  }
}

export type CheckinGap = 'none' | 'ahead' | 'behind' | 'unknown'

/**
 * How far apart a report may sit from the board before it's flagged, in
 * percentage points. Tasks are coarse units — on a five-task sprint one task
 * is 20 points — so a tight threshold would flag people for nothing more
 * than "I finished the code but haven't moved the card yet". 15 points is
 * one task's worth of slack on boards of ~7 tasks or fewer, which is the
 * common sprint size here, while still catching "I'm at 90" against a board
 * that says 40.
 */
export const CHECKIN_GAP_THRESHOLD = 15

/**
 * The standup signal this whole feature exists to surface: does what the
 * person SAYS match what their TASKS say?
 *
 * - 'ahead'   — they report meaningfully more done than the board shows
 *               (often just stale cards, sometimes optimism worth a question)
 * - 'behind'  — they report meaningfully less (the board over-promises:
 *               cards marked done that aren't, or scope they know is coming)
 * - 'none'    — the two agree within the threshold; nothing to raise
 * - 'unknown' — the board has no tasks for them, so there is nothing to
 *               compare against. Deliberately NOT 'none': "we can't tell" and
 *               "they agree" read very differently in meeting prep.
 *
 * Comparison is strict (> threshold, not >=) so a gap of exactly one
 * threshold's width — the documented "one task of slack" — is still 'none'.
 */
export function checkinGap(
  reportedPercent: number,
  computed: { percent: number | null },
): CheckinGap {
  if (computed.percent === null) return 'unknown'
  const delta = reportedPercent - computed.percent
  if (delta > CHECKIN_GAP_THRESHOLD) return 'ahead'
  if (delta < -CHECKIN_GAP_THRESHOLD) return 'behind'
  return 'none'
}
