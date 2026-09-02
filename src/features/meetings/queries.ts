import { cache } from 'react'
import { and, asc, desc, eq, gt, gte, inArray, lt, lte, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { meetingVisibleTo } from '@/features/meetings/visibility'
import { liveApps, liveMeetings } from '@/db/live'
import { meetingApps, meetingAttendees, users } from '@/db/schema'
import type { MeetingApp } from '@/features/meetings/app-labels'
import { parseColomboWallClock } from '@/features/meetings/next-meeting'

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
 * Where a "Show earlier meetings" page picks up. `endsAt` is the ISO instant
 * of the last row already shown, `id` its meeting id — the tiebreak for two
 * meetings ending at the same instant, without which a page boundary landing
 * inside a tie would repeat or skip a row.
 */
export type PastMeetingCursor = { endsAt: string; id: string }

/** How many past meetings the docket serves before "Show earlier meetings". */
const PAST_PAGE_SIZE = 20

/**
 * The /meetings docket's read: every not-yet-ended meeting, plus one PAGE of
 * past ones — where listMeetings above returns the viewer's entire meeting
 * history on every load and grows forever.
 *
 * The upcoming/past line is splitByUpcoming's rule (a meeting is past once it
 * has ENDED), applied in SQL so the page never fetches years of history to
 * throw most of it away. The boundary uses one clock read, so the two halves
 * cannot both claim the same meeting; a meeting that ends between this read
 * and the client's own render is the client's split to re-file.
 *
 * `past` is keyset-paged on (endsAt, id) — an OFFSET page drifts when a
 * meeting is created or trashed between two clicks, silently skipping or
 * repeating a row at the seam. Ordered by endsAt (newest-ended first) rather
 * than listMeetings' startsAt so the cursor and the ordering agree about
 * what "earlier" means. `pastTotal` is counted separately so the "Past (N)"
 * header can tell the truth while only a page is loaded.
 */
export async function listMeetingsWindowed(
  viewerId: string,
  opts?: {
    pastLimit?: number
    pastCursor?: PastMeetingCursor
  },
): Promise<{ upcoming: MeetingSummary[]; past: MeetingSummary[]; pastTotal: number }> {
  const pastLimit = opts?.pastLimit ?? PAST_PAGE_SIZE
  const cursor = opts?.pastCursor
  const cursorEndsAt = cursor ? new Date(cursor.endsAt) : null
  // A cursor that does not name a real instant would otherwise become an
  // invalid-date comparison Postgres rejects mid-request; the first page is
  // the only honest fallback.
  const validCursor = cursor && cursorEndsAt && !Number.isNaN(cursorEndsAt.getTime())
  const now = new Date()

  const [upcomingRows, pastRows, [countRow]] = await Promise.all([
    db
      .select(meetingColumns)
      .from(liveMeetings)
      .where(and(meetingVisibleTo(viewerId), gt(liveMeetings.endsAt, now)))
      // Soonest first — the order splitByUpcoming would put them in anyway.
      .orderBy(asc(liveMeetings.startsAt)),
    db
      .select(meetingColumns)
      .from(liveMeetings)
      .where(
        and(
          meetingVisibleTo(viewerId),
          lte(liveMeetings.endsAt, now),
          validCursor
            ? or(
                lt(liveMeetings.endsAt, cursorEndsAt),
                and(eq(liveMeetings.endsAt, cursorEndsAt), lt(liveMeetings.id, cursor.id)),
              )
            : undefined,
        ),
      )
      .orderBy(desc(liveMeetings.endsAt), desc(liveMeetings.id))
      .limit(pastLimit),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(liveMeetings)
      .where(and(meetingVisibleTo(viewerId), lte(liveMeetings.endsAt, now))),
  ])

  // One hydrate over both halves keeps the attach pattern at exactly two
  // extra queries for the whole read; hydrate preserves row order, so the
  // combined list splits back apart by position.
  const hydrated = await hydrate([...upcomingRows, ...pastRows])
  return {
    upcoming: hydrated.slice(0, upcomingRows.length),
    past: hydrated.slice(upcomingRows.length),
    pastTotal: countRow?.count ?? 0,
  }
}

/**
 * Every meeting STARTING on one Asia/Colombo calendar day — the targeted
 * fetch behind a `?day` that falls outside the docket's loaded window.
 *
 * The day is a Colombo wall-clock day, not a UTC one: the naive
 * `startsAt::date` comparison files an 8pm Colombo meeting under the next
 * UTC day for an office 5:30 ahead. parseColomboWallClock also doubles as
 * the format gate — anything that is not a real `YYYY-MM-DD` day answers []
 * rather than becoming a cast error inside the query.
 */
export async function getMeetingsForDay(
  viewerId: string,
  day: string,
): Promise<MeetingSummary[]> {
  const dayStart = parseColomboWallClock(`${day}T00:00`)
  if (!dayStart) return []
  // Next midnight via UTC date arithmetic on the day STRING — safe because
  // the string is a validated calendar day, and the result goes straight
  // back through the same wall-clock parser.
  const nextDayIso = new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10)
  const dayEnd = parseColomboWallClock(`${nextDayIso}T00:00`)
  if (!dayEnd) return []

  const rows = await db
    .select(meetingColumns)
    .from(liveMeetings)
    .where(
      and(
        meetingVisibleTo(viewerId),
        gte(liveMeetings.startsAt, dayStart),
        lt(liveMeetings.startsAt, dayEnd),
      ),
    )
    .orderBy(asc(liveMeetings.startsAt))

  return hydrate(rows)
}

