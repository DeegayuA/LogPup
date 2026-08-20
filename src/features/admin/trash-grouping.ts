// Pure, DB-free row shaping for the admin Trash view. trash-queries.ts runs
// one bounded SELECT per soft-deleted source and hands the raw joined rows
// (plain data, no drizzle types) to the builders below, which decide what
// becomes the visible `label` vs the secondary `context` line, and whether a
// row's parent is itself trashed (`parentTrashed` — the "nesting" a segment
// or keyframe has: it lives inside a meeting that may or may not also be in
// the trash). Kept out of trash-queries.ts and free of any `db` import so
// this logic is unit-testable with hand-built fixtures, no mocking required.
//
// THE LABEL RULE THIS FILE EXISTS TO ENFORCE: a segment or keyframe's label
// is ALWAYS the neutral placeholder from note-labels.ts (also used by
// src/features/meetings/ai-actions.ts for its own logActivity rows), never
// the segment's text or the keyframe's image. Trash is a retraction —
// showing what was retracted would defeat the point of having deleted it.
// trash-grouping.test.ts pins this down directly.
//
// note-labels.ts is imported, not duplicated: it is deliberately a
// dependency-free leaf (imports nothing), unlike ai-actions.ts, which pulls
// in `@/lib/auth` — and, through it, next-auth/next/server — at module load.
// Importing the shared module keeps this file's zero-mock testability intact
// while removing the drift risk two separate copies would carry.
import { keyframeDeleteLabel, noteSegmentDeleteLabel } from '@/features/meetings/note-labels'

// 'app' leads the list because it is the only kind that can contain the
// others: a deleted app takes its whole board and calendar out of every view
// with it, so an admin scanning the trash for "what went missing today"
// should meet the project before its parts.
// 'bug' sits with the other app children (task, sprint) rather than at the
// end: bug_reports.app_id is NOT NULL and ON DELETE CASCADE (schema.ts), so a
// bug belongs to a project the same way a task does and goes with it on purge.
// 'person' sits LAST, and not because it matters least: it is the only kind
// here that is not work at all. Everything above it is something somebody
// made and then deleted; a person is somebody who left. Reading the bin as
// "what went missing from the projects, and separately, who went missing"
// keeps those two questions from being scanned as one list.
export const TRASH_KINDS = ['app', 'meeting', 'task', 'sprint', 'bug', 'segment', 'keyframe', 'assignment', 'person'] as const
export type TrashKind = (typeof TRASH_KINDS)[number]

export type TrashRow = {
  id: string
  label: string
  /** Secondary line under the label — the app it belongs to, usually. */
  context: string | null
  deletedByName: string | null
  deletedByAvatarUrl: string | null
  deletedAt: Date
  /** True when this row's parent (a meeting, for segments/keyframes) is
   *  ALSO trashed — the admin trash UI uses this to block restoring the
   *  child before the parent, matching restoreSegment/restoreKeyframe's own
   *  server-side guard in trash-actions.ts. */
  parentTrashed: boolean
}

export type TrashGroup = {
  kind: TrashKind
  rows: TrashRow[]
  /** How many trashed rows exist for this source in total — rows.length is
   *  "showing latest N", this is "of M", per the PER_SOURCE_LIMIT precedent
   *  in src/features/apps/activity-queries.ts. */
  totalCount: number
}

// --- Raw shapes trash-queries.ts's per-table SELECTs hand in ---------------

export type RawAppTrashRow = {
  id: string
  name: string
  /** The app's own status at the moment it was deleted. An archived app that
   *  is then deleted must come back archived, and the trash row says so
   *  rather than implying every restore lands back on the active list. */
  status: string
  deletedAt: Date
  deletedByName: string | null
  deletedByAvatarUrl: string | null
}

export type RawBugTrashRow = {
  id: string
  title: string
  appName: string | null
  deletedAt: Date
  deletedByName: string | null
  deletedByAvatarUrl: string | null
}

