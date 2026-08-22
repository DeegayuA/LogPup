import { describe, expect, it } from 'vitest'
import {
  MAX_EXPANDED_OCCURRENCES,
  expand,
  occurrenceInstant,
  rruleFor,
  type RecurrenceRule,
} from './recurrence'

/** A weekly Monday standup at 10:00 for an hour, Colombo. */
const weekly = (over: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  freq: 'weekly',
  interval: 1,
  byWeekday: [1],
  monthlyMode: null,
  timeZone: 'Asia/Colombo',
  startMinutes: 10 * 60,
  durationMinutes: 60,
  anchorDate: '2026-08-03', // a Monday
  untilDate: null,
  ...over,
})

describe('daily', () => {
  const daily = (over: Partial<RecurrenceRule> = {}) =>
    weekly({ freq: 'daily', byWeekday: [], anchorDate: '2026-08-03', ...over })

  it('yields every day from the anchor', () => {
    expect(expand(daily(), '2026-08-03', '2026-08-06')).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
    ])
  })

  it('respects an interval greater than one, anchored on the anchor', () => {
    // Anchored, NOT "every other day inside the window": asking for a window
    // that starts on an off day must not shift the whole series onto it.
    expect(expand(daily({ interval: 2 }), '2026-08-04', '2026-08-09')).toEqual([
      '2026-08-05',
      '2026-08-07',
      '2026-08-09',
    ])
  })

  it('never yields a date before the anchor', () => {
    expect(expand(daily(), '2026-07-01', '2026-08-04')).toEqual(['2026-08-03', '2026-08-04'])
  })

  it('stops at untilDate, inclusive', () => {
    expect(expand(daily({ untilDate: '2026-08-05' }), '2026-08-03', '2026-08-30')).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
    ])
  })

  it('returns nothing when the window closes before it opens', () => {
    expect(expand(daily(), '2026-08-10', '2026-08-01')).toEqual([])
  })
})

describe('weekly', () => {
  it('yields the anchor weekday every week', () => {
    expect(expand(weekly(), '2026-08-01', '2026-08-31')).toEqual([
      '2026-08-03',
      '2026-08-10',
      '2026-08-17',
      '2026-08-24',
      '2026-08-31',
    ])
  })

  it('yields several weekdays in one week', () => {
    // Mon + Wed, the shape almost every studio standup actually has.
    expect(expand(weekly({ byWeekday: [1, 3] }), '2026-08-03', '2026-08-13')).toEqual([
      '2026-08-03',
      '2026-08-05',
      '2026-08-10',
      '2026-08-12',
    ])
  })

  it('skips the off weeks when the interval is two', () => {
    expect(expand(weekly({ interval: 2 }), '2026-08-03', '2026-09-01')).toEqual([
      '2026-08-03',
      '2026-08-17',
      '2026-08-31',
    ])
  })

  it('counts fortnights from the anchor week even when the window starts mid-series', () => {
    // The bug this guards: measuring the interval from the WINDOW start makes
    // the same series expand differently depending on what you asked for.
    expect(expand(weekly({ interval: 2 }), '2026-08-10', '2026-09-01')).toEqual([
      '2026-08-17',
      '2026-08-31',
    ])
  })

  it('falls back to the anchor weekday when byWeekday is empty', () => {
    expect(expand(weekly({ byWeekday: [] }), '2026-08-03', '2026-08-17')).toEqual([
      '2026-08-03',
      '2026-08-10',
      '2026-08-17',
    ])
  })

  it('yields a Sunday, which is weekday 0 and must not be read as absent', () => {
    // `byWeekday: [0]` is falsy-adjacent in exactly the way that turns a
    // Sunday series into "no weekday given, use the anchor".
    expect(expand(weekly({ byWeekday: [0], anchorDate: '2026-08-02' }), '2026-08-01', '2026-08-16'))
      .toEqual(['2026-08-02', '2026-08-09', '2026-08-16'])
  })
})

describe('monthly by day of month', () => {
  const monthly = (over: Partial<RecurrenceRule> = {}) =>
    weekly({
      freq: 'monthly',
      byWeekday: [],
      monthlyMode: 'day-of-month',
      anchorDate: '2026-01-15',
      ...over,
    })

  it('yields the same date each month', () => {
    expect(expand(monthly(), '2026-01-01', '2026-04-30')).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
      '2026-04-15',
    ])
  })

  it('SKIPS months that have no such day rather than clamping to the last one', () => {
    // A "the 31st" series has no February. Clamping to the 28th would invent
    // a meeting on a date the rule never described, and the person who set it
    // would find a standup they did not schedule.
    expect(expand(monthly({ anchorDate: '2026-01-31' }), '2026-01-01', '2026-05-31')).toEqual([
      '2026-01-31',
      '2026-03-31',
      '2026-05-31',
    ])
  })

  it('yields 29 February in a leap year and skips it otherwise', () => {
    const rule = monthly({ anchorDate: '2024-02-29', interval: 12 })
    expect(expand(rule, '2024-01-01', '2029-12-31')).toEqual(['2024-02-29', '2028-02-29'])
  })

  it('respects a quarterly interval', () => {
    expect(expand(monthly({ interval: 3 }), '2026-01-01', '2026-12-31')).toEqual([
      '2026-01-15',
      '2026-04-15',
      '2026-07-15',
      '2026-10-15',
    ])
  })
})

