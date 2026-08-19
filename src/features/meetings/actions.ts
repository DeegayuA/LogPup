'use server'

import { z } from 'zod'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { liveMeetings } from '@/db/live'
// meetingScreenshots is deliberately NOT imported: deleteMeeting used to read
// its rows to sweep the Blob objects, and a soft delete keeps both the rows and
// the objects (they are purged with the meeting from admin Trash, not here).
import {
  apps,
  meetingAttendeeHistory,
  meetingAttendees,
  meetings,
  users,
} from '@/db/schema'
import {
  formatBusinessTime,
  formatBusinessWeekdayDayMonth,
} from '@/features/people/format-instant'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { revalidateAdmin } from '@/lib/revalidate-admin'
import { format } from 'date-fns'
import { getTeamForApp } from '@/features/people/queries'
import {
  createCalendarEvent,
  deleteCalendarEvent,
  describeCalendarError,
  updateCalendarEventTime,
} from '@/features/calendar/google-calendar'
import { logActivity } from '@/features/activity/log'
import { createNotifications, extractMentionedUserIds } from '@/features/notifications/notify'
import { meetingUrlSchema } from '@/features/meetings/meeting-url'
import { buildAttendanceEntry } from '@/features/meetings/attendance-history'
import { can, type UserRole } from '@/features/auth/capabilities'
import { loadActor } from '@/features/auth/actor'
import { managesApp } from '@/features/apps/project-manager'

/**
 * The editable shape of a meeting, shared by create and update so the two can
 * never drift into accepting different things — an edit form that allowed a
 * title the create form rejected would be a bug nobody notices until someone
 * hits it.
 */
const meetingFields = {
  appId: z.uuid().nullable(),
  title: z.string().min(2).max(120),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  agenda: z.string().max(2000).optional(),
  meetingUrl: meetingUrlSchema.optional(),
  attendeeIds: z.array(z.uuid()).min(1),
  // "Create a Google Meet link for me": carried by the save because a Meet
  // room only exists as a property of a Calendar event (see createCalendarEvent).
  // Accepted on update too for schema symmetry, though only create acts on it.
  withMeet: z.boolean().optional(),
}

const endsAfterStart = (data: { startsAt: string; endsAt: string }) =>
  new Date(data.endsAt) > new Date(data.startsAt)
const endsAfterStartError = {
  message: 'End time must be after the start time',
  path: ['endsAt'],
}

const meetingInput = z.object(meetingFields).refine(endsAfterStart, endsAfterStartError)

const meetingUpdateInput = z
  .object({ meetingId: z.uuid(), ...meetingFields })
  .refine(endsAfterStart, endsAfterStartError)

const rescheduleInput = z
  .object({
    meetingId: z.uuid(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
  })
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    message: 'End time must be after the start time',
    path: ['endsAt'],
  })

const MAX_NOTES_LENGTH = 5000

/**
 * Emailing invites through the Google Calendar API is a bonus, not the
 * product: it only works for an organiser who signed in with Google AND still
 * holds a live refresh token for the sensitive `calendar.events` scope. Every
 * user, however they signed in, can always get the same meeting as an RFC 5545
 * `.ics` file from /api/meetings/[id]/ics — so when Google is unavailable the
 * honest thing to say is *why*, and to point at the path that works, rather
 * than to offer a retry that will fail identically.
 *
 * These helpers compose that message. `reason` is a clause produced by
 * describeCalendarError() (or the constant below when there is no connection
 * at all), never anything derived from a token.
 */
const NO_GOOGLE_CONNECTION_REASON = 'the organiser has no Google Calendar connection'
const ICS_FALLBACK_HINT = 'Use “Add to calendar” on the meeting to get the invite file instead.'

const inviteWarning = (reason: string) =>
  `Meeting saved. Google didn’t email the invites — ${reason}. ${ICS_FALLBACK_HINT}`
// No ICS_FALLBACK_HINT here: this message's only surface (add-to-calendar's
// retry toast) always renders a "Download invite" action button, so spelling
// the fallback out in prose next to that button just triples the toast.
const retryFailedMessage = (reason: string) =>
  `Google didn’t send the invites — ${reason}.`
const moveWarning = (reason: string) =>
  `Moved here, but the Google Calendar event still shows the old time — ${reason}. ${ICS_FALLBACK_HINT}`

async function requireSession() {
  const session = await auth()
  if (!session?.user) return null
  return session
}

/**
 * Walks an error's `.cause` chain looking for a Postgres foreign-key
 * violation (bogus appId/attendeeId). Same shape as the copy in
 * sprints/task-actions.ts — the neon-http driver / drizzle wrap the
 * underlying NeonDbError, so the `code`/`message` we want may be a few
 * levels down.
 */
