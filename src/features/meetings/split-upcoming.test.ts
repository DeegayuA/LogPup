import { describe, it, expect } from 'vitest'
import { splitByUpcoming } from './split-upcoming'

const now = new Date('2026-08-10T12:00:00')

/** One meeting, an hour long unless told otherwise. */
function meeting(startsAt: string, durationMinutes = 60) {
  const start = new Date(startsAt)
  return { startsAt: start, endsAt: new Date(start.getTime() + durationMinutes * 60_000) }
}

describe('splitByUpcoming', () => {
  it('sorts upcoming meetings ascending', () => {
    const meetings = [meeting('2026-08-12T09:00:00'), meeting('2026-08-11T09:00:00')]
    const { upcoming } = splitByUpcoming(meetings, now)
    expect(upcoming.map((m) => m.startsAt.toISOString())).toEqual([
      meeting('2026-08-11T09:00:00').startsAt.toISOString(),
      meeting('2026-08-12T09:00:00').startsAt.toISOString(),
    ])
  })

  it('keeps past meetings in their given order', () => {
    const meetings = [meeting('2026-08-09T09:00:00'), meeting('2026-08-08T09:00:00')]
    const { past } = splitByUpcoming(meetings, now)
    expect(past).toEqual(meetings)
  })

  it('treats a meeting starting exactly now as upcoming', () => {
    const meetings = [meeting('2026-08-10T12:00:00')]
    const { upcoming, past } = splitByUpcoming(meetings, now)
    expect(upcoming).toHaveLength(1)
    expect(past).toHaveLength(0)
  })

  it('keeps a meeting that is HAPPENING NOW out of the past list', () => {
    // The bug this guards: splitting on startsAt filed a running meeting
    // under "Past" the moment it began, while its own badge — computed from
    // endsAt by meetingTiming — still read "Happening now". One screen, two
    // contradictory answers about the same meeting.
    const running = meeting('2026-08-10T11:29:00', 60) // ends 12:29; now is 12:00
    const { upcoming, past } = splitByUpcoming([running], now)
    expect(past).toHaveLength(0)
    expect(upcoming).toEqual([running])
  })

  it('sorts a running meeting above one that has not started', () => {
    // The meeting you are sitting in belongs at the top of the list.
    const running = meeting('2026-08-10T11:30:00', 60)
    const later = meeting('2026-08-10T16:00:00')
    const { upcoming } = splitByUpcoming([later, running], now)
    expect(upcoming).toEqual([running, later])
  })

  it('files a meeting as past the instant it ends, not a moment before', () => {
    const endsExactlyNow = meeting('2026-08-10T11:00:00', 60) // ends 12:00:00
    const { upcoming, past } = splitByUpcoming([endsExactlyNow], now)
    expect(past).toEqual([endsExactlyNow])
    expect(upcoming).toHaveLength(0)
  })

  it('handles a day-long meeting still under way', () => {
    const allDay = meeting('2026-08-10T00:00:00', 24 * 60)
    expect(splitByUpcoming([allDay], now).past).toHaveLength(0)
  })

  it('returns empty arrays for no meetings', () => {
    expect(splitByUpcoming([], now)).toEqual({ upcoming: [], past: [] })
  })
})
