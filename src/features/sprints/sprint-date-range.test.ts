import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SPRINT_DAYS,
  defaultSprintRange,
  shiftEndDate,
  sprintDurationLabel,
} from './sprint-date-range'

// All dates below are plain `yyyy-mm-dd` calendar strings, matched to the
// `sprints` table's `date` columns — there is no timezone in play anywhere
// in this file, only calendar-day arithmetic.

describe('DEFAULT_SPRINT_DAYS', () => {
  it('is 7', () => expect(DEFAULT_SPRINT_DAYS).toBe(7))
})

describe('defaultSprintRange', () => {
  it('is 7 inclusive calendar days starting today (start + 6 = end)', () => {
    expect(defaultSprintRange('2026-08-11')).toEqual({
      startDate: '2026-08-11',
      endDate: '2026-08-17',
    })
  })

  it('crosses a month boundary correctly (Aug 28 -> Sep 3)', () => {
    expect(defaultSprintRange('2026-08-28')).toEqual({
      startDate: '2026-08-28',
      endDate: '2026-09-03',
    })
  })

  it('crosses the February/March boundary in a leap year (2028 has Feb 29)', () => {
    expect(defaultSprintRange('2028-02-25')).toEqual({
      startDate: '2028-02-25',
      endDate: '2028-03-02',
    })
  })

  it('crosses the February/March boundary in a non-leap year (2026 has 28 days)', () => {
    // One day further into March than the 2028 leap-year case above, since
    // February is a day shorter — confirms the leap day is actually being
    // accounted for and not just coincidentally landing on the same date.
    expect(defaultSprintRange('2026-02-25')).toEqual({
      startDate: '2026-02-25',
      endDate: '2026-03-03',
    })
  })

  it('crosses a year boundary (Dec 28 -> Jan 3)', () => {
    expect(defaultSprintRange('2026-12-28')).toEqual({
      startDate: '2026-12-28',
      endDate: '2027-01-03',
    })
  })
})

describe('shiftEndDate', () => {
  it('preserves the duration when the start date moves forward', () => {
    // 2026-08-11..2026-08-17 is a 7-day span; moving the start forward a
    // week should move the end forward a week too.
    expect(shiftEndDate('2026-08-11', '2026-08-17', '2026-08-18')).toBe('2026-08-24')
  })

  it('preserves the duration when the start date moves backward', () => {
    expect(shiftEndDate('2026-08-11', '2026-08-17', '2026-08-04')).toBe('2026-08-10')
  })

  it('preserves a non-default duration, not just DEFAULT_SPRINT_DAYS', () => {
    // A 3-day span (inclusive): 08-01, 08-02, 08-03.
    expect(shiftEndDate('2026-08-01', '2026-08-03', '2026-08-10')).toBe('2026-08-12')
  })

  it('preserves duration across a month boundary shift', () => {
    // Same 7-day span as the defaultSprintRange month-boundary case above,
    // nudged one day later so the shifted end also crosses into September.
    expect(shiftEndDate('2026-08-28', '2026-09-03', '2026-08-29')).toBe('2026-09-04')
  })
})

describe('sprintDurationLabel', () => {
  it('pluralizes multi-day ranges', () => {
    expect(sprintDurationLabel('2026-08-11', '2026-08-17')).toBe('7 days')
  })

  it('does not pluralize a single-day range', () => {
    expect(sprintDurationLabel('2026-08-11', '2026-08-11')).toBe('1 day')
  })

  it('returns null when the end date is before the start date', () => {
    expect(sprintDurationLabel('2026-08-17', '2026-08-11')).toBeNull()
  })

  it('returns null when either date is missing', () => {
    expect(sprintDurationLabel('', '2026-08-17')).toBeNull()
    expect(sprintDurationLabel('2026-08-11', '')).toBeNull()
    expect(sprintDurationLabel('', '')).toBeNull()
  })
})
