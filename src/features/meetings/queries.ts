import { asc, count, eq, gte, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { apps, meetingAttendees, meetings } from '@/db/schema'

export type UpcomingMeeting = {
  id: string
  title: string
  startsAt: Date
  endsAt: Date
  appName: string | null
  appSlug: string | null
  googleEventId: string | null
  attendeeCount: number
}

export async function listUpcomingMeetings(): Promise<UpcomingMeeting[]> {
  const rows = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      startsAt: meetings.startsAt,
      endsAt: meetings.endsAt,
      appName: apps.name,
      appSlug: apps.slug,
      googleEventId: meetings.googleEventId,
    })
    .from(meetings)
    .leftJoin(apps, eq(meetings.appId, apps.id))
    .where(gte(meetings.startsAt, new Date()))
    .orderBy(asc(meetings.startsAt))
    .limit(30)

  if (rows.length === 0) return []

  const counts = await db
    .select({ meetingId: meetingAttendees.meetingId, attendeeCount: count() })
    .from(meetingAttendees)
    .where(
      inArray(
        meetingAttendees.meetingId,
        rows.map((r) => r.id),
      ),
    )
    .groupBy(meetingAttendees.meetingId)

  const countByMeeting = new Map(counts.map((c) => [c.meetingId, c.attendeeCount]))

  return rows.map((row) => ({
    ...row,
    attendeeCount: countByMeeting.get(row.id) ?? 0,
  }))
}
