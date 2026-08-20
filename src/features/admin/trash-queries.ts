// trash: the one read that wants deleted rows.
//
// Every other query in this codebase reads the five soft-deleted tables
// through src/db/live.ts's liveMeetings/liveTasks/liveSprints/
// liveNoteSegments/liveScreenshots subqueries, which exist specifically to
// EXCLUDE deletedAt IS NOT NULL rows. This file is the deliberate exception —
// the admin Trash view's whole job is to show exactly those rows — so it
// reads meetings/tasks/sprints/meetingNoteSegments/meetingScreenshots raw.
// It is pre-allowlisted by path in src/db/live.test.ts's checks 1/2/4.
//
// Shape: one bounded SELECT per source (PER_SOURCE_LIMIT, same precedent as
// getAppActivity in src/features/apps/activity-queries.ts), run together in a
// single Promise.all so a future admin page pays one round-trip-shaped cost
// for the whole view rather than one query per group. Each source also gets
// a COUNT(*) so the UI can say "showing latest N of M" instead of silently
// truncating.

import { alias } from 'drizzle-orm/pg-core'
import { and, count, desc, eq, isNotNull, isNull } from 'drizzle-orm'
import { db } from '@/db'
import {
  apps,
  assignmentHistory,
  meetingNoteSegments,
  meetingScreenshots,
  meetings,
  sprints,
  tasks,
  users,
} from '@/db/schema'
import {
  buildAppTrashRow,
  buildAssignmentTrashRow,
  buildKeyframeTrashRow,
  buildMeetingTrashRow,
  buildSegmentTrashRow,
  buildSprintTrashRow,
  buildTaskTrashRow,
  toTrashGroup,
  type TrashGroup,
} from '@/features/admin/trash-grouping'

/** Per-source cap, mirroring PER_SOURCE_LIMIT in activity-queries.ts. */
const PER_SOURCE_LIMIT = 50

