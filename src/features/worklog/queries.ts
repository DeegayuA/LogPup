import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { db } from '@/db'
import { dailyWorklogs, users } from '@/db/schema'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'

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
