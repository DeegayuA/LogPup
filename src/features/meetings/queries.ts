import { cache } from 'react'
import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { db } from '@/db'
import { meetingVisibleTo } from '@/features/meetings/visibility'
import { liveApps, liveMeetings } from '@/db/live'
import { meetingApps, meetingAttendees, users } from '@/db/schema'
import type { MeetingApp } from '@/features/meetings/app-labels'

export type MeetingAttendee = {
  id: string
  name: string
  avatarUrl: string | null
  response: 'pending' | 'going' | 'maybe' | 'declined'
  /** Real, visible invite property — see meeting_attendees.optional. */
  optional: boolean
}

export type MeetingSummary = {
  id: string
  title: string
  /** Who may see it: 'workspace' (everyone signed in) or 'attendees' only.
   *  Every list that carries a summary was already visibility-filtered for
   *  its viewer; this field exists so the EDIT form can show and keep the
   *  setting rather than silently resetting it to the default. */
  visibility: 'workspace' | 'attendees'
  /**
   * DEPRECATED. The meetings.app_id column — one project id, kept only so
   * change-request routing has a stable primary-ish answer without resolving a
   * set. It is NOT the meeting's project list: read `apps` for anything a
   * person sees and for every permission decision. See the comment on the
   * column in src/db/schema.ts.
   */
  appId: string | null
  /**
   * Every project this meeting is on, ordered by name, all equal. `[]` is the
   * app-less meeting — the company all-hands that belongs to nobody — and is
   * exactly the state `appId === null` used to mean on its own.
   */
  apps: MeetingApp[]
  startsAt: Date
  endsAt: Date
  agenda: string | null
  notes: string | null
  meetingUrl: string | null
  googleEventId: string | null
  createdBy: string
  attendees: MeetingAttendee[]
}

// No join to `apps` here any more: a meeting can be on several projects, and
// joining would multiply each meeting row per project — the same problem
// attachAttendees was written to avoid, with the same fix (see attachApps).
const meetingColumns = {
  id: liveMeetings.id,
  title: liveMeetings.title,
  visibility: liveMeetings.visibility,
  appId: liveMeetings.appId,
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
  rows: MeetingRow[],
): Promise<Map<string, MeetingAttendee[]>> {
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
      optional: meetingAttendees.optional,
    })
    .from(meetingAttendees)
    .innerJoin(users, eq(meetingAttendees.userId, users.id))
    .where(inArray(meetingAttendees.meetingId, rows.map((r) => r.id)))

  const byMeeting = new Map<string, MeetingAttendee[]>()
  for (const row of attendeeRows) {
    const list = byMeeting.get(row.meetingId) ?? []
    list.push({
      id: row.id,
      name: row.name,
      avatarUrl: row.avatarUrl,
      response: row.response,
      optional: row.optional,
    })
    byMeeting.set(row.meetingId, list)
  }

  return byMeeting
}

/**
 * The projects each meeting is on, fetched the same way and for the same
 * reason as the attendees above: joining meeting_apps into the main query
 * would return one row per meeting-project pair, so a meeting on four projects
 * would appear four times and any LIMIT or pagination above would count the
 * duplicates.
 *
 * ORDERED BY APP NAME, not by anything storage decides. Order here is what a
 * reader sees ("Alpha, Beta +2") and what decides which two names survive the
 * overflow, so ordering by a join-row id would shift the visible set between
 * two reads of an unchanged meeting.
 */
async function attachApps(rows: MeetingRow[]): Promise<Map<string, MeetingApp[]>> {
  // meetingApps has no deletedAt of its own — live iff its meeting is live.
  // `rows` already came from a liveMeetings-scoped query, so scoping to their
  // ids cannot pull in a trashed meeting's projects (see MEETING_CHILD_TABLES
  // in src/db/live.ts).
  const appRows = await db
    .select({
      meetingId: meetingApps.meetingId,
      id: liveApps.id,
      name: liveApps.name,
      slug: liveApps.slug,
    })
    .from(meetingApps)
    .innerJoin(liveApps, eq(meetingApps.appId, liveApps.id))
    .where(inArray(meetingApps.meetingId, rows.map((r) => r.id)))
    .orderBy(asc(liveApps.name))

  const byMeeting = new Map<string, MeetingApp[]>()
  for (const row of appRows) {
    const list = byMeeting.get(row.meetingId) ?? []
    list.push({ id: row.id, name: row.name, slug: row.slug })
    byMeeting.set(row.meetingId, list)
  }
  return byMeeting
}

/** The row shape every query below selects, before its two lists are attached. */
type MeetingRow = Omit<MeetingSummary, 'attendees' | 'apps'>

/**
 * Attaches both lists in ONE extra round trip each, in parallel — never one
 * query per meeting.
 */
async function hydrate(rows: MeetingRow[]): Promise<MeetingSummary[]> {
  if (rows.length === 0) return []
  const [attendeesByMeeting, appsByMeeting] = await Promise.all([
    attachAttendees(rows),
    attachApps(rows),
  ])
  return rows.map((r) => ({
    ...r,
    attendees: attendeesByMeeting.get(r.id) ?? [],
    apps: appsByMeeting.get(r.id) ?? [],
  }))
}

/**
 * Every meeting THIS VIEWER may see — the /meetings page's list and calendar.
 * 'attendees'-visibility meetings surface only for people on them; see
 * meetingVisibleTo. There is deliberately no viewerless variant left: a list
 * of all meetings with no viewer is exactly the query that leaks a private
 * one.
 */
export async function listMeetings(viewerId: string): Promise<MeetingSummary[]> {
  const rows = await db
    .select(meetingColumns)
    .from(liveMeetings)
    .where(meetingVisibleTo(viewerId))
    .orderBy(desc(liveMeetings.startsAt))

  return hydrate(rows)
}

/**
 * The meetings on ONE project — the app page's Meetings tab.
 *
 * The innerJoin is pinned to a single app_id, so it still returns exactly one
 * row per meeting even though a meeting can be on several projects. hydrate()
 * then attaches the FULL project list, which is what lets the tab show a joint
 * meeting's sibling projects instead of implying it belongs here alone.
 */
export async function getMeetingsForApp(appId: string, viewerId: string): Promise<MeetingSummary[]> {
  const rows = await db
    .select(meetingColumns)
    .from(liveMeetings)
    .innerJoin(meetingApps, eq(meetingApps.meetingId, liveMeetings.id))
    .where(and(eq(meetingApps.appId, appId), meetingVisibleTo(viewerId)))
    .orderBy(desc(liveMeetings.startsAt))

  return hydrate(rows)
}

/**
 * One meeting with its attendees — the PDF export page's header data.
 * cache()-wrapped because the print route needs it twice per request
 * (generateMetadata for the PDF filename, then the page itself).
 */
export const getMeetingById = cache(
  async function getMeetingById(
    meetingId: string,
    viewerId: string,
  ): Promise<MeetingSummary | null> {
    const rows = await db
      .select(meetingColumns)
      .from(liveMeetings)
      // Visibility is part of "exists" here on purpose: a private meeting a
      // non-attendee asks for by id answers null, indistinguishable from a
      // meeting that was never created — an exports route must not confirm
      // the id is real by answering 403 instead of 404.
      .where(and(eq(liveMeetings.id, meetingId), meetingVisibleTo(viewerId)))

    const [meeting] = await hydrate(rows)
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
    .where(
      and(
        eq(meetingAttendees.userId, userId),
        gte(liveMeetings.startsAt, now),
        lte(liveMeetings.startsAt, until),
      ),
    )
    .orderBy(asc(liveMeetings.startsAt))

  return hydrate(rows)
}
