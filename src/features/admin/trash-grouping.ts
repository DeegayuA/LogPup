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
// is ALWAYS the neutral placeholder that src/features/meetings/ai-actions.ts
// also uses for its own logActivity rows (noteSegmentDeleteLabel /
// keyframeDeleteLabel), never the segment's text or the keyframe's image.
// Trash is a retraction — showing what was retracted would defeat the point
// of having deleted it. trash-grouping.test.ts pins this down directly.
//
// The two builders below are DUPLICATED from ai-actions.ts, not imported —
// ai-actions.ts pulls in `@/lib/auth` (and, through it, next-auth/next/server)
// at module load, which is exactly the kind of dependency this file exists to
// stay free of so it can be unit tested with zero mocks. Each is one line;
// keep them byte-for-byte identical to ai-actions.ts's noteSegmentDeleteLabel
// / keyframeDeleteLabel if either ever changes.
const noteSegmentDeleteLabel = (meetingTitle: string) => `a note segment in ${meetingTitle}`
const keyframeDeleteLabel = (meetingTitle: string) => `a screen keyframe in ${meetingTitle}`

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
    // A task's sprintId is nulled out by deleteSprint for every LIVE task at
    // the moment its sprint is trashed (see deleteSprint in
    // src/features/sprints/actions.ts) — a task can never end up pointing at
    // a trashed sprint the way a segment/keyframe points at a trashed
    // meeting, so there is no parent-trashed state to surface here.
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
