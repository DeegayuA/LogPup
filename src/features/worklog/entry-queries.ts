import { and, asc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { liveWorklogEntries } from '@/db/live'
import { apps, tasks } from '@/db/schema'
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
      taskTitle: tasks.title,
      appId: liveWorklogEntries.appId,
      appName: apps.name,
      appSlug: apps.slug,
    })
    .from(liveWorklogEntries)
    // LEFT joins, both: `task_id` is ON DELETE SET NULL and `app_id` is stored
    // rather than derived, precisely so hours survive the task being deleted.
    // An inner join would make those rows vanish from the day's total — losing
    // time somebody actually worked.
    .leftJoin(tasks, eq(tasks.id, liveWorklogEntries.taskId))
    .leftJoin(apps, eq(apps.id, liveWorklogEntries.appId))
    .where(and(eq(liveWorklogEntries.userId, userId), eq(liveWorklogEntries.day, day)))
    // Oldest first: the list reads in the order the day happened, which is how
    // somebody reconstructing it will check it.
    .orderBy(asc(liveWorklogEntries.createdAt))

  return rows as WorklogEntryRow[]
}