function isForeignKeyViolation(error: unknown): boolean {
  let current: unknown = error
  const seen = new Set<unknown>()
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const e = current as { code?: unknown; message?: unknown; cause?: unknown }
    if (e.code === '23503') return true
    if (typeof e.message === 'string' && e.message.includes('foreign key')) return true
    current = e.cause
  }
  return false
}

// Gate function: every write below (retryCalendarInvite, rescheduleMeeting,
// updateMeetingNotes, deleteMeeting) resolves the meeting through here first,
// so reading via liveMeetings is what makes a trashed meeting 404 as "not
// found" instead of still being mutable through its own gate.
async function meetingById(meetingId: string) {
  const [meeting] = await db.select().from(liveMeetings).where(eq(liveMeetings.id, meetingId))
  return meeting ?? null
}

async function slugForApp(appId: string | null): Promise<string | null> {
  if (!appId) return null
  const [app] = await db.select({ slug: apps.slug }).from(apps).where(eq(apps.id, appId))
  return app?.slug ?? null
}

async function appNameById(appId: string | null): Promise<string | null> {
  if (!appId) return null
  const [app] = await db.select({ name: apps.name }).from(apps).where(eq(apps.id, appId))
  return app?.name ?? null
}

async function revalidateMeetingPaths(appId: string | null) {
  const slug = await slugForApp(appId)
  if (slug) revalidatePath('/apps/' + slug)
  revalidatePath('/meetings')
  revalidatePath('/')
  // deleteMeeting is one of the callers, and a soft delete lands a new row in
  // the admin Trash card — see revalidateAdmin's own comment.
  revalidateAdmin()
}

// Async now: the third branch reads the caller's assignment on the meeting's
// app. Every call site MUST await — an un-awaited call returns a Promise,
// which is truthy, which is "always allowed".
const EMPTY: ReadonlySet<string> = new Set()

async function canManageMeeting(
  session: { user: { id: string; role: string } },
  meeting: { createdBy: string; appId?: string | null },
): Promise<boolean> {
  // Admin family and the creator both come from the matrix now: 'meeting.manage'
  // is 'all' for superadmin/admin and 'own' against createdBy for everyone
  // else. Written as a role string this silently went false for superadmin.
  if (can({ id: session.user.id, role: session.user.role as UserRole, scopeAppIds: EMPTY },
          'meeting.manage', { ownerId: meeting.createdBy })) return true
  // The app's PROJECT MANAGER manages its meetings (see project-manager.ts);
  // leads/architects stay reviewers and are deliberately not here.
  //
  // DELIBERATELY still managesApp rather than the matrix's scoped arm.
  // managesApp regex-matches the free-text assignments.role string; the
  // matrix resolves manager scope from app_role_history's structured pm/lead.
  // They are not the same set, and swapping this arm would silently strip
  // meeting management from every PM who holds the title in free text but has
  // never been recorded as pm on the app. That migration is a separate,
  // visible piece of work — not a side effect of a permission refactor.
  return managesApp(session.user.id, meeting.appId)
}

/** A candidate for the Google Calendar attendee list: who, and required/optional. */
type AttendeeRef = { userId: string; optional: boolean }

async function attendeeEmails(
  attendees: AttendeeRef[],
): Promise<{ email: string; optional: boolean }[]> {
  if (attendees.length === 0) return []
  const rows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.id, attendees.map((a) => a.userId)))
  const optionalByUserId = new Map(attendees.map((a) => [a.userId, a.optional]))
  return rows.map((r) => ({ email: r.email, optional: optionalByUserId.get(r.id) ?? false }))
}

/**
 * Best-effort Google Calendar invite for a meeting. Never throws: a
 * missing/invalid Google connection comes back as a `reason` clause for the
 * caller to phrase, not as a thrown error — the meeting itself is already
 * saved either way, and the `.ics` route can always serve the same invite.
 */
