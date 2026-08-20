import { desc, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db'
import { liveApps, liveMeetings, liveTasks } from '@/db/live'
import {
  appComments,
  assignmentHistory,
  meetingApps,
  users,
} from '@/db/schema'
import {
  assignmentActivityTitle,
  mergeActivity,
  type AppActivityItem,
} from '@/features/apps/activity'
import { appTabHref, boardHref } from '@/features/apps/tabs'

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

  const [appRows, commentRows, taskRows, meetingRows, allocationRows] = await Promise.all([
    // The slug, so every item can carry a real destination. The feed was a
    // read-only cul-de-sac: item ids and kinds were known but no href was
    // built, so acting on anything meant re-finding it by hand on the right
    // tab. One tiny indexed read keeps getAppActivity's signature unchanged
    // for its (frozen) caller.
    db.select({ slug: liveApps.slug }).from(liveApps).where(eq(liveApps.id, appId)),
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
        id: liveTasks.id,
        at: liveTasks.createdAt,
        title: liveTasks.title,
        status: liveTasks.status,
        assigneeName: users.name,
        assigneeAvatarUrl: users.avatarUrl,
      })
      .from(liveTasks)
      // Left join: an unassigned task is normal and must still show up.
      .leftJoin(users, eq(users.id, liveTasks.assigneeId))
      .where(eq(liveTasks.appId, appId))
      .orderBy(desc(liveTasks.createdAt))
      .limit(PER_SOURCE_LIMIT),
    db
      .select({
        id: liveMeetings.id,
        at: liveMeetings.createdAt,
        title: liveMeetings.title,
        startsAt: liveMeetings.startsAt,
        creatorName: users.name,
        creatorAvatarUrl: users.avatarUrl,
      })
      .from(liveMeetings)
      .innerJoin(users, eq(users.id, liveMeetings.createdBy))
      // Through meeting_apps, not the deprecated meetings.app_id: a meeting
      // this project shares with two others still happened here, and reading
      // the single column would drop it from this feed while the Meetings tab
      // one click away still lists it.
      //
      // The join is pinned to ONE app_id, so it stays one row per meeting and
      // PER_SOURCE_LIMIT still means "the last N meetings", not "the last N
      // meeting-project pairs". meetingApps is reached through liveMeetings —
      // it has no deletedAt of its own (see MEETING_CHILD_TABLES in
      // src/db/live.ts).
      .innerJoin(meetingApps, eq(meetingApps.meetingId, liveMeetings.id))
      .where(eq(meetingApps.appId, appId))
      .orderBy(desc(liveMeetings.createdAt))
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

  const slug = appRows[0]?.slug ?? null

  const comments: AppActivityItem[] = commentRows.map((row) => ({
    id: `comment:${row.id}`,
    kind: 'comment',
    at: row.at,
    actorName: row.authorName,
    actorAvatarUrl: row.authorAvatarUrl,
    title: `${row.authorName} commented`,
    detail: firstLine(row.body),
    href: slug ? appTabHref(slug, 'discussion') : null,
  }))

  const taskItems: AppActivityItem[] = taskRows.map((row) => ({
    id: `task:${row.id}`,
    kind: 'task',
    at: row.at,
    actorName: row.assigneeName,
    actorAvatarUrl: row.assigneeAvatarUrl,
    title: `Task added — ${row.title}`,
    detail: row.assigneeName ? `Assigned to ${row.assigneeName}` : 'Unassigned',
    // Best effort, honestly limited: the board's `q` filter finds the card by
    // its title within the selected sprint. A task parked in an older sprint
    // lands on a filtered board whose columns say so in words — still one
    // click closer than re-finding it by hand.
    href: slug ? boardHref(slug, undefined, { q: row.title }) : null,
  }))

  const meetingItems: AppActivityItem[] = meetingRows.map((row) => ({
    id: `meeting:${row.id}`,
    kind: 'meeting',
    at: row.at,
    actorName: row.creatorName,
    actorAvatarUrl: row.creatorAvatarUrl,
    title: `Meeting scheduled — ${row.title}`,
    detail: null,
    // The meetings tab of this app, not /meetings/[id] — no such route exists
    // (same rule the search provider follows).
    href: slug ? appTabHref(slug, 'meetings') : null,
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
