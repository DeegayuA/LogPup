import { and, asc, count, desc, eq, gte, lte } from 'drizzle-orm'
import { db } from '@/db'
import { absences, assignments, dailyWorklogs, orgHolidays, users, workSchedules } from '@/db/schema'
import { liveApps } from '@/db/live'
import type { ScheduleRow } from '@/features/worklog/schedules'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { orgHolidaySet } from '@/features/worklog/org-holidays'

/**
 * Reads for the work log.
 *
 * `daily_worklogs` is not in SOFT_TABLES (src/db/live.ts) and has no delete
 * path — a day is corrected by editing it — so these read the table directly
 * rather than through a live* subquery. `users` is likewise not soft-deleted.
 */

export type WorklogRow = {
  day: string
  percent: number
  note: string | null
  updatedAt: Date
}

export type TeamWorklogRow = WorklogRow & {
  userId: string
  userName: string
  avatarUrl: string | null
}

/**
 * The day this person joined, Colombo — the floor for "which days do you
 * still owe". `users.createdAt` is used deliberately: `assignments` has no
 * createdAt at all, and `assignment_history.effectiveFrom` is backfilled to
 * GREATEST(user.createdAt, app.createdAt), which makes people look older on
 * the team than they are and would invent debt they never owed.
 */
export async function getUserJoinDay(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
  return row ? toIsoDateInTimeZone(row.createdAt, LK_TIMEZONE) : null
}

/**
 * Has this person ever logged a day at all?
 *
 * Deliberately a count and not a fetch: the only caller is the dashboard's
 * first-log nudge, which needs "zero or not", never the rows. The access
 * path is `daily_worklogs_user_day_idx` — the (user, day) unique index — so
 * this stays one index read however long the log gets.
 */
export async function countMyWorklogDays(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(dailyWorklogs)
    .where(eq(dailyWorklogs.userId, userId))
  return row?.n ?? 0
}

/** One person's most recent days, newest first. */
export async function getMyWorklogs(userId: string, days: number): Promise<WorklogRow[]> {
  return db
    .select({
      day: dailyWorklogs.day,
      percent: dailyWorklogs.percent,
      note: dailyWorklogs.note,
      updatedAt: dailyWorklogs.updatedAt,
    })
    .from(dailyWorklogs)
    .where(eq(dailyWorklogs.userId, userId))
    .orderBy(desc(dailyWorklogs.day))
    .limit(days)
}

/**
 * One person's entries inside `[fromIso, toIso]`, both ends inclusive —
 * the month calendar's single read. Bounded by DATE, not by row count:
 * `getMyWorklogs(userId, 31)` answers "the last 31 entries", which stops
 * being "August" the first time someone logs an extra weekend day.
 */
export async function getMyWorklogsInRange(
  userId: string,
  fromIso: string,
  toIso: string,
): Promise<WorklogRow[]> {
  return db
    .select({
      day: dailyWorklogs.day,
      percent: dailyWorklogs.percent,
      note: dailyWorklogs.note,
      updatedAt: dailyWorklogs.updatedAt,
    })
    .from(dailyWorklogs)
    .where(
      and(
        eq(dailyWorklogs.userId, userId),
        gte(dailyWorklogs.day, fromIso),
        lte(dailyWorklogs.day, toIso),
      ),
    )
    .orderBy(desc(dailyWorklogs.day))
}

/**
 * Every person's entries across a day range — the team view's single read.
 * Bounded by date on both sides so this cannot become a full-table scan as
 * the log grows; `daily_worklogs_day_idx` is the access path.
 */
export async function getTeamWorklogs(fromIso: string, toIso: string): Promise<TeamWorklogRow[]> {
  return db
    .select({
      userId: dailyWorklogs.userId,
      userName: users.name,
      avatarUrl: users.avatarUrl,
      day: dailyWorklogs.day,
      percent: dailyWorklogs.percent,
      note: dailyWorklogs.note,
      updatedAt: dailyWorklogs.updatedAt,
    })
    .from(dailyWorklogs)
    .innerJoin(users, eq(dailyWorklogs.userId, users.id))
    .where(and(gte(dailyWorklogs.day, fromIso), lte(dailyWorklogs.day, toIso)))
    .orderBy(desc(dailyWorklogs.day), users.name)
}

