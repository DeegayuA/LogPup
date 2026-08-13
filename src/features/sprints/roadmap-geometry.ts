/**
 * Pure px↔date math behind the live roadmap: dragging a sprint's bar left
 * or right, resizing either edge, and the live tooltip that follows the
 * drag overlay. Kept out of `roadmap.tsx` for the same reason as
 * `sprint-date-range.ts`: it's the part worth unit-testing, and component
 * bodies must stay idempotent.
 *
 * Same "always UTC in, always UTC out" discipline as `sprint-date-range.ts`
 * — the `sprints` table stores plain `date` columns (`yyyy-mm-dd`), and
 * parsing those through `new Date(isoString)` or reading back local getters
 * risks shifting a date by a day depending on the machine's timezone/DST.
 * Every function below parses to UTC y/m/d, does the arithmetic in UTC
 * milliseconds, and formats back out with UTC getters.
 */

/** Month-scale timeline: every day is this many pixels wide, so `roadmap.tsx`'s
 *  month columns stay proportional to their real length and bars line up
 *  exactly. The single source — `roadmap.tsx` imports this rather than
 *  redeclaring it, so the geometry here and the pixels on screen can't drift
 *  apart. */
export const PX_PER_DAY = 4

/** A sprint can never be shorter than this — an edge handle dragged past its
 *  opposite clamps here instead of crossing it (or collapsing to zero/negative
 *  duration, which `sprints.endDate >= sprints.startDate` wouldn't even allow
 *  the server to save). */
export const MIN_SPRINT_DAYS = 1

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

function addDays(iso: string, days: number): string {
  const { y, m, d } = parseIsoDate(iso)
  return toIsoDate(Date.UTC(y, m - 1, d + days))
}

/** Inclusive day count spanning `start`..`end` (same day = 1 day). */
function diffDaysInclusive(start: string, end: string): number {
  const { y: y1, m: m1, d: d1 } = parseIsoDate(start)
  const { y: y2, m: m2, d: d2 } = parseIsoDate(end)
  const ms = Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)
  return Math.round(ms / 86_400_000) + 1
}

/** A drag's raw pixel offset, rounded to the nearest whole calendar day.
 *  `|| 0` normalizes `Math.round`'s `-0` (e.g. `daysFromOffset(-1)`) back to
 *  `0` — a no-op nudge must compare equal to a literal `0`, not fail a
 *  strict `Object.is`-based equality check the way `-0` would. */
export function daysFromOffset(px: number): number {
  return Math.round(px / PX_PER_DAY) || 0
}

/**
 * Moves a sprint's whole range by `days`, holding its duration fixed — the
 * bar-body drag ("shift both dates the same amount"). `days` may be
 * negative (shift earlier) or zero (no-op, same range back).
 */
export function shiftRange(start: string, end: string, days: number): { start: string; end: string } {
  return { start: addDays(start, days), end: addDays(end, days) }
}

/**
 * Drags the START edge by `days`, clamped so it can never reach or pass the
 * end date — a sprint is always at least `MIN_SPRINT_DAYS` day long. The end
 * date is never touched.
 */
export function resizeStart(start: string, end: string, days: number): string {
  const proposed = addDays(start, days)
  const latestAllowed = addDays(end, -(MIN_SPRINT_DAYS - 1))
  return proposed > latestAllowed ? latestAllowed : proposed
}

/**
 * Drags the END edge by `days`, clamped so it can never reach or pass the
 * start date. The start date is never touched.
 */
export function resizeEnd(start: string, end: string, days: number): string {
  const proposed = addDays(end, days)
  const earliestAllowed = addDays(start, MIN_SPRINT_DAYS - 1)
  return proposed < earliestAllowed ? earliestAllowed : proposed
}

export { diffDaysInclusive }
