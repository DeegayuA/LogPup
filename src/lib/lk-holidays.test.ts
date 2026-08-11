import { describe, it, expect } from 'vitest'
import { isLkHoliday, isLkSunday, toIsoDateInTimeZone } from './lk-holidays'

describe('isLkHoliday', () => {
  it('returns the holiday name for a known holiday', () => {
    // Noon in Colombo (UTC+5:30) — well inside 2026-02-04 in both UTC and Colombo.
    expect(isLkHoliday(new Date('2026-02-04T06:00:00Z'))).toBe('Independence Day')
  })

  it('returns undefined for a non-holiday', () => {
    expect(isLkHoliday(new Date('2026-02-05T06:00:00Z'))).toBeUndefined()
  })

  it('resolves the timezone edge: a UTC date that is already the next day in Colombo', () => {
    // 2026-02-03T20:00:00Z is 2026-02-04 01:30 in Asia/Colombo (UTC+5:30) —
    // already Independence Day locally, even though the UTC calendar date
    // is still 2026-02-03.
    const utcEdge = new Date('2026-02-03T20:00:00Z')
    expect(isLkHoliday(utcEdge)).toBe('Independence Day')
    // The same instant, read as a UTC calendar date, is not a holiday —
    // proves the result is timezone-dependent and not a coincidence.
    expect(isLkHoliday(utcEdge, 'UTC')).toBeUndefined()
  })

  it('is keyed by ISO date, not calendar coincidence', () => {
    expect(isLkHoliday(new Date('2026-12-25T06:00:00Z'))).toBe('Christmas Day')
    expect(isLkHoliday(new Date('2026-12-24T06:00:00Z'))).toBeUndefined()
  })
})

describe('isLkSunday', () => {
  it('is true for a Sunday in Colombo', () => {
    // 2026-01-04 is a Sunday in Asia/Colombo and not a public holiday.
    expect(isLkSunday(new Date('2026-01-04T06:00:00Z'))).toBe(true)
  })

  it('is false for a non-Sunday', () => {
    // 2026-01-03 is a Saturday in Asia/Colombo.
    expect(isLkSunday(new Date('2026-01-03T06:00:00Z'))).toBe(false)
  })

  it('resolves the timezone edge like isLkHoliday', () => {
    // 2026-02-01T20:00:00Z is 2026-02-02 01:30 in Asia/Colombo — already
    // Monday there — while the UTC calendar date is still Sunday 2026-02-01.
    const edge = new Date('2026-02-01T20:00:00Z')
    expect(isLkSunday(edge)).toBe(false)
    expect(isLkSunday(edge, 'UTC')).toBe(true)
  })

  it('can land on a holiday too (Sunday + holiday coexist)', () => {
    // 2026-02-01, Navam Full Moon Poya Day, is also a Sunday — the UI layer
    // decides which color wins; both helpers must independently agree it's
    // a Sunday and a holiday.
    const date = new Date('2026-02-01T06:00:00Z')
    expect(isLkSunday(date)).toBe(true)
    expect(isLkHoliday(date)).toBe('Navam Full Moon Poya Day')
  })
})

describe('toIsoDateInTimeZone', () => {
  it('formats using the wall-clock day in the given timezone', () => {
    expect(toIsoDateInTimeZone(new Date('2026-02-03T20:00:00Z'), 'Asia/Colombo')).toBe('2026-02-04')
    expect(toIsoDateInTimeZone(new Date('2026-02-03T20:00:00Z'), 'UTC')).toBe('2026-02-03')
  })
})
