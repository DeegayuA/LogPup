// The pure middle of getMeetingGlances (glance-actions.ts): batched rows in,
// per-meeting MeetingGlance map out. A separate module rather than more of
// glance-actions.ts because a 'use server' file may only export async server
// actions — the synchronous core would be untestable from there, and this
// logic is exactly the part that must be tested (the parity and leak rules
// in glance-actions.test.ts). Same split as followups.ts (pure) feeding
// ai-actions.ts (server), for the same reason.
//
// PARITY IS THE CONTRACT. For any meeting, the glance this produces must
// deep-equal glanceFromIntel(await getMeetingIntel(id)) — the row's chips
// and the opened panel's contents must never disagree. That is why nothing
// here re-implements a count: the carried-forward selection is
// selectCarriedForward (caps and all), the merge/overdue math rides inside
// glanceFromIntel, and this module only reproduces getMeetingIntel's
// per-meeting ROW FILTERING in JS — the one part that had to move out of SQL
// so a hundred meetings cost the same number of statements as one.

import { can, type UserRole } from '@/features/auth/capabilities'
import {
  selectCarriedForward,
  type FollowupKind,
  type OpenFollowupItem,
} from '@/features/meetings/followups'
import {
  glanceFromIntel,
  type MeetingGlance,
} from '@/features/meetings/components/meeting-notes-model'

/**
 * Ids over this cap answer null, exactly like a denied id. The docket batches
 * one screenful of meetings; a hundred-id request is already a whole page of
 * history, and an unbounded one is a way to make one server action hydrate
 * the entire meetings table.
 */
export const MAX_GLANCE_IDS = 100

/** The meeting row fields the glance computation actually reads. */
export type GlanceMeetingRow = {
  id: string
  createdBy: string
  startsAt: Date
  nextMeetingAt: Date | null
}

/** One meeting's meeting_ai_notes row, JSONB columns still unknown-shaped. */
export type GlanceNotesRow = {
  meetingId: string
  perPerson: unknown
  deadlines: unknown
  questions: unknown
  createdAt: Date
}

export type GlanceAttendeeRow = { meetingId: string; userId: string }

/**
 * One candidate follow-up row from the batched carry query — a SUPERSET of
 * what any single meeting carries, narrowed per meeting by
 * carriedIntoMeeting below. Carries the source meeting's title/date the same
 * way fetchCarriedFollowups joins them.
 */
export type GlanceFollowupRow = {
  id: string
  userId: string | null
  personName: string
  text: string
  kind: FollowupKind
  status: 'open' | 'resolved'
  targetMeetingId: string | null
  resolvedInMeetingId: string | null
  sourceMeetingId: string
  sourceMeetingTitle: string
  sourceMeetingStartsAt: Date
}

/**
 * The per-meeting half of fetchCarriedFollowups' WHERE clause (see
 * ai-actions.ts), byte-for-byte in JS: the batched query keeps only the
 * meeting-independent conditions (open-or-resolved-somewhere-in-the-batch,
 * attributed, source live, source readable by the caller) and this decides
 * which meetings each surviving row actually lands on. Change one without
 * the other and a row's chip count silently diverges from the panel it
 * opens into.
 */
export function carriedIntoMeeting(
  row: GlanceFollowupRow,
  meeting: { id: string; startsAt: Date },
): boolean {
  if (row.status !== 'open' && row.resolvedInMeetingId !== meeting.id) return false
  if (row.userId === null) return false
  if (row.targetMeetingId !== null) return row.targetMeetingId === meeting.id
  return (
    row.sourceMeetingId !== meeting.id &&
    row.sourceMeetingStartsAt.getTime() < meeting.startsAt.getTime()
  )
}

/** getMeetingIntel's defensive JSONB read, unchanged: not-an-array is []. */
function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

const EMPTY_SCOPE: ReadonlySet<string> = new Set()

/**
 * The batched twin of canReadMeetingIntel (ai-actions.ts), decided from
 * pre-fetched sets so a hundred meetings need three IN-clause queries
 * instead of three hundred point reads. THE RULE IS THE SAME FOUR ARMS,
 * built from the same primitives — `can` with 'meeting.intel.view' (the
 * admin and creator arms), isProjectManagerRole over the caller's
 * assignments (managedAppIds — the PM arm, resolved once by the caller),
 * and an attendee row. If canReadMeetingIntel grows an arm, this must grow
 * it too, or list chips and the opened panel will disagree about whether a
 * meeting produced anything.
 */
