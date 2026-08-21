/**
 * Invited hours, and how much of the RSVP widget anybody actually uses.
 *
 * INVITED HOURS, NOT ATTENDED HOURS, and the name is the honesty. Nothing in
 * this product can see who walked into a room; what it can see is who was asked
 * and for how long. That is a real cost and fully derivable, so it stays the
 * headline — but every surface says "invited hours" and carries the definition
 * sentence, because a number that quietly means something else is worse than no
 * number.
 *
 * Pure: no clock, no I/O.
 */

/** Nobody is invited to a fourteen-hour meeting. A duration past this is a
 *  data-entry accident or an all-day placeholder, and letting one through would
 *  swamp a week's total with a single row. */
export const DURATION_CLAMP_HOURS = 8

const HOUR_MS = 60 * 60 * 1000

export type AttendeeResponse = 'pending' | 'going' | 'maybe' | 'declined'

export interface OccurrenceHoursInput {
  meetingId: string
  startsAt: Date
  endsAt: Date
  attendeeResponses: AttendeeResponse[]
}

export interface OccurrenceHoursResult {
  meetingId: string
  hours: number
  /** The raw duration exceeded the clamp. Surfaced rather than silent: a week
   *  whose total was quietly cut is a week whose number cannot be checked. */
  clamped: boolean
  /** endsAt <= startsAt. Contributes zero and says so, instead of contributing
   *  a negative that would make a week's total smaller than its parts. */
  flagged: boolean
}

/**
 * `LEAST(duration, 8h) × (attendees who have not declined)`.
 *
 * Declined rows are excluded because a decline is the one RSVP signal that IS
 * unambiguous — somebody said no. Every other response, `pending` included, is
 * treated as invited, since `pending` measures whether anyone uses the widget
 * rather than whether they intend to come.
 */
export function invitedHoursFor(input: OccurrenceHoursInput): OccurrenceHoursResult {
  const rawMs = input.endsAt.getTime() - input.startsAt.getTime()
  if (!Number.isFinite(rawMs) || rawMs <= 0) {
    return { meetingId: input.meetingId, hours: 0, clamped: false, flagged: true }
  }

  const rawHours = rawMs / HOUR_MS
  const clamped = rawHours > DURATION_CLAMP_HOURS
  const hours = Math.min(rawHours, DURATION_CLAMP_HOURS)
  const heads = input.attendeeResponses.filter((response) => response !== 'declined').length

  return { meetingId: input.meetingId, hours: hours * heads, clamped, flagged: false }
}

export interface RsvpAdoptionRow { userId: string; response: AttendeeResponse }
export interface RsvpAdoptionInput { meetingId: string; createdBy: string; attendees: RsvpAdoptionRow[] }
export interface RsvpAdoptionResult { pending: number; total: number; rate: number }

/**
 * How many invitations are still sitting at `pending`.
 *
 * A NEUTRAL ADOPTION STAT, never a waste signal, and the demotion is the whole
 * point. The .ics invites this product sends carry RSVP=TRUE and mail-client
 * replies never write back, so `pending` measures how many people use the
 * in-app control — not how many intend to come. A rule that read it as
 * disinterest would propose cancelling meetings the whole team attends.
 *
 * The ORGANIZER'S OWN ROW IS EXCLUDED. `pending` is genuinely unsettable
 * through the UI for the person who created the meeting, so counting it would
 * put a floor under every adoption figure that has nothing to do with adoption.
 */
export function rsvpAdoption(inputs: RsvpAdoptionInput[]): RsvpAdoptionResult {
  let pending = 0
  let total = 0
  for (const meeting of inputs) {
    for (const attendee of meeting.attendees) {
      if (attendee.userId === meeting.createdBy) continue
      total += 1
      if (attendee.response === 'pending') pending += 1
    }
  }
  return { pending, total, rate: total === 0 ? 0 : pending / total }
}
