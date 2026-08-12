import { isoDayRange } from '@/features/people/iso-day'

/**
 * The contribution-graph level ramp and the dense day series it renders.
 *
 * TWO BUGS THIS MODULE EXISTS TO KILL, both from the version that lived inline
 * in queries.ts:
 *
 *  1. TWO DIFFERENT DAY BOUNDARIES. The SQL bucketed with `to_char(created_at)`
 *     — the server's timezone — while the JS fill loop keyed off
 *     `cursor.toISOString().slice(0, 10)` — UTC — walking from a local-midnight
 *     start. On any server not running in UTC the two disagreed by a day, so
 *     counts landed in cells next to the ones they belonged in. Now the caller
 *     buckets in Asia/Colombo in SQL and fills with the same Colombo days here,
 *     from one list of day keys.
 *  2. AN UNDOCUMENTED, UNLABELLED RAMP. The thresholds (1, 2–3, 4–5, 6+) lived
 *     as a nested ternary and the legend said only "Less … More", so no reader
 *     could tell whether a dark cell meant two tasks or twenty. THRESHOLDS is
 *     now the single source for both the level function and the legend text —
 *     they cannot drift apart.
 *
 * WHAT IT MEASURES, stated plainly because the old doc comment was wrong: tasks
 * CREATED with this person as the assignee, on the day they were created. It is
 * work arriving, not work finishing — `tasks` has no completion timestamp, so
 * a "shipped" graph is not derivable from this schema at all.
 */

export type ActivityLevel = 0 | 1 | 2 | 3 | 4

export type ActivityDay = {
  /** `YYYY-MM-DD` in the business timezone. */
  date: string
  count: number
  level: ActivityLevel
}

/**
 * Lower bound per level, ascending. Level 0 is "nothing happened" and is kept
 * visually distinct from level 1 for exactly that reason — a blank day and a
 * one-task day must not read the same.
 */
export const ACTIVITY_THRESHOLDS: { level: ActivityLevel; min: number; label: string }[] = [
  { level: 0, min: 0, label: 'none' },
  { level: 1, min: 1, label: '1' },
  { level: 2, min: 2, label: '2–3' },
  { level: 3, min: 4, label: '4–5' },
  { level: 4, min: 6, label: '6+' },
]

export function activityLevel(count: number): ActivityLevel {
  if (!Number.isFinite(count) || count <= 0) return 0
  let level: ActivityLevel = 0
  for (const threshold of ACTIVITY_THRESHOLDS) {
    if (count >= threshold.min) level = threshold.level
  }
  return level
}

/**
 * A dense day-by-day series over [fromIso, toIso], zero-filled — the graph
 * needs every day present, including the empty ones, or the calendar grid
 * develops holes where a week should be.
 *
 * Counts for days outside the range are ignored rather than clamped into the
 * edge cells: a stray row from a wider query must not inflate the first day.
 */
export function buildActivitySeries(
  counts: { day: string; count: number }[],
  fromIso: string,
  toIso: string,
): ActivityDay[] {
  const byDay = new Map(counts.map((row) => [row.day, row.count]))
  return isoDayRange(fromIso, toIso).map((date) => {
    const count = byDay.get(date) ?? 0
    return { date, count, level: activityLevel(count) }
  })
}

/** Total across the series — the "N tasks in the last 6 months" figure. */
export function activityTotal(series: ActivityDay[]): number {
  return series.reduce((sum, day) => sum + day.count, 0)
}

/** The busiest single day in the series, for the graph's scale caption. */
export function activityPeak(series: ActivityDay[]): number {
  return series.reduce((peak, day) => (day.count > peak ? day.count : peak), 0)
}