// ---------------------------------------------------------------------------
// Coverage inputs
// ---------------------------------------------------------------------------
//
// `computeCoverage` (coverage.ts) is pure and takes everything as data, so the
// fetching lives here. Four reads, one per thing that can make a day not owed:
// what was logged, what leave was approved, what week the person works, and
// which days the studio shut.

/**
 * The days this person logged inside `[fromIso, toIso]`, both ends inclusive.
 *
 * Bounded by date rather than by row count. A `limit N` read answers "was this
 * day logged" only while the person has logged fewer than N days — for a
 * diligent logger the oldest days in the window fall off the end of the limit
 * and come back looking missing.
 */
export async function getMyWorklogDays(
  userId: string,
  fromIso: string,
  toIso: string,
): Promise<string[]> {
  const rows = await db
    .select({ day: dailyWorklogs.day })
    .from(dailyWorklogs)
    .where(
      and(
        eq(dailyWorklogs.userId, userId),
        gte(dailyWorklogs.day, fromIso),
        lte(dailyWorklogs.day, toIso),
      ),
    )
  return rows.map((row) => row.day)
}

/** One filed absence, as the work log needs to show it. */
export type MyAbsence = {
  id: string
  /** INCLUSIVE, and so is `endDate` — see the `absences` table comment. */
  startDate: string
  endDate: string
  kind: (typeof absences.$inferSelect)['kind']
  reason: string | null
}

const absenceColumns = {
  id: absences.id,
  startDate: absences.startDate,
  endDate: absences.endDate,
  kind: absences.kind,
  reason: absences.reason,
}

/**
 * Every absence this person has filed that nobody has decided yet, oldest
 * first.
 *
 * Deliberately NOT bounded by the catch-up window. A pending absence is an
 * outstanding thing whatever days it covers, and this is the only screen that
 * shows it to the person who filed it — one that aged out of the window would
 * simply disappear, which is the failure the panel exists to avoid.
 */
export async function getMyPendingAbsences(userId: string): Promise<MyAbsence[]> {
  return db
    .select(absenceColumns)
    .from(absences)
    .where(and(eq(absences.userId, userId), eq(absences.status, 'pending')))
    .orderBy(absences.startDate)
}

/**
 * Approved absences overlapping `[fromIso, toIso]` — the ONLY ones that exempt
 * a day. A pending one never does (absence-actions.ts), so filing cannot lower
 * the filer's own denominator.
 */
export async function getMyApprovedAbsences(
  userId: string,
  fromIso: string,
  toIso: string,
): Promise<MyAbsence[]> {
  return db
    .select(absenceColumns)
    .from(absences)
    .where(
      and(
        eq(absences.userId, userId),
        eq(absences.status, 'approved'),
        lte(absences.startDate, toIso),
        gte(absences.endDate, fromIso),
      ),
    )
    .orderBy(absences.startDate)
}

/** One approved absence range with its owner — the team view's exemption read. */
export type TeamAbsenceRange = {
  userId: string
  /** INCLUSIVE, and so is `endDate` — see the `absences` table comment. */
  startDate: string
  endDate: string
}

/**
 * Every APPROVED absence overlapping `[fromIso, toIso]`, across the whole
 * team. Exists so the admin strip can paint a person's leave day as leave
 * rather than as "Not logged yet" — the same honesty rule the personal
 * calendar follows, read once for everyone instead of once per person.
 * Approved only, for the same reason as `getMyApprovedAbsences`: a pending
 * absence exempts nothing.
 */
