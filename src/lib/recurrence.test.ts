import { describe, expect, it } from 'vitest'

import {
  DEFAULT_MAX_OCCURRENCES,
  RecurrenceError,
  describeRecurrence,
  expandRecurrence,
  weekdayOf,
  type RecurrenceRule,
} from './recurrence'

// Wed 2026-08-19. Sat 2026-08-22 is a WORKING half day here; Sun 23 is not.
const WED = '2026-08-19'
const HORIZON = '2026-09-30'
const noHolidays = () => false

const rule = (over: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  frequency: 'weekly',
  interval: 1,
  ends: { kind: 'open' },
  ...over,
})

describe('daily', () => {
  it('includes the anchor and runs to the horizon', () => {
    expect(
      expandRecurrence(rule({ frequency: 'daily' }), { anchor: WED, horizon: '2026-08-23' }),
    ).toEqual(['2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23'])
  })

  it('honours an interval', () => {
    expect(
      expandRecurrence(rule({ frequency: 'daily', interval: 3 }), {
        anchor: WED,
        horizon: '2026-08-31',
      }),
    ).toEqual(['2026-08-19', '2026-08-22', '2026-08-25', '2026-08-28', '2026-08-31'])
  })

  it('crosses a month boundary without arithmetic drift', () => {
    expect(
      expandRecurrence(rule({ frequency: 'daily' }), {
        anchor: '2026-08-30',
        horizon: '2026-09-02',
      }),
    ).toEqual(['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02'])
  })
})

describe('weekly', () => {
  it('repeats on the anchor weekday when no days are named', () => {
    const days = expandRecurrence(rule(), { anchor: WED, horizon: '2026-09-10' })
    expect(days).toEqual(['2026-08-19', '2026-08-26', '2026-09-02', '2026-09-09'])
    for (const day of days) expect(weekdayOf(day)).toBe(3) // Wednesday
  })

  it('emits several named days per week, in weekday order', () => {
    // Mon/Wed/Fri from a Wednesday anchor.
    expect(
      expandRecurrence(rule({ weekdays: [5, 1, 3] }), { anchor: WED, horizon: '2026-08-31' }),
    ).toEqual([
      '2026-08-19', // Wed, the anchor
      '2026-08-21', // Fri
      '2026-08-24', // Mon
      '2026-08-26', // Wed
      '2026-08-28', // Fri
      '2026-08-31', // Mon
    ])
  })

  it('never emits a day earlier than the anchor from the anchor week', () => {
    // THE off-by-one this shape invites: a Wednesday start on a Mon/Wed rule
    // must not produce the Monday two days before the series began.
    const days = expandRecurrence(rule({ weekdays: [1, 3] }), {
      anchor: WED,
      horizon: '2026-08-26',
    })
    expect(days).toEqual(['2026-08-19', '2026-08-24', '2026-08-26'])
    expect(days).not.toContain('2026-08-17')
  })

  it('honours a fortnightly interval', () => {
    expect(expandRecurrence(rule({ interval: 2 }), { anchor: WED, horizon: '2026-09-30' })).toEqual([
      '2026-08-19',
      '2026-09-02',
      '2026-09-16',
      '2026-09-30',
    ])
  })
})

