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
function addDays(iso: string, days: number): string {
  const { y, m, d } = parseIsoDate(iso)
  return toIsoDate(Date.UTC(y, m - 1, d + days))
}

/** Inclusive day count spanning `start`..`end` (same day = 1 day). Negative
 *  or zero when `end` is before `start` — callers use that to detect the
 *  invalid range rather than clamping it. */
function diffDaysInclusive(start: string, end: string): number {
  const { y: y1, m: m1, d: d1 } = parseIsoDate(start)
  const { y: y2, m: m2, d: d2 } = parseIsoDate(end)
  const ms = Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)
  return Math.round(ms / 86_400_000) + 1
}

/** The form's default range on open: `today` through
 *  `today + (DEFAULT_SPRINT_DAYS - 1)`, i.e. DEFAULT_SPRINT_DAYS inclusive
 *  calendar days starting today. */
export function defaultSprintRange(today: string): { startDate: string; endDate: string } {
  return { startDate: today, endDate: addDays(today, DEFAULT_SPRINT_DAYS - 1) }
}

/** Re-anchors the end date to `newStart` while preserving the inclusive
 *  duration between `oldStart` and `oldEnd` — the "move the whole sprint"
 *  behaviour the form applies when the start date changes and the user
 *  hasn't edited the end date themselves. */
export function shiftEndDate(oldStart: string, oldEnd: string, newStart: string): string {
  const durationDays = diffDaysInclusive(oldStart, oldEnd)
  return addDays(newStart, durationDays - 1)
}

/** Human label for the form's live "N days" duration hint, or null when the
 *  range can't be labelled — either date missing, or end before start (that
 *  case is already surfaced by the form's own inline validation, so the
 *  hint just steps aside instead of showing a zero/negative count). */
export function sprintDurationLabel(startDate: string, endDate: string): string | null {
  if (!startDate || !endDate) return null
  const days = diffDaysInclusive(startDate, endDate)
  if (days < 1) return null
  return `${days} day${days === 1 ? '' : 's'}`
}
