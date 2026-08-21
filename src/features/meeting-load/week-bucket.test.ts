import { describe, expect, it } from 'vitest'
import { localWeekStartIso, weekStartIsoOffset } from './week-bucket'

describe('localWeekStartIso', () => {
  it('files Sunday 18:30 UTC in the Colombo Monday that has already begun', () => {
    // 18:30 UTC on Sunday is 00:00 Monday in Colombo (UTC+5:30) exactly. A UTC
    // bucket would file this in the previous week while the fill loop expected
    // it in this one — the whole bug class this module exists for.
    expect(localWeekStartIso(new Date('2026-08-23T18:30:00Z'))).toBe('2026-08-24')
  })

  it('keeps an instant that is still Sunday in UTC in the Colombo Monday', () => {
    // Monday 05:29 Colombo = Sunday 23:59 UTC.
    expect(localWeekStartIso(new Date('2026-08-23T23:59:00Z'))).toBe('2026-08-24')
  })

  it('treats Sunday as the END of its week, not the start of the next', () => {
    // Sunday midday Colombo belongs to the Monday six days earlier.
    expect(localWeekStartIso(new Date('2026-08-23T06:30:00Z'))).toBe('2026-08-17')
  })

  it('returns the day itself for a Monday', () => {
    expect(localWeekStartIso(new Date('2026-08-24T06:30:00Z'))).toBe('2026-08-24')
  })

  it('walks back through the week for each weekday', () => {
    expect(localWeekStartIso(new Date('2026-08-21T06:30:00Z'))).toBe('2026-08-17') // Friday
    expect(localWeekStartIso(new Date('2026-08-22T06:30:00Z'))).toBe('2026-08-17') // Saturday
  })
})

describe('weekStartIsoOffset', () => {
  it('steps back exactly seven days', () => {
    expect(weekStartIsoOffset('2026-08-24', 1)).toBe('2026-08-17')
    expect(weekStartIsoOffset('2026-08-24', 4)).toBe('2026-07-27')
  })

  it('is a no-op at zero', () => {
    expect(weekStartIsoOffset('2026-08-24', 0)).toBe('2026-08-24')
  })

  it('crosses a month and a year boundary without drifting', () => {
    expect(weekStartIsoOffset('2026-01-05', 1)).toBe('2025-12-29')
  })
})