export function decideIntelReadable(args: {
  viewer: { id: string; role: UserRole }
  meeting: { id: string; createdBy: string }
  /** The meeting's own project ids (meeting_apps). */
  meetingAppIds: readonly string[]
  /** App ids where the viewer's assignment carries a manager-family role. */
  managedAppIds: ReadonlySet<string>
  /** Meeting ids (within the batch) the viewer is an attendee of. */
  attendedMeetingIds: ReadonlySet<string>
}): boolean {
  const { viewer, meeting } = args
  if (
    can(
      { id: viewer.id, role: viewer.role, scopeAppIds: EMPTY_SCOPE },
      'meeting.intel.view',
      { ownerId: meeting.createdBy },
    )
  ) {
    return true
  }
  if (args.meetingAppIds.some((appId) => args.managedAppIds.has(appId))) return true
  return args.attendedMeetingIds.has(meeting.id)
}

/**
 * rows in → glances out, for the meetings the permission gate already
 * admitted. Per meeting this rebuilds exactly the slice of getMeetingIntel
 * that glanceFromIntel reads — notes (JSONB, defensively parsed), the
 * carried-forward prep groups (selectCarriedForward over this meeting's
 * qualifying rows and attendees, resolved statuses mapped back on, so the
 * per-person cap displaces the same items it displaces in the panel), and
 * the room's agreed next meeting — then hands it to the SAME glanceFromIntel
 * the panel uses. One `now` for the whole batch, so neighbouring rows can
 * never disagree about what "overdue" means.
 */
export function buildGlanceMap(input: {
  meetings: GlanceMeetingRow[]
  notesRows: GlanceNotesRow[]
  attendeeRows: GlanceAttendeeRow[]
  followupRows: GlanceFollowupRow[]
  now: Date
}): Map<string, MeetingGlance> {
  const notesByMeeting = new Map(input.notesRows.map((row) => [row.meetingId, row]))
  const attendeesByMeeting = new Map<string, string[]>()
  for (const row of input.attendeeRows) {
    const list = attendeesByMeeting.get(row.meetingId) ?? []
    list.push(row.userId)
    attendeesByMeeting.set(row.meetingId, list)
  }
  const statusById = new Map(input.followupRows.map((row) => [row.id, row.status]))

  const glances = new Map<string, MeetingGlance>()
  for (const meeting of input.meetings) {
    const carried: OpenFollowupItem[] = input.followupRows.filter((row) =>
      carriedIntoMeeting(row, meeting),
    )
    const prep = selectCarriedForward(
      carried,
      attendeesByMeeting.get(meeting.id) ?? [],
      input.now,
    ).map((group) => ({
      // getMeetingIntel maps each visible item back to its row's status the
      // same way; its resolved-last re-sort is skipped here because the cap
      // was already applied inside selectCarriedForward, so ordering within
      // a group cannot change what gets counted.
      items: group.items.map((item) => ({
        status: statusById.get(item.id) ?? ('open' as const),
        fromDate: item.fromDate,
      })),
    }))

    const notesRow = notesByMeeting.get(meeting.id)
    glances.set(
      meeting.id,
      glanceFromIntel(
        {
          notes: notesRow
            ? {
                // glanceFromIntel never reads the summary text — hasNotes is
                // "a notes row exists" — so the batch does not fetch it.
                summary: null,
                perPerson: asArray(notesRow.perPerson),
                deadlines: asArray(notesRow.deadlines),
                questions: asArray(notesRow.questions),
                createdAt: notesRow.createdAt,
              }
            : null,
          prep,
          nextMeetingAt: meeting.nextMeetingAt,
        },
        input.now,
      ),
    )
  }
  return glances
}

/**
 * The response shape: EVERY requested id gets a key, and anything the
 * pipeline did not produce a glance for — denied, unknown, trashed, over the
 * cap — is null. Null is deliberately indistinguishable from
 * "asked, nothing to show": a distinct denied marker would let any member
 * probe which meetings carry intel they cannot read.
 */
export function assembleGlanceResponse(
  requestedIds: readonly string[],
  glances: ReadonlyMap<string, MeetingGlance>,
): Record<string, MeetingGlance | null> {
  const map: Record<string, MeetingGlance | null> = {}
  for (const id of requestedIds) {
    map[id] = glances.get(id) ?? null
  }
  return map
}
