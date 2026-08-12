import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { meetingNoteSegments } from '@/db/schema'

/**
 * Whether ANY note segment has EVER existed for this meeting — live or
 * trashed. Deliberately reads the RAW meetingNoteSegments table rather than
 * liveNoteSegments (src/db/live.ts): it decides whether the note timeline
 * (getMeetingNoteTimeline in ai-actions.ts) and the typed-note composer
 * (addTypedNoteSegment) still treat the legacy `meetings.notes` blob as
 * live content.
 *
 * That blob retires the FIRST time a real segment is created for a meeting
 * (see addTypedNoteSegment's migrate-on-first-edit) and must STAY retired —
 * trashing the last live segment must never resurrect it. A liveNoteSegments
 * count would do exactly that: once every segment for a meeting is
 * soft-deleted, a live-only count goes back to zero and the legacy blob
 * would reappear as if nothing had ever been written, silently discarding
 * the fact that the meeting had already graduated to real segments.
 *
 * allowlisted: did-segments-EVER-exist probe — trashing the last segment
 * must not resurrect the legacy notes blob (see src/db/live.test.ts's
 * ALLOWLIST entry for this file).
 */
export async function haveNoteSegmentsEverExisted(meetingId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: meetingNoteSegments.id })
    .from(meetingNoteSegments)
    .where(eq(meetingNoteSegments.meetingId, meetingId))
    .limit(1)
  return row !== undefined
}