export type RawMeetingTrashRow = {
  id: string
  title: string
  appName: string | null
  deletedAt: Date
  deletedByName: string | null
  deletedByAvatarUrl: string | null
}

export type RawTaskTrashRow = {
  id: string
  title: string
  appName: string | null
  deletedAt: Date
  deletedByName: string | null
  deletedByAvatarUrl: string | null
}

export type RawSprintTrashRow = {
  id: string
  name: string
  appName: string | null
  deletedAt: Date
  deletedByName: string | null
  deletedByAvatarUrl: string | null
}

export type RawSegmentTrashRow = {
  id: string
  meetingTitle: string
  appName: string | null
  /** The parent meeting's OWN deletedAt (raw, not liveMeetings) — non-null
   *  means the meeting is trashed too. */
  meetingDeletedAt: Date | null
  deletedAt: Date
  deletedByName: string | null
  deletedByAvatarUrl: string | null
}

export type RawKeyframeTrashRow = RawSegmentTrashRow

export type RawAssignmentTrashRow = {
  id: string
  personName: string | null
  appName: string | null
  role: string
  /** assignment_history.effectiveFrom of the 'removed' tombstone — the
   *  instant they were unassigned, standing in for deletedAt. */
  deletedAt: Date
  deletedByName: string | null
  deletedByAvatarUrl: string | null
}

/**
 * An OPEN row in user_deletions — the same tombstone shape as the assignment
 * kind above, not a deletedAt row. `users` has no deletedAt column and must
 * not grow one (the long comment on userDeletions in db/schema.ts says why),
 * so what stands in for "deleted" here is the removal interval's start.
 */
export type RawPersonTrashRow = {
  /** user_deletions.id — the interval, not the person. It is the interval a
   *  restore closes, and a person may have more than one over time. */
  id: string
  personName: string | null
  /** Free text the remover typed: "contract ended", "duplicate account". */
  reason: string | null
  /** user_deletions.removedAt — when the interval opened. */
  deletedAt: Date
  deletedByName: string | null
  deletedByAvatarUrl: string | null
}

// --- Builders ----------------------------------------------------------

export function buildAppTrashRow(row: RawAppTrashRow): TrashRow {
  return {
    id: row.id,
    label: row.name,
    // Every other kind puts its app in `context`; an app IS the app, so the
    // secondary line carries the one fact a restorer needs instead — whether
    // it comes back to the active list or straight into the archive.
    context: row.status === 'archived' ? 'Archived project' : 'Project',
    deletedByName: row.deletedByName,
    deletedByAvatarUrl: row.deletedByAvatarUrl,
    deletedAt: row.deletedAt,
    // Nothing contains an app, so there is no parent to be trashed. The
    // reverse is what matters and is handled at read time: an app's sprints,
    // tasks and meetings are live iff the app is (the liveApps joins in
    // src/db/live.ts), so they are NOT separately trashed and must not be
    // separately listed here.
    parentTrashed: false,
  }
}

export function buildBugTrashRow(row: RawBugTrashRow): TrashRow {
  return {
    id: row.id,
    // The bug's own title, unlike a note segment's — a bug report is a
    // description of a fault somebody chose to publish to the team, not
    // private content that deleting retracts.
    label: row.title,
    context: row.appName,
    deletedByName: row.deletedByName,
    deletedByAvatarUrl: row.deletedByAvatarUrl,
    deletedAt: row.deletedAt,
    // A bug's app may itself be trashed, but that does not block restoring the
    // bug: bug_reports.app_id survives an app's soft delete untouched, so the
    // report simply reappears with its project when the project comes back —
    // the same reasoning as a task under a trashed sprint.
    parentTrashed: false,
  }
}

export function buildMeetingTrashRow(row: RawMeetingTrashRow): TrashRow {
  return {
    id: row.id,
    label: row.title,
    context: row.appName,
    deletedByName: row.deletedByName,
    deletedByAvatarUrl: row.deletedByAvatarUrl,
    deletedAt: row.deletedAt,
    parentTrashed: false,
  }
}