async function syncCalendarInvite(
  meeting: {
    id: string
    title: string
    agenda: string | null
    startsAt: Date
    endsAt: Date
    createdBy: string
  },
  attendees: AttendeeRef[],
  /** Ask Google to mint a Meet room with the event and store its link. */
  withMeet?: boolean,
): Promise<{ reason?: string; meetUrl?: string }> {
  const [creator] = await db
    .select({ googleRefreshToken: users.googleRefreshToken })
    .from(users)
    .where(eq(users.id, meeting.createdBy))
  if (!creator?.googleRefreshToken) {
    return { reason: NO_GOOGLE_CONNECTION_REASON }
  }

  try {
    const emails = await attendeeEmails(attendees)
    const { eventId, meetLink } = await createCalendarEvent({
      refreshToken: creator.googleRefreshToken,
      title: meeting.title,
      agenda: meeting.agenda ?? undefined,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      attendeeEmails: emails,
      withMeet,
    })
    // The minted link fills meeting_url only where the form left it blank.
    // The guarded WHERE — not a read-then-write — is what makes a link typed
    // concurrently by someone else win over the minted one instead of being
    // silently overwritten; the second statement lands the event id even when
    // the first matched nothing.
    if (withMeet && meetLink) {
      await db
        .update(meetings)
        .set({ googleEventId: eventId, meetingUrl: meetLink })
        .where(and(eq(meetings.id, meeting.id), isNull(meetings.meetingUrl)))
      await db.update(meetings).set({ googleEventId: eventId }).where(eq(meetings.id, meeting.id))
      return { meetUrl: meetLink }
    }
    await db.update(meetings).set({ googleEventId: eventId }).where(eq(meetings.id, meeting.id))
    return {}
  } catch (error) {
    // Logged, not swallowed: this used to be a bare `catch {}`, so the actual
    // Google error was never recorded anywhere and the failure could not be
    // diagnosed from the outside. describeCalendarError never echoes the token.
    const reason = describeCalendarError(error)
    console.error(`[calendar] invite failed for meeting ${meeting.id}: ${reason}`, error)
    return { reason }
  }
}

/**
 * Pushes a new time window onto a meeting's existing Google Calendar event.
 * Same contract as syncCalendarInvite: never throws, and a failure comes back
 * as a `calendarWarning` string rather than failing the move — the meeting row
 * is the source of truth, and silently leaving the invite on the old time
 * without telling anyone would be the worst of the three outcomes.
 */
async function syncCalendarTime(
  organiserId: string,
  eventId: string,
  startsAt: Date,
  endsAt: Date,
): Promise<string | undefined> {
  const [creator] = await db
    .select({ googleRefreshToken: users.googleRefreshToken })
    .from(users)
    .where(eq(users.id, organiserId))
  if (!creator?.googleRefreshToken) return moveWarning(NO_GOOGLE_CONNECTION_REASON)

  try {
    await updateCalendarEventTime({
      refreshToken: creator.googleRefreshToken,
      eventId,
      startsAt,
      endsAt,
    })
    return undefined
  } catch (error) {
    const reason = describeCalendarError(error)
    console.error(`[calendar] reschedule failed for event ${eventId}: ${reason}`, error)
    return moveWarning(reason)
  }
}

export async function createMeeting(
  input: unknown,
): Promise<ActionResult<{ meetingId: string; calendarWarning?: string; meetUrl?: string }>> {
  // Any authenticated member may create a meeting — no role check beyond a session.
  const session = await requireSession()
  if (!session) return err('Sign in required')

  const parsed = meetingInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const { appId, title, startsAt, endsAt, agenda, meetingUrl } = parsed.data
  // Dedup: the picker can submit the same user twice (e.g. selected, then
  // re-added via a mention hint) — a duplicate id would violate the
  // meetingAttendees composite primary key and fail the whole batch insert.
  const attendeeIds = [...new Set(parsed.data.attendeeIds)]
  // Generated client-side (not via .returning()) so the id is known before
  // the batch runs — db.batch sends both inserts in one atomic round-trip
  // (neon-http has no transactions), so the attendee rows can't reference a
  // meeting id that isn't guaranteed to exist yet.
  const meetingId = crypto.randomUUID()
  // One instant for the meeting row and every attendee's opening membership
  // interval, so the history starts exactly when the meeting did.
  const at = new Date()

  try {
    await db.batch([
      db.insert(meetings).values({
        id: meetingId,
        appId,
        title,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        agenda: agenda || null,
        meetingUrl: meetingUrl ?? null,
        createdBy: session.user.id,
        createdAt: at,
      }),
      db
        .insert(meetingAttendees)
        .values(attendeeIds.map((userId) => ({ meetingId, userId }))),
      // The membership history opens in the SAME batch as the live rows —
      // otherwise every meeting created after this feature shipped would have
      // attendees with no recorded start, and "who was on this meeting on
      // date X" would only work for the backfilled ones.
      db.insert(meetingAttendeeHistory).values(
        attendeeIds.map((userId) =>
          buildAttendanceEntry({
            meetingId,
            userId,
            response: 'pending',
            changeKind: 'added',
            changedBy: session.user.id,
            at,
          }),
        ),
      ),
    ])
  } catch (error) {
    if (isForeignKeyViolation(error)) return err('Invalid app or attendee')
    throw error
  }

  await logActivity({
    actorId: session.user.id,
    verb: 'created',
    entityType: 'meeting',
    entityId: meetingId,
    entityLabel: title,
    appId,
    appName: await appNameById(appId),
    pagePath: '/meetings',
    // Business timezone, not the server's: this string is PERSISTED into the
    // trail, so a UTC server would bake "5h30 earlier" into the row forever —
    // unlike the surrounding UI, a log line can never be re-rendered right.
    detail: `for ${formatBusinessWeekdayDayMonth(new Date(startsAt))} · ${formatBusinessTime(new Date(startsAt))}`,
    metadata: { startsAt, endsAt, attendeeCount: attendeeIds.length },
  })

  const { reason, meetUrl } = await syncCalendarInvite(
    {
      id: meetingId,
      title,
      agenda: agenda || null,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      createdBy: session.user.id,
    },
    // createMeeting doesn't yet collect a per-attendee optional flag (the
    // invite-list UI work is a later task) — every row it inserts above is
    // optional:false by column default, so the calendar invite matches.
    attendeeIds.map((userId) => ({ userId, optional: false })),
    // Only when no link was typed: a pasted Zoom link and a minted Meet room
    // on the same meeting would give the Join button two contradictory answers.
    parsed.data.withMeet === true && !meetingUrl,
  )
  const calendarWarning = reason ? inviteWarning(reason) : undefined

  // Notify every attendee except the organizer. A notification failure must not
  // fail the meeting itself, which is already created and calendar-synced.
  try {
    await createNotifications(
      attendeeIds
        .filter((id) => id !== session.user.id)
        .map((userId) => ({
          userId,
          actorId: session.user.id,
          type: 'meeting' as const,
          title: `${session.user.name ?? 'Someone'} invited you to “${title}”`,
          body: format(new Date(startsAt), 'EEE, MMM d · h:mm a'),
          link: '/meetings',
          meetingId,
        })),
    )
  } catch (error) {
    console.error('[notifications] meeting invite failed:', error)
  }

  await revalidateMeetingPaths(appId)
  return ok({ meetingId, calendarWarning, meetUrl })
}

