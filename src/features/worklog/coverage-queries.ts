import { and, desc, eq, gte, isNull, lt, or } from 'drizzle-orm'
import { db } from '@/db'
import { dailyWorklogs, orgHolidays, users, workSchedules } from '@/db/schema'
import { isGazettedHoliday } from '@/lib/working-days'
import { can, type Actor } from '@/features/auth/capabilities'
import { approvedAbsenceDays } from '@/features/worklog/absence-queries'
import { computeCoverage, type CoverageSummary } from '@/features/worklog/coverage'
import { patternForDay, STUDIO_DEFAULT_PATTERN } from '@/features/worklog/schedules'

/**
 * Assembles a CoverageInput from the database and hands it to the pure core.
 *
 * All the deciding lives in coverage.ts; this only fetches. Keeping the split
 * sharp is what lets the precedence ladder be pinned by tests that never need
 * a Postgres.
 */
export async function getCoverage(
  actor: Actor,
  userId: string,
  from: string,
  to: string,
  today: string,
): Promise<CoverageSummary | null> {
  const own = userId === actor.id
  if (!own && !can(actor, 'coverage.view') && !can(actor, 'coverage.view', { ownerId: userId })) {
    return null
  }

  const [person] = await db
    .select({ createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
  if (!person) return null

  const [logged, schedules, holidays, exemptDays] = await Promise.all([
    db
      .select({ day: dailyWorklogs.day })
      .from(dailyWorklogs)
      .where(and(eq(dailyWorklogs.userId, userId), gte(dailyWorklogs.day, from), lt(dailyWorklogs.day, to))),
    db
      .select({
        effectiveFrom: workSchedules.effectiveFrom,
        effectiveTo: workSchedules.effectiveTo,
        pattern: workSchedules.pattern,
      })
      .from(workSchedules)
      .where(eq(workSchedules.userId, userId))
      .orderBy(desc(workSchedules.effectiveFrom)),
    db.select({ day: orgHolidays.day }).from(orgHolidays),
    approvedAbsenceDays(userId, from, to),
  ])

  const orgHolidaySet = new Set(holidays.map((h) => h.day))
  const rows = schedules.map((s) => ({
    effectiveFrom: s.effectiveFrom.toISOString().slice(0, 10),
    effectiveTo: s.effectiveTo ? s.effectiveTo.toISOString().slice(0, 10) : null,
    pattern: s.pattern,
  }))

  return computeCoverage({
    from,
    to,
    loggedDays: new Set(logged.map((l) => l.day)),
    exemptDays,
    // Company shutdowns compose on TOP of the gazetted calendar through the
    // same callback working-days.ts already takes — a company holiday no
    // longer needs a deploy.
    isHoliday: (iso) => isGazettedHoliday(iso) || orgHolidaySet.has(iso),
    patternFor: (iso) => (rows.length === 0 ? STUDIO_DEFAULT_PATTERN : patternForDay(rows, iso)),
    joinedOn: person.createdAt.toISOString().slice(0, 10),
    today,
  })
}
