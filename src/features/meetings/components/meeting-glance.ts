// The numbers and labels a meeting row shows BEFORE anyone opens it, plus the
// counts the /meetings header leads with. Pure and colocated with the
// components that render them (meeting-list, meetings-views, the page header)
// so the "what does this row say at a glance" rules are testable without a
// DOM.
//
// Everything here takes `now` as an argument rather than reading the clock:
// these run during render in client components, where React's compiler lint
// (correctly) treats a clock read as impure, and a test that cannot pin "now"
// can only assert tautologies.

import { differenceInCalendarDays } from 'date-fns'

export type AttendeeResponse = 'pending' | 'going' | 'maybe' | 'declined'

export type RsvpTally = {
  going: number
  maybe: number
  declined: number
  pending: number
  total: number
}

/**
 * Who is actually coming. `response` is fetched for every attendee
 * (queries.ts attachAttendees) and was, until now, thrown away by the row —
 * the avatar pile rendered identically whether everyone had accepted or
 * nobody had opened the invite.
 */
export function tallyRsvps(attendees: { response: AttendeeResponse }[]): RsvpTally {
  const tally: RsvpTally = { going: 0, maybe: 0, declined: 0, pending: 0, total: attendees.length }
  for (const attendee of attendees) tally[attendee.response] += 1
  return tally
}

/**
 * True when an upcoming meeting has invitees and not one of them has
 * answered. This is the only RSVP fact that earns a colour: "nobody has
 * replied and it is about to happen" is a thing to act on, whereas "two
 * people declined" is just information.
 */
export function noRsvpYet(tally: RsvpTally, state: MeetingState): boolean {
  return state !== 'past' && tally.total > 0 && tally.pending === tally.total
}

/**
 * Whether THIS viewer still owes this meeting an answer.
 *
 * THE one pending-RSVP source — the "Waiting on you" tile, the row's inline
 * Yes/Maybe/No, and the waiting filter all call this. It existed twice before
 * (summarizeMeetings' inline find, and getMyPendingInvites' own query), and
 * the two could disagree on the same screen; a predicate with one definition
 * cannot.
 *
 * Deliberately says nothing about timing: "a past meeting no longer needs a
 * reply" is a decision about which meetings a caller feeds in (the tile
 * counts upcoming only), not about what "your response is pending" means.
 */
export function isAwaitingViewerRsvp(
  meeting: { attendees: { id: string; response: AttendeeResponse }[] },
  viewerId: string,
): boolean {
  const mine = meeting.attendees.find((attendee) => attendee.id === viewerId)
  return mine?.response === 'pending'
}

export type MeetingState = 'live' | 'soon' | 'today' | 'upcoming' | 'past'

export type MeetingTiming = {
  state: MeetingState
  /** Human label for the row's timing chip, e.g. "Tomorrow", "3 days ago". */
  label: string
  /** Calendar days from `now` to the start — positive future, negative past. */
  days: number
}

/** Minutes before the start at which a meeting reads as "about to happen".
 *  Exported so the boundary clock (useListNow) can arm a tick at the instant
 *  a row's label flips to "Starting soon", not only at start/end. */