export async function retryCalendarInvite(meetingId: string): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return err('Sign in required')

  const existing = await meetingById(meetingId)
  if (!existing) return err('Meeting not found')
  if (!(await canManageMeeting(session, existing))) return err('Not allowed')
  if (existing.googleEventId) return err('Meeting already has a calendar invite')

  // meetingAttendees has no deletedAt of its own — `existing` above was
  // already resolved through the liveMeetings-backed meetingById gate, so
  // this can't read a trashed meeting's attendees (see MEETING_CHILD_TABLES
  // in src/db/live.ts).
  const attendeeRows = await db
    .select({ userId: meetingAttendees.userId, optional: meetingAttendees.optional })
    .from(meetingAttendees)
    .where(eq(meetingAttendees.meetingId, meetingId))

  const { reason } = await syncCalendarInvite(existing, attendeeRows)
  if (reason) return err(retryFailedMessage(reason))

  await logActivity({
    actorId: session.user.id,
    verb: 'updated',
    entityType: 'meeting',
    entityId: existing.id,
    entityLabel: existing.title,
    appId: existing.appId,
    appName: await appNameById(existing.appId),
    pagePath: '/meetings',
    detail: 'with calendar invites',
  })

  await revalidateMeetingPaths(existing.appId)
  return ok(undefined)
}

/**
 * Moves a meeting to a new time window — the server half of both dragging a
 * chip onto another day in the month calendar and editing the start/end
 * fields in the meeting detail panel.
 *
 * Same permission rule as every other write in this file: an admin, or the
 * person who created the meeting. If the meeting already has a Google
 * Calendar invite out, the event is patched to the new time and the invitees
 * are re-notified; when that can't be done the move still succeeds and the
 * desync is reported back as a `calendarWarning` for the caller to surface.
 */
