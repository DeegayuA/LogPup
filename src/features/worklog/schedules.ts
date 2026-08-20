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

/**
 * How long a full day is, in minutes. Decided by the user: eight hours, so
 * Saturday's 0.5 is 240 and a Monday-to-Saturday week is 44 hours.
 *
 * THE ONLY DEFINITION, and it lives here because the pattern above and this
 * number together are the whole answer to "how long is this person's day".
 * Split across two modules they drift, and the drift stays invisible until two
 * surfaces disagree about whether somebody is short on hours — at which point
 * it reads as an accusation of under-logging rather than as a bug.
 *
 * NOTE WHAT THIS IS NOT. `daily_worklogs.percent` is a self-scored fraction of
 * what somebody PLANNED that day, not time, and presenting it as hours would
 * be a lie (the worklog spec is explicit about this). This constant exists for
 * the separate per-task minutes measure, where minutes are genuinely recorded.
 * It converts a SCHEDULE into minutes and says nothing about what anyone
 * logged.
 *
 * Callers should keep taking scheduled minutes as a PARAMETER wherever they
 * can, so a function that cannot obtain a schedule answers "cannot say"
 * instead of computing against an assumed day. There is deliberately no
 * `?? 480` fallback anywhere: a silently-assumed working day is the exact
 * failure this constant exists to prevent.
 */
export const MINUTES_PER_FULL_DAY = 480

/** A schedule fraction as minutes. One conversion, one rounding rule. */
export function scheduledMinutesForFraction(fraction: number): number {
  return Math.round(fraction * MINUTES_PER_FULL_DAY)
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
