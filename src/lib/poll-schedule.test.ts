import { describe, expect, it } from 'vitest'
import { nextPollDelay, shouldPoll } from '@/lib/poll-schedule'

const SCHEDULE = { baseMs: 15_000, maxMs: 300_000 }

describe('nextPollDelay', () => {
  it('doubles the wait each time a poll comes back with nothing new', () => {
    expect(nextPollDelay(15_000, false, SCHEDULE)).toBe(30_000)
    expect(nextPollDelay(30_000, false, SCHEDULE)).toBe(60_000)
    expect(nextPollDelay(60_000, false, SCHEDULE)).toBe(120_000)
  })

  it('never backs off past maxMs', () => {
    expect(nextPollDelay(240_000, false, SCHEDULE)).toBe(300_000)
    expect(nextPollDelay(300_000, false, SCHEDULE)).toBe(300_000)
  })

  it('snaps straight back to baseMs the moment something changes', () => {
    // Fully backed off, then a notification lands.
    expect(nextPollDelay(300_000, true, SCHEDULE)).toBe(15_000)
  })

  it('grows from baseMs even when handed a shorter current delay', () => {
    expect(nextPollDelay(0, false, SCHEDULE)).toBe(30_000)
    expect(nextPollDelay(500, false, SCHEDULE)).toBe(30_000)
  })

  it('honours a custom factor', () => {
    expect(nextPollDelay(15_000, false, { ...SCHEDULE, factor: 3 })).toBe(45_000)
  })

  it('treats factor 1 as "no backoff" rather than shrinking the delay', () => {
    expect(nextPollDelay(15_000, false, { ...SCHEDULE, factor: 1 })).toBe(15_000)
    // A nonsensical factor must not turn the backoff into a speed-up.
    expect(nextPollDelay(15_000, false, { ...SCHEDULE, factor: 0.5 })).toBe(15_000)
  })
})

describe('shouldPoll', () => {
  it('polls only when enabled, visible and online all hold', () => {
    expect(shouldPoll({ enabled: true, visible: true, online: true })).toBe(true)
  })

  it('stops for a backgrounded tab', () => {
    expect(shouldPoll({ enabled: true, visible: false, online: true })).toBe(false)
  })

  it('stops while offline', () => {
    expect(shouldPoll({ enabled: true, visible: true, online: false })).toBe(false)
  })

  it('stops when the caller disables it, however good the conditions', () => {
    expect(shouldPoll({ enabled: false, visible: true, online: true })).toBe(false)
  })
})