export const SOON_MINUTES = 60

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`
}

/**
 * Where a meeting sits relative to now, in words.
 *
 * Deliberately COARSE below the day: "Starting soon" rather than "in 43
 * minutes". These labels are rendered by client components that also render
 * on the server, so a minute-resolution label is a hydration mismatch waiting
 * for a slow request — and nobody schedules their morning off a minute
 * counter that only updates when React happens to re-render. Day-granularity
 * labels change at most once per render for the entire window they describe.
 */
export function meetingTiming(startsAt: Date, endsAt: Date, now: Date): MeetingTiming {
  const days = differenceInCalendarDays(startsAt, now)

  if (now.getTime() >= startsAt.getTime() && now.getTime() < endsAt.getTime()) {
    return { state: 'live', label: 'Happening now', days }
  }

  if (now.getTime() >= endsAt.getTime()) {
    const ago = -days
    if (ago <= 0) return { state: 'past', label: 'Earlier today', days }
    if (ago === 1) return { state: 'past', label: 'Yesterday', days }
    if (ago < 7) return { state: 'past', label: `${ago} days ago`, days }
    if (ago < 30) return { state: 'past', label: `${plural(Math.floor(ago / 7), 'week')} ago`, days }
    return { state: 'past', label: `${plural(Math.floor(ago / 30), 'month')} ago`, days }
  }

  const minutesUntil = (startsAt.getTime() - now.getTime()) / 60_000
  if (minutesUntil <= SOON_MINUTES) return { state: 'soon', label: 'Starting soon', days }
  if (days <= 0) return { state: 'today', label: 'Later today', days }
  if (days === 1) return { state: 'upcoming', label: 'Tomorrow', days }
  if (days < 7) return { state: 'upcoming', label: `In ${days} days`, days }
  if (days < 30) return { state: 'upcoming', label: `In ${plural(Math.floor(days / 7), 'week')}`, days }
  return { state: 'upcoming', label: `In ${plural(Math.floor(days / 30), 'month')}`, days }
}

/** "45m" / "1h" / "1h 30m" — how long the meeting runs. */
export function durationLabel(startsAt: Date, endsAt: Date): string {
  const minutes = Math.max(0, Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}

type OverviewMeeting = {
  startsAt: Date
  endsAt: Date
  attendees: { id: string; response: AttendeeResponse }[]
}

export type MeetingsOverview = {
  total: number
  upcoming: number
  past: number
  /**
   * Every meeting starting today, INCLUDING ones that have already finished.
   * Counting only the ones still to come made a tile labelled "Today" read 0
   * at 5pm to somebody who had just sat through three meetings — a number
   * that is technically about "what's left" wearing the label of "what's
   * happening today". If you want "what's left", read it off the row states.
   */
  today: number
  /** Upcoming meetings starting within the next 7 calendar days (incl. today). */
  week: number
  /** Upcoming meetings you are invited to and have not answered. */
  awaitingYou: number
  live: number
}

/**
 * The at-a-glance numbers for the page header. Before this, the only figure on
 * /meetings was `upcoming.length + past.length` — a total that tells you
 * nothing you can act on. "Today", "this week" and "waiting on your reply" are
 * the three questions someone opens this page holding.
 */
export function summarizeMeetings(
  upcoming: OverviewMeeting[],
  past: OverviewMeeting[],
  currentUserId: string,
  now: Date,
): MeetingsOverview {
  let today = 0
  let week = 0
  let awaitingYou = 0
  let live = 0

  for (const meeting of upcoming) {
    const timing = meetingTiming(meeting.startsAt, meeting.endsAt, now)
    if (timing.days >= 0 && timing.days < 7) week += 1
    if (isAwaitingViewerRsvp(meeting, currentUserId)) awaitingYou += 1
  }

  // `today` and `live` are both counted across BOTH lists on purpose.
  // splitByUpcoming now files a meeting as past once it has ENDED, so a
  // running one sits in `upcoming` — but everything that finished EARLIER
  // today is in `past`, and both belong in a "Today" count. Read off
  // `upcoming` alone, the header said "Today 0" to someone whose day had been
  // nothing but meetings. (`live` can only come from `upcoming` now; it is
  // still summed over both so the two counters cannot drift apart should the
  // split rule ever move again.)
  for (const meeting of [...upcoming, ...past]) {
    const timing = meetingTiming(meeting.startsAt, meeting.endsAt, now)
    if (timing.days === 0) today += 1
    if (timing.state === 'live') live += 1
  }

  return {
    total: upcoming.length + past.length,
    upcoming: upcoming.length,
    past: past.length,
    today,
    week,
    awaitingYou,
    live,
  }
}
