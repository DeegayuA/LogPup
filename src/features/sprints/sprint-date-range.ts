/**
 * Pure date-range math for the sprint form dialog.
 *
 * The `sprints` table stores `date` columns, not timestamps, and the
 * <input type="date"> fields in the dialog speak the same `yyyy-mm-dd`
 * format. Every function below stays in that local calendar-date space:
 * strings are parsed into y/m/d components and run through `Date.UTC`,
 * then formatted back out with the matching UTC getters. That
 * "always UTC in, always UTC out" round trip is what avoids timezone
 * drift — using `new Date(isoString)` or a `Date`'s local getters here
 * would risk shifting a date by a day depending on the machine's
 * timezone/DST, which is exactly the class of bug this module exists to
 * avoid. None of this cares what "today" is — that's the caller's job.
 */

/** A sprint defaults to a 7-CALENDAR-DAY span, counted INCLUSIVE of both
 *  endpoints: a sprint starting Monday and running this many days ends
 *  the following Sunday (start + 6 days), not the Monday after. */
export const DEFAULT_SPRINT_DAYS = 7

function parseIsoDate(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

function toIsoDate(utcMs: number): string {
  const date = new Date(utcMs)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Adds (or, with a negative count, subtracts) whole calendar days to `iso`. */
export function addCalendarDays(iso: string, days: number): string {
  const { y, m, d } = parseIsoDate(iso)
  return toIsoDate(Date.UTC(y, m - 1, d + days))
}

/** Signed whole calendar days from `from` to `to` (same day = 0, later = a
 *  positive count). The roadmap converts a pixel drag into this unit before
 *  it touches anything else. */
export function dayDelta(from: string, to: string): number {
  const { y: y1, m: m1, d: d1 } = parseIsoDate(from)
  const { y: y2, m: m2, d: d2 } = parseIsoDate(to)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

/** Inclusive day count spanning `start`..`end` (same day = 1 day). Negative
 *  or zero when `end` is before `start` — callers use that to detect the
 *  invalid range rather than clamping it. */
export function inclusiveDayCount(start: string, end: string): number {
  return dayDelta(start, end) + 1
}

/** The form's default range on open: `today` through
 *  `today + (DEFAULT_SPRINT_DAYS - 1)`, i.e. DEFAULT_SPRINT_DAYS inclusive
 *  calendar days starting today. */
export function defaultSprintRange(today: string): { startDate: string; endDate: string } {
  return { startDate: today, endDate: addCalendarDays(today, DEFAULT_SPRINT_DAYS - 1) }
}

/** Re-anchors the end date to `newStart` while preserving the inclusive
 *  duration between `oldStart` and `oldEnd` — the "move the whole sprint"
 *  behaviour the form applies when the start date changes and the user
 *  hasn't edited the end date themselves. */
export function shiftEndDate(oldStart: string, oldEnd: string, newStart: string): string {
  const durationDays = inclusiveDayCount(oldStart, oldEnd)
  return addCalendarDays(newStart, durationDays - 1)
}

/** Human label for the form's live "N days" duration hint, or null when the
 *  range can't be labelled — either date missing, or end before start (that
 *  case is already surfaced by the form's own inline validation, so the
 *  hint just steps aside instead of showing a zero/negative count). */
export function sprintDurationLabel(startDate: string, endDate: string): string | null {
  if (!startDate || !endDate) return null
  const days = inclusiveDayCount(startDate, endDate)
  if (days < 1) return null
  return `${days} day${days === 1 ? '' : 's'}`
}

export type SprintRange = { startDate: string; endDate: string }

/**
 * Slides a whole sprint by `deltaDays`, keeping its duration exactly. This is
 * what dragging the BODY of a roadmap bar means: the sprint is the same
 * length, it just happens later or earlier. Zero delta returns an equal range
 * so callers can compare and skip a no-op write.
 */
export function moveSprintRange(
  startDate: string,
  endDate: string,
  deltaDays: number,
): SprintRange {
  return {
    startDate: addCalendarDays(startDate, deltaDays),
    endDate: addCalendarDays(endDate, deltaDays),
  }
}

/**
 * Drags the LEFT edge: the start moves, the end stays put.
 *
 * Clamped so the start can never cross its own end — a sprint of negative
 * length is not a state the DB constraint or the UI can represent, and
 * silently swapping the two ends would be a far more surprising outcome than
 * the drag simply stopping. One-day sprints are legal, so the floor is
 * `endDate` itself, not `endDate - 1`.
 */
export function resizeSprintStart(
  startDate: string,
  endDate: string,
  deltaDays: number,
): SprintRange {
  const proposed = addCalendarDays(startDate, deltaDays)
  return { startDate: proposed > endDate ? endDate : proposed, endDate }
}

/** Drags the RIGHT edge: the end moves, the start stays put. Clamped at
 *  `startDate` for the same reason as `resizeSprintStart`. */
export function resizeSprintEnd(
  startDate: string,
  endDate: string,
  deltaDays: number,
): SprintRange {
  const proposed = addCalendarDays(endDate, deltaDays)
  return { startDate, endDate: proposed < startDate ? startDate : proposed }
}

export type SprintStatus = 'planned' | 'active' | 'done'

/**
 * The status a newly created sprint should start in, given its date range
 * and "today" (all three plain yyyy-mm-dd strings in the same calendar-date
 * space as the rest of this module — callers are responsible for computing
 * `today` correctly, e.g. via `toIsoDateInTimeZone(new Date(), LK_TIMEZONE)`
 * from lk-holidays.ts for an Asia/Colombo-correct value).
 *
 * A range that contains today (inclusive of both endpoints) starts 'active'
 * — a sprint that's already running the day it's created shouldn't require
 * a manual status flip to be seen as such. A wholly future range stays
 * 'planned'; a wholly past range (e.g. someone logging a sprint
 * retroactively) starts 'done'.
 */
export function initialSprintStatus(startDate: string, endDate: string, today: string): SprintStatus {
  if (today < startDate) return 'planned'
  if (today > endDate) return 'done'
  return 'active'
}

/**
 * Whether a sprint should read as "running now" to a human looking at the
 * dashboard — status 'active' always counts, and a 'planned' sprint whose
 * date range already contains today counts too (defensive: covers rows
 * created before sprints started auto-activating, and anything a user
 * forgets to flip). A 'done' sprint never counts, even if its range still
 * technically contains today (e.g. someone closed it out early).
 *
 * Reuses `initialSprintStatus`'s "does this range contain today" check
 * rather than reimplementing the inclusive-range comparison.
 */
export function isSprintRunningNow(
  status: SprintStatus,
  startDate: string,
  endDate: string,
  today: string,
): boolean {
  if (status === 'active') return true
  if (status === 'done') return false
  return initialSprintStatus(startDate, endDate, today) === 'active'
}