export async function getTrash(): Promise<TrashGroup[]> {
  const [
    appRows,
    [appTotal],
    meetingRows,
    [meetingTotal],
    taskRows,
    [taskTotal],
    sprintRows,
    [sprintTotal],
    segmentRows,
    [segmentTotal],
    keyframeRows,
    [keyframeTotal],
    assignmentRows,
    [assignmentTotal],
  ] = await Promise.all([
    // Apps first, matching TRASH_KINDS: a deleted project explains why a pile
    // of its meetings and sprints stopped appearing, and reading that
    // explanation after the consequences is the wrong order.
    db
      .select({
        id: apps.id,
        name: apps.name,
        status: apps.status,
        deletedAt: apps.deletedAt,
        deletedByName: users.name,
        deletedByAvatarUrl: users.avatarUrl,
      })
      .from(apps)
      .leftJoin(users, eq(apps.deletedBy, users.id))
      .where(isNotNull(apps.deletedAt))
      .orderBy(desc(apps.deletedAt))
      .limit(PER_SOURCE_LIMIT),
    db.select({ total: count() }).from(apps).where(isNotNull(apps.deletedAt)),

    db
      .select({
        id: meetings.id,
        title: meetings.title,
        appName: apps.name,
        deletedAt: meetings.deletedAt,
        deletedByName: users.name,
        deletedByAvatarUrl: users.avatarUrl,
      })
      .from(meetings)
      .leftJoin(apps, eq(meetings.appId, apps.id))
      .leftJoin(users, eq(meetings.deletedBy, users.id))
      .where(isNotNull(meetings.deletedAt))
      .orderBy(desc(meetings.deletedAt))
      .limit(PER_SOURCE_LIMIT),
    db.select({ total: count() }).from(meetings).where(isNotNull(meetings.deletedAt)),

    db
      .select({
        id: tasks.id,
        title: tasks.title,
        appName: apps.name,
        deletedAt: tasks.deletedAt,
        deletedByName: users.name,
        deletedByAvatarUrl: users.avatarUrl,
      })
      .from(tasks)
      .leftJoin(apps, eq(tasks.appId, apps.id))
      .leftJoin(users, eq(tasks.deletedBy, users.id))
      .where(isNotNull(tasks.deletedAt))
      .orderBy(desc(tasks.deletedAt))
      .limit(PER_SOURCE_LIMIT),
    db.select({ total: count() }).from(tasks).where(isNotNull(tasks.deletedAt)),

    db
      .select({
        id: sprints.id,
        name: sprints.name,
        appName: apps.name,
        deletedAt: sprints.deletedAt,
        deletedByName: users.name,
        deletedByAvatarUrl: users.avatarUrl,
      })
      .from(sprints)
      .leftJoin(apps, eq(sprints.appId, apps.id))
      .leftJoin(users, eq(sprints.deletedBy, users.id))
      .where(isNotNull(sprints.deletedAt))
      .orderBy(desc(sprints.deletedAt))
      .limit(PER_SOURCE_LIMIT),
    db.select({ total: count() }).from(sprints).where(isNotNull(sprints.deletedAt)),

    // Segments/keyframes have no appId of their own — joined through their
    // (raw, possibly-also-trashed) parent meeting for both the app-name
    // context and meetingDeletedAt (the "is the parent also trashed" flag
    // trash-grouping.ts turns into parentTrashed). NEVER select `.content` —
    // a retraction must not re-broadcast what it retracts; the label is
    // always the neutral noteSegmentDeleteLabel placeholder instead (see
    // trash-grouping.ts).
    db
      .select({
        id: meetingNoteSegments.id,
        meetingTitle: meetings.title,
        appName: apps.name,
        meetingDeletedAt: meetings.deletedAt,
        deletedAt: meetingNoteSegments.deletedAt,
        deletedByName: users.name,
        deletedByAvatarUrl: users.avatarUrl,
      })
      .from(meetingNoteSegments)
      .innerJoin(meetings, eq(meetingNoteSegments.meetingId, meetings.id))
      .leftJoin(apps, eq(meetings.appId, apps.id))
      .leftJoin(users, eq(meetingNoteSegments.deletedBy, users.id))
      .where(isNotNull(meetingNoteSegments.deletedAt))
      .orderBy(desc(meetingNoteSegments.deletedAt))
      .limit(PER_SOURCE_LIMIT),
    db.select({ total: count() }).from(meetingNoteSegments).where(isNotNull(meetingNoteSegments.deletedAt)),

    // Same shape as segments; NEVER select `.blobUrl`/`.blobPathname` — the
    // image itself is the content a retraction must not re-broadcast.
    db
      .select({
        id: meetingScreenshots.id,
        meetingTitle: meetings.title,
        appName: apps.name,
        meetingDeletedAt: meetings.deletedAt,
        deletedAt: meetingScreenshots.deletedAt,
        deletedByName: users.name,
        deletedByAvatarUrl: users.avatarUrl,
      })
      .from(meetingScreenshots)
      .innerJoin(meetings, eq(meetingScreenshots.meetingId, meetings.id))
      .leftJoin(apps, eq(meetings.appId, apps.id))
      .leftJoin(users, eq(meetingScreenshots.deletedBy, users.id))
      .where(isNotNull(meetingScreenshots.deletedAt))
      .orderBy(desc(meetingScreenshots.deletedAt))
      .limit(PER_SOURCE_LIMIT),
    db.select({ total: count() }).from(meetingScreenshots).where(isNotNull(meetingScreenshots.deletedAt)),

    // Assignments are hard-deleted by design (see the schema.ts comment on
    // assignment_history) — there is no "assignments WHERE deletedAt IS NOT
    // NULL" to read. Its trash record IS the still-open changeKind='removed'
    // tombstone: "still open" (effectiveTo IS NULL) means nothing has since
    // re-added this (user, app) pairing, which is exactly what
    // assignment_history_one_open_idx enforces at most one of per pairing.
    (() => {
      const person = alias(users, 'trash_assignment_person')
      const actor = alias(users, 'trash_assignment_actor')
      return db
        .select({
          id: assignmentHistory.id,
          personName: person.name,
          appName: apps.name,
          role: assignmentHistory.role,
          deletedAt: assignmentHistory.effectiveFrom,
          deletedByName: actor.name,
          deletedByAvatarUrl: actor.avatarUrl,
        })
        .from(assignmentHistory)
        .innerJoin(person, eq(assignmentHistory.userId, person.id))
        .leftJoin(actor, eq(assignmentHistory.changedBy, actor.id))
        .leftJoin(apps, eq(assignmentHistory.appId, apps.id))
        .where(and(eq(assignmentHistory.changeKind, 'removed'), isNull(assignmentHistory.effectiveTo)))
        .orderBy(desc(assignmentHistory.effectiveFrom))
        .limit(PER_SOURCE_LIMIT)
    })(),
    db
      .select({ total: count() })
      .from(assignmentHistory)
      .where(and(eq(assignmentHistory.changeKind, 'removed'), isNull(assignmentHistory.effectiveTo))),
  ])

  return [
    toTrashGroup(
      'app',
      appRows.map((r) => ({ ...r, deletedAt: r.deletedAt! })),
      appTotal?.total ?? 0,
      buildAppTrashRow,
    ),
    toTrashGroup(
      'meeting',
      // The WHERE isNotNull(meetings.deletedAt) above guarantees deletedAt is
      // set on every row this query returns — the `!` just narrows the type
      // drizzle infers (nullable at the schema level) back to what's true here.
      meetingRows.map((r) => ({ ...r, deletedAt: r.deletedAt! })),
      meetingTotal?.total ?? 0,
      buildMeetingTrashRow,
    ),
    toTrashGroup(
      'task',
      taskRows.map((r) => ({ ...r, deletedAt: r.deletedAt! })),
      taskTotal?.total ?? 0,
      buildTaskTrashRow,
    ),
    toTrashGroup(
      'sprint',
      sprintRows.map((r) => ({ ...r, deletedAt: r.deletedAt! })),
      sprintTotal?.total ?? 0,
      buildSprintTrashRow,
    ),
    toTrashGroup(
      'segment',
      segmentRows.map((r) => ({ ...r, deletedAt: r.deletedAt! })),
      segmentTotal?.total ?? 0,
      buildSegmentTrashRow,
    ),
    toTrashGroup(
      'keyframe',
      keyframeRows.map((r) => ({ ...r, deletedAt: r.deletedAt! })),
      keyframeTotal?.total ?? 0,
      buildKeyframeTrashRow,
    ),
    toTrashGroup('assignment', assignmentRows, assignmentTotal?.total ?? 0, buildAssignmentTrashRow),
  ]
}
