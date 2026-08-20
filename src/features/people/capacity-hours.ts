import type { SchedulePattern } from '@/db/schema'
import { STUDIO_DEFAULT_PATTERN } from '@/features/worklog/schedules'

/**
 * Capacity in HOURS rather than in percent.
 *
 * A percentage answers "how much of this person" and hides the question that
 * matters — how much of WHAT. Two people can both sit at 80% while one owes 35
 * hours a week and the other 17, because the studio week is not the same
 * length for everybody: Saturday is half a day for all, and a part-time
 * schedule (work_schedules.pattern) can make any weekday a fraction. Percent
 * flattens that, so a part-timer at 80% looks exactly as loaded as a
 * full-timer at 80% while carrying less than half the work.
 *
 * Hours do not flatten it. They are also the same unit people log, which is
 * what lets planned load and actual effort be compared at all.
 *
 * NO DATABASE, NO SCHEMA CHANGE. This derives hours from what the app already
 * knows — the person's schedule pattern and their existing allocation
 * percentages — so it is useful before the worklog hours migration lands and
 * stays correct after it. When per-project logged hours arrive, `allocated`
 * gains a second source and the arithmetic here is unchanged.
 */

/**
 * A whole working day, in hours.
 *
 * Eight, because that is the day the rest of the product already assumes: the
 * public sandbox logs 8.0 for a weekday and 4.0 for a Saturday, and the
 * studio's week is Monday to Friday whole with Saturday half
 * (src/lib/working-days.ts). Declared here as the ONE place the number lives,
 * so a studio moving to a seven-hour day changes it once instead of hunting
 * literals.
 *
 * A day's hours are always `fraction * FULL_DAY_HOURS`, which is what keeps
 * Saturday at four hours with no special case anywhere.
 */
export const FULL_DAY_HOURS = 8

/** The hours a single day owes, given its fraction of a working day. */
export function hoursForFraction(fraction: number): number {
  return round1(fraction * FULL_DAY_HOURS)
}

/**
 * The hours a person's week owes.
 *
 * Sums the schedule pattern rather than assuming five days: the pattern is the
 * only thing that knows about part-time, and a `work_schedules` row exists
 * precisely for people who deviate. Falling back to the studio default keeps
 * that table near-empty — no row means the normal week, which is 44 hours:
 * five whole days plus a half Saturday.
 */
export function weeklyCapacityHours(pattern: SchedulePattern = STUDIO_DEFAULT_PATTERN): number {
  const total =
    pattern.mon + pattern.tue + pattern.wed + pattern.thu + pattern.fri + pattern.sat + pattern.sun
  return round1(total * FULL_DAY_HOURS)
}

/**
 * What an allocation percentage is worth in hours for THIS person's week.
 *
 * The bridge that makes hours usable today: `assignments.allocationPct`
 * already says what share of someone's time a project holds, and their
 * schedule says how long their week is. Multiplying gives the hours that share
 * was standing in for all along.
 */
export function allocatedHours(
  allocationPct: number,
  pattern: SchedulePattern = STUDIO_DEFAULT_PATTERN,
): number {
  return round1((allocationPct / 100) * weeklyCapacityHours(pattern))
}

export type HoursLoad = {
  /** Hours committed across every project. */
  allocated: number
  /** Hours the person's schedule actually offers. */
  capacity: number
  /** Hours left; negative when overcommitted. */
  remaining: number
  /**
   * Percent of their OWN week, so it stays comparable with the existing
   * capacity bar and its 80% / 100% thresholds. A part-timer at 22 of 22 hours
   * is at 100% — correctly, because they are full — even though a full-timer's
   * 22 hours is half a week.
   */
  percent: number
}

/**
 * One person's load, from their allocations and their schedule.
 *
 * Percent is DERIVED from the hours rather than summed from the source
 * percentages. The two are equal today, but they stop being equal the moment
 * an allocation is expressed directly in hours — and deriving means this keeps
 * telling the truth through that change instead of quietly disagreeing with
 * the hours printed beside it.
 */
export function hoursLoad(
  allocationPcts: readonly number[],
  pattern: SchedulePattern = STUDIO_DEFAULT_PATTERN,
): HoursLoad {
  const capacity = weeklyCapacityHours(pattern)
  const allocated = round1(allocationPcts.reduce((sum, pct) => sum + (pct / 100) * capacity, 0))
  return {
    allocated,
    capacity,
    remaining: round1(capacity - allocated),
    // A zero-hour week — someone wholly on leave, or a pattern of all zeros —
    // has no denominator. Reporting 0% says "no commitment against no time",
    // which is true; NaN renders as a broken bar and Infinity would paint them
    // permanently over capacity.
    percent: capacity === 0 ? 0 : Math.round((allocated / capacity) * 100),
  }
}

/** One decimal place: hours are read, not accumulated, so 7.5 must stay 7.5. */
function round1(value: number): number {
  return Math.round(value * 10) / 10
}