export async function rescheduleMeeting(
  meetingId: string,
  startsAt: string,
  endsAt: string,
): Promise<ActionResult<{ calendarWarning?: string }>> {
  const session = await requireSession()
  if (!session) return err('Sign in required')

  const parsed = rescheduleInput.safeParse({ meetingId, startsAt, endsAt })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const existing = await meetingById(parsed.data.meetingId)
  if (!existing) return err('Meeting not found')
  if (!(await canManageMeeting(session, existing))) return err('Not allowed')

  const nextStart = new Date(parsed.data.startsAt)
  const nextEnd = new Date(parsed.data.endsAt)
  if (
    nextStart.getTime() === existing.startsAt.getTime() &&
    nextEnd.getTime() === existing.endsAt.getTime()
  ) {
    // Nothing moved (e.g. a chip dropped back on its own day) — skip the
    // write, the calendar round-trip and the "meeting moved" notifications.
    return ok({})
  }

  await db
    .update(meetings)
    .set({ startsAt: nextStart, endsAt: nextEnd })
    .where(eq(meetings.id, existing.id))

  await logActivity({
    actorId: session.user.id,
    verb: 'moved',
    entityType: 'meeting',
    entityId: existing.id,
    entityLabel: existing.title,
    appId: existing.appId,
    appName: await appNameById(existing.appId),
    pagePath: '/meetings',
    // Business timezone — persisted string, same reason as createMeeting.
    detail: `to ${formatBusinessWeekdayDayMonth(nextStart)} · ${formatBusinessTime(nextStart)}`,
    metadata: {
      startsAt: { from: existing.startsAt.toISOString(), to: nextStart.toISOString() },
      endsAt: { from: existing.endsAt.toISOString(), to: nextEnd.toISOString() },
    },
  })

  const calendarWarning = existing.googleEventId
    ? await syncCalendarTime(existing.createdBy, existing.googleEventId, nextStart, nextEnd)
    : undefined

  // Tell the attendees their meeting moved — the same best-effort treatment
  // as the invite notification in createMeeting: a notification failure must
  // not fail a move that has already been written.
  try {
    // Same reasoning as retryCalendarInvite: `existing` came from the
    // liveMeetings-backed meetingById gate above.
    const attendeeRows = await db
      .select({ userId: meetingAttendees.userId })
      .from(meetingAttendees)
      .where(eq(meetingAttendees.meetingId, existing.id))
    await createNotifications(
      attendeeRows
        .map((row) => row.userId)
        .filter((userId) => userId !== session.user.id)
        .map((userId) => ({
          userId,
          actorId: session.user.id,
          type: 'meeting' as const,
          title: `${session.user.name ?? 'Someone'} moved “${existing.title}”`,
          body: format(nextStart, 'EEE, MMM d · h:mm a'),
          link: '/meetings',
          meetingId: existing.id,
        })),
    )
  } catch (error) {
    console.error('[notifications] meeting reschedule failed:', error)
  }

  await revalidateMeetingPaths(existing.appId)
  return ok({ calendarWarning })
}

/**
 * Edit a meeting in full — title, app, agenda, link, time and attendee list.
 *
 * `rescheduleMeeting` above only ever moved a meeting in time, which left the
 * rest of it permanently frozen at whatever was typed into the create form:
 * a typo in a title, a meeting filed under the wrong app, or an attendee who
 * should never have been on it could only be fixed by deleting the meeting and
 * rebuilding it, losing its notes, its actions and its calendar event.
 *
 * Permission is `canManageMeeting` — the organiser, or any admin. That is the
 * same gate `rescheduleMeeting` and `deleteMeeting` already use, so an admin
 * who could already delete this meeting outright can now do the far less
 * destructive thing instead.
 *
 * Attendees are reconciled rather than replaced wholesale: only the genuinely
 * added and removed rows are written, so an untouched attendee keeps the RSVP
 * they already gave. A delete-then-reinsert would silently reset everyone to
 * 'pending' on every save.
 */
