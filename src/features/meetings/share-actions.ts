'use server'

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { liveMeetings } from '@/db/live'
import { meetingAttendees, users } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'

export type MeetingShareInfo = {
  title: string
  startsAt: Date
  meetingUrl: string | null
  attendees: {
    id: string
    name: string
    email: string
    /** Normalized (+94…) or null — feeds wa.me; a row without one still gets email. */
    phone: string | null
  }[]
}

/**
 * Everything the share sheet needs to hand a meeting to WhatsApp or email.
 *
 * PERMISSION: organiser or admin — the people allowed to change the invite
 * list are the people entitled to broadcast to it. Deliberately NOT the
 * attendee gate (canReadMeetingIntel): this returns every attendee's phone
 * number and email in one payload, which is a directory read, not a "was I in
 * the room" read.
 *
 * Sharing itself stays on the device: wa.me and mailto: both end at a compose
 * box with the organiser's thumb on the send button (the contact-buttons.tsx
 * contract). Nothing here sends anything.
 */
export async function getMeetingShareInfo(
  meetingId: string,
): Promise<ActionResult<MeetingShareInfo>> {
  const session = await auth()
  if (!session?.user) return err('Sign in required')

  const parsed = z.uuid().safeParse(meetingId)
  if (!parsed.success) return err('Meeting not found')

  const [meeting] = await db
    .select({
      title: liveMeetings.title,
      startsAt: liveMeetings.startsAt,
      meetingUrl: liveMeetings.meetingUrl,
      createdBy: liveMeetings.createdBy,
    })
    .from(liveMeetings)
    .where(eq(liveMeetings.id, parsed.data))
  if (!meeting) return err('Meeting not found')
  if (meeting.createdBy !== session.user.id && session.user.role !== 'admin') {
    return err('Only the organiser can share the invite')
  }

  const attendees = await db
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
    .from(meetingAttendees)
    .innerJoin(users, eq(meetingAttendees.userId, users.id))
    .where(eq(meetingAttendees.meetingId, parsed.data))
    .orderBy(users.name)

  return ok({
    title: meeting.title,
    startsAt: meeting.startsAt,
    meetingUrl: meeting.meetingUrl,
    attendees,
  })
}
