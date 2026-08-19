import { isWorkingDay } from '@/lib/working-days'
import { computeCoverage } from '@/features/worklog/coverage'
import { STUDIO_DEFAULT_PATTERN, type SchedulePattern } from '@/features/worklog/schedules'

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

/**
 * Whether a work log is expected for this day at all.
 *
 * Delegates to the studio-wide definition in src/lib/working-days.ts rather
 * than deciding here: Saturday is a HALF working day at this studio, and it
 * still owes a log. Two other features (the people KPI baseline and the
 * invited-hours metric) have to answer the same question, so the definition
 * lives in one place or the studio ends up with three answers to "how many
 * working days was that".
 */
export function isRequiredWorkDay(
  iso: string,
  isHoliday?: (iso: string) => boolean,
): boolean {
  return isWorkingDay(iso, isHoliday)
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
  /** APPROVED absences. An approved leave day is never asked for. */
  exempt?: ReadonlySet<string>
  /** This person's working pattern; the studio default when they have no row. */
  pattern?: SchedulePattern
}): string[] {
  const { today, joinedOn, logged, isHoliday, exempt, pattern } = input

  // A THIN SELECTOR over computeCoverage, deliberately — not a second
  // definition of "missing".
  //
  // These two used to disagree three ways: this function had no absence input
  // at all (so approved leave was still demanded), it used the studio-wide
  // week (so a part-time person was asked for every weekday), and its
  // isHoliday was optional and its only caller passed nothing (so a company
  // shutdown still read as owed). A coverage figure rendered beside this
  // prompt told the same person they owed N days and N-k days at once.
  //
  // What survives unchanged is what callers depend on: whole ISO days, oldest
  // first, today excluded, capped at MAX_BACKFILL_DAYS, never before the join
  // date. Saturday's 0.5 belongs to the ratio, not to a backfill list — half
  // a day is still a day you owe an entry for.
  const from = new Date(`${today}T12:00:00Z`)
  // 120 calendar days is the same safety bound the backwards walk used: wide
  // enough to find MAX_BACKFILL_DAYS working days, bounded so a bad joinedOn
  // cannot spin.
  from.setUTCDate(from.getUTCDate() - 120)
  const windowStart = from.toISOString().slice(0, 10)

  const { days } = computeCoverage({
    from: windowStart > joinedOn ? windowStart : joinedOn,
    to: today,
    loggedDays: logged,
    exemptDays: exempt ?? new Set(),
    isHoliday: isHoliday ?? (() => false),
    patternFor: () => pattern ?? STUDIO_DEFAULT_PATTERN,
    joinedOn,
    today,
  })

  return days
    .filter((d) => d.status === 'missing')
    .slice(-MAX_BACKFILL_DAYS)
    .map((d) => d.day)
}
