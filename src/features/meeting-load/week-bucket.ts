/**
 * Which Colombo week an instant belongs to.
 *
 * Weeks start MONDAY and are always resolved in Asia/Colombo, never UTC. The
 * bug this exists to prevent is specific and has bitten this codebase before:
 * bucketing in one zone and filling the gaps in another. A meeting at 18:30 UTC
 * on a Sunday is already Monday 00:00 in Colombo, so a UTC bucket files it in
 * last week while the fill loop expects it in this one, and the two never
 * reconcile.
 *
 * Built on `iso-day.ts`, the codebase's one existing Asia/Colombo day-arithmetic
 * module, rather than a second UTC anchor of its own.
 */

import { isoDayAdd, isoDayOf } from '@/features/people/iso-day'

/**
 * The Monday of `date`'s Colombo week, as yyyy-mm-dd.
 *
 * The day is resolved in Colombo FIRST and the weekday arithmetic happens on
 * that day string afterwards — reversing the two is exactly the straddle above.
 */
export function localWeekStartIso(date: Date): string {
  const iso = isoDayOf(date)
  // Midday UTC: far enough from either boundary that the ±05:30 offset cannot
  // tip the weekday to its neighbour. Same anchor discipline as iso-day.ts.
  const weekday = new Date(`${iso}T12:00:00Z`).getUTCDay()
  // getUTCDay is Sunday-0; Monday-start means Sunday is six days INTO the week,
  // not the first day of the next one.
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1
  return isoDayAdd(iso, -daysSinceMonday)
}

/**
 * `weeksBack` whole weeks before `weekStartIso`.
 *
 * In 7-day steps through `isoDayAdd`, so it inherits that module's UTC-midnight
 * anchor and cannot drift across a DST boundary somewhere else in the world.
 * Colombo has no DST, but the anchor is the reason this stays true rather than
 * happening to be true.
 */
export function weekStartIsoOffset(weekStartIso: string, weeksBack: number): string {
  return isoDayAdd(weekStartIso, -7 * weeksBack)
}
