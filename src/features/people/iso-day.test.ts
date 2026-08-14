import { describe, it, expect } from 'vitest'
import { isIsoDay, isoDayAdd, isoDayDiff, isoDayOf, isoDayRange, isoWeekStart } from './iso-day'

describe('isIsoDay', () => {
  it('accepts a real calendar day', () => {
    expect(isIsoDay('2026-08-12')).toBe(true)
  })

  it('rejects a day that does not exist', () => {
    expect(isIsoDay('2026-02-31')).toBe(false)
  })

  it('rejects anything not in YYYY-MM-DD shape', () => {
    expect(isIsoDay('12/08/2026')).toBe(false)
    expect(isIsoDay('2026-8-12')).toBe(false)
    expect(isIsoDay('')).toBe(false)
  })

  it('accepts a leap day in a leap year and rejects it otherwise', () => {
    expect(isIsoDay('2028-02-29')).toBe(true)
    expect(isIsoDay('2026-02-29')).toBe(false)
  })
})

describe('isoDayAdd', () => {
  it('walks forward across a month boundary', () => {
    expect(isoDayAdd('2026-08-30', 3)).toBe('2026-09-02')
  })

  it('walks backwards across a year boundary', () => {
    expect(isoDayAdd('2026-01-02', -3)).toBe('2025-12-30')
  })

  it('is the identity for zero', () => {
    expect(isoDayAdd('2026-08-12', 0)).toBe('2026-08-12')
  })

  it('throws on a malformed day rather than sliding it', () => {
    expect(() => isoDayAdd('2026-02-31', 1)).toThrow(RangeError)
  })
})

describe('isoWeekStart', () => {
  it('walks back to the Sunday that starts the week', () => {
    // 2026-02-13 is a Friday; the activity grid's first column has to begin on
    // the Sunday before it or the calendar's bottom rows hang off the left edge.
    expect(isoWeekStart('2026-02-13')).toBe('2026-02-08')
    expect(isoWeekStart('2026-02-14')).toBe('2026-02-08')
  })

  it('leaves a Sunday alone', () => {
    expect(isoWeekStart('2026-02-08')).toBe('2026-02-08')
  })

  it('crosses a month and a year boundary', () => {
    expect(isoWeekStart('2026-03-03')).toBe('2026-03-01')
    expect(isoWeekStart('2026-01-01')).toBe('2025-12-28')
  })

  it('throws on a malformed day rather than sliding it', () => {
    expect(() => isoWeekStart('2026-02-31')).toThrow(RangeError)
  })
})

describe('isoDayDiff', () => {
  it('counts whole days forward', () => {
    expect(isoDayDiff('2026-08-12', '2026-08-10')).toBe(2)
  })

  it('is negative when the target is earlier', () => {
    expect(isoDayDiff('2026-08-10', '2026-08-12')).toBe(-2)
  })

  it('spans a leap day correctly', () => {
    expect(isoDayDiff('2028-03-01', '2028-02-28')).toBe(2)
  })
})

describe('isoDayOf', () => {
  it('resolves an instant to its Asia/Colombo day, not its UTC day', () => {
    // 20:00 UTC is already the next morning in Colombo (UTC+5:30) — the exact
    // window in which a naive toISOString().slice(0, 10) reads yesterday.
    expect(isoDayOf(new Date('2026-08-11T20:00:00.000Z'))).toBe('2026-08-12')
    expect(isoDayOf(new Date('2026-08-11T17:00:00.000Z'))).toBe('2026-08-11')
  })
})

describe('isoDayRange', () => {
  it('is inclusive of both ends', () => {
    expect(isoDayRange('2026-08-10', '2026-08-13')).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
    ])
  })

  it('returns a single day when both ends match', () => {
    expect(isoDayRange('2026-08-10', '2026-08-10')).toEqual(['2026-08-10'])
  })

  it('returns nothing for an inverted range instead of looping', () => {
    expect(isoDayRange('2026-08-13', '2026-08-10')).toEqual([])
  })

  it('caps a runaway range', () => {
    expect(isoDayRange('2000-01-01', '2026-01-01')).toHaveLength(1001)
  })
})
