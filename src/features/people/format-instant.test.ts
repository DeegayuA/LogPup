import { describe, it, expect } from 'vitest'
import {
  formatBusinessDayMonth,
  formatBusinessMeetingRange,
  formatBusinessMonthYear,
  formatBusinessTime,
  formatBusinessWeekdayDayMonth,
} from './format-instant'

/**
 * Every expectation below is written from a UTC instant, so these tests fail
 * if the module ever falls back to the process timezone — which is exactly the
 * bug it exists to prevent. Asia/Colombo is UTC+5:30 with no DST, so
 * 03:30 UTC is 09:00 Colombo on the same day and 20:00 UTC is already tomorrow.
 */
describe('formatBusinessTime', () => {
  it('renders 12-hour Colombo wall-clock time, not the process timezone', () => {
    expect(formatBusinessTime(new Date('2026-08-12T03:30:00.000Z'))).toBe('9:00 AM')
  })

  it('pads minutes but not the hour', () => {
    expect(formatBusinessTime(new Date('2026-08-12T03:35:00.000Z'))).toBe('9:05 AM')
  })

  it('crosses into PM correctly', () => {
    expect(formatBusinessTime(new Date('2026-08-12T09:00:00.000Z'))).toBe('2:30 PM')
  })

  it('prints midnight as 12:00 AM, never 0:00', () => {
    // 18:30 UTC is 00:00 the next day in Colombo.
    expect(formatBusinessTime(new Date('2026-08-11T18:30:00.000Z'))).toBe('12:00 AM')
  })

  it('prints noon as 12:00 PM', () => {
    expect(formatBusinessTime(new Date('2026-08-12T06:30:00.000Z'))).toBe('12:00 PM')
  })
})

describe('formatBusinessDayMonth', () => {
  it('uses the Colombo calendar day', () => {
    expect(formatBusinessDayMonth(new Date('2026-08-12T03:30:00.000Z'))).toBe('Aug 12')
  })

  it('rolls to the next day for a late-evening UTC instant', () => {
    // 20:00 UTC on the 11th is 01:30 on the 12th in Colombo. Formatting in UTC
    // would print "Aug 11" while followup-split.ts aged it as the 12th.
    expect(formatBusinessDayMonth(new Date('2026-08-11T20:00:00.000Z'))).toBe('Aug 12')
  })
})

describe('formatBusinessWeekdayDayMonth', () => {
  it('names the weekday of the Colombo day', () => {
    expect(formatBusinessWeekdayDayMonth(new Date('2026-08-12T03:30:00.000Z'))).toBe('Wed, Aug 12')
  })

  it('rolls the weekday over with the day', () => {
    expect(formatBusinessWeekdayDayMonth(new Date('2026-08-11T20:00:00.000Z'))).toBe('Wed, Aug 12')
  })
})

describe('formatBusinessMonthYear', () => {
  it('formats a joined date', () => {
    expect(formatBusinessMonthYear(new Date('2026-01-03T00:00:00.000Z'))).toBe('Jan 2026')
  })

  it('uses the Colombo year at a new-year boundary', () => {
    // 19:00 UTC on Dec 31 is already Jan 1 in Colombo.
    expect(formatBusinessMonthYear(new Date('2025-12-31T19:00:00.000Z'))).toBe('Jan 2026')
  })
})

describe('formatBusinessMeetingRange', () => {
  it('prints one day and two times for a same-day meeting', () => {
    expect(
      formatBusinessMeetingRange(
        new Date('2026-08-12T03:30:00.000Z'),
        new Date('2026-08-12T04:30:00.000Z'),
      ),
    ).toBe('Wed, Aug 12 · 9:00 AM – 10:00 AM')
  })

  it('carries the day onto the end when a meeting runs past midnight', () => {
    // 23:00–00:30 Colombo. Without the day the end would read as if the
    // meeting finished 22 hours before it started.
    expect(
      formatBusinessMeetingRange(
        new Date('2026-08-12T17:30:00.000Z'),
        new Date('2026-08-12T19:00:00.000Z'),
      ),
    ).toBe('Wed, Aug 12 · 11:00 PM – Thu, Aug 13 12:30 AM')
  })

  it('does not split a range that only crosses midnight UTC', () => {
    // 22:00 UTC → 03:30 Colombo next day; 23:00 UTC → 04:30 Colombo same
    // Colombo day. The comparison must be Colombo days, not UTC days.
    expect(
      formatBusinessMeetingRange(
        new Date('2026-08-11T22:00:00.000Z'),
        new Date('2026-08-11T23:00:00.000Z'),
      ),
    ).toBe('Wed, Aug 12 · 3:30 AM – 4:30 AM')
  })
})

describe('invalid input', () => {
  it('throws rather than printing "Invalid Date" into the page', () => {
    expect(() => formatBusinessTime(new Date('nonsense'))).toThrow(RangeError)
  })
})
