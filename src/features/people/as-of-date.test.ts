import { describe, it, expect } from 'vitest'
import { isoDaysAgo, resolveAsOf, todayIso } from './as-of-date'

const NOW = new Date('2026-08-11T09:30:00.000Z')
// 01:30 on the 12th in Colombo (UTC+5:30) — still the 11th in UTC. Every
// "what day is it" answer below has to say the 12th.
const AFTER_LOCAL_MIDNIGHT = new Date('2026-08-11T20:00:00.000Z')

describe('resolveAsOf', () => {
  it('defaults to now when no param is given', () => {
    expect(resolveAsOf(undefined, NOW)).toEqual({
      at: NOW,
      iso: '2026-08-11',
      isToday: true,
      invalid: false,
    })
  })

  it('resolves a past day to the END of that day in Asia/Colombo', () => {
    const resolved = resolveAsOf('2026-03-04', NOW)
    // 23:59:59.999 Colombo, i.e. 18:29:59.999Z — not 23:59:59.999Z, which is
    // already 05:29 on the 5th locally and would fold the next morning's
    // changes into "the 4th".
    expect(resolved.at.toISOString()).toBe('2026-03-04T18:29:59.999Z')
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

  it('treats the local calendar day as today just after local midnight', () => {
    // The bug this pins: with a UTC day the 12th read as "the future" and got
    // clamped, so the picker showed the 11th under a heading saying "today".
    expect(resolveAsOf('2026-08-12', AFTER_LOCAL_MIDNIGHT)).toMatchObject({
      iso: '2026-08-12',
      isToday: true,
      invalid: false,
    })
    expect(resolveAsOf('2026-08-11', AFTER_LOCAL_MIDNIGHT)).toMatchObject({
      iso: '2026-08-11',
      isToday: false,
    })
  })
})

describe('isoDaysAgo / todayIso', () => {
  it('walks back whole days in the business timezone', () => {
    expect(isoDaysAgo(7, NOW)).toBe('2026-08-04')
    expect(isoDaysAgo(30, NOW)).toBe('2026-07-12')
    expect(isoDaysAgo(0, NOW)).toBe('2026-08-11')
  })

  it('crosses a month boundary', () => {
    expect(isoDaysAgo(1, new Date('2026-03-01T00:00:00.000Z'))).toBe('2026-02-28')
  })

  it('todayIso is the Asia/Colombo day, not the UTC one', () => {
    expect(todayIso(NOW)).toBe('2026-08-11')
    expect(todayIso(AFTER_LOCAL_MIDNIGHT)).toBe('2026-08-12')
  })

  it('presets step back from the local day, not the UTC one', () => {
    expect(isoDaysAgo(0, AFTER_LOCAL_MIDNIGHT)).toBe('2026-08-12')
    expect(isoDaysAgo(7, AFTER_LOCAL_MIDNIGHT)).toBe('2026-08-05')
  })
})
