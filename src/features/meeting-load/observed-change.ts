/**
 * What actually happened after somebody accepted a suggestion.
 *
 * THIS REPLACES "HOURS SAVED TO DATE", and the replacement is the point. A
 * running total of hours saved is a number the feature awards itself: it
 * assumes the change worked, compounds that assumption weekly, and can only go
 * up. This measures instead, from the same live queries every other figure
 * uses, and it is allowed to say the load went UP.
 *
 * AVERAGE, NOT SUM. Summing a weekly rate into a total is precisely how "hours
 * saved to date" inflated. Four weeks either side of the decision, averaged,
 * compared.
 *
 * Pure.
 */

import type { WeekHours } from '@/features/meeting-load/trend-points'

export interface ObservedChangeInput {
  decidedAt: Date
  /** The 4 Colombo weeks strictly BEFORE the week the decision was made. */
  beforeWeeklyHours: WeekHours[]
  /** The 4 strictly after. The decision's own week is in neither: it is half a
   *  week of old behaviour and half of new, and counting it either way would
   *  flatter or punish the decision for no reason. */
  afterWeeklyHours: WeekHours[]
}

export type ObservedChange =
  | { status: 'measured'; beforeAvgHours: number; afterAvgHours: number; deltaHours: number }
  | { status: 'no-data-yet' }

const average = (weeks: WeekHours[]) =>
  weeks.length === 0 ? 0 : weeks.reduce((sum, week) => sum + week.hours, 0) / weeks.length

/**
 * `'no-data-yet'` when the series has not met since the decision.
 *
 * NEVER a fabricated zero. "No occurrences yet" and "the same load as before"
 * are different facts, and rendering the first as the second would credit a
 * decision that has not been tested.
 */
export function observedChangeFor(input: ObservedChangeInput): ObservedChange {
  const after = input.afterWeeklyHours.filter((week) => week.hours > 0)
  if (after.length === 0) return { status: 'no-data-yet' }

  const beforeAvgHours = average(input.beforeWeeklyHours)
  const afterAvgHours = average(input.afterWeeklyHours)
  return {
    status: 'measured',
    beforeAvgHours,
    afterAvgHours,
    // Reported as-is, negative included. A suggestion that made things worse is
    // exactly what this ledger exists to surface.
    deltaHours: afterAvgHours - beforeAvgHours,
  }
}