export async function getTeamApprovedAbsences(
  fromIso: string,
  toIso: string,
): Promise<TeamAbsenceRange[]> {
  return db
    .select({
      userId: absences.userId,
      startDate: absences.startDate,
      endDate: absences.endDate,
    })
    .from(absences)
    .where(
      and(
        eq(absences.status, 'approved'),
        lte(absences.startDate, toIso),
        gte(absences.endDate, fromIso),
      ),
    )
    .orderBy(absences.startDate)
}

/**
 * This person's effective-dated schedule rows, newest first, as Colombo ISO
 * days — the shape `patternForDay` takes.
 *
 * Empty for almost everyone: a row exists only for someone who deviates from
 * the studio default, and `patternForDay` returns that default for any day no
 * row covers. The column is a timestamp and the comparison is a day, so the
 * conversion happens here rather than in the pure module.
 */
export async function getMyWorkSchedule(userId: string): Promise<ScheduleRow[]> {
  const rows = await db
    .select({
      pattern: workSchedules.pattern,
      effectiveFrom: workSchedules.effectiveFrom,
      effectiveTo: workSchedules.effectiveTo,
    })
    .from(workSchedules)
    .where(eq(workSchedules.userId, userId))
    .orderBy(desc(workSchedules.effectiveFrom))
  return rows.map((row) => ({
    pattern: row.pattern,
    effectiveFrom: toIsoDateInTimeZone(row.effectiveFrom, LK_TIMEZONE),
    effectiveTo: row.effectiveTo ? toIsoDateInTimeZone(row.effectiveTo, LK_TIMEZONE) : null,
  }))
}

/**
 * Company shutdown days IN FORCE in `[fromIso, toIso]`, to be merged with the
 * gazetted map by the caller — the same `isHoliday(iso)` callback
 * working-days.ts and coverage.ts both take, so a company holiday needs no
 * deploy and no second definition of "holiday".
 *
 * REVOCATION IS APPLIED HERE, through `orgHolidaySet`, and this used to be
 * the second definition it warns about. `org_holidays` is revoked rather than
 * deleted (see the comment on the table in src/db/schema.ts) and a row only
 * still closes the studio while `isOrgHolidayInForce` says so. Selecting
 * `day` alone silently dropped that clause, so `/worklog`'s catch-up panel
 * kept exempting days from shutdowns that had been called off, while
 * getCoverage — which reads the same table through `orgHolidaySet` — counted
 * them owed. The person and their manager were reading different denominators
 * for the same days.
 */
export async function getOrgHolidayDays(fromIso: string, toIso: string): Promise<string[]> {
  const rows = await db
    .select({ day: orgHolidays.day, revokedFrom: orgHolidays.revokedFrom })
    .from(orgHolidays)
    .where(and(gte(orgHolidays.day, fromIso), lte(orgHolidays.day, toIso)))
  return [...orgHolidaySet(rows)]
}

export type UserAssignedApp = {
  id: string
  name: string
  slug: string
  role: string
  allocationPct: number
}

/**
 * Reads the active apps/projects a user is assigned to.
 * If none are explicitly assigned, falls back to active studio apps.
 */
export async function getMyAssignedApps(userId: string): Promise<UserAssignedApp[]> {
  const rows = await db
    .select({
      id: liveApps.id,
      name: liveApps.name,
      slug: liveApps.slug,
      role: assignments.role,
      allocationPct: assignments.allocationPct,
    })
    .from(assignments)
    .innerJoin(liveApps, eq(assignments.appId, liveApps.id))
    .where(and(eq(assignments.userId, userId), eq(liveApps.status, 'active')))
    .orderBy(desc(assignments.allocationPct))

  if (rows.length === 0) {
    const allLive = await db
      .select({
        id: liveApps.id,
        name: liveApps.name,
        slug: liveApps.slug,
      })
      .from(liveApps)
      .where(eq(liveApps.status, 'active'))
      .orderBy(asc(liveApps.name))
      .limit(6)

    return allLive.map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      role: 'Contributor',
      allocationPct: 0,
    }))
  }

  return rows
}
