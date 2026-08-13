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

export const TRASH_KINDS = ['meeting', 'task', 'sprint', 'segment', 'keyframe', 'assignment'] as const
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

// --- Builders ----------------------------------------------------------

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

/** Assembles one TrashGroup from a source's raw rows + its total count. */
export function toTrashGroup<T>(
  kind: TrashKind,
  rawRows: readonly T[],
  totalCount: number,
  build: (row: T) => TrashRow,
): TrashGroup {
  return { kind, rows: rawRows.map(build), totalCount }
}
