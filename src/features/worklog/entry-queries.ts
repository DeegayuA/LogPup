import { and, asc, eq, gte, lte, sql } from 'drizzle-orm'

import { db } from '@/db'
import { liveApps, liveTasks, liveWorklogEntries } from '@/db/live'
import type { EntryCategory } from '@/features/worklog/entries'

/**
 * One day's logged hours AS THE PAGE RENDERS THEM.
 *
 * NOT a duplicate of `getMyDayEntries` in entry-evidence.ts, and named
 * differently on purpose so nobody imports the wrong one. That function feeds
 * the AI evidence pipeline and returns the narrow shape a prompt needs — id,
 * minutes, category, task title. This one feeds the UI and needs what a person
 * reads: the project name, the note, whether it was billable. Two readers, two
 * shapes, one table.
 *
 * If they ever converge, delete this and widen that one — but a display read
 * pulling two extra joins into every prompt build would be the worse merge.
 *
 * SELF-ONLY, and the caller passes the id rather than this resolving a
 * session: every existing worklog read follows that shape (getMyWorklogsInRange,
 * getMyDayEntries' neighbours), and a query that chose its own subject would be
 * one refactor away from being handed somebody else's.
 *
 * Reads through `liveWorklogEntries`, never the raw table — entries are
 * soft-deleted, and a deleted row still answering a total would make the
 * accounted figure quietly wrong rather than visibly missing.
 */

export type WorklogEntryRow = {
  id: string
  minutes: number
  category: EntryCategory
  billable: boolean
  note: string | null
  taskId: string | null
  /** Title of the task the time was booked to, when it was booked to one. */
  taskTitle: string | null
  appId: string | null
  appName: string | null
  appSlug: string | null
}

export async function listDayEntriesForDisplay(
  userId: string,
  day: string,
): Promise<WorklogEntryRow[]> {
  const rows = await db
    .select({
      id: liveWorklogEntries.id,
      minutes: liveWorklogEntries.minutes,
      category: liveWorklogEntries.category,
      billable: liveWorklogEntries.billable,
      note: liveWorklogEntries.note,
      taskId: liveWorklogEntries.taskId,
      taskTitle: liveTasks.title,
      appId: liveWorklogEntries.appId,
      appName: liveApps.name,
      appSlug: liveApps.slug,
    })
    .from(liveWorklogEntries)
    // LEFT joins onto the LIVE views, and both halves of that matter.
    //
    // LEFT, because `task_id` is ON DELETE SET NULL and `app_id` is stored
    // rather than derived, precisely so hours survive the work being deleted.
    // An inner join would make those rows vanish from the day's total, losing
    // time somebody actually worked.
    //
    // LIVE, because tasks and apps are soft-deletable: joining the raw tables
    // would surface a trashed task's title as though it were current. Through
    // the live views a trashed task yields a null title and the entry renders
    // under its category instead — the hours are kept, the stale name is not.
    // db/live.test.ts enforces this repo-wide, and it caught this file.
    .leftJoin(liveTasks, eq(liveTasks.id, liveWorklogEntries.taskId))
    .leftJoin(liveApps, eq(liveApps.id, liveWorklogEntries.appId))
    .where(and(eq(liveWorklogEntries.userId, userId), eq(liveWorklogEntries.day, day)))
    // Oldest first: the list reads in the order the day happened, which is how
    // somebody reconstructing it will check it.
    .orderBy(asc(liveWorklogEntries.createdAt))

  return rows as WorklogEntryRow[]
}

/**
 * The tasks this person can book hours to, for the picker on the day card.
 *
 * WHY DONE TASKS ARE IN HERE. The commonest reason to log task hours is
 * having just finished the thing, and `tasks` has no `updated_at` — there is
 * no column that could say "done recently", so a filter on status would
 * silently make the most ordinary case impossible. They are ordered last
 * instead, and carry their status as a hint so a finished task is visibly
 * finished before it is chosen.
 *
 * IN PROGRESS FIRST, not the enum's own order. `asc(status)` would sort
 * todo → in_progress → done, and the task somebody is logging against is
 * overwhelmingly the one they are in the middle of.
 *
 * ASSIGNED TO THEM, but that is a convenience and not a permission: the save
 * path accepts any live task id and derives the project from it. This list is
 * "what you are likely to want", not "what you are allowed to say".
 *
 * Through liveTasks and liveApps, so a trashed task is never offered — the
 * same rule resolveEntryAppId enforces one step later, applied here so the
 * refusal never has to happen.
 */
export type LoggableTask = {
  id: string
  title: string
  appName: string
  status: 'todo' | 'in_progress' | 'done'
}

/** Enough to cover a real backlog, small enough that one read stays cheap. */
const MAX_LOGGABLE_TASKS = 200

export async function listLoggableTasks(userId: string): Promise<LoggableTask[]> {
  const rows = await db
    .select({
      id: liveTasks.id,
      title: liveTasks.title,
      appName: liveApps.name,
      status: liveTasks.status,
    })
    .from(liveTasks)
    .innerJoin(liveApps, eq(liveApps.id, liveTasks.appId))
    .where(eq(liveTasks.assigneeId, userId))
    .orderBy(
      sql`case ${liveTasks.status} when 'in_progress' then 0 when 'todo' then 1 else 2 end`,
      asc(liveApps.name),
      asc(liveTasks.title),
    )
    .limit(MAX_LOGGABLE_TASKS)

  return rows as LoggableTask[]
}

/**
 * Which days in a range carry at least one live hour entry.
 *
 * ONE ROW PER DAY, not per entry: the caller only ever asks "does this day
 * have hours on it", and returning the entries themselves would pull a whole
 * month of rows across to answer a set-membership question.
 *
 * This is the other half of `getMyWorklogsInRange` (queries.ts). That one
 * reads daily_worklogs — the SCORE — and for a long time it was the only
 * input to every "is this day done?" answer on the page, so a day with three
 * carefully recorded hours and no slider movement was counted as empty. The
 * two reads stay separate because the two facts are separate: a score is a
 * judgement, hours are a measurement, and neither is derived from the other.
 * Composing them into a state is `classifyDay`'s job (day-state.ts), not a
 * query's.
 */
export async function getMyEntryDaysInRange(
  userId: string,
  fromIso: string,
  toIso: string,
): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ day: liveWorklogEntries.day })
    .from(liveWorklogEntries)
    .where(
      and(
        eq(liveWorklogEntries.userId, userId),
        gte(liveWorklogEntries.day, fromIso),
        lte(liveWorklogEntries.day, toIso),
      ),
    )

  return new Set(rows.map((row) => row.day))
}
