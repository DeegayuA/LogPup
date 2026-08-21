/**
 * Twelve weeks of invited hours, ready to draw.
 *
 * EMPTY WEEKS ARE ZEROES, NEVER GAPS. A quiet week that vanished from the
 * series would compress the x-axis and make a fortnight of silence look like
 * two busy weeks side by side — the chart would be telling the opposite of the
 * truth. Same discipline as allocation-history.ts, which this mirrors.
 *
 * Pure: `now` is injected.
 */

import { localWeekStartIso, weekStartIsoOffset } from '@/features/meeting-load/week-bucket'

export interface WeekHours { weekStartIso: string; hours: number }
export interface LoadTrendPoint { weekStartIso: string; hours: number }
export interface LoadTrendData { points: LoadTrendPoint[]; yMax: number }

export const TREND_WEEKS = 12
/** A floor for the y-axis, so twelve empty weeks draw a flat line along the
 *  bottom instead of dividing by zero and producing NaN coordinates. */
export const TREND_Y_FLOOR_HOURS = 1

/**
 * The last twelve Colombo weeks, oldest first, ending with the week `now` is
 * in — so the right-hand edge of the chart is always this week, whether or not
 * anything happened in it.
 */
export function buildLoadTrend(weeklyHours: WeekHours[], now: Date): LoadTrendData {
  const byWeek = new Map(weeklyHours.map((row) => [row.weekStartIso, row.hours]))
  const thisWeek = localWeekStartIso(now)

  const points: LoadTrendPoint[] = []
  for (let back = TREND_WEEKS - 1; back >= 0; back -= 1) {
    const weekStartIso = weekStartIsoOffset(thisWeek, back)
    points.push({ weekStartIso, hours: byWeek.get(weekStartIso) ?? 0 })
  }

  const peak = points.reduce((max, point) => Math.max(max, point.hours), 0)
  return { points, yMax: Math.max(peak, TREND_Y_FLOOR_HOURS) }
}