describe('monthly by nth weekday', () => {
  const nth = (over: Partial<RecurrenceRule> = {}) =>
    weekly({
      freq: 'monthly',
      byWeekday: [],
      monthlyMode: 'nth-weekday',
      anchorDate: '2026-08-11', // the SECOND Tuesday of August 2026
      ...over,
    })

  it('yields the same ordinal weekday each month', () => {
    expect(expand(nth(), '2026-08-01', '2026-11-30')).toEqual([
      '2026-08-11',
      '2026-09-08',
      '2026-10-13',
      '2026-11-10',
    ])
  })

  it('treats a fifth-weekday anchor as THE LAST of the month', () => {
    // 2026-08-31 is the fifth Monday of August. Most months have no fifth
    // Monday, so reading the anchor literally would produce a series that
    // fires four times a year. "Last Monday" is what a person choosing the
    // last Monday of the month means.
    const rule = nth({ anchorDate: '2026-08-31' })
    expect(expand(rule, '2026-08-01', '2026-11-30')).toEqual([
      '2026-08-31',
      '2026-09-28',
      '2026-10-26',
      '2026-11-30',
    ])
  })
})

describe('guards', () => {
  it('treats an interval below one as one rather than looping forever', () => {
    expect(expand(weekly({ interval: 0 }), '2026-08-03', '2026-08-17')).toEqual([
      '2026-08-03',
      '2026-08-10',
      '2026-08-17',
    ])
  })

  it('caps a pathological window instead of returning a million dates', () => {
    const out = expand(weekly({ freq: 'daily', byWeekday: [] }), '2026-01-01', '2126-01-01')
    expect(out.length).toBe(MAX_EXPANDED_OCCURRENCES)
  })

  it('yields nothing when untilDate precedes the anchor', () => {
    expect(expand(weekly({ untilDate: '2026-07-01' }), '2026-01-01', '2026-12-31')).toEqual([])
  })
})

describe('occurrenceInstant', () => {
  it('places the meeting at the local wall clock, not at a UTC offset', () => {
    const { startsAt, endsAt } = occurrenceInstant(weekly(), '2026-08-03')
    // 10:00 in Asia/Colombo (+05:30) is 04:30 UTC.
    expect(startsAt.toISOString()).toBe('2026-08-03T04:30:00.000Z')
    expect(endsAt.toISOString()).toBe('2026-08-03T05:30:00.000Z')
  })

  it('keeps the SAME wall clock across a DST boundary in a zone that has one', () => {
    // The whole reason the rule stores minutes-past-local-midnight instead of
    // an instant. London goes +00:00 -> +01:00 on 2026-03-29; a 09:00 standup
    // must stay 09:00 on both sides, which means the UTC instant MOVES.
    const london = weekly({ timeZone: 'Europe/London', startMinutes: 9 * 60 })
    expect(occurrenceInstant(london, '2026-03-27').startsAt.toISOString()).toBe(
      '2026-03-27T09:00:00.000Z',
    )
    expect(occurrenceInstant(london, '2026-03-31').startsAt.toISOString()).toBe(
      '2026-03-31T08:00:00.000Z',
    )
  })

  it('carries a duration past midnight into the next day', () => {
    const late = weekly({ startMinutes: 23 * 60, durationMinutes: 120 })
    // 23:00 Colombo is 17:30Z; two hours later is 19:30Z, still the 3rd in
    // UTC even though it is the 4th where the meeting is.
    expect(occurrenceInstant(late, '2026-08-03').endsAt.toISOString()).toBe(
      '2026-08-03T19:30:00.000Z',
    )
  })
})

describe('rruleFor', () => {
  it('writes a weekly rule with its weekdays', () => {
    expect(rruleFor(weekly({ byWeekday: [1, 3] }))).toBe('FREQ=WEEKLY;BYDAY=MO,WE')
  })

  it('writes the interval only when it is not one', () => {
    expect(rruleFor(weekly({ interval: 2 }))).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO')
  })

  it('writes UNTIL as a UTC instant, because RFC 5545 requires one', () => {
    // A bare date would be read in the recipient's zone and could drop or add
    // a final occurrence.
    expect(rruleFor(weekly({ untilDate: '2026-09-28' }))).toBe(
      'FREQ=WEEKLY;BYDAY=MO;UNTIL=20260928T235959Z',
    )
  })

  it('writes a monthly day-of-month rule', () => {
    expect(
      rruleFor(weekly({ freq: 'monthly', monthlyMode: 'day-of-month', anchorDate: '2026-01-15' })),
    ).toBe('FREQ=MONTHLY;BYMONTHDAY=15')
  })

  it('writes a monthly nth-weekday rule, with -1 for a last-of-month anchor', () => {
    const second = weekly({ freq: 'monthly', monthlyMode: 'nth-weekday', anchorDate: '2026-08-11' })
    expect(rruleFor(second)).toBe('FREQ=MONTHLY;BYDAY=2TU')
    const last = weekly({ freq: 'monthly', monthlyMode: 'nth-weekday', anchorDate: '2026-08-31' })
    expect(rruleFor(last)).toBe('FREQ=MONTHLY;BYDAY=-1MO')
  })

  it('writes a daily rule', () => {
    expect(rruleFor(weekly({ freq: 'daily', byWeekday: [] }))).toBe('FREQ=DAILY')
  })
})
