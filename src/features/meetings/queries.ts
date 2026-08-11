import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { db } from '@/db'
import { apps, meetingAttendees, meetings, users } from '@/db/schema'

export type MeetingAttendee = { id: string; name: string; avatarUrl: string | null }

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
  googleEventId: string | null
  createdBy: string
  attendees: MeetingAttendee[]
}

const meetingColumns = {
  id: meetings.id,
  title: meetings.title,
  appId: meetings.appId,
  appName: apps.name,
  appSlug: apps.slug,
  startsAt: meetings.startsAt,
  endsAt: meetings.endsAt,
  agenda: meetings.agenda,
  notes: meetings.notes,
  googleEventId: meetings.googleEventId,
  createdBy: meetings.createdBy,
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

  const attendeeRows = await db
    .select({
      meetingId: meetingAttendees.meetingId,
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(meetingAttendees)
    .innerJoin(users, eq(meetingAttendees.userId, users.id))
    .where(inArray(meetingAttendees.meetingId, rows.map((r) => r.id)))

  const byMeeting = new Map<string, MeetingAttendee[]>()
  for (const row of attendeeRows) {
    const list = byMeeting.get(row.meetingId) ?? []
    list.push({ id: row.id, name: row.name, avatarUrl: row.avatarUrl })
    byMeeting.set(row.meetingId, list)
  }

  return rows.map((r) => ({ ...r, attendees: byMeeting.get(r.id) ?? [] }))
}

export async function listMeetings(): Promise<MeetingSummary[]> {
  const rows = await db
    .select(meetingColumns)
    .from(meetings)
    .leftJoin(apps, eq(meetings.appId, apps.id))
    .orderBy(desc(meetings.startsAt))

  return attachAttendees(rows)
}

export async function getMeetingsForApp(appId: string): Promise<MeetingSummary[]> {
  const rows = await db
    .select(meetingColumns)
    .from(meetings)
    .leftJoin(apps, eq(meetings.appId, apps.id))
    .where(eq(meetings.appId, appId))
    .orderBy(desc(meetings.startsAt))

  return attachAttendees(rows)
}

export async function getUpcomingMeetingsForUser(
  userId: string,
  days: number,
): Promise<MeetingSummary[]> {
  const now = new Date()
  const until = new Date(now)
  until.setDate(until.getDate() + days)

  const rows = await db
    .select(meetingColumns)
    .from(meetingAttendees)
    .innerJoin(meetings, eq(meetingAttendees.meetingId, meetings.id))
    .leftJoin(apps, eq(meetings.appId, apps.id))
    .where(
      and(
        eq(meetingAttendees.userId, userId),
        gte(meetings.startsAt, now),
        lte(meetings.startsAt, until),
      ),
    )
    .orderBy(asc(meetings.startsAt))

  return attachAttendees(rows)
}
