'use server'

// The ONE batched read that paints the /meetings docket's intelligence: every
// row's chips and every triage-rail count come from a single call here, made
// once per page load, before the user can scroll. It exists because the old
// per-row path fired the FULL getMeetingIntel payload — transcript-adjacent
// notes, every approved user, prep groups — for every row within 300px of the
// viewport, just to render ~5 count chips.
//
// COMPUTED-ONLY, by page contract: nothing here may ever reach Gemini. And
// BATCHED, in load-actions.ts's sense — the statement count is FIXED (at most
// six queries) however many ids arrive; the per-meeting work all happens in
// glance-core.ts over rows fetched with IN clauses. Never N getMeetingIntel
// builds, and never a per-id permission loop.

import { and, eq, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { liveMeetings } from '@/db/live'
import { assignments, meetingAiNotes, meetingApps, meetingAttendees, meetingFollowups } from '@/db/schema'
import { meetingVisibleTo } from '@/features/meetings/visibility'
import { isAdminRole, type UserRole } from '@/features/auth/capabilities'
import { isProjectManagerRole } from '@/lib/project-roles'
import {
  assembleGlanceResponse,
  buildGlanceMap,
  decideIntelReadable,
  MAX_GLANCE_IDS,
} from '@/features/meetings/glance-core'
import type { MeetingGlance } from '@/features/meetings/components/meeting-notes-model'

// visibility.ts's rule, for the same reason it has it: a malformed id
// compared against a uuid column is a Postgres cast error, and one bad id in
// a batch must cost that id its glance, not the whole page its counts.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The action's one input, validated like list-actions' — a hostile client
// can pass anything at all here, and the safety must not rest on `new Set`
// happening to throw into the catch-all. Filter-not-reject stays the UUID_RE
// pass below: one bad id costs that id its glance, not the batch.
const idsInput = z.array(z.string())

/**
 * Glances for a batch of meeting ids, gated per id by canReadMeetingIntel's
 * rule (admin | creator | PM of any of the meeting's projects | attendee —
 * see decideIntelReadable in glance-core.ts for why the rule is re-decided
 * from batched sets rather than by calling that function in a loop).
 *
 * Denied, unknown, trashed, malformed and over-cap ids all answer null —
 * indistinguishable from "asked, nothing to show", so counts never leak.
 * NEVER throws: any failure is { ok: false }, one worded notice on the list,
 * because a page's counts failing must not take the page down with it.
 */
export async function getMeetingGlances(
  meetingIds: string[],
): Promise<{ ok: true; map: Record<string, MeetingGlance | null> } | { ok: false }> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false }
    const viewerId = session.user.id
    const role = (session.user.role ?? 'member') as UserRole

    const parsedIds = idsInput.safeParse(meetingIds)
    if (!parsedIds.success) return { ok: false }

    const requested = [...new Set(parsedIds.data)]
    if (requested.length > MAX_GLANCE_IDS) {
      console.warn(
        `[meeting-glances] ${requested.length} ids requested; ids beyond ${MAX_GLANCE_IDS} answer null`,
      )
    }
    const ids = requested.slice(0, MAX_GLANCE_IDS).filter((id) => UUID_RE.test(id))
    if (ids.length === 0) return { ok: true, map: assembleGlanceResponse(requested, new Map()) }

    // The list contract, not the by-id one: glances exist to sit on rows the
    // viewer's list already shows, so the batch starts from the same
    // visibility predicate listMeetings uses. Strictly narrower than
    // getMeetingIntel's by-id read only for a non-attendee admin asking
    // about an attendees-only meeting — a row that can appear on no list.
    const meetings = await db
      .select({
        id: liveMeetings.id,
        createdBy: liveMeetings.createdBy,
        startsAt: liveMeetings.startsAt,
        nextMeetingAt: liveMeetings.nextMeetingAt,
      })
      .from(liveMeetings)
      .where(and(inArray(liveMeetings.id, ids), meetingVisibleTo(viewerId)))

    if (meetings.length === 0) return { ok: true, map: assembleGlanceResponse(requested, new Map()) }
    const foundIds = meetings.map((meeting) => meeting.id)

    // The three sets the per-id gate is decided from — the batched halves of
    // canReadMeetingIntel's PM and attendee arms.
    const [appRows, attendeeRows] = await Promise.all([
      db
        .select({ meetingId: meetingApps.meetingId, appId: meetingApps.appId })
        .from(meetingApps)
        .where(inArray(meetingApps.meetingId, foundIds)),
      db
        .select({ meetingId: meetingAttendees.meetingId, userId: meetingAttendees.userId })
        .from(meetingAttendees)
        .where(inArray(meetingAttendees.meetingId, foundIds)),
    ])

    const appIdsByMeeting = new Map<string, string[]>()
    for (const row of appRows) {
      const list = appIdsByMeeting.get(row.meetingId) ?? []
      list.push(row.appId)
      appIdsByMeeting.set(row.meetingId, list)
    }
    const attendedMeetingIds = new Set(
      attendeeRows.filter((row) => row.userId === viewerId).map((row) => row.meetingId),
    )

    // Which of the batch's apps the viewer MANAGES — isProjectManagerRole
    // over their own assignment rows, the same test-pinned definition
    // managesAnyApp applies, resolved once for the whole batch.
    const unionAppIds = [...new Set(appRows.map((row) => row.appId))]
    const assignmentRows =
      unionAppIds.length > 0
        ? await db
            .select({ appId: assignments.appId, role: assignments.role })
            .from(assignments)
            .where(and(eq(assignments.userId, viewerId), inArray(assignments.appId, unionAppIds)))
        : []
    const managedAppIds = new Set(
      assignmentRows.filter((row) => isProjectManagerRole(row.role)).map((row) => row.appId),
    )

    const allowed = meetings.filter((meeting) =>
      decideIntelReadable({
        viewer: { id: viewerId, role },
        meeting,
        meetingAppIds: appIdsByMeeting.get(meeting.id) ?? [],
        managedAppIds,
        attendedMeetingIds,
      }),
    )
    if (allowed.length === 0) return { ok: true, map: assembleGlanceResponse(requested, new Map()) }
    const allowedIds = allowed.map((meeting) => meeting.id)

    // The last two batched reads: every allowed meeting's AI-notes row, and
    // one SUPERSET of carried-forward candidates — fetchCarriedFollowups'
    // WHERE with its per-meeting conditions loosened to "any meeting in the
    // batch" (target IN allowed, resolved-in IN allowed, source earlier than
    // the batch's latest start); glance-core's carriedIntoMeeting re-applies
    // the exact per-meeting half in JS. The source-meeting entitlement
    // (admin | source creator | source attendee) stays in SQL because it is
    // meeting-independent — without it a follow-up's transcript-derived text
    // count would leak through a throwaway meeting, same reasoning as
    // getMeetingIntel's own prep read.
    const latestStartsAt = new Date(
      Math.max(...allowed.map((meeting) => meeting.startsAt.getTime())),
    )
    const isAdmin = isAdminRole(role)
    const [notesRows, followupRows] = await Promise.all([
      db
        .select({
          meetingId: meetingAiNotes.meetingId,
          perPerson: meetingAiNotes.perPerson,
          deadlines: meetingAiNotes.deadlines,
          questions: meetingAiNotes.questions,
          createdAt: meetingAiNotes.createdAt,
        })
        .from(meetingAiNotes)
        .where(inArray(meetingAiNotes.meetingId, allowedIds)),
      db
        .select({
          id: meetingFollowups.id,
          userId: meetingFollowups.userId,
          personName: meetingFollowups.personName,
          text: meetingFollowups.text,
          kind: meetingFollowups.kind,
          status: meetingFollowups.status,
          targetMeetingId: meetingFollowups.targetMeetingId,
          resolvedInMeetingId: meetingFollowups.resolvedInMeetingId,
          sourceMeetingId: meetingFollowups.sourceMeetingId,
          sourceMeetingTitle: liveMeetings.title,
          sourceMeetingStartsAt: liveMeetings.startsAt,
        })
        .from(meetingFollowups)
        .innerJoin(liveMeetings, eq(meetingFollowups.sourceMeetingId, liveMeetings.id))
        .leftJoin(
          meetingAttendees,
          and(
            eq(meetingAttendees.meetingId, liveMeetings.id),
            eq(meetingAttendees.userId, viewerId),
          ),
        )
        .where(
          and(
            or(
              eq(meetingFollowups.status, 'open'),
              inArray(meetingFollowups.resolvedInMeetingId, allowedIds),
            ),
            isNotNull(meetingFollowups.userId),
            or(
              inArray(meetingFollowups.targetMeetingId, allowedIds),
              and(
                isNull(meetingFollowups.targetMeetingId),
                lt(liveMeetings.startsAt, latestStartsAt),
              ),
            ),
            isAdmin
              ? undefined
              : or(eq(liveMeetings.createdBy, viewerId), isNotNull(meetingAttendees.userId)),
          ),
        ),
    ])

    const glances = buildGlanceMap({
      meetings: allowed,
      notesRows,
      attendeeRows,
      followupRows,
      now: new Date(),
    })
    return { ok: true, map: assembleGlanceResponse(requested, glances) }
  } catch (error) {
    console.error('[meeting-glances] batch failed:', error)
    return { ok: false }
  }
}
