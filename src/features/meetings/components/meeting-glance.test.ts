import { describe, it, expect } from 'vitest'
import {
  durationLabel,
  isAwaitingViewerRsvp,
  meetingTiming,
  noRsvpYet,
  summarizeMeetings,
  tallyRsvps,
  type AttendeeResponse,
} from './meeting-glance'

const now = new Date('2026-08-12T10:00:00')

function attendee(id: string, response: AttendeeResponse) {
  return { id, name: id, response }
}

describe('tallyRsvps', () => {
  it('counts every response bucket', () => {
    expect(
      tallyRsvps([
        attendee('a', 'going'),
        attendee('b', 'going'),
        attendee('c', 'maybe'),
        attendee('d', 'declined'),
        attendee('e', 'pending'),
      ]),
    ).toEqual({ going: 2, maybe: 1, declined: 1, pending: 1, total: 5 })
  })

  it('returns an all-zero tally for nobody', () => {
    expect(tallyRsvps([])).toEqual({ going: 0, maybe: 0, declined: 0, pending: 0, total: 0 })
  })
})

describe('noRsvpYet', () => {
  it('flags an upcoming meeting nobody has answered', () => {
    const tally = tallyRsvps([attendee('a', 'pending'), attendee('b', 'pending')])
    expect(noRsvpYet(tally, 'upcoming')).toBe(true)
  })

  it('does not flag a meeting with even one answer', () => {
    const tally = tallyRsvps([attendee('a', 'pending'), attendee('b', 'declined')])
    expect(noRsvpYet(tally, 'upcoming')).toBe(false)
  })

  it('does not flag a past meeting — the reply no longer matters', () => {
    const tally = tallyRsvps([attendee('a', 'pending')])
    expect(noRsvpYet(tally, 'past')).toBe(false)
  })

  it('does not flag a meeting with no invitees at all', () => {
    expect(noRsvpYet(tallyRsvps([]), 'upcoming')).toBe(false)
  })
})

describe('isAwaitingViewerRsvp', () => {
  it('flags a meeting where the viewer has not answered', () => {
    const meeting = { attendees: [attendee('me', 'pending'), attendee('other', 'going')] }
    expect(isAwaitingViewerRsvp(meeting, 'me')).toBe(true)
  })

  it('does not flag once the viewer has answered — any answer counts', () => {
    for (const response of ['going', 'maybe', 'declined'] as const) {
      expect(isAwaitingViewerRsvp({ attendees: [attendee('me', response)] }, 'me')).toBe(false)
    }
  })

  it("ignores other people's pending replies", () => {
    const meeting = { attendees: [attendee('other', 'pending')] }
    expect(isAwaitingViewerRsvp(meeting, 'me')).toBe(false)
  })

  it('never flags a meeting the viewer is not invited to', () => {
    expect(isAwaitingViewerRsvp({ attendees: [] }, 'me')).toBe(false)
  })

  it('agrees with summarizeMeetings — the tile and the row share one definition', () => {
    const upcoming = [
      {
        startsAt: new Date('2026-08-14T09:00:00'),
        endsAt: new Date('2026-08-14T10:00:00'),
        attendees: [attendee('me', 'pending')],
      },
    ]
    expect(summarizeMeetings(upcoming, [], 'me', now).awaitingYou).toBe(
      upcoming.filter((meeting) => isAwaitingViewerRsvp(meeting, 'me')).length,
    )
  })
})

describe('meetingTiming', () => {
  function timing(start: string, end: string) {
    return meetingTiming(new Date(start), new Date(end), now)
  }

  it('reports a meeting in progress as live', () => {
    expect(timing('2026-08-12T09:30:00', '2026-08-12T11:00:00')).toMatchObject({
      state: 'live',
      label: 'Happening now',
    })
  })

  it('treats the exact start instant as live, not upcoming', () => {
    expect(timing('2026-08-12T10:00:00', '2026-08-12T11:00:00').state).toBe('live')
  })

  it('treats the exact end instant as past, not live', () => {
    expect(timing('2026-08-12T09:00:00', '2026-08-12T10:00:00').state).toBe('past')
  })

  it('calls anything within the hour "starting soon"', () => {
    expect(timing('2026-08-12T10:45:00', '2026-08-12T11:15:00')).toMatchObject({
      state: 'soon',
      label: 'Starting soon',
    })
  })

  it('separates later today from tomorrow', () => {
    expect(timing('2026-08-12T16:00:00', '2026-08-12T17:00:00')).toMatchObject({
      state: 'today',
      label: 'Later today',
    })
    expect(timing('2026-08-13T09:00:00', '2026-08-13T10:00:00').label).toBe('Tomorrow')
  })

  it('counts days, then weeks, then months ahead', () => {
    expect(timing('2026-08-15T09:00:00', '2026-08-15T10:00:00').label).toBe('In 3 days')
    expect(timing('2026-08-26T09:00:00', '2026-08-26T10:00:00').label).toBe('In 2 weeks')
    expect(timing('2026-10-20T09:00:00', '2026-10-20T10:00:00').label).toBe('In 2 months')
  })

  it('counts days, then weeks, then months back', () => {
    expect(timing('2026-08-12T07:00:00', '2026-08-12T08:00:00').label).toBe('Earlier today')
    expect(timing('2026-08-11T09:00:00', '2026-08-11T10:00:00').label).toBe('Yesterday')
    expect(timing('2026-08-09T09:00:00', '2026-08-09T10:00:00').label).toBe('3 days ago')
    expect(timing('2026-08-01T09:00:00', '2026-08-01T10:00:00').label).toBe('1 week ago')
    expect(timing('2026-06-01T09:00:00', '2026-06-01T10:00:00').label).toBe('2 months ago')
  })

  it('measures days in calendar days, not 24-hour blocks', () => {
    // 23:30 tonight is under 24h away but is still "Later today".
    expect(timing('2026-08-12T23:30:00', '2026-08-13T00:30:00').label).toBe('Later today')
    // 00:30 tomorrow is ~14h away but is a different calendar day.
    expect(timing('2026-08-13T00:30:00', '2026-08-13T01:30:00').label).toBe('Tomorrow')
  })
})

