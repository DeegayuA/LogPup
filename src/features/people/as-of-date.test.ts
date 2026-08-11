import { describe, it, expect } from 'vitest'
import { isoDaysAgo, resolveAsOf, todayIso } from './as-of-date'

const NOW = new Date('2026-08-11T09:30:00.000Z')

describe('resolveAsOf', () => {
  it('defaults to now when no param is given', () => {
    expect(resolveAsOf(undefined, NOW)).toEqual({
      at: NOW,
      iso: '2026-08-11',
      isToday: true,
      invalid: false,
    })
  })

  it('resolves a past day to the END of that day', () => {
    const resolved = resolveAsOf('2026-03-04', NOW)
    expect(resolved.at.toISOString()).toBe('2026-03-04T23:59:59.999Z')
    expect(resolved).toMatchObject({ iso: '2026-03-04', isToday: false, invalid: false })
  })

  it('clamps today to now rather than the end of today', () => {
    const resolved = resolveAsOf('2026-08-11', NOW)
    expect(resolved.at).toBe(NOW)
    expect(resolved.isToday).toBe(true)
  })

  it('clamps a future date to now without flagging it invalid', () => {
    expect(resolveAsOf('2027-01-01', NOW)).toMatchObject({
      at: NOW,
      iso: '2026-08-11',
      isToday: true,
      invalid: false,
    })
  })

  it('flags a malformed param and falls back to now', () => {
    for (const raw of ['nonsense', '2026-3-4', '11/08/2026', '']) {
      const resolved = resolveAsOf(raw || undefined, NOW)
      expect(resolved.at).toBe(NOW)
      if (raw) expect(resolved.invalid).toBe(true)
    }
  })

  it('rejects a well-formed but nonexistent day instead of sliding it', () => {
    // Date.UTC would roll 2026-02-31 forward to March 3.
    expect(resolveAsOf('2026-02-31', NOW)).toMatchObject({ invalid: true, isToday: true })
  })
})

describe('isoDaysAgo / todayIso', () => {
  it('walks back whole days in UTC', () => {
    expect(isoDaysAgo(7, NOW)).toBe('2026-08-04')
    expect(isoDaysAgo(30, NOW)).toBe('2026-07-12')
    expect(isoDaysAgo(0, NOW)).toBe('2026-08-11')
  })

  it('crosses a month boundary', () => {
    expect(isoDaysAgo(1, new Date('2026-03-01T00:00:00.000Z'))).toBe('2026-02-28')
  })

  it('todayIso is the UTC day', () => {
    expect(todayIso(NOW)).toBe('2026-08-11')
  })
})
