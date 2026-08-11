'use server'

import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { meetingAttendeeHistory, meetingAttendees, meetings } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { MEETING_URL_ERROR, meetingUrlSchema } from '@/features/meetings/meeting-url'
import {
  buildAttendanceEntry,
  type AttendanceChange,
  type AttendanceResponse,
} from '@/features/meetings/attendance-history'

/**
 * The two statements every membership change appends to
 * `meeting_attendee_history`: close the interval currently open for this
 * (meetingId, userId), then open one describing the resulting state.
 *
 * Both take the SAME `at`, which is what makes the intervals abut exactly —
 * `[previous.effectiveFrom, at)` then `[at, …)`. selectRowsAsOf compares
 * half-open, so at exactly `at` the new row wins and never both. Deriving the
 * two timestamps separately would leave a gap or an overlap at the boundary
 * and quietly corrupt every "as of" answer that lands in it. Identical
 * reasoning, and identical shape, to historyStatements in
 * features/people/actions.ts.
 *
 * Returned rather than executed so the caller can put them in the same
 * db.batch as the mutation to `meeting_attendees` itself.
 */
function attendanceHistoryStatements(input: {
  meetingId: string
  userId: string
  response: AttendanceResponse
  changeKind: AttendanceChange
  changedBy: string
  at: Date
  note?: string | null
}) {
  return [
    db
      .update(meetingAttendeeHistory)
      .set({ effectiveTo: input.at })
      .where(
        and(
          eq(meetingAttendeeHistory.meetingId, input.meetingId),
          eq(meetingAttendeeHistory.userId, input.userId),
          isNull(meetingAttendeeHistory.effectiveTo),
        ),
      ),
    db.insert(meetingAttendeeHistory).values(buildAttendanceEntry(input)),
  ] as const
}

const RESPONSES = ['going', 'maybe', 'declined'] as const
const responseSchema = z.enum(RESPONSES)

// An attendee marks whether they're coming. Scoped to the caller's own
// attendee row — you can only set your own RSVP, and only for a meeting you're
// actually invited to.
export async function respondToMeeting(
  meetingId: string,
  response: (typeof RESPONSES)[number],
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')
  const parsed = responseSchema.safeParse(response)
  if (!parsed.success) return err('Invalid response')

  // Checked before the batch rather than via .returning(): a batch's
  // statements all run, so "you're not on the invite list" has to be an early
  // return, not a zero-row update discovered afterwards.
  const [existing] = await db
    .select({ userId: meetingAttendees.userId })
    .from(meetingAttendees)
    .where(
      and(eq(meetingAttendees.meetingId, meetingId), eq(meetingAttendees.userId, session.user.id)),
    )
  if (!existing) return err("You're not on this meeting's invite list")

  const at = new Date()
  // The RSVP is the only payload this membership carries, so a change to it
  // is an 'updated' interval — without this the open row's `response` drifts
  // out of sync with the live table and the history stops being a history.
  await db.batch([
    db
      .update(meetingAttendees)
      .set({ response: parsed.data })
      .where(
        and(
          eq(meetingAttendees.meetingId, meetingId),
          eq(meetingAttendees.userId, session.user.id),
        ),
      ),
    ...attendanceHistoryStatements({
      meetingId,
      userId: session.user.id,
      response: parsed.data,
      changeKind: 'updated',
      changedBy: session.user.id,
      at,
    }),
  ])

  revalidatePath('/meetings')
  revalidatePath('/')
  return ok(undefined)
}

/**
 * Takes someone off a meeting's invite list, closing their membership
 * interval and leaving a tombstone that records who removed them and when.
 *
 * Removal is a statement about the FUTURE only. It deliberately does not:
 *   - clear `meeting_note_segments.speakerId` — they did say those words;
 *   - reassign tasks already accepted from this meeting's suggestions;
 *   - touch `meeting_speakers` — the mapping is the record of whose voice
 *     that was, and deleting it would re-open the label to being guessed.
 * The transcript is a record of the past, and the past is not editable from
 * an invite list.
 *
 * Same permission rule as every other meeting write: an admin or the
 * meeting's creator.
 */
export async function removeMeetingAttendee(
  meetingId: string,
  userId: string,
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')

  const parsed = z
    .object({ meetingId: z.uuid(), userId: z.uuid() })
    .safeParse({ meetingId, userId })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const [meeting] = await db
    .select({ createdBy: meetings.createdBy })
    .from(meetings)
    .where(eq(meetings.id, parsed.data.meetingId))
  if (!meeting) return err('Meeting not found')
  if (meeting.createdBy !== session.user.id && session.user.role !== 'admin') {
    return err('Only the organizer can change the invite list')
  }

  const [existing] = await db
    .select({ response: meetingAttendees.response })
    .from(meetingAttendees)
    .where(
      and(
        eq(meetingAttendees.meetingId, parsed.data.meetingId),
        eq(meetingAttendees.userId, parsed.data.userId),
      ),
    )
  if (!existing) return err('That person is not on this meeting')

  const at = new Date()
  await db.batch([
    db
      .delete(meetingAttendees)
      .where(
        and(
          eq(meetingAttendees.meetingId, parsed.data.meetingId),
          eq(meetingAttendees.userId, parsed.data.userId),
        ),
      ),
    // Tombstone, not close-only: a close records the instant but not the
    // actor. The row stays open and carries the RSVP they last held, so the
    // timeline can say "removed — was going". See the meetingAttendeeHistory
    // comment in src/db/schema.ts.
    ...attendanceHistoryStatements({
      meetingId: parsed.data.meetingId,
      userId: parsed.data.userId,
      response: existing.response,
      changeKind: 'removed',
      changedBy: session.user.id,
      at,
    }),
  ])

  revalidatePath('/meetings')
  revalidatePath('/')
  return ok(undefined)
}

// Set (or clear) the video-call link. Only the meeting's creator or an admin
// may change it.
export async function setMeetingLink(meetingId: string, url: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')
  const parsed = meetingUrlSchema.safeParse(url)
  if (!parsed.success) return err(MEETING_URL_ERROR)

  const [meeting] = await db
    .select({ createdBy: meetings.createdBy })
    .from(meetings)
    .where(eq(meetings.id, meetingId))
  if (!meeting) return err('Meeting not found')
  if (meeting.createdBy !== session.user.id && session.user.role !== 'admin') {
    return err('Only the organizer can set the link')
  }

  await db.update(meetings).set({ meetingUrl: parsed.data }).where(eq(meetings.id, meetingId))
  revalidatePath('/meetings')
  return ok(undefined)
}
