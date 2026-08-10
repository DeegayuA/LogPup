import { describe, it, expect } from 'vitest'
import { splitByUpcoming } from './split-upcoming'

const now = new Date('2026-08-10T12:00:00')

function meeting(startsAt: string) {
  return { startsAt: new Date(startsAt) }
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

  it('returns empty arrays for no meetings', () => {
    expect(splitByUpcoming([], now)).toEqual({ upcoming: [], past: [] })
  })
})
