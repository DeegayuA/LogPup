/**
 * Splits the meetings a person is an attendee of into what is ahead of them and
 * what just happened, and counts how many they actually turned up to.
 *
 * THE BOUNDARY IS `endsAt`, NOT `startsAt`. A meeting that started twenty
 * minutes ago and runs for another forty is the single most useful row on the
 * page — "they are in a meeting right now" — and keying off startsAt files it
 * under "recent", where nobody looks. It is therefore upcoming, flagged
 * `inProgress`, and stays at the top of the list until it is genuinely over.
 *
 * ATTENDANCE IS "DID NOT DECLINE", not "said yes". `meeting_attendees.response`
 * defaults to 'pending' and most people never touch it, so counting only
 * 'going' would report zero attendance for a team that meets constantly. An
 * explicit 'declined' is the one signal that reliably means "was not there", so
 * that — and only that — is excluded. The label the UI puts on the number says
 * "not declined" rather than implying a register was taken.
 *
 * Both lists are CAPPED. A long-tenured person accumulates hundreds of
 * meetings, and the query already bounds the window it reads; the caps bound
 * what renders inside it. `totalUpcoming`/`totalRecent` report the full counts
 * within the window so the UI can say "5 of 23" instead of quietly truncating.
 */

export type AttendeeResponse = 'pending' | 'going' | 'maybe' | 'declined'

export type PersonMeetingRow = {
  id: string
  title: string
  startsAt: Date
  endsAt: Date
  meetingUrl: string | null
  appName: string | null
  appSlug: string | null
  response: AttendeeResponse
}

export type PersonMeetingEntry = PersonMeetingRow & {
  /** Started but not finished — happening as the page is rendered. */
  inProgress: boolean
}

export type PersonMeetings = {
  upcoming: PersonMeetingEntry[]
  recent: PersonMeetingEntry[]
  totalUpcoming: number
  totalRecent: number
  /** Past meetings in the trailing window they did not decline. */
  attendedRecently: number
  /** How many days back `attendedRecently` looks, for the UI's label. */
  attendedWindowDays: number
}

export type SplitOptions = {
  upcomingLimit?: number
  recentLimit?: number
  attendedWindowDays?: number
}

const DEFAULTS = { upcomingLimit: 5, recentLimit: 5, attendedWindowDays: 30 } as const

export function splitPersonMeetings(
  rows: PersonMeetingRow[],
  now: Date,
  options: SplitOptions = {},
): PersonMeetings {
  const { upcomingLimit, recentLimit, attendedWindowDays } = { ...DEFAULTS, ...options }
  const nowMs = now.getTime()
  const windowStartMs = nowMs - attendedWindowDays * 86_400_000

  const entries = rows.map((row) => ({
    ...row,
    inProgress: row.startsAt.getTime() <= nowMs && row.endsAt.getTime() > nowMs,
  }))

  const ahead = entries.filter((entry) => entry.endsAt.getTime() > nowMs)
  const behind = entries.filter((entry) => entry.endsAt.getTime() <= nowMs)

  return {
    upcoming: [...ahead]
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .slice(0, upcomingLimit),
    recent: [...behind]
      .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
      .slice(0, recentLimit),
    totalUpcoming: ahead.length,
    totalRecent: behind.length,
    attendedRecently: behind.filter(
      (entry) => entry.response !== 'declined' && entry.startsAt.getTime() >= windowStartMs,
    ).length,
    attendedWindowDays,
  }
}
