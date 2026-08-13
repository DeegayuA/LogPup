import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { liveMeetings } from '@/db/live'
import { meetingAttendees, users } from '@/db/schema'
import { auth } from '@/lib/auth'
import { canAccessApp } from '@/lib/access-gate'
import { buildIcs, icsFileName, meetingIcsUid } from '@/features/meetings/ics'

/**
 * Streams a meeting's invite as an RFC 5545 `.ics` file.
 *
 * This is the calendar path that cannot break: it needs no OAuth token, no
 * Google API and no third-party availability, so it works for every user
 * whether they signed in with Google, Notion or a password. The Google
 * Calendar integration (features/calendar/google-calendar.ts) remains a
 * best-effort bonus on top of it, not the only way to get an invite out.
 *
 * Authorization mirrors the avatar proxy route and the meetings queries:
 * a session is required (401), and anyone who cannot reach the app itself —
 * or asks for a meeting that does not exist — gets a flat 404 that leaks
 * nothing about which of the two it was. Every approved member can already
 * see every meeting via listMeetings(), so no narrower per-meeting rule
 * exists to enforce here; if one is ever added to the queries, it belongs
 * here too.
 */

const paramsSchema = z.object({ id: z.uuid() })

/** RFC 5545 §3.8.7.4 requires SEQUENCE to increase whenever a REQUEST is
 * re-issued, or clients discard the update as stale. There is no revision
 * counter on the meetings table, so this derives one from elapsed whole
 * minutes since the row was created: strictly increasing over time, which is
 * a superset of "increases on every change". The cost is that re-downloading
 * an unchanged invite also bumps it — harmless, because the UID is stable and
 * the content identical, so a client updates the event in place. Erring this
 * way is deliberate: a sequence that is too low is silently ignored, which is
 * the failure mode this whole feature exists to stop. */
function sequenceFor(createdAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 60_000))
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return new Response('Unauthorized', { status: 401 })
  if (!canAccessApp(session.user.status ?? 'pending', true)) {
    return new Response('Not found', { status: 404 })
  }

  const parsed = paramsSchema.safeParse(await params)
  if (!parsed.success) return new Response('Not found', { status: 404 })

  const [meeting] = await db.select().from(liveMeetings).where(eq(liveMeetings.id, parsed.data.id))
  if (!meeting) return new Response('Not found', { status: 404 })

  const [[organizer], attendees] = await Promise.all([
    db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, meeting.createdBy)),
    // meetingAttendees has no deletedAt of its own — `meeting` above was
    // already confirmed live via liveMeetings, so filtering on its id here
    // cannot pull in a trashed meeting's attendees (see MEETING_CHILD_TABLES
    // in src/db/live.ts).
    db
      .select({ name: users.name, email: users.email })
      .from(meetingAttendees)
      .innerJoin(users, eq(meetingAttendees.userId, users.id))
      .where(eq(meetingAttendees.meetingId, meeting.id)),
  ])

  const now = new Date()
  let body: string
  try {
    body = buildIcs({
      uid: meetingIcsUid(meeting.id),
      sequence: sequenceFor(meeting.createdAt, now),
      now,
      title: meeting.title,
      description: meeting.agenda,
      // No room field on a meeting, so the join link doubles as the location —
      // which is what every calendar client shows in the "where" slot and makes
      // clickable on a phone.
      location: meeting.meetingUrl,
      url: meeting.meetingUrl,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      organizer: organizer ?? { name: null, email: 'noreply@logpup.app' },
      attendees,
    })
  } catch (error) {
    // buildIcs only throws on an event that cannot be represented at all
    // (blank title, inverted times) — data the create/reschedule actions
    // already reject, so reaching here means a row predating those rules.
    console.error('[ics] could not build invite for meeting', meeting.id, error)
    return new Response('This meeting cannot be exported as a calendar invite', { status: 422 })
  }

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8; method=REQUEST',
      'Content-Disposition': `attachment; filename="${icsFileName(meeting.title)}"`,
      // Per-user content behind auth, and it changes the moment the meeting is
      // edited — never let a shared cache or the browser hold a stale invite.
      'Cache-Control': 'private, no-store',
    },
  })
}