describe('how it ends', () => {
  it('until: inclusive of the named day', () => {
    const days = expandRecurrence(rule({ ends: { kind: 'until', date: '2026-09-02' } }), {
      anchor: WED,
      horizon: HORIZON,
    })
    expect(days.at(-1)).toBe('2026-09-02')
  })

  it('until: an end before the start is an empty series, not an error', () => {
    // Dragging the end date back past the start should show an empty preview.
    expect(
      expandRecurrence(rule({ ends: { kind: 'until', date: '2026-08-01' } }), {
        anchor: WED,
        horizon: HORIZON,
      }),
    ).toEqual([])
  })

  it('count: stops after exactly that many', () => {
    expect(
      expandRecurrence(rule({ ends: { kind: 'count', count: 3 } }), {
        anchor: WED,
        horizon: HORIZON,
      }),
    ).toHaveLength(3)
  })

  it('open: runs to the horizon, which is the only thing bounding it', () => {
    const days = expandRecurrence(rule({ ends: { kind: 'open' } }), {
      anchor: WED,
      horizon: '2026-09-09',
    })
    expect(days.at(-1)).toBe('2026-09-09')
  })

  it('open daily is capped rather than running away', () => {
    // The caller writes a row per day, so an unbounded expansion is a hang.
    expect(
      expandRecurrence(rule({ frequency: 'daily' }), { anchor: WED, horizon: '2030-01-01' }),
    ).toHaveLength(DEFAULT_MAX_OCCURRENCES)
  })

  it('a count larger than the cap is still capped', () => {
    expect(
      expandRecurrence(rule({ frequency: 'daily', ends: { kind: 'count', count: 5000 } }), {
        anchor: WED,
        horizon: '2030-01-01',
        max: 10,
      }),
    ).toHaveLength(10)
  })
})

describe('skipping days the studio is closed', () => {
  it('keeps the whole weekend by default, since skipping is opt-in', () => {
    const days = expandRecurrence(rule({ frequency: 'daily' }), {
      anchor: '2026-08-21', // Fri
      horizon: '2026-08-24', // Mon
    })
    expect(days).toContain('2026-08-22') // Sat
    expect(days).toContain('2026-08-23') // Sun
  })

  it('drops Sunday but KEEPS Saturday when skipping is on', () => {
    // The trap: a five-day-week intuition drops both. Saturday is a half day
    // here and therefore a working day.
    expect(
      expandRecurrence(rule({ frequency: 'daily', skipNonWorkingDays: true }), {
        anchor: '2026-08-21',
        horizon: '2026-08-24',
        isHoliday: noHolidays,
      }),
    ).toEqual(['2026-08-21', '2026-08-22', '2026-08-24'])
  })

  it('drops a holiday without shifting the rest of the series', () => {
    // The occurrence is skipped, not moved: a weekly meeting landing on a Poya
    // day does not become a Thursday meeting.
    expect(
      expandRecurrence(rule({ skipNonWorkingDays: true }), {
        anchor: WED,
        horizon: '2026-09-10',
        isHoliday: (iso) => iso === '2026-08-26',
      }),
    ).toEqual(['2026-08-19', '2026-09-02', '2026-09-09'])
  })
})

describe('refusals', () => {
  it('rejects an interval below one, which would never advance', () => {
    expect(() => expandRecurrence(rule({ interval: 0 }), { anchor: WED, horizon: HORIZON })).toThrow(
      RecurrenceError,
    )
  })

  it('rejects a series of zero occurrences', () => {
    expect(() =>
      expandRecurrence(rule({ ends: { kind: 'count', count: 0 } }), {
        anchor: WED,
        horizon: HORIZON,
      }),
    ).toThrow(RecurrenceError)
  })

  it('returns nothing when the horizon precedes the anchor', () => {
    expect(expandRecurrence(rule(), { anchor: WED, horizon: '2026-08-01' })).toEqual([])
  })
})

describe('describeRecurrence says what will happen', () => {
  it('names the weekday it inherits from the anchor', () => {
    expect(describeRecurrence(rule(), WED)).toBe('Every week on Wednesday, until you stop it.')
  })

  it('lists several days readably', () => {
    expect(describeRecurrence(rule({ weekdays: [1, 3, 5] }), WED)).toBe(
      'Every week on Monday, Wednesday and Friday, until you stop it.',
    )
  })

  it('counts intervals and occurrences', () => {
    expect(
      describeRecurrence(
        rule({ frequency: 'daily', interval: 3, ends: { kind: 'count', count: 1 } }),
        WED,
      ),
    ).toBe('Every 3 days, 1 time.')
  })

  it('names an end date and the skipping rule', () => {
    expect(
      describeRecurrence(
        rule({ ends: { kind: 'until', date: '2026-09-30' }, skipNonWorkingDays: true }),
        WED,
      ),
    ).toBe('Every week on Wednesday, until 2026-09-30, skipping days the studio is closed.')
  })
})
