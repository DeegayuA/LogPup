/**
 * Turns the `?at=YYYY-MM-DD` query param on the team-history page into the
 * instant the "as of" query runs against.
 *
 * Two decisions worth stating, because both are visible to the user:
 *
 *  - a day resolves to its END (23:59:59.999 UTC), not its start. "How did
 *    the team look on the 3rd" means after that day's changes, not before
 *    them — resolving to midnight would render the 3rd as if it were the
 *    2nd, and a change made on the day you picked would be invisible.
 *  - the future is clamped to now. There is no history past the present, so
 *    a stale bookmark or a fat-fingered year renders today rather than an
 *    empty page that looks like data loss.
 *
 * UTC throughout, matching how the timestamps are written, so the answer
 * doesn't shift with the server's local zone.
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

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function resolveAsOf(raw: string | undefined, now: Date = new Date()): ResolvedAsOf {
  const today = isoDay(now)
  if (!raw) return { at: now, iso: today, isToday: true, invalid: false }

  if (!ISO_DAY.test(raw)) return { at: now, iso: today, isToday: true, invalid: true }

  // Date.UTC round-trips through the parsed parts, so "2026-02-31" comes back
  // as March 3 and fails this identity check instead of silently sliding.
  const [year, month, day] = raw.split('-').map(Number)
  const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
  if (Number.isNaN(endOfDay.getTime()) || isoDay(endOfDay) !== raw) {
    return { at: now, iso: today, isToday: true, invalid: true }
  }

  if (endOfDay.getTime() >= now.getTime()) {
    return { at: now, iso: today, isToday: true, invalid: false }
  }
  return { at: endOfDay, iso: raw, isToday: false, invalid: false }
}

/** YYYY-MM-DD `days` before `now`, for the picker's quick presets. */
export function isoDaysAgo(days: number, now: Date = new Date()): string {
  const date = new Date(now.getTime())
  date.setUTCDate(date.getUTCDate() - days)
  return isoDay(date)
}

export function todayIso(now: Date = new Date()): string {
  return isoDay(now)
}
