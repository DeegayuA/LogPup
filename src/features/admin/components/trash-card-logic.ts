// Pure, DB-free presentation logic for the admin Trash card — kept out of
// trash-card.tsx so it's unit-testable without any DOM/component test infra
// (this repo has none — see trash-card-logic.test.ts's file header for the
// check that justified that call). trash-card.tsx and trash-row-actions.tsx
// import from here rather than re-deriving any of this inline.

import type { TrashGroup, TrashKind, TrashRow } from '@/features/admin/trash-grouping'

/**
 * Canonical display order. Matches TRASH_KINDS in trash-grouping.ts (and
 * therefore the order getTrash() already returns groups in) but is restated
 * here rather than imported, so this module has zero runtime dependency on
 * trash-grouping.ts beyond its types — and so a future reordering of
 * TRASH_KINDS can't silently reorder the card without a matching, reviewed
 * change here too.
 */
export const TRASH_GROUP_ORDER: readonly TrashKind[] = [
  'meeting',
  'task',
  'sprint',
  'segment',
  'keyframe',
  'assignment',
]

export const TRASH_GROUP_TITLES: Record<TrashKind, string> = {
  meeting: 'Meetings',
  task: 'Tasks',
  sprint: 'Sprints',
  segment: 'Note segments',
  keyframe: 'Keyframes',
  assignment: 'Assignments',
}

/**
 * Re-sorts getTrash()'s groups into TRASH_GROUP_ORDER and fills in any
 * missing kind with an empty group, so the card's render order is guaranteed
 * by this module rather than by trusting the data layer's array order never
 * changes.
 */
export function orderGroupsForDisplay(groups: readonly TrashGroup[]): TrashGroup[] {
  const byKind = new Map(groups.map((g) => [g.kind, g] as const))
  return TRASH_GROUP_ORDER.map((kind) => byKind.get(kind) ?? { kind, rows: [], totalCount: 0 })
}

/**
 * "Showing latest N of M" — only worth a line when the bounded SELECT
 * (PER_SOURCE_LIMIT in trash-queries.ts) actually truncated something.
 * Returns null (render nothing) once every trashed row for that source is
 * already shown.
 */
export function trashCountFootnote(shownCount: number, totalCount: number): string | null {
  return totalCount > shownCount ? `Showing latest ${shownCount} of ${totalCount}` : null
}

/**
 * Segments/keyframes nest under their meeting (trash-grouping.ts's
 * parentTrashed) — restoring the child before the parent would come back
 * still invisible (liveNoteSegments/liveScreenshots' join to liveMeetings
 * would still filter it out), which is exactly what restoreSegment/
 * restoreKeyframe's own server-side guard in trash-actions.ts already
 * refuses with this same message. Surfacing it here too means the disabled
 * button explains itself before a click ever reaches the server.
 */
export function restoreDisabledReason(row: Pick<TrashRow, 'parentTrashed'>): string | null {
  return row.parentTrashed ? 'Restore the meeting first' : null
}

/**
 * The exact phrase purgeMeeting/purgeTask/purgeSprint/purgeSegment/
 * purgeKeyframe check server-side (trash-actions.ts's CONFIRM_PHRASE). Used
 * here ONLY to decide whether the "Delete forever" button is enabled yet —
 * whatever the user actually typed is always what gets passed to the server
 * action, which re-checks it independently; this local check never stands in
 * for that one and never short-circuits the call.
 */
export const PURGE_CONFIRM_PHRASE = 'delete forever'

export function matchesPurgeConfirm(typed: string): boolean {
  return typed === PURGE_CONFIRM_PHRASE
}