describe('durationLabel', () => {
  it('formats sub-hour, whole-hour and mixed spans', () => {
    expect(durationLabel(new Date('2026-08-12T10:00:00'), new Date('2026-08-12T10:45:00'))).toBe('45m')
    expect(durationLabel(new Date('2026-08-12T10:00:00'), new Date('2026-08-12T12:00:00'))).toBe('2h')
    expect(durationLabel(new Date('2026-08-12T10:00:00'), new Date('2026-08-12T11:30:00'))).toBe('1h 30m')
  })

  it('never reports a negative duration for a broken time range', () => {
    expect(durationLabel(new Date('2026-08-12T11:00:00'), new Date('2026-08-12T10:00:00'))).toBe('0m')
  })
})

describe('summarizeMeetings', () => {
  function meeting(startsAt: string, endsAt: string, attendees: ReturnType<typeof attendee>[] = []) {
    return { startsAt: new Date(startsAt), endsAt: new Date(endsAt), attendees }
  }

  it('counts today, this week and the ones waiting on you', () => {
    const upcoming = [
      meeting('2026-08-12T14:00:00', '2026-08-12T15:00:00', [attendee('me', 'pending')]),
      meeting('2026-08-14T09:00:00', '2026-08-14T10:00:00', [attendee('me', 'going')]),
      meeting('2026-09-01T09:00:00', '2026-09-01T10:00:00', [attendee('me', 'pending')]),
    ]
    const past = [meeting('2026-08-01T09:00:00', '2026-08-01T10:00:00')]

    expect(summarizeMeetings(upcoming, past, 'me', now)).toEqual({
      total: 4,
      upcoming: 3,
      past: 1,
      today: 1,
      week: 2,
      awaitingYou: 2,
      live: 0,
    })
  })

  it('counts meetings that already happened today under "today"', () => {
    // splitByUpcoming files on startsAt, so this morning's 09:00 stand-up is
    // in `past` by 10:00. A tile labelled "Today" that ignored it read 0 to
    // somebody who had been in meetings all morning.
    const past = [meeting('2026-08-12T09:00:00', '2026-08-12T09:30:00')]
    const upcoming = [meeting('2026-08-12T16:00:00', '2026-08-12T17:00:00')]
    expect(summarizeMeetings(upcoming, past, 'me', now)).toMatchObject({ today: 2, week: 1 })
  })

  it('leaves a finished meeting out of the next-7-days count', () => {
    const past = [meeting('2026-08-12T09:00:00', '2026-08-12T09:30:00')]
    expect(summarizeMeetings([], past, 'me', now).week).toBe(0)
  })

  it('counts a running meeting as live even though it is filed under past', () => {
    // splitByUpcoming files on startsAt, so a meeting that began at 09:30 and
    // runs to 11:00 lands in `past` while it is still happening.
    const past = [meeting('2026-08-12T09:30:00', '2026-08-12T11:00:00')]
    expect(summarizeMeetings([], past, 'me', now).live).toBe(1)
  })

  it('ignores a pending response that is not yours', () => {
    const upcoming = [meeting('2026-08-14T09:00:00', '2026-08-14T10:00:00', [attendee('someone-else', 'pending')])]
    expect(summarizeMeetings(upcoming, [], 'me', now).awaitingYou).toBe(0)
  })

  it('handles an empty page', () => {
    expect(summarizeMeetings([], [], 'me', now)).toEqual({
      total: 0,
      upcoming: 0,
      past: 0,
      today: 0,
      week: 0,
      awaitingYou: 0,
      live: 0,
    })
  })
})
