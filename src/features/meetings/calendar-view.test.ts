import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VIEW,
  addCalendarMonths,
  calendarUrlPatch,
  endOfMonthIso,
  isCalendarView,
  isIsoDate,
  isTimeGridView,
  isoDayInstant,
  isoToDisplayDate,
  mondayIndex,
  parseCalendarView,
  parseFocusedDate,
  startOfMonthIso,
  startOfWeekIso,
  stepFocusedDate,
  visibleRange,
} from './calendar-view'
import { getLkHoliday, isLkSunday, toIsoDateInTimeZone } from '@/lib/lk-holidays'

/*
 * Every assertion below is an exact string. That is deliberate: the whole
 * module works in `Date.UTC` space on `yyyy-mm-dd` strings, so these results
 * must be identical whatever timezone the test runner sits in — a range that
 * shifted with TZ would be the exact bug this design exists to prevent.
 *
 * Reference dates: 2026-08-12 is a Wednesday; 2026-08-01 a Saturday;
 * 2026-08-31 a Monday; 2026-12-01 a Tuesday.
 */

describe('parseCalendarView', () => {
  it('opens on the list, exactly as the page does today', () => {
    expect(parseCalendarView(null)).toBe('list')
    expect(parseCalendarView(undefined)).toBe(DEFAULT_VIEW)
  })

  it('accepts every view', () => {
    expect(parseCalendarView('day')).toBe('day')
    expect(parseCalendarView('week')).toBe('week')
    expect(parseCalendarView('month')).toBe('month')
    expect(parseCalendarView('agenda')).toBe('agenda')
  })

  it('falls back rather than rendering a view that does not exist', () => {
    expect(parseCalendarView('year')).toBe('list')
    expect(parseCalendarView('')).toBe('list')
  })

  it('knows which views the time grid renders', () => {
    expect(isTimeGridView('day')).toBe(true)
    expect(isTimeGridView('week')).toBe(true)
    expect(isTimeGridView('month')).toBe(false)
    expect(isTimeGridView('agenda')).toBe(false)
    expect(isCalendarView('list')).toBe(false)
    expect(isCalendarView('month')).toBe(true)
  })
})

describe('isIsoDate / parseFocusedDate', () => {
  it('accepts a real date', () => {
    expect(isIsoDate('2026-08-12')).toBe(true)
    expect(isIsoDate('2028-02-29')).toBe(true)
  })

  it('rejects a date that does not exist instead of rolling it over', () => {
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('2026-13-01')).toBe(false)
    expect(isIsoDate('2026-00-10')).toBe(false)
    expect(isIsoDate('2026-8-12')).toBe(false)
    expect(isIsoDate('yesterday')).toBe(false)
  })

  it('falls back to today for anything missing or hand-mangled', () => {
    expect(parseFocusedDate(null, '2026-08-12')).toBe('2026-08-12')
    expect(parseFocusedDate('2026-02-30', '2026-08-12')).toBe('2026-08-12')
    expect(parseFocusedDate('2026-09-01', '2026-08-12')).toBe('2026-09-01')
  })
})

describe('calendarUrlPatch', () => {
  it('always names the view, so an absent key can only mean "never touched"', () => {
    expect(calendarUrlPatch('list', '2026-08-12')).toEqual({ view: 'list', date: null })
    expect(calendarUrlPatch('week', '2026-08-12')).toEqual({
      view: 'week',
      date: '2026-08-12',
    })
  })

  it('pins the date even when it is today, so a link means that week', () => {
    expect(calendarUrlPatch('day', '2026-08-12').date).toBe('2026-08-12')
    expect(calendarUrlPatch('month', '2026-09-01').date).toBe('2026-09-01')
  })

  it('drops the date in the list view, which has no focused day', () => {
    expect(calendarUrlPatch('list', '2026-08-19')).toEqual({ view: 'list', date: null })
  })
})

describe('week boundaries start on Monday', () => {
  it('indexes Monday as 0 and Sunday as 6', () => {
    expect(mondayIndex('2026-08-10')).toBe(0) // Monday
    expect(mondayIndex('2026-08-12')).toBe(2) // Wednesday
    expect(mondayIndex('2026-08-16')).toBe(6) // Sunday
  })

  it('puts Sunday at the END of its week, not the start of the next one', () => {
    expect(startOfWeekIso('2026-08-16')).toBe('2026-08-10')
    expect(startOfWeekIso('2026-08-10')).toBe('2026-08-10')
  })
})

