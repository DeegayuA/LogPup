import { differenceInCalendarDays } from 'date-fns'

/**
 * Fraction of a sprint's tasks that are done, in [0, 1]. A sprint with no
 * tasks yet reports 0 rather than NaN so the progress bar renders empty
 * instead of collapsing.
 */
export function sprintProgress(counts: { todo: number; in_progress: number; done: number }): number {
  const total = counts.todo + counts.in_progress + counts.done
  if (total === 0) return 0
  return counts.done / total
}

/**
 * Calendar days between `now` and a sprint's `endDate` (a plain YYYY-MM-DD
 * string, as stored in the `date` column). Positive = days left, 0 = ends
 * today, negative = overdue. Anchored to local noon so `new Date()` parsing
 * of the date-only string can't shift a calendar day under UTC parsing.
 */
export function daysRemaining(endDate: string, now: Date = new Date()): number {
  const end = new Date(`${endDate}T12:00:00`)
  return differenceInCalendarDays(end, now)
}
