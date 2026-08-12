import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'

/**
 * Calendar-day arithmetic on `YYYY-MM-DD` strings.
 *
 * Everything on the person page that answers "is this late, and by how long"
 * compares DAYS, not instants: a task due on the 3rd is overdue the moment the
 * 4th begins in the office, regardless of what hour it is. Doing that with
 * `Date` objects means picking a timezone for every comparison and getting it
 * wrong at least once — which is exactly the bug the activity graph shipped
 * with (SQL bucketed in the server's zone, the JS fill loop keyed off UTC, so
 * on any non-UTC server the two disagreed by a day).
 *
 * So: one representation for a day, `YYYY-MM-DD`, and one place that turns an
 * instant into one (`isoDayOf`, always Asia/Colombo — the business timezone the
 * rest of the product already resolves days in). Lexicographic order on that
 * format IS chronological order, so comparisons need no parsing at all; only
 * arithmetic does, and it goes through UTC midnight where every day is exactly
 * 86,400,000 ms long (no DST to lose an hour to — Asia/Colombo has none either,
 * but the UTC anchor keeps this correct even if that ever changes).
 *
 * Malformed input throws rather than silently sliding a date: every caller
 * either passes a value from a Postgres `date` column or one this module
 * produced, so a bad string here is a bug, and a wrong-but-plausible date is
 * the worst possible way to surface it.
 */

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

/** True when `value` is a well-formed, real calendar day. */
export function isIsoDay(value: string): boolean {
  if (!ISO_DAY.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day))
  // Round-tripping catches "2026-02-31", which Date.UTC happily slides to
  // March 3 instead of rejecting.
  return utc.toISOString().slice(0, 10) === value
}

function toUtcMidnight(iso: string): number {
  if (!isIsoDay(iso)) throw new RangeError(`Not an ISO calendar day: ${iso}`)
  const [year, month, day] = iso.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

/** `iso` shifted by whole days (negative walks backwards). */
export function isoDayAdd(iso: string, days: number): string {
  return new Date(toUtcMidnight(iso) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function isoDayDiff(to: string, from: string): number {
  return Math.round((toUtcMidnight(to) - toUtcMidnight(from)) / DAY_MS)
}

/** The calendar day an instant falls on, in the business timezone. */
export function isoDayOf(date: Date): string {
  return toIsoDateInTimeZone(date, LK_TIMEZONE)
}

/**
 * Every day from `from` to `to` inclusive, ascending. Returns [] when the
 * range is inverted rather than looping forever, and is hard-capped so a
 * corrupt bound can never hang a render.
 */
const MAX_RANGE_DAYS = 1000

export function isoDayRange(from: string, to: string): string[] {
  const span = isoDayDiff(to, from)
  if (span < 0) return []
  const days: string[] = []
  for (let offset = 0; offset <= Math.min(span, MAX_RANGE_DAYS); offset += 1) {
    days.push(isoDayAdd(from, offset))
  }
  return days
}
