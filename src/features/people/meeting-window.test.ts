import { describe, it, expect } from 'vitest'
import { splitPersonMeetings, type PersonMeetingRow } from './meeting-window'

const NOW = new Date('2026-08-12T06:00:00.000Z')
const HOUR = 3_600_000
const DAY = 86_400_000

function meeting(over: Partial<PersonMeetingRow> = {}): PersonMeetingRow {
  const startsAt = over.startsAt ?? new Date(NOW.getTime() + DAY)
  return {
    id: 'm1',
    title: 'Weekly sync',
    startsAt,
    endsAt: new Date(startsAt.getTime() + HOUR),
    meetingUrl: null,
    appName: null,
    appSlug: null,
    response: 'pending',
    ...over,
  }
}

describe('splitPersonMeetings', () => {
  it('files a future meeting as upcoming and a finished one as recent', () => {
    const result = splitPersonMeetings(
      [
        meeting({ id: 'future', startsAt: new Date(NOW.getTime() + DAY) }),
        meeting({ id: 'past', startsAt: new Date(NOW.getTime() - DAY) }),
      ],
      NOW,
    )
    expect(result.upcoming.map((m) => m.id)).toEqual(['future'])
    expect(result.recent.map((m) => m.id)).toEqual(['past'])
  })

  it('keeps an in-progress meeting in upcoming and flags it', () => {
    const live = meeting({
      id: 'live',
      startsAt: new Date(NOW.getTime() - 20 * 60_000),
      endsAt: new Date(NOW.getTime() + 40 * 60_000),
    })
    const result = splitPersonMeetings([live], NOW)
    expect(result.upcoming.map((m) => m.id)).toEqual(['live'])
    expect(result.upcoming[0].inProgress).toBe(true)
    expect(result.recent).toEqual([])
  })

  it('does not flag a meeting that has not started', () => {
    const result = splitPersonMeetings([meeting({ id: 'later' })], NOW)
    expect(result.upcoming[0].inProgress).toBe(false)
  })

  it('treats a meeting ending exactly now as over', () => {
    const result = splitPersonMeetings(
      [meeting({ id: 'edge', startsAt: new Date(NOW.getTime() - HOUR), endsAt: NOW })],
      NOW,
    )
    expect(result.recent.map((m) => m.id)).toEqual(['edge'])
  })

  it('orders upcoming soonest-first and recent newest-first', () => {
    const result = splitPersonMeetings(
      [
        meeting({ id: 'in-3d', startsAt: new Date(NOW.getTime() + 3 * DAY) }),
        meeting({ id: 'in-1d', startsAt: new Date(NOW.getTime() + DAY) }),
        meeting({ id: '5d-ago', startsAt: new Date(NOW.getTime() - 5 * DAY) }),
        meeting({ id: '1d-ago', startsAt: new Date(NOW.getTime() - DAY) }),
      ],
      NOW,
    )
    expect(result.upcoming.map((m) => m.id)).toEqual(['in-1d', 'in-3d'])
    expect(result.recent.map((m) => m.id)).toEqual(['1d-ago', '5d-ago'])
  })

  it('caps both lists but still reports the real totals', () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      meeting({ id: `up-${i}`, startsAt: new Date(NOW.getTime() + (i + 1) * DAY) }),
    ).concat(
      Array.from({ length: 6 }, (_, i) =>
        meeting({ id: `past-${i}`, startsAt: new Date(NOW.getTime() - (i + 1) * DAY) }),
      ),
    )
    const result = splitPersonMeetings(rows, NOW, { upcomingLimit: 3, recentLimit: 2 })
    expect(result.upcoming).toHaveLength(3)
    expect(result.recent).toHaveLength(2)
    expect(result.totalUpcoming).toBe(8)
    expect(result.totalRecent).toBe(6)
  })

  it('counts attendance as "did not decline" within the window', () => {
    const result = splitPersonMeetings(
      [
        meeting({ id: 'a', startsAt: new Date(NOW.getTime() - DAY), response: 'going' }),
        meeting({ id: 'b', startsAt: new Date(NOW.getTime() - 2 * DAY), response: 'pending' }),
        meeting({ id: 'c', startsAt: new Date(NOW.getTime() - 3 * DAY), response: 'maybe' }),
        meeting({ id: 'd', startsAt: new Date(NOW.getTime() - 4 * DAY), response: 'declined' }),
      ],
      NOW,
    )
    expect(result.attendedRecently).toBe(3)
  })

  it('excludes past meetings older than the attendance window', () => {
    const result = splitPersonMeetings(
      [
        meeting({ id: 'inside', startsAt: new Date(NOW.getTime() - 29 * DAY) }),
        meeting({ id: 'outside', startsAt: new Date(NOW.getTime() - 31 * DAY) }),
      ],
      NOW,
      { attendedWindowDays: 30 },
    )
    expect(result.attendedRecently).toBe(1)
    expect(result.attendedWindowDays).toBe(30)
  })

  it('never counts a future meeting as attended', () => {
    const result = splitPersonMeetings([meeting({ response: 'going' })], NOW)
    expect(result.attendedRecently).toBe(0)
  })

  it('is empty all round for someone with no meetings', () => {
    const result = splitPersonMeetings([], NOW)
    expect(result.upcoming).toEqual([])
    expect(result.recent).toEqual([])
    expect(result.totalUpcoming).toBe(0)
    expect(result.totalRecent).toBe(0)
    expect(result.attendedRecently).toBe(0)
    expect(result.today).toBe(0)
  })
})

// NOW is 2026-08-12T06:00Z — 11:30 AM in Asia/Colombo, so "today" there runs
// from 2026-08-11T18:30Z to 2026-08-12T18:29Z. The dashboard's "Meetings
// today" tile reads this field; each case below is one it used to get wrong
// back when the count was filtered out of the `upcoming` display list.
describe('splitPersonMeetings today count', () => {
  it('counts meetings that already finished today, not just the ones ahead', () => {
    const result = splitPersonMeetings(
      [
        meeting({ id: 'this-morning', startsAt: new Date(NOW.getTime() - 3 * HOUR) }),
        meeting({ id: 'this-afternoon', startsAt: new Date(NOW.getTime() + 3 * HOUR) }),
      ],
      NOW,
    )
    expect(result.upcoming).toHaveLength(1)
    expect(result.today).toBe(2)
  })

  it('is not capped by upcomingLimit the way the display list is', () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      meeting({ id: `m${i}`, startsAt: new Date(NOW.getTime() + (i + 1) * (HOUR / 2)) }),
    )
    const result = splitPersonMeetings(rows, NOW)
    expect(result.upcoming).toHaveLength(5) // the cap
    expect(result.today).toBe(8)
  })

  it('uses the Colombo calendar day, not the UTC one', () => {
    const result = splitPersonMeetings(
      [
        // 20:00Z on the 11th is already 01:30 on the 12th in Colombo.
        meeting({ id: 'colombo-today', startsAt: new Date('2026-08-11T20:00:00.000Z') }),
        // 10:00Z on the 11th is still the 11th there.
        meeting({ id: 'colombo-yesterday', startsAt: new Date('2026-08-11T10:00:00.000Z') }),
      ],
      NOW,
    )
    expect(result.today).toBe(1)
  })

  it('excludes tomorrow', () => {
    const result = splitPersonMeetings(
      [meeting({ id: 'tomorrow', startsAt: new Date(NOW.getTime() + DAY) })],
      NOW,
    )
    expect(result.upcoming).toHaveLength(1)
    expect(result.today).toBe(0)
  })
})
