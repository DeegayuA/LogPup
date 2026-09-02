import { describe, expect, it, vi } from 'vitest'

// The module under test imports the glance server action (for `retry`), and
// THAT module reaches the db at import time — stubbed out so this stays a
// pure-function test. Same mocked-module idiom as rsvp-actions.test.ts.
vi.mock('@/features/meetings/glance-actions', () => ({ getMeetingGlances: vi.fn() }))

import { nextListBoundary } from './use-glance-map'

const now = new Date('2026-08-10T12:00:00')

/** One meeting, an hour long unless told otherwise. */
function meeting(startsAt: string, durationMinutes = 60) {
  const start = new Date(startsAt)
  return { startsAt: start, endsAt: new Date(start.getTime() + durationMinutes * 60_000) }
}

describe('nextListBoundary', () => {
  it('returns null for an empty list', () => {
    expect(nextListBoundary([], now)).toBeNull()
  })

  it('returns null when every boundary is behind now', () => {
    expect(nextListBoundary([meeting('2026-08-10T09:00:00')], now)).toBeNull()
  })

  it('picks the soonest future start across meetings', () => {
    // Both starts are already inside their "Starting soon" hour, so the
    // starts themselves are the next label changes.
    const meetings = [meeting('2026-08-10T12:45:00'), meeting('2026-08-10T12:20:00')]
    expect(nextListBoundary(meetings, now)).toEqual(new Date('2026-08-10T12:20:00'))
  })

  it("arms the 'Starting soon' threshold an hour before a start", () => {
    // A 14:00 meeting flips from "Later today" to "Starting soon" at 13:00
    // (start − SOON_MINUTES) — without this boundary an idle tab jumps
    // straight from "Later today" to "Happening now".
    const meetings = [meeting('2026-08-10T14:00:00')]
    expect(nextListBoundary(meetings, now)).toEqual(new Date('2026-08-10T13:00:00'))
  })

  it('a live meeting contributes its END as the next boundary', () => {
    // Started 11:30, ends 12:30 — the crossing that turns "Happening now"
    // stale is the end, and it must beat a later meeting's start.
    const meetings = [meeting('2026-08-10T11:30:00'), meeting('2026-08-10T14:00:00')]
    expect(nextListBoundary(meetings, now)).toEqual(new Date('2026-08-10T12:30:00'))
  })

  it('a boundary exactly at now is already crossed, not upcoming', () => {
    // Strictly-after matters: re-arming on "now itself" would loop a timer
    // on the same instant forever instead of advancing past it.
    const meetings = [meeting('2026-08-10T12:00:00', 30)]
    expect(nextListBoundary(meetings, now)).toEqual(new Date('2026-08-10T12:30:00'))
  })

  it('order of meetings does not matter', () => {
    const a = [meeting('2026-08-10T13:00:00'), meeting('2026-08-10T12:15:00', 15)]
    const b = [...a].reverse()
    expect(nextListBoundary(a, now)).toEqual(nextListBoundary(b, now))
    expect(nextListBoundary(a, now)).toEqual(new Date('2026-08-10T12:15:00'))
  })
})