export async function updateMeeting(
  input: unknown,
  // meetUrl is never set here (update doesn't mint rooms — see meetingFields'
  // withMeet note) but stays in the type so the form's shared success path can
  // read one result shape for both save modes.
): Promise<ActionResult<{ meetingId: string; calendarWarning?: string; meetUrl?: string }>> {
  const session = await requireSession()
  if (!session) return err('Sign in required')

  const parsed = meetingUpdateInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const existing = await meetingById(parsed.data.meetingId)
  if (!existing) return err('Meeting not found')
  if (!(await canManageMeeting(session, existing))) return err('Not allowed')

  const { meetingId, appId, title, startsAt, endsAt, agenda, meetingUrl } = parsed.data
  // Same dedup as createMeeting: the picker can hand back the same id twice,
  // and a duplicate would violate the meetingAttendees composite primary key.
  const nextAttendeeIds = [...new Set(parsed.data.attendeeIds)]
  const nextStart = new Date(startsAt)
  const nextEnd = new Date(endsAt)

  // `response` rides along for the removal tombstone below — meeting_attendee_history
  // carries the RSVP a removed person had rather than zeroing it, so the timeline
  // can say "removed — was going" instead of "removed — pending".
  const currentRows = await db
    .select({ userId: meetingAttendees.userId, response: meetingAttendees.response })
    .from(meetingAttendees)
    .where(eq(meetingAttendees.meetingId, meetingId))
  const currentIds = new Set(currentRows.map((row) => row.userId))
  const responseByUser = new Map(currentRows.map((row) => [row.userId, row.response]))
  const added = nextAttendeeIds.filter((id) => !currentIds.has(id))
  const removed = [...currentIds].filter((id) => !nextAttendeeIds.includes(id))
  // ONE instant for every history row this save writes, so a closed interval
  // and the one opened after it abut exactly — see buildAttendanceEntry in
  // attendance-history.ts. Deriving the two timestamps separately leaves a gap
  // or an overlap at the boundary and corrupts every "as of" answer that lands
  // in it.
  const changedAt = new Date()

  // One atomic round trip. neon-http has no transactions, so `db.batch` is
  // what keeps the meeting row and its attendee rows from landing apart. It
  // takes a non-empty tuple, hence the always-present update first and the
  // conditional attendee writes spread in after it.
  type BatchWrite = Parameters<typeof db.batch>[0][number]
  const attendeeWrites: BatchWrite[] = []
  if (removed.length > 0) {
    attendeeWrites.push(
      db
        .delete(meetingAttendees)
        .where(
          and(
            eq(meetingAttendees.meetingId, meetingId),
            inArray(meetingAttendees.userId, removed),
          ),
        ),
      // Close whatever interval each of them had open …
      db
        .update(meetingAttendeeHistory)
        .set({ effectiveTo: changedAt })
        .where(
          and(
            eq(meetingAttendeeHistory.meetingId, meetingId),
            inArray(meetingAttendeeHistory.userId, removed),
            isNull(meetingAttendeeHistory.effectiveTo),
          ),
        ),
      // … then leave a 'removed' tombstone OPEN. Not close-only: a close
      // records the instant but not the actor, and attendanceAsOf stays one
      // uniform rule ("the row open at the date wins") with no special case
      // for "no open row". Readers drop 'removed' rows from a roster.
      db.insert(meetingAttendeeHistory).values(
        removed.map((userId) =>
          buildAttendanceEntry({
            meetingId,
            userId,
            response: responseByUser.get(userId) ?? 'pending',
            changeKind: 'removed',
            changedBy: session.user.id,
            at: changedAt,
          }),
        ),
      ),
    )
  }
  if (added.length > 0) {
    attendeeWrites.push(
      db.insert(meetingAttendees).values(added.map((userId) => ({ meetingId, userId }))),
      // CLOSE FIRST — the same rule assignSpeaker follows, and for the same
      // reason. Someone absent from meeting_attendees may STILL have an open
      // history row: the tombstone a removal deliberately leaves open. Adding
      // them back without closing it would put two open intervals on one
      // (meetingId, userId), which meeting_attendee_history_one_open_idx
      // rejects outright — so remove an attendee, then add them back in the
      // same editor, and the whole save failed with a 23505 that the catch
      // below does not recognise (it only maps 23503) and therefore rethrows,
      // losing the title, the times and every other attendee change with it.
      db
        .update(meetingAttendeeHistory)
        .set({ effectiveTo: changedAt })
        .where(
          and(
            eq(meetingAttendeeHistory.meetingId, meetingId),
            inArray(meetingAttendeeHistory.userId, added),
            isNull(meetingAttendeeHistory.effectiveTo),
          ),
        ),
      // Opened in the SAME batch as the live row, exactly as createMeeting
      // does — otherwise an attendee added by an edit has no recorded start
      // and "who was on this meeting on date X" answers wrongly for them.
      db.insert(meetingAttendeeHistory).values(
        added.map((userId) =>
          buildAttendanceEntry({
            meetingId,
            userId,
            response: 'pending',
            changeKind: 'added',
            changedBy: session.user.id,
            at: changedAt,
          }),
        ),
      ),
    )
  }

  try {
    await db.batch([
      db
        .update(meetings)
        .set({
          appId,
          title,
          startsAt: nextStart,
          endsAt: nextEnd,
          agenda: agenda || null,
          meetingUrl: meetingUrl ?? null,
        })
        .where(eq(meetings.id, meetingId)),
      ...attendeeWrites,
    ])
  } catch (error) {
    if (isForeignKeyViolation(error)) return err('Invalid app or attendee')
    throw error
  }

  const moved =
    nextStart.getTime() !== existing.startsAt.getTime() ||
    nextEnd.getTime() !== existing.endsAt.getTime()

  await logActivity({
    actorId: session.user.id,
    verb: 'updated',
    entityType: 'meeting',
    entityId: meetingId,
    entityLabel: title,
    appId,
    appName: await appNameById(appId),
    pagePath: '/meetings',
    // Business timezone — this string is persisted into the trail, so a UTC
    // server would bake the wrong clock time in forever (same reason as
    // createMeeting).
    detail: moved
      ? `moved to ${formatBusinessWeekdayDayMonth(nextStart)} · ${formatBusinessTime(nextStart)}`
      : undefined,
    metadata: {
      startsAt: { from: existing.startsAt.toISOString(), to: nextStart.toISOString() },
      endsAt: { from: existing.endsAt.toISOString(), to: nextEnd.toISOString() },
      titleChanged: existing.title !== title,
      attendeesAdded: added.length,
      attendeesRemoved: removed.length,
    },
  })

  // Only the time is pushed to Google: `updateCalendarEventTime` is the one
  // calendar mutation this app implements, and a title-only edit has nothing
  // to send it.
  const calendarWarning =
    existing.googleEventId && moved
      ? await syncCalendarTime(existing.createdBy, existing.googleEventId, nextStart, nextEnd)
      : undefined

  // Best-effort, exactly as in createMeeting and rescheduleMeeting: the edit
  // is already written, and a notification failure must not undo it. Newly
  // added attendees hear that they were added; everyone else hears about it
  // only if the meeting actually moved, because "X updated the agenda" is not
  // worth a notification to twelve people.
  try {
    const notified = new Map<string, string>()
    for (const userId of added) {
      notified.set(userId, `${session.user.name ?? 'Someone'} added you to “${title}”`)
    }
    if (moved) {
      for (const userId of nextAttendeeIds) {
        if (notified.has(userId)) continue
        notified.set(userId, `${session.user.name ?? 'Someone'} moved “${title}”`)
      }
    }
    await createNotifications(
      [...notified]
        .filter(([userId]) => userId !== session.user.id)
        .map(([userId, notificationTitle]) => ({
          userId,
          actorId: session.user.id,
          type: 'meeting' as const,
          title: notificationTitle,
          body: format(nextStart, 'EEE, MMM d · h:mm a'),
          link: '/meetings',
          meetingId,
        })),
    )
  } catch (error) {
    console.error('[notifications] meeting update failed:', error)
  }

  // Both apps: the meeting may have been moved from one app to another, and
  // the app it left needs re-rendering just as much as the one it joined.
  await revalidateMeetingPaths(existing.appId)
  if (appId !== existing.appId) await revalidateMeetingPaths(appId)
  return ok({ meetingId, calendarWarning })
}

