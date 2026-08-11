/**
 * Pure date math behind "drag a meeting onto another day" in the month
 * calendar. Kept out of the component (and free of any DB/network call) for
 * the same reason as split-upcoming.ts: it is the part worth unit-testing,
 * and component bodies must stay idempotent.
 */

/** `yyyy-MM-dd` — the key the month grid uses for a day cell / drop target. */
export function dayKeyToDate(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) return null
  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  // Rejects impossible dates that Date would silently roll over (2026-02-30
  // becoming March 2nd), so a bogus drop target can never move a meeting to a
  // day the user never pointed at.
  if (date.getFullYear() !== Number(year)) return null
  if (date.getMonth() !== Number(month) - 1) return null
  if (date.getDate() !== Number(day)) return null
  return date
}

/**
 * Moves a meeting onto `targetDay`, keeping its wall-clock start time (a
 * 10:00 standup dropped on Friday is still a 10:00 standup) and its exact
 * duration.
 *
 * The end is derived by adding the original elapsed milliseconds rather than
 * by re-stamping the end's clock time, so a meeting that runs past midnight
 * keeps its length instead of collapsing to a negative span. Across a DST
 * boundary that means the duration is preserved and the end's clock time may
 * shift by an hour — the honest trade for "an hour is an hour".
 */
export function moveMeetingToDay(
  startsAt: Date,
  endsAt: Date,
  targetDay: Date,
): { startsAt: Date; endsAt: Date } {
  const nextStart = new Date(
    targetDay.getFullYear(),
    targetDay.getMonth(),
    targetDay.getDate(),
    startsAt.getHours(),
    startsAt.getMinutes(),
    startsAt.getSeconds(),
    startsAt.getMilliseconds(),
  )
  const durationMs = endsAt.getTime() - startsAt.getTime()
  return { startsAt: nextStart, endsAt: new Date(nextStart.getTime() + durationMs) }
}
