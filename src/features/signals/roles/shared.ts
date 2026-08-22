/**
 * What every role scorecard has in common — which is deliberately almost
 * nothing.
 *
 * THE ABSENCE IS THE FEATURE. There is no shared `score`, no `total`, no
 * `rating`, and no numeric field at the top level of any scorecard in this
 * directory. That is fairness rule 4 made structural: two scorecards with a
 * common numeric field can be sorted against each other, and the moment a PM
 * and a tech lead appear in one ranked list the numbers stop describing their
 * jobs and start describing a race between two different ones.
 *
 * `Scorecard<Role>` therefore carries a role tag, a window, and a list of
 * figures. Comparing two of them requires a human to decide what they are
 * comparing, which is the correct amount of friction.
 */

import type { Figure } from '../figure'

export type SignalWindow = {
  /** `YYYY-MM-DD`, Asia/Colombo, inclusive. */
  from: string
  to: string
  /**
   * Working days in the window MINUS approved leave — the denominator for
   * every per-day rate in this feature.
   *
   * Never calendar days. A fortnight is ten working days here, nine if
   * somebody took a Friday, and 9.5 if it included one Saturday. Dividing by
   * fourteen would make everybody look 40% less productive in exact
   * proportion to how much they rested.
   */
  workingDays: number
}

export type Scorecard<Role extends string> = {
  role: Role
  userId: string
  window: SignalWindow
  figures: Figure[]
  /**
   * Said in the scorecard's own words when the role is hard to observe.
   *
   * Only the architect card sets it today, and it is a type-level slot rather
   * than a comment there so the honest caveat renders next to the numbers
   * instead of living in a design document nobody opens.
   */
  caveat?: string
}

/** Whole days between two instants, floored — never negative. */
export function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000))
}

/**
 * A rate per working day, or null when the window contains none.
 *
 * Null rather than zero for an empty window, and the distinction is not
 * pedantic: a fortnight of approved leave has no working days, and reporting
 * "0 reviews per day" for it would put a zero on the scorecard of somebody who
 * was on holiday.
 */
export function perWorkingDay(count: number, workingDays: number): number | null {
  if (workingDays <= 0) return null
  return count / workingDays
}

/** A whole-number percentage, or null when the denominator is zero. */
export function share(part: number, whole: number): number | null {
  if (whole <= 0) return null
  return Math.round((part / whole) * 100)
}
