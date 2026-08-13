import { cache } from 'react'
import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { db } from '@/db'
import { liveMeetings } from '@/db/live'
import { apps, meetingAttendees, users } from '@/db/schema'

export type MeetingAttendee = {
  id: string
  name: string
  avatarUrl: string | null
  response: 'pending' | 'going' | 'maybe' | 'declined'
}

export type MeetingSummary = {
  id: string
  title: string
  appId: string | null
  appName: string | null
  appSlug: string | null
  startsAt: Date
  endsAt: Date
  agenda: string | null
  notes: string | null
  meetingUrl: string | null
  googleEventId: string | null
  createdBy: string
  attendees: MeetingAttendee[]
}

const meetingColumns = {
  id: liveMeetings.id,
  title: liveMeetings.title,
  appId: liveMeetings.appId,
  appName: apps.name,
  appSlug: apps.slug,
  startsAt: liveMeetings.startsAt,
  endsAt: liveMeetings.endsAt,
  agenda: liveMeetings.agenda,
  notes: liveMeetings.notes,
  meetingUrl: liveMeetings.meetingUrl,
  googleEventId: liveMeetings.googleEventId,
  createdBy: liveMeetings.createdBy,
}

/**
 * Meeting attendees are fetched in a second query keyed by meeting id
 * rather than joined into the main query — joining would multiply each
 * meeting row per attendee and complicate the ordering/pagination above.
 */
async function attachAttendees(
  rows: Omit<MeetingSummary, 'attendees'>[],
): Promise<MeetingSummary[]> {
  if (rows.length === 0) return []

  // meetingAttendees has no deletedAt of its own — live iff its meeting is
  // live. `rows` here already came from a liveMeetings-scoped query (see
  // listMeetings/getMeetingsForApp/getUpcomingMeetingsForUser below), so
  // scoping to `rows.map((r) => r.id)` cannot pull in a trashed meeting's
  // attendees (see MEETING_CHILD_TABLES in src/db/live.ts).
  const attendeeRows = await db
    .select({
      meetingId: meetingAttendees.meetingId,
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
      response: meetingAttendees.response,
    })
    .from(meetingAttendees)
    .innerJoin(users, eq(meetingAttendees.userId, users.id))
    .where(inArray(meetingAttendees.meetingId, rows.map((r) => r.id)))

  const byMeeting = new Map<string, MeetingAttendee[]>()
  for (const row of attendeeRows) {
    const list = byMeeting.get(row.meetingId) ?? []
    list.push({ id: row.id, name: row.name, avatarUrl: row.avatarUrl, response: row.response })
    byMeeting.set(row.meetingId, list)
  }

  return rows.map((r) => ({ ...r, attendees: byMeeting.get(r.id) ?? [] }))
}

export async function listMeetings(): Promise<MeetingSummary[]> {
  const rows = await db
    .select(meetingColumns)
    .from(liveMeetings)
    .leftJoin(apps, eq(liveMeetings.appId, apps.id))
    .orderBy(desc(liveMeetings.startsAt))

  return attachAttendees(rows)
}

export async function getMeetingsForApp(appId: string): Promise<MeetingSummary[]> {
  const rows = await db
    .select(meetingColumns)
    .from(liveMeetings)
    .leftJoin(apps, eq(liveMeetings.appId, apps.id))
    .where(eq(liveMeetings.appId, appId))
    .orderBy(desc(liveMeetings.startsAt))

  return attachAttendees(rows)
}

/**
 * One meeting with its attendees — the PDF export page's header data.
 * cache()-wrapped because the print route needs it twice per request
 * (generateMetadata for the PDF filename, then the page itself).
 */
export const getMeetingById = cache(
  async function getMeetingById(meetingId: string): Promise<MeetingSummary | null> {
    const rows = await db
      .select(meetingColumns)
      .from(meetings)
      .leftJoin(apps, eq(meetings.appId, apps.id))
      .where(eq(meetings.id, meetingId))

    const [meeting] = await attachAttendees(rows)
    return meeting ?? null
  },
)

export async function getUpcomingMeetingsForUser(
  userId: string,
  days: number,
): Promise<MeetingSummary[]> {
  const now = new Date()
  const until = new Date(now)
  until.setDate(until.getDate() + days)

  // meetingAttendees has no deletedAt of its own — live iff its meeting is
  // live (see MEETING_CHILD_TABLES in src/db/live.ts).
  const rows = await db
    .select(meetingColumns)
    .from(meetingAttendees)
    .innerJoin(liveMeetings, eq(meetingAttendees.meetingId, liveMeetings.id))
    .leftJoin(apps, eq(liveMeetings.appId, apps.id))
    .where(
      and(
        eq(meetingAttendees.userId, userId),
        gte(liveMeetings.startsAt, now),
        lte(liveMeetings.startsAt, until),
      ),
    )
    .orderBy(asc(liveMeetings.startsAt))

  return attachAttendees(rows)
}