export function buildTaskTrashRow(row: RawTaskTrashRow): TrashRow {
  return {
    id: row.id,
    label: row.title,
    context: row.appName,
    deletedByName: row.deletedByName,
    deletedByAvatarUrl: row.deletedByAvatarUrl,
    deletedAt: row.deletedAt,
    // A trashed task CAN point at a trashed sprint — deleteSprint deliberately
    // leaves tasks.sprint_id alone so a sprint restore is lossless (see
    // src/features/sprints/actions.ts) — but unlike a segment/keyframe under a
    // trashed meeting, that is not a blocked restore: restoreTask works
    // regardless, and the task simply lands in the app backlog until its
    // sprint comes back too (the backlog rule in
    // src/features/sprints/backlog.ts). So there is genuinely nothing to
    // disable here, which is what parentTrashed drives.
    parentTrashed: false,
  }
}

export function buildSprintTrashRow(row: RawSprintTrashRow): TrashRow {
  return {
    id: row.id,
    label: row.name,
    context: row.appName,
    deletedByName: row.deletedByName,
    deletedByAvatarUrl: row.deletedByAvatarUrl,
    deletedAt: row.deletedAt,
    parentTrashed: false,
  }
}

export function buildSegmentTrashRow(row: RawSegmentTrashRow): TrashRow {
  return {
    id: row.id,
    // NEVER the segment's own text — see the file-level comment.
    label: noteSegmentDeleteLabel(row.meetingTitle),
    context: row.appName,
    deletedByName: row.deletedByName,
    deletedByAvatarUrl: row.deletedByAvatarUrl,
    deletedAt: row.deletedAt,
    parentTrashed: row.meetingDeletedAt !== null,
  }
}

export function buildKeyframeTrashRow(row: RawKeyframeTrashRow): TrashRow {
  return {
    id: row.id,
    // NEVER the screenshot image/URL — see the file-level comment.
    label: keyframeDeleteLabel(row.meetingTitle),
    context: row.appName,
    deletedByName: row.deletedByName,
    deletedByAvatarUrl: row.deletedByAvatarUrl,
    deletedAt: row.deletedAt,
    parentTrashed: row.meetingDeletedAt !== null,
  }
}

export function buildAssignmentTrashRow(row: RawAssignmentTrashRow): TrashRow {
  return {
    id: row.id,
    label: row.personName ?? 'Unknown user',
    context: row.appName ? `${row.appName} · ${row.role}` : row.role,
    deletedByName: row.deletedByName,
    deletedByAvatarUrl: row.deletedByAvatarUrl,
    deletedAt: row.deletedAt,
    parentTrashed: false,
  }
}

export function buildPersonTrashRow(row: RawPersonTrashRow): TrashRow {
  return {
    id: row.id,
    label: row.personName ?? 'Unknown user',
    // The reason IS shown, unlike a segment's content. It is not the removed
    // person's own words being re-broadcast after they retracted them — it is
    // the admin's note about why they removed somebody, written for exactly
    // this audience, and it is the one fact a second admin needs before
    // deciding whether to put them back. The fallback still states the kind
    // of row this is, the way an app row's context does.
    context: row.reason ?? 'Removed from the workspace',
    deletedByName: row.deletedByName,
    deletedByAvatarUrl: row.deletedByAvatarUrl,
    deletedAt: row.deletedAt,
    // Nothing contains a person. Their work is not nested under them either:
    // it stayed live and attributed the whole time they were removed, so
    // there is no parent to restore first.
    parentTrashed: false,
  }
}

/** Assembles one TrashGroup from a source's raw rows + its total count. */
export function toTrashGroup<T>(
  kind: TrashKind,
  rawRows: readonly T[],
  totalCount: number,
  build: (row: T) => TrashRow,
): TrashGroup {
  return { kind, rows: rawRows.map(build), totalCount }
}
