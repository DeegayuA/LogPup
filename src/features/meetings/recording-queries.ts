import { and, desc, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/db'
import { meetingAiNotes, meetingRecordingSegments, meetingRecordings } from '@/db/schema'
import { canReadMeetingIntel } from '@/features/meetings/ai-actions'
import { liveMeetings } from '@/db/live'
import { auth } from '@/lib/auth'

/**
 * A meeting's takes, as the cards render them.
 *
 * READS DELETED ROWS ON PURPOSE, which is why this file carries an allowlist
 * entry in live.test.ts. A removed take has to stay visible to whoever removed
 * it, or "remove" is indistinguishable from "lose" and nobody will press the
 * button twice. The live/removed split is explicit in the returned shape
 * rather than implied by absence.
 */

export type RecordingTake = {
  id: string
  takeIndex: number
  label: string | null
  startedAt: Date
  endedAt: Date | null
  segments: number
  removed: boolean
  removedAt: Date | null
}

export type MeetingRecordings = {
  takes: RecordingTake[]
  /** Live takes only — a removed one is not a round this meeting still has. */
  rounds: number
  /**
   * Segments recorded before takes existed (recording_id NULL). Counted and
   * named rather than hidden: they are real transcript, they belong to this
   * meeting, and they cannot be attributed to any take without inventing one.
   */
  untrackedSegments: number
  /**
   * The written-up summary no longer covers what this meeting holds — a take
   * was added or removed after the synthesis ran.
   *
   * DERIVED, never stamped. A `stale` column would be one more thing to keep
   * true across every write path; comparing the two timestamps that already
   * exist cannot drift, because there is nothing to forget to update.
   */
  summaryStale: boolean
}

export async function listMeetingRecordings(meetingId: string): Promise<MeetingRecordings | null> {
  const session = await auth()
  if (!session?.user) return null
  // Resolved through liveMeetings, which is canReadMeetingIntel's stated
  // contract: a trashed meeting must read as "not found" rather than staying
  // reachable through its own gate.
  const [meeting] = await db
    .select({ id: liveMeetings.id, createdBy: liveMeetings.createdBy })
    .from(liveMeetings)
    .where(eq(liveMeetings.id, meetingId))
  if (!meeting) return null
  const allowed = await canReadMeetingIntel(
    { id: session.user.id, role: session.user.role },
    meeting,
  )
  if (!allowed) return null

  const [takes, untracked, notes, marks] = await Promise.all([
    db
      .select({
        id: meetingRecordings.id,
        takeIndex: meetingRecordings.takeIndex,
        label: meetingRecordings.label,
        startedAt: meetingRecordings.startedAt,
        endedAt: meetingRecordings.endedAt,
        deletedAt: meetingRecordings.deletedAt,
        segments: sql<number>`(
          select count(*)::int from meeting_recording_segments s
          where s.recording_id = ${meetingRecordings.id} and s.deleted_at is null
        )`,
      })
      .from(meetingRecordings)
      .where(eq(meetingRecordings.meetingId, meetingId))
      .orderBy(desc(meetingRecordings.takeIndex)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(meetingRecordingSegments)
      .where(
        and(
          eq(meetingRecordingSegments.meetingId, meetingId),
          isNull(meetingRecordingSegments.recordingId),
          isNull(meetingRecordingSegments.deletedAt),
        ),
      ),
    db
      .select({ createdAt: meetingAiNotes.createdAt })
      .from(meetingAiNotes)
      .where(eq(meetingAiNotes.meetingId, meetingId)),
    db
      .select({
        lastAdded: sql<Date | null>`max(${meetingRecordingSegments.createdAt})`,
        lastRemoved: sql<Date | null>`max(${meetingRecordingSegments.deletedAt})`,
      })
      .from(meetingRecordingSegments)
      .where(eq(meetingRecordingSegments.meetingId, meetingId)),
  ])

  const wroteUpAt = notes[0]?.createdAt ?? null
  const lastAdded = marks[0]?.lastAdded ? new Date(marks[0].lastAdded) : null
  const lastRemoved = marks[0]?.lastRemoved ? new Date(marks[0].lastRemoved) : null

  return {
    takes: takes.map((t) => ({
      id: t.id,
      takeIndex: t.takeIndex,
      label: t.label,
      startedAt: t.startedAt,
      endedAt: t.endedAt,
      segments: t.segments,
      removed: t.deletedAt !== null,
      removedAt: t.deletedAt,
    })),
    rounds: takes.filter((t) => t.deletedAt === null).length,
    untrackedSegments: untracked[0]?.n ?? 0,
    // No write-up yet is not stale — there is nothing to be out of date.
    summaryStale:
      wroteUpAt !== null
      && ((lastRemoved !== null && lastRemoved > wroteUpAt)
        || (lastAdded !== null && lastAdded > wroteUpAt)),
  }
}