/**
 * Files an existing meeting under an app, moves it to a different one, or
 * unfiles it entirely.
 *
 * `updateMeeting` can already change the app, but only as part of a full
 * re-submission of the whole meeting — title, times and the entire attendee
 * list. That makes the cheap, common correction ("this standup belongs to
 * Ledger after all") cost a round trip through a form that can reset RSVPs and
 * republish calendar invites. A quick meeting is meant to start general and be
 * attached later, so attaching it needs its own one-field write.
 *
 * Nothing else about the meeting is touched: no calendar sync (the app is not
 * part of the Google event) and no notifications (an attendee does not need to
 * hear that a meeting was refiled).
 */
export async function setMeetingApp(meetingId: string, appId: string | null): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return err('Sign in required')

  const parsed = z
    .object({ meetingId: z.uuid(), appId: z.uuid().nullable() })
    .safeParse({ meetingId, appId })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const existing = await meetingById(parsed.data.meetingId)
  if (!existing) return err('Meeting not found')
  if (!(await canManageMeeting(session, existing))) return err('Not allowed')

  const nextAppId = parsed.data.appId
  // Re-picking the app it is already filed under is a no-op, not an activity
  // row: without this the trail fills with "updated · to Ledger" lines that
  // record nothing having happened.
  if (nextAppId === existing.appId) return ok(undefined)

  try {
    await db.update(meetings).set({ appId: nextAppId }).where(eq(meetings.id, existing.id))
  } catch (error) {
    if (isForeignKeyViolation(error)) return err('Invalid app')
    throw error
  }

  const nextAppName = await appNameById(nextAppId)
  await logActivity({
    actorId: session.user.id,
    verb: 'updated',
    entityType: 'meeting',
    entityId: existing.id,
    entityLabel: existing.title,
    appId: nextAppId,
    appName: nextAppName,
    pagePath: '/meetings',
    detail: nextAppName ? `to ${nextAppName}` : 'off its app',
    metadata: { appId: { from: existing.appId, to: nextAppId } },
  })

  // Both apps, same reason as updateMeeting: the app it left has one meeting
  // fewer and needs re-rendering as much as the one it joined.
  await revalidateMeetingPaths(existing.appId)
  await revalidateMeetingPaths(nextAppId)
  return ok(undefined)
}

