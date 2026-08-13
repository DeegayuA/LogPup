import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'

/**
 * Day arithmetic for the work log, kept pure and clock-free so the Colombo
 * boundary is pinned by a test rather than discovered in production.
 */

export const PERCENT_MIN = 0
export const PERCENT_MAX = 100

/** `yyyy-mm-dd`, the only shape a work-log day is ever written or read as. */
export const WORK_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * The calendar day a moment belongs to for this team — Asia/Colombo, not the
 * server's zone and not UTC. Someone logging at 01:00 Colombo is logging the
 * day that just started; a UTC-derived day files that under yesterday, which
 * is wrong for exactly the people who log at the end of a long evening.
 */
export function resolveWorkDay(now: Date): string {
  return toIsoDateInTimeZone(now, LK_TIMEZONE)
}

/**
 * Whether a day is still ahead of the caller. A work log records what
 * happened, and today's own entry stays editable all day, so there is never
 * a reason to write a future one.
 *
 * String comparison is exact here because both sides are zero-padded
 * `yyyy-mm-dd`, which sorts lexicographically the same way it sorts
 * chronologically.
 */
export function isFutureWorkDay(day: string, now: Date): boolean {
  return day > resolveWorkDay(now)
}

/**
 * The last `count` days ending today, newest first — the spine of the
 * personal history list. Built by walking a midday UTC cursor backwards, so
 * a month or year boundary is the calendar's problem rather than this
 * function's, and the midday anchor keeps the ±05:30 offset from ever
 * tipping a step into the neighbouring date.
 */
export function worklogDaysBack(count: number, now: Date): string[] {
  const days: string[] = []
  const cursor = new Date(`${resolveWorkDay(now)}T12:00:00Z`)
  for (let i = 0; i < count; i += 1) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return days
}

/**
 * What a run of days adds up to. The average deliberately covers only the
 * days that were actually logged — treating an unlogged day as 0% would
 * punish leave and make the number useless as a trend.
 */
export function summarizeWorklogs(
  rows: { percent: number }[],
): { logged: number; averagePercent: number | null } {
  if (rows.length === 0) return { logged: 0, averagePercent: null }
  const total = rows.reduce((sum, row) => sum + row.percent, 0)
  return { logged: rows.length, averagePercent: Math.round(total / rows.length) }
}
