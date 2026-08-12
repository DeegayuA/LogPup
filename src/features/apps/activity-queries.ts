import { desc, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db'
import {
  appComments,
  assignmentHistory,
  meetings,
  tasks,
  users,
} from '@/db/schema'
import {
  assignmentActivityTitle,
  mergeActivity,
  type AppActivityItem,
} from '@/features/apps/activity'

/**
 * Per-source cap. Each branch is fetched at this depth and the merge trims to
 * the caller's limit, so one very chatty source (a comment thread) can never
 * push every task and allocation change off the front of the feed.
 */
const PER_SOURCE_LIMIT = 25

/** Trims a body to a single glanceable line without cutting mid-word. */
function firstLine(text: string, maxLength = 140): string {
  const line = text.split('\n').find((candidate) => candidate.trim().length > 0)?.trim() ?? ''
  if (line.length <= maxLength) return line
  const clipped = line.slice(0, maxLength)
  const lastSpace = clipped.lastIndexOf(' ')
  return `${lastSpace > maxLength / 2 ? clipped.slice(0, lastSpace) : clipped}…`
}

// NOTE: "when did this app last move" deliberately does NOT live here. It is a
// `max(created_at)` column on the three aggregates `getAppCounts` (queries.ts)
// already runs for the header. It was briefly its own trio of queries in this
// file, which doubled the round trips on every tab of every app for numbers
// that were being fetched two lines away.

/**
 * "What has actually happened on this app lately", assembled from the four
 * tables that carry a per-app timestamp.
 *
 * `assignment_history` is the interesting one: it already carries a per-app
 * index (`assignment_history_app_from_idx`, see schema.ts) and an actor on
 * every row, and until now nothing in the product read it per app — so who
 * joined the project and when was recorded but unreadable.
 *
 * `tasks` has no `created_by` column, so a task's actor is genuinely unknown;
 * the row shows the assignee as context instead of inventing an author.
 */
export async function getAppActivity(appId: string, limit = 40): Promise<AppActivityItem[]> {
  const person = alias(users, 'activity_person')
  const actor = alias(users, 'activity_actor')

  const [commentRows, taskRows, meetingRows, allocationRows] = await Promise.all([
    db
      .select({
        id: appComments.id,
        at: appComments.createdAt,
        body: appComments.body,
        authorName: users.name,
        authorAvatarUrl: users.avatarUrl,
      })
      .from(appComments)
      .innerJoin(users, eq(users.id, appComments.authorId))
      .where(eq(appComments.appId, appId))
      .orderBy(desc(appComments.createdAt))
      .limit(PER_SOURCE_LIMIT),
    db
      .select({
        id: tasks.id,
        at: tasks.createdAt,
        title: tasks.title,
        status: tasks.status,
        assigneeName: users.name,
        assigneeAvatarUrl: users.avatarUrl,
      })
      .from(tasks)
      // Left join: an unassigned task is normal and must still show up.
      .leftJoin(users, eq(users.id, tasks.assigneeId))
      .where(eq(tasks.appId, appId))
      .orderBy(desc(tasks.createdAt))
      .limit(PER_SOURCE_LIMIT),
    db
      .select({
        id: meetings.id,
        at: meetings.createdAt,
        title: meetings.title,
        startsAt: meetings.startsAt,
        creatorName: users.name,
        creatorAvatarUrl: users.avatarUrl,
      })
      .from(meetings)
      .innerJoin(users, eq(users.id, meetings.createdBy))
      .where(eq(meetings.appId, appId))
      .orderBy(desc(meetings.createdAt))
      .limit(PER_SOURCE_LIMIT),
    db
      .select({
        id: assignmentHistory.id,
        at: assignmentHistory.effectiveFrom,
        changeKind: assignmentHistory.changeKind,
        allocationPct: assignmentHistory.allocationPct,
        role: assignmentHistory.role,
        personName: person.name,
        personAvatarUrl: person.avatarUrl,
        actorName: actor.name,
      })
      .from(assignmentHistory)
      .innerJoin(person, eq(person.id, assignmentHistory.userId))
      // Left join: a deleted admin must not erase the changes they made.
      .leftJoin(actor, eq(actor.id, assignmentHistory.changedBy))
      .where(eq(assignmentHistory.appId, appId))
      .orderBy(desc(assignmentHistory.effectiveFrom))
      .limit(PER_SOURCE_LIMIT),
  ])

  const comments: AppActivityItem[] = commentRows.map((row) => ({
    id: `comment:${row.id}`,
    kind: 'comment',
    at: row.at,
    actorName: row.authorName,
    actorAvatarUrl: row.authorAvatarUrl,
    title: `${row.authorName} commented`,
    detail: firstLine(row.body),
    href: null,
  }))

  const taskItems: AppActivityItem[] = taskRows.map((row) => ({
    id: `task:${row.id}`,
    kind: 'task',
    at: row.at,
    actorName: row.assigneeName,
    actorAvatarUrl: row.assigneeAvatarUrl,
    title: `Task added — ${row.title}`,
    detail: row.assigneeName ? `Assigned to ${row.assigneeName}` : 'Unassigned',
    href: null,
  }))

  const meetingItems: AppActivityItem[] = meetingRows.map((row) => ({
    id: `meeting:${row.id}`,
    kind: 'meeting',
    at: row.at,
    actorName: row.creatorName,
    actorAvatarUrl: row.creatorAvatarUrl,
    title: `Meeting scheduled — ${row.title}`,
    detail: null,
    href: null,
  }))

  const allocationItems: AppActivityItem[] = allocationRows.map((row) => ({
    id: `assignment:${row.id}`,
    kind: 'assignment',
    at: row.at,
    actorName: row.personName,
    actorAvatarUrl: row.personAvatarUrl,
    title: assignmentActivityTitle(row.changeKind, row.personName, row.allocationPct),
    detail: row.changeKind === 'removed' ? null : `${row.role}${row.actorName ? ` · by ${row.actorName}` : ''}`,
    href: null,
  }))

  return mergeActivity([comments, taskItems, meetingItems, allocationItems], limit)
}