export async function updateMeetingNotes(meetingId: string, notes: string): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return err('Sign in required')
  if (notes.length > MAX_NOTES_LENGTH) return err('Notes are too long')

  const existing = await meetingById(meetingId)
  if (!existing) return err('Meeting not found')
  if (!(await canManageMeeting(session, existing))) return err('Not allowed')

  await db.update(meetings).set({ notes: notes || null }).where(eq(meetings.id, meetingId))

  await logActivity({
    actorId: session.user.id,
    verb: 'updated',
    entityType: 'meeting',
    entityId: meetingId,
    entityLabel: existing.title,
    appId: existing.appId,
    appName: await appNameById(existing.appId),
    pagePath: '/meetings',
    detail: 'notes',
  })

  // Notify anyone @mentioned in the notes (except the author). Best-effort.
  try {
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users)
    const mentionedIds = extractMentionedUserIds(notes, allUsers).filter(
      (id) => id !== session.user.id,
    )
    await createNotifications(
      mentionedIds.map((userId) => ({
        userId,
        actorId: session.user.id,
        type: 'mention' as const,
        title: `${session.user.name ?? 'Someone'} mentioned you`,
        body: `In “${existing.title}”`,
        link: '/meetings',
        meetingId,
      })),
    )
  } catch (error) {
    console.error('[notifications] mention notify failed:', error)
  }

  await revalidateMeetingPaths(existing.appId)
  return ok(undefined)
}

export async function deleteMeeting(meetingId: string): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return err('Sign in required')
  // Scope resolved from the session; the matrix decides below, once the
  // meeting is known and its app can be named.
  const actor = await loadActor()
  if (!actor) return err('Sign in required')

  const existing = await meetingById(meetingId)
  if (!existing) return err('Meeting not found')
  // Stricter than the edit/reschedule gate ON PURPOSE. Editing is
  // recoverable — edit it back; deletion takes the meeting's notes, actions
  // and calendar event with it, so it follows the workspace rule that
  // destroying things is an admin's call, organiser or not. (Tasks, sprints
  // and assignments already work this way.)
  // 'meeting.delete' is 'all' for superadmin/admin, 'scoped' for manager, and
  // NONE for editor and below — an editor's delete opens a change request
  // instead of mutating. Written as a role string this both hid the action
  // from superadmin and gave managers no route to it at all.
  if (!can(actor, 'meeting.delete', { ownerId: existing.createdBy, appId: existing.appId })) {
    return err('Not allowed to delete this meeting')
  }

  if (existing.googleEventId) {
    // Best-effort: the calendar invite is cleanup, not the source of truth —
    // the meeting still gets deleted (soft-deleted, see below) even if
    // Google is unreachable or the creator's grant has been revoked. This
    // stays even though the meeting itself is only trashed, not gone: guests
    // must stop seeing the invite the instant the meeting is deleted, and
    // googleEventId is left on the row rather than cleared, so a restore
    // still knows which event it used to own.
    try {
      const [creator] = await db
        .select({ googleRefreshToken: users.googleRefreshToken })
        .from(users)
        .where(eq(users.id, existing.createdBy))
      if (creator?.googleRefreshToken) {
        await deleteCalendarEvent(creator.googleRefreshToken, existing.googleEventId)
      }
    } catch {
      // Ignore — proceed with the soft delete regardless.
    }
  }

  // Soft delete: mark the row rather than removing it, so an admin can view
  // and restore it from Trash. Screen keyframes and every other row that
  // hangs off meetingId are left exactly where they are — including their
  // objects in Blob storage, which are retained (not swept here) until an
  // admin permanently purges the trashed meeting.
  const marked = await db
    .update(meetings)
    .set({ deletedAt: new Date(), deletedBy: session.user.id })
    .where(and(eq(meetings.id, meetingId), isNull(meetings.deletedAt)))
    .returning({ id: meetings.id })
  if (marked.length === 0) return err('Meeting not found')

  // ONE activity row per delete. The merge that brought soft-deletes in left
  // two identical logActivity calls here (the branch's and main's), which wrote
  // the trash event to the activity feed twice and ran appNameById twice per
  // delete.
  await logActivity({
    actorId: session.user.id,
    verb: 'deleted',
    entityType: 'meeting',
    entityId: meetingId,
    entityLabel: existing.title,
    appId: existing.appId,
    appName: await appNameById(existing.appId),
    pagePath: '/meetings',
  })

  await revalidateMeetingPaths(existing.appId)
  return ok(undefined)
}

/**
 * Thin server-action wrapper over getTeamForApp so the client meeting form
 * can prefill attendees when an app is selected. ActionResult rather than a
 * bare array so a failed lookup is distinguishable from an app that simply
 * has no team — with a bare [] for both, the form would silently show "no
 * suggestions" for what was actually an error.
 */
export async function teamForApp(
  appId: string,
): Promise<ActionResult<{ id: string; name: string }[]>> {
  const session = await requireSession()
  if (!session) return err('Sign in required')

  // uuid shape checked here rather than left to Postgres — a malformed id
  // would otherwise surface as a uuid cast error thrown across the action
  // boundary instead of a plain err().
  const parsed = z.uuid().safeParse(appId)
  if (!parsed.success) return err('Invalid app')

  try {
    const team = await getTeamForApp(parsed.data)
    return ok(team.map((member) => ({ id: member.userId, name: member.name })))
  } catch {
    return err('Could not load the team for that app')
  }
}
