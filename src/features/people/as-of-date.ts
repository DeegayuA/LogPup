import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'

/**
 * Turns the `?at=YYYY-MM-DD` query param on the team-history page into the
 * instant the "as of" query runs against.
 *
 * Three decisions worth stating, because all three are visible to the user:
 *
 *  - a day resolves to its END (23:59:59.999), not its start. "How did the
 *    team look on the 3rd" means after that day's changes, not before them —
 *    resolving to midnight would render the 3rd as if it were the 2nd, and a
 *    change made on the day you picked would be invisible.
 *  - the future is clamped to now. There is no history past the present, so
 *    a stale bookmark or a fat-fingered year renders today rather than an
 *    empty page that looks like data loss.
 *  - a "day" is a day in Asia/Colombo (LK_TIMEZONE), the business timezone
 *    the rest of the product already resolves days in (sprints, holidays,
 *    the mini calendar). Deriving it from `toISOString()` instead made the
 *    picker read yesterday for the 5.5 hours after local midnight — the
 *    control would grey out the very day the heading above it called
 *    "today". The instants stored in the DB are unaffected; only the
 *    mapping between a calendar day and an instant lives here.
 */
export type ResolvedAsOf = {
  /** The instant to query. */
  at: Date
  /** Normalised YYYY-MM-DD for the date input and for building links. */
  iso: string
  /** True when the resolved day is today — i.e. "live", not history. */
  isToday: boolean
  /** True when the raw param was present but unusable, so the UI can say so. */
  invalid: boolean
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** Asia/Colombo is UTC+05:30 year-round — no DST, so one fixed offset is exact. */
const LK_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

/** The calendar day `date` falls on in the business timezone. */
function isoDay(date: Date): string {
  return toIsoDateInTimeZone(date, LK_TIMEZONE)
}

export function resolveAsOf(raw: string | undefined, now: Date = new Date()): ResolvedAsOf {
  const today = isoDay(now)
  if (!raw) return { at: now, iso: today, isToday: true, invalid: false }

  if (!ISO_DAY.test(raw)) return { at: now, iso: today, isToday: true, invalid: true }

  // Date.UTC round-trips through the parsed parts, so "2026-02-31" comes back
  // as March 3 and fails this identity check instead of silently sliding.
  // Subtracting the offset turns 23:59:59.999 *local* into the instant it
  // actually is — which is what the half-open interval comparison needs.
  const [year, month, day] = raw.split('-').map(Number)
  const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - LK_OFFSET_MS)
  if (Number.isNaN(endOfDay.getTime()) || isoDay(endOfDay) !== raw) {
    return { at: now, iso: today, isToday: true, invalid: true }
  }

  if (endOfDay.getTime() >= now.getTime()) {
    return { at: now, iso: today, isToday: true, invalid: false }
  }
  return { at: endOfDay, iso: raw, isToday: false, invalid: false }
}

/** YYYY-MM-DD `days` before `now` in the business timezone, for the presets. */
export function isoDaysAgo(days: number, now: Date = new Date()): string {
  // Shift into local wall-clock, walk whole days there, then read the date
  // parts back off — so "1 week ago" is the same weekday locally regardless
  // of which side of the UTC boundary `now` sits on.
  const local = new Date(now.getTime() + LK_OFFSET_MS)
  local.setUTCDate(local.getUTCDate() - days)
  return local.toISOString().slice(0, 10)
}

export function todayIso(now: Date = new Date()): string {
  return isoDay(now)
}
