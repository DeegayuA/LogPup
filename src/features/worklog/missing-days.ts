import { LK_HOLIDAYS } from '@/lib/lk-holidays'

/**
 * Which days a person still owes a work log for.
 *
 * The rule is "log every day, and if you miss one, fill it in" — so the app
 * has to be able to say exactly which days are outstanding. Three things
 * keep that from becoming a permanent red badge nobody can clear:
 *
 *  - Weekends and gazetted Sri Lankan holidays are never required. Without
 *    this the backlog goes red for the whole team after every Poya day and
 *    the prompt stops meaning anything.
 *  - The window starts the day the person joined, never an absolute epoch,
 *    so somebody who started last week is not shown months of debt.
 *  - It is capped (MAX_BACKFILL_DAYS). Someone back from two weeks' leave
 *    should be asked for a fortnight, not a quarter — an unclearable
 *    backlog is indistinguishable from disengagement, and punishing leave
 *    is the fastest way to make people stop filling it in honestly.
 *
 * Pure, so all of that is pinned by tests rather than discovered on a Poya
 * Monday.
 */

/**
 * How far back the app will ask someone to fill in. Ten working days is
 * about a fortnight of calendar time — long enough to cover ordinary leave,
 * short enough to stay clearable in one sitting.
 */
export const MAX_BACKFILL_DAYS = 10

/** ISO `yyyy-mm-dd` → is it a gazetted Sri Lankan holiday? */
function isGazettedHoliday(iso: string): boolean {
  return iso in LK_HOLIDAYS
}

/**
 * Whether a work log is expected for this day at all.
 *
 * Saturday counts as non-working alongside Sunday. That is the safer error:
 * a team that does work Saturdays is merely not nagged about them, whereas
 * requiring a day the team does not work produces a backlog nobody can
 * clear. `lk-holidays.ts` models only Sunday (isLkSunday), which is why the
 * weekend test is done here rather than borrowed from there.
 */
export function isRequiredWorkDay(
  iso: string,
  isHoliday: (iso: string) => boolean = isGazettedHoliday,
): boolean {
  // Midday UTC: far enough from either boundary that the ±05:30 Colombo
  // offset cannot tip the weekday to its neighbour.
  const weekday = new Date(`${iso}T12:00:00Z`).getUTCDay()
  if (weekday === 0 || weekday === 6) return false
  return !isHoliday(iso)
}

/**
 * Every required day, oldest first, that the person has not logged —
 * excluding today, which is not missed until it is over.
 */
export function missingWorkDays(input: {
  /** Today, Colombo (`yyyy-mm-dd`). */
  today: string
  /** The day this person joined the team — `users.createdAt`, Colombo. */
  joinedOn: string
  /** Days already logged. */
  logged: Set<string>
  isHoliday?: (iso: string) => boolean
}): string[] {
  const { today, joinedOn, logged, isHoliday } = input
  const missing: string[] = []

  // Walk backwards from yesterday, collecting required-but-unlogged days
  // until the cap, the join date, or the safety bound is reached.
  const cursor = new Date(`${today}T12:00:00Z`)
  cursor.setUTCDate(cursor.getUTCDate() - 1)

  // Bounded independently of the cap so a bad joinedOn cannot spin: at most
  // a calendar quarter of walking to find MAX_BACKFILL_DAYS working days.
  for (let step = 0; step < 120 && missing.length < MAX_BACKFILL_DAYS; step += 1) {
    const iso = cursor.toISOString().slice(0, 10)
    if (iso < joinedOn) break
    if (isRequiredWorkDay(iso, isHoliday) && !logged.has(iso)) missing.push(iso)
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  return missing.reverse()
}