/** The widest range getMeetingsForRange serves — the month grid's 42-day
 *  window plus slack. Anything larger is not a calendar view asking. */
const MAX_RANGE_DAYS = 62

/**
 * Every meeting STARTING within an inclusive span of Asia/Colombo calendar
 * days — the targeted fetch behind a calendar view (month/agenda/week/day)
 * stepping back past the docket's windowed past. Same wall-clock day
 * interpretation, validation and hydrate pattern as getMeetingsForDay above;
 * a malformed, inverted or oversized range answers [] rather than becoming a
 * cast error or an unbounded read.
 */
export async function getMeetingsForRange(
  viewerId: string,
  startDay: string,
  endDay: string,
): Promise<MeetingSummary[]> {
  const rangeStart = parseColomboWallClock(`${startDay}T00:00`)
  if (!rangeStart) return []
  if (!parseColomboWallClock(`${endDay}T00:00`)) return []
  // End is INCLUSIVE: the bound is the start of the day after endDay, via UTC
  // date arithmetic on the validated day string (same trick as above).
  const afterEndIso = new Date(Date.parse(`${endDay}T00:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10)
  const rangeEnd = parseColomboWallClock(`${afterEndIso}T00:00`)
  if (!rangeEnd) return []
  const spanDays = (rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000
  if (spanDays <= 0 || spanDays > MAX_RANGE_DAYS) return []

  const rows = await db
    .select(meetingColumns)
    .from(liveMeetings)
    .where(
      and(
        meetingVisibleTo(viewerId),
        gte(liveMeetings.startsAt, rangeStart),
        lt(liveMeetings.startsAt, rangeEnd),
      ),
    )
    .orderBy(asc(liveMeetings.startsAt))

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

/**
 * One meeting by id, for a `?open=` deep link naming a meeting outside the
 * docket's loaded window. The same read as getMeetingById — including its
 * "visibility is part of exists" answer, so a private meeting a non-attendee
 * deep-links answers null, not 403 — with the viewer-first argument order
 * the other windowed reads here use, and sharing its per-request cache so a
 * page that both lists and opens a meeting pays for it once.
 */
export async function getMeetingSummaryById(
  viewerId: string,
  id: string,
): Promise<MeetingSummary | null> {
  return getMeetingById(id, viewerId)
}

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
