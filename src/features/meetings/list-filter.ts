/**
 * The `?f=` grammar for the /meetings docket — which meetings a triage tile
 * keeps when pressed.
 *
 * Pure on purpose: the tiles' counts and the filtered list below them MUST
 * share one predicate, or a tile can advertise "3" while the docket shows two
 * rows. parseListFilter is the only reader of the raw search param, so a
 * mangled or stale URL (`?f=stuck`, `?f=Waiting`) degrades to "no filter"
 * rather than an inexplicably empty page.
 */

import {
  isAwaitingViewerRsvp,
  type AttendeeResponse,
} from '@/features/meetings/components/meeting-glance'
import type { MeetingGlance } from '@/features/meetings/components/meeting-notes-model'

export type ListFilter = 'waiting' | 'overdue' | 'followups' | 'questions'

const LIST_FILTERS: readonly ListFilter[] = ['waiting', 'overdue', 'followups', 'questions']

/**
 * Exact-match, case-sensitive: the app writes these four lowercase values and
 * nothing else, so anything unrecognised is a hand-edited or out-of-date URL
 * — treat it as no filter, never as an error the viewer has to see.
 */
export function parseListFilter(value: string | null): ListFilter | null {
  if (value === null) return null
  return (LIST_FILTERS as readonly string[]).includes(value) ? (value as ListFilter) : null
}

/** Structural on purpose: MeetingSummary satisfies it, and the one fact the
 *  synchronous filter needs — who has answered — stays visible in the type. */
type FilterableMeeting = {
  attendees: { id: string; response: AttendeeResponse }[]
}

/**
 * Does one meeting survive one filter?
 *
 * 'waiting' answers synchronously from the attendees the row already holds —
 * the tile must be pressable before any glance resolves — and it IS
 * isAwaitingViewerRsvp (meeting-glance.ts): the one pending-RSVP source, so
 * the tile, the nudge and the row's inline RSVP can never drift apart.
 *
 * The glance-backed filters honour the tri-state contract: `undefined` means
 * the batch is still counting and `null` means asked-and-nothing-to-show —
 * which is deliberately also what permission-denied looks like, so counts
 * never leak. Both answer "no match": a filter never claims a meeting on
 * facts it does not hold.
 */
export function matchesListFilter(
  filter: ListFilter,
  meeting: FilterableMeeting,
  viewerId: string,
  glance: MeetingGlance | null | undefined,
): boolean {
  if (filter === 'waiting') {
    return isAwaitingViewerRsvp(meeting, viewerId)
  }

  if (!glance) return false
  if (filter === 'overdue') return glance.overdueActions > 0
  if (filter === 'followups') return glance.openFollowups > 0
  return glance.questions > 0
}