describe('visibleRange', () => {
  it('shows one day in day view', () => {
    expect(visibleRange('day', '2026-08-12')).toEqual({
      days: ['2026-08-12'],
      start: '2026-08-12',
      end: '2026-08-12',
    })
  })

  it('shows Monday through Sunday in week view', () => {
    const range = visibleRange('week', '2026-08-12')
    expect(range.days).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
    ])
    expect(range.start).toBe('2026-08-10')
    expect(range.end).toBe('2026-08-16')
  })

  it('carries a week across a month boundary', () => {
    // 2026-08-31 is a Monday, so its week runs into September.
    expect(visibleRange('week', '2026-08-31')).toMatchObject({
      start: '2026-08-31',
      end: '2026-09-06',
    })
    // …and the Tuesday after it belongs to that same week, back in August.
    expect(visibleRange('week', '2026-09-01').start).toBe('2026-08-31')
  })

  it('carries a week across a year boundary', () => {
    // 2026-12-31 is a Thursday; its Monday is the 28th and its Sunday is in 2027.
    expect(visibleRange('week', '2026-12-31')).toMatchObject({
      start: '2026-12-28',
      end: '2027-01-03',
    })
  })

  it('pads the month out to whole Monday-started weeks', () => {
    const range = visibleRange('month', '2026-08-12')
    // August 2026 starts on a Saturday and ends on a Monday, so the grid runs
    // from 27 July to 6 September — six full weeks.
    expect(range.start).toBe('2026-07-27')
    expect(range.end).toBe('2026-09-06')
    expect(range.days).toHaveLength(42)
    expect(range.days.length % 7).toBe(0)
    expect(mondayIndex(range.start)).toBe(0)
    expect(mondayIndex(range.end)).toBe(6)
  })

  it('includes the leading and trailing days the month grid actually draws', () => {
    // A meeting on 31 July is visible in August's grid; a range stopping at
    // the 1st would leave that cell empty for no reason a viewer could see.
    const range = visibleRange('month', '2026-08-12')
    expect(range.days).toContain('2026-07-31')
    expect(range.days).toContain('2026-09-01')
  })

  it('pads a month across a year boundary', () => {
    const range = visibleRange('month', '2026-12-15')
    expect(range.start).toBe('2026-11-30')
    expect(range.end).toBe('2027-01-03')
    expect(range.days).toHaveLength(35)
  })

  it('gives agenda the calendar month itself, unpadded', () => {
    const range = visibleRange('agenda', '2026-08-12')
    expect(range.start).toBe('2026-08-01')
    expect(range.end).toBe('2026-08-31')
    expect(range.days).toHaveLength(31)
  })

  it('handles a short month in agenda view', () => {
    expect(visibleRange('agenda', '2026-02-10').days).toHaveLength(28)
    expect(visibleRange('agenda', '2028-02-10').days).toHaveLength(29)
  })

  it('returns the focused day for the list view rather than a special case', () => {
    expect(visibleRange('list', '2026-08-12').days).toEqual(['2026-08-12'])
  })

  it('returns days in strictly ascending order with no gaps', () => {
    const { days } = visibleRange('month', '2026-08-12')
    for (let i = 1; i < days.length; i += 1) {
      expect(days[i] > days[i - 1]).toBe(true)
    }
  })
})

describe('month helpers', () => {
  it('finds the first and last day of a month', () => {
    expect(startOfMonthIso('2026-08-12')).toBe('2026-08-01')
    expect(endOfMonthIso('2026-08-12')).toBe('2026-08-31')
    expect(endOfMonthIso('2026-02-01')).toBe('2026-02-28')
    expect(endOfMonthIso('2028-02-01')).toBe('2028-02-29')
    expect(endOfMonthIso('2026-12-01')).toBe('2026-12-31')
  })

  it('clamps the day when a month is too short to hold it', () => {
    expect(addCalendarMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addCalendarMonths('2026-03-31', -1)).toBe('2026-02-28')
    expect(addCalendarMonths('2028-01-31', 1)).toBe('2028-02-29')
  })

  it('rolls the year over in both directions', () => {
    expect(addCalendarMonths('2026-12-15', 1)).toBe('2027-01-15')
    expect(addCalendarMonths('2026-01-15', -1)).toBe('2025-12-15')
  })
})

describe('stepFocusedDate', () => {
  it('moves by the current view’s own unit', () => {
    expect(stepFocusedDate('day', '2026-08-12', 1)).toBe('2026-08-13')
    expect(stepFocusedDate('day', '2026-08-12', -1)).toBe('2026-08-11')
    expect(stepFocusedDate('week', '2026-08-12', 1)).toBe('2026-08-19')
    expect(stepFocusedDate('week', '2026-08-12', -1)).toBe('2026-08-05')
    expect(stepFocusedDate('month', '2026-08-12', 1)).toBe('2026-09-12')
    expect(stepFocusedDate('agenda', '2026-08-12', -1)).toBe('2026-07-12')
  })

  it('steps a week over a month boundary without landing mid-week', () => {
    expect(visibleRange('week', stepFocusedDate('week', '2026-08-31', 1)).start).toBe('2026-09-07')
  })

  it('steps a month over a year boundary', () => {
    expect(stepFocusedDate('month', '2026-12-15', 1)).toBe('2027-01-15')
  })
})

describe('isoDayInstant', () => {
  /* The visible-range maths above never touches a timezone; this is where the
     ISO grid meets real instants, and the only place a +05:30 offset can put a
     day marker on the wrong square. Asia/Colombo has been a fixed +05:30 with
     no DST since 2006, so these are stable regardless of the runner's TZ. */

  it('resolves back to the same Colombo day', () => {
    for (const iso of ['2026-01-01', '2026-08-12', '2026-12-31']) {
      expect(toIsoDateInTimeZone(isoDayInstant(iso))).toBe(iso)
    }
  })

  it('sits mid-day, far from either boundary', () => {
    const noon = isoDayInstant('2026-08-12').getTime()
    // 2026-08-12 00:00 Colombo is 2026-08-11T18:30Z, so midday is +12h.
    expect(noon).toBe(Date.UTC(2026, 7, 12, 6, 30))
  })

  it('feeds the existing Sunday and holiday helpers the right day', () => {
    // 2026-08-09 is a Sunday; 2026-08-27 is Nikini Full Moon Poya Day.
    expect(isLkSunday(isoDayInstant('2026-08-09'))).toBe(true)
    expect(isLkSunday(isoDayInstant('2026-08-10'))).toBe(false)
    expect(getLkHoliday(isoDayInstant('2026-08-27'))?.name).toBe('Nikini Full Moon Poya Day')
    expect(getLkHoliday(isoDayInstant('2026-08-12'))).toBeUndefined()
  })
})

describe('isoToDisplayDate', () => {
  it('round-trips the calendar fields through local getters', () => {
    const date = isoToDisplayDate('2026-08-12')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(7)
    expect(date.getDate()).toBe(12)
  })
})
