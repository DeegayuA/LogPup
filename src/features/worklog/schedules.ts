import type { SchedulePattern } from '@/db/schema'

export type { SchedulePattern }

/**
 * The studio's normal week, mirrored from `workingDayFraction`
 * (src/lib/working-days.ts) — Monday to Friday whole, Saturday a half day,
 * Sunday none.
 *
 * This is NOT a second definition. A `work_schedules` row exists only for
 * someone who deviates from this, so the default keeps living in exactly one
 * place and this constant is the shape that place produces. The test asserts
 * the two agree; if working-days.ts ever changes, that test fails first.
 */
export const STUDIO_DEFAULT_PATTERN: SchedulePattern = {
  mon: 1,
  tue: 1,
  wed: 1,
  thu: 1,
  fri: 1,
  sat: 0.5,
  sun: 0,
}

export type ScheduleRow = {
  effectiveFrom: string
  effectiveTo: string | null
  pattern: SchedulePattern
}

/**
 * The pattern in force on `iso`, or the studio default when no row covers it.
 *
 * Half-open [effectiveFrom, effectiveTo), exactly like app_role_history: an
 * inclusive end would let two adjacent rows both claim the boundary day, and
 * "what was expected of them on 12 June" must have one answer.
 */
export function patternForDay(rows: readonly ScheduleRow[], iso: string): SchedulePattern {
  for (const row of rows) {
    if (row.effectiveFrom > iso) continue
    if (row.effectiveTo !== null && row.effectiveTo <= iso) continue
    return row.pattern
  }
  return STUDIO_DEFAULT_PATTERN
}

export type DateRange = { startDate: string; endDate: string }

/**
 * Whether two absence ranges share a day. BOTH BOUNDS INCLUSIVE — absences
 * are dates a person states in words ("I am out Monday to Wednesday"), not
 * machine intervals, so Wednesday is covered.
 *
 * Used to refuse a second absence over days already claimed. Enforced here
 * rather than by a Postgres EXCLUDE constraint, which would need btree_gist:
 * unverified on this Neon instance, and a failed extension install mid
 * migration is worse than an application check with a test behind it.
 */
export function overlaps(a: DateRange, b: DateRange): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate
}
