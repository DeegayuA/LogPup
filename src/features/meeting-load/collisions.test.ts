import { describe, expect, it } from 'vitest'
import { computeCollisions, type WeekMeetingInterval } from './collisions'

const at = (iso: string) => new Date(iso)
const meeting = (
  meetingId: string, start: string, end: string, users: string[],
): WeekMeetingInterval => ({
  meetingId, startsAt: at(start), endsAt: at(end), nonDeclinedUserIds: users,
})

describe('computeCollisions — overlap', () => {
  it('counts the overlapping span for a double-booked person', () => {
    const result = computeCollisions([
      meeting('a', '2026-08-21T09:00:00Z', '2026-08-21T10:00:00Z', ['u1']),
      meeting('b', '2026-08-21T09:30:00Z', '2026-08-21T10:30:00Z', ['u1']),
    ])
    expect(result.teamOverlapHours).toBe(0.5)
    expect(result.perUserOverlapHours).toEqual({ u1: 0.5 })
  })

  it('does NOT treat touching meetings as an overlap', () => {
    const result = computeCollisions([
      meeting('a', '2026-08-21T09:00:00Z', '2026-08-21T10:00:00Z', ['u1']),
      meeting('b', '2026-08-21T10:00:00Z', '2026-08-21T11:00:00Z', ['u1']),
    ])
    expect(result.teamOverlapHours).toBe(0)
    expect(result.teamBackToBackCount).toBe(1)
  })

  it('counts identical intervals as a full-duration overlap', () => {
    const result = computeCollisions([
      meeting('a', '2026-08-21T09:00:00Z', '2026-08-21T10:00:00Z', ['u1']),
      meeting('b', '2026-08-21T09:00:00Z', '2026-08-21T10:00:00Z', ['u1']),
    ])
    expect(result.teamOverlapHours).toBe(1)
  })

  it('compares each pair once and never a meeting with itself', () => {
    const result = computeCollisions([
      meeting('a', '2026-08-21T09:00:00Z', '2026-08-21T10:00:00Z', ['u1']),
      meeting('b', '2026-08-21T09:00:00Z', '2026-08-21T10:00:00Z', ['u1']),
    ])
    // Counted twice it would be 2; counted against itself, more.
    expect(result.teamOverlapHours).toBe(1)
  })

  it('keeps two people’s overlaps out of each other’s totals', () => {
    const result = computeCollisions([
      meeting('a', '2026-08-21T09:00:00Z', '2026-08-21T10:00:00Z', ['u1', 'u2']),
      meeting('b', '2026-08-21T09:30:00Z', '2026-08-21T10:30:00Z', ['u1']),
    ])
    expect(result.perUserOverlapHours).toEqual({ u1: 0.5 })
    expect(result.perUserOverlapHours.u2).toBeUndefined()
  })

  it('trusts the caller’s declined filter — it is given no response field', () => {
    const result = computeCollisions([
      meeting('a', '2026-08-21T09:00:00Z', '2026-08-21T10:00:00Z', ['u1']),
      meeting('b', '2026-08-21T09:00:00Z', '2026-08-21T10:00:00Z', []),
    ])
    expect(result.teamOverlapHours).toBe(0)
  })
})

describe('computeCollisions — back-to-back', () => {
  const gap = (minutes: number, seconds = 0) => computeCollisions([
    meeting('a', '2026-08-21T09:00:00Z', '2026-08-21T10:00:00Z', ['u1']),
    meeting('b',
      new Date(at('2026-08-21T10:00:00Z').getTime() + (minutes * 60 + seconds) * 1000).toISOString(),
      '2026-08-21T12:00:00Z', ['u1']),
  ]).teamBackToBackCount

  it('counts a zero gap', () => { expect(gap(0)).toBe(1) })
  it('counts 9m59s', () => { expect(gap(9, 59)).toBe(1) })
  it('does not count exactly 10m', () => { expect(gap(10)).toBe(0) })
})

describe('computeCollisions — broken rows', () => {
  it('ignores a meeting that ends before it starts', () => {
    const result = computeCollisions([
      meeting('a', '2026-08-21T11:00:00Z', '2026-08-21T09:00:00Z', ['u1']),
      meeting('b', '2026-08-21T09:00:00Z', '2026-08-21T10:00:00Z', ['u1']),
    ])
    expect(result.teamOverlapHours).toBe(0)
    expect(result.teamBackToBackCount).toBe(0)
  })

  it('ignores a zero-length meeting', () => {
    const result = computeCollisions([
      meeting('a', '2026-08-21T09:00:00Z', '2026-08-21T09:00:00Z', ['u1']),
      meeting('b', '2026-08-21T09:00:00Z', '2026-08-21T10:00:00Z', ['u1']),
    ])
    expect(result.teamOverlapHours).toBe(0)
  })

  it('is empty for an empty week', () => {
    expect(computeCollisions([])).toEqual({
      teamOverlapHours: 0, teamBackToBackCount: 0, perUserOverlapHours: {},
    })
  })
})
