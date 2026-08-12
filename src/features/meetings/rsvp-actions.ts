'use server'

import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { meetingAttendees, meetings } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'
import { MEETING_URL_ERROR, meetingUrlSchema } from '@/features/meetings/meeting-url'

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

  // Grab the title up front so the activity row can name the meeting.
  const [meeting] = await db
    .select({ title: meetings.title })
    .from(meetings)
    .where(eq(meetings.id, meetingId))

  const result = await db
    .update(meetingAttendees)
    .set({ response: parsed.data })
    .where(and(eq(meetingAttendees.meetingId, meetingId), eq(meetingAttendees.userId, session.user.id)))
    .returning({ userId: meetingAttendees.userId })

  if (result.length === 0) return err("You're not on this meeting's invite list")

  await logActivity({
    actorId: session.user.id,
    verb: 'rsvp',
    entityType: 'meeting',
    entityId: meetingId,
    entityLabel: meeting?.title ?? '',
    pagePath: '/meetings',
    detail: parsed.data,
  })

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
    .select({ createdBy: meetings.createdBy, title: meetings.title })
    .from(meetings)
    .where(eq(meetings.id, meetingId))
  if (!meeting) return err('Meeting not found')
  if (meeting.createdBy !== session.user.id && session.user.role !== 'admin') {
    return err('Only the organizer can set the link')
  }

  await db.update(meetings).set({ meetingUrl: parsed.data }).where(eq(meetings.id, meetingId))

  await logActivity({
    actorId: session.user.id,
    verb: 'updated',
    entityType: 'meeting',
    entityId: meetingId,
    entityLabel: meeting.title,
    pagePath: '/meetings',
    detail: 'meeting link',
    metadata: { meetingUrl: parsed.data },
  })

  revalidatePath('/meetings')
  return ok(undefined)
}
