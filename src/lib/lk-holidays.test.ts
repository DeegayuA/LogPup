import { describe, it, expect } from 'vitest'
import {
  excusesWork,
  getHolidayIconKind,
  getLkHoliday,
  getLkHolidayName,
  isLkSunday,
  isMercantileHoliday,
  toIsoDateInTimeZone,
} from './lk-holidays'

describe('getLkHolidayName', () => {
  it('returns the holiday name for a known holiday', () => {
    // Noon in Colombo (UTC+5:30) — well inside 2026-02-04 in both UTC and Colombo.
    expect(getLkHolidayName(new Date('2026-02-04T06:00:00Z'))).toBe('Independence Day')
  })

  it('returns undefined for a non-holiday', () => {
    expect(getLkHolidayName(new Date('2026-02-05T06:00:00Z'))).toBeUndefined()
  })

  it('resolves the timezone edge: a UTC date that is already the next day in Colombo', () => {
    // 2026-02-03T20:00:00Z is 2026-02-04 01:30 in Asia/Colombo (UTC+5:30) —
    // already Independence Day locally, even though the UTC calendar date
    // is still 2026-02-03.
    const utcEdge = new Date('2026-02-03T20:00:00Z')
    expect(getLkHolidayName(utcEdge)).toBe('Independence Day')
    // The same instant, read as a UTC calendar date, is not a holiday —
    // proves the result is timezone-dependent and not a coincidence.
    expect(getLkHolidayName(utcEdge, 'UTC')).toBeUndefined()
  })

  it('is keyed by ISO date, not calendar coincidence', () => {
    expect(getLkHolidayName(new Date('2026-12-25T06:00:00Z'))).toBe('Christmas Day')
    expect(getLkHolidayName(new Date('2026-12-24T06:00:00Z'))).toBeUndefined()
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

  it('resolves the timezone edge like getLkHolidayName', () => {
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
    expect(getLkHolidayName(date)).toBe('Navam Full Moon Poya Day')
  })
})

describe('getLkHoliday', () => {
  it('returns categories including public, bank, mercantile, and poya for a Full Moon Poya Day', () => {
    // 2026-02-04 is Independence Day — a public holiday but not a poya day.
    expect(getLkHoliday(new Date('2026-02-04T06:00:00Z'))).toEqual({
      name: 'Independence Day',
      categories: ['public', 'bank', 'mercantile'],
    })
    // 2026-01-03, Duruthu Full Moon Poya Day, is a public holiday AND poya.
    const poya = getLkHoliday(new Date('2026-01-03T06:00:00Z'))
    expect(poya?.categories).toContain('poya')
    expect(poya?.categories).toEqual(expect.arrayContaining(['public', 'bank', 'mercantile', 'poya']))
  })

  it('marks a bank-only closing day as bank but not public', () => {
    // 2026-06-30, Bank Half-Year Closing, is well-established practice but
    // never appears in the public-holiday gazette list.
    const bankOnly = getLkHoliday(new Date('2026-06-30T06:00:00Z'))
    expect(bankOnly?.categories).toContain('bank')
    expect(bankOnly?.categories).not.toContain('public')
    expect(bankOnly?.categories).not.toContain('mercantile')
  })

  it('marks New Year\'s Day as both bank and mercantile but not public', () => {
    const newYears = getLkHoliday(new Date('2026-01-01T06:00:00Z'))
    expect(newYears?.categories).toEqual(expect.arrayContaining(['bank', 'mercantile']))
    expect(newYears?.categories).not.toContain('public')
  })

  it('returns undefined for a non-holiday', () => {
    expect(getLkHoliday(new Date('2026-02-05T06:00:00Z'))).toBeUndefined()
  })

  it('resolves the Asia/Colombo timezone edge like getLkHolidayName', () => {
    // Same UTC edge as the getLkHolidayName test above: already Independence Day
    // (2026-02-04) in Colombo, still 2026-02-03 in UTC.
    const utcEdge = new Date('2026-02-03T20:00:00Z')
    expect(getLkHoliday(utcEdge)?.name).toBe('Independence Day')
    expect(getLkHoliday(utcEdge, 'UTC')).toBeUndefined()
  })
})

describe('getLkHolidayName vs getLkHoliday', () => {
  it('returns a plain name string, not the categorized record', () => {
    const result = getLkHolidayName(new Date('2026-01-03T06:00:00Z'))
    expect(result).toBe('Duruthu Full Moon Poya Day')
    expect(typeof result).toBe('string')
  })
})

describe('getHolidayIconKind', () => {
  it('resolves poya over public when both are present', () => {
    expect(getHolidayIconKind(['public', 'bank', 'mercantile', 'poya'])).toBe('poya')
  })

  it('resolves public over bank/mercantile when both are present', () => {
    expect(getHolidayIconKind(['public', 'bank', 'mercantile'])).toBe('public')
  })

  it('resolves mercantile over bank when both are present', () => {
    // A day that closes shops and offices matters more to planning than one
    // that only closes banks, so it must not be labelled 'Bank holiday'.
    expect(getHolidayIconKind(['bank', 'mercantile'])).toBe('mercantile')
  })

  it('resolves mercantile for a mercantile day that is not a public holiday', () => {
    expect(getHolidayIconKind(['mercantile'])).toBe('mercantile')
  })

  it('resolves bank for a bank-only, non-public holiday', () => {
    expect(getHolidayIconKind(['bank'])).toBe('bank')
  })

  it('keeps poya on top of the full public + bank + mercantile stack', () => {
    expect(getHolidayIconKind(['mercantile', 'bank', 'poya'])).toBe('poya')
    expect(getHolidayIconKind(['bank', 'poya'])).toBe('poya')
  })

  it('returns undefined for no categories', () => {
    expect(getHolidayIconKind([])).toBeUndefined()
    expect(getHolidayIconKind(undefined)).toBeUndefined()
  })
})

describe('toIsoDateInTimeZone', () => {
  it('formats using the wall-clock day in the given timezone', () => {
    expect(toIsoDateInTimeZone(new Date('2026-02-03T20:00:00Z'), 'Asia/Colombo')).toBe('2026-02-04')
    expect(toIsoDateInTimeZone(new Date('2026-02-03T20:00:00Z'), 'UTC')).toBe('2026-02-03')
  })
})

describe('excusesWork', () => {
  it('is true only when the mercantile list covers the day', () => {
    // Mercantile (Shop and Office Employees Act) is the list that shuts shops
    // and offices. Public and Poya say how a day was announced, not who is off.
    expect(excusesWork(['public', 'bank', 'mercantile', 'poya'])).toBe(true)
    expect(excusesWork(['bank', 'mercantile'])).toBe(true)
    expect(excusesWork(['mercantile'])).toBe(true)
  })

  it('is false for a gazetted day the mercantile list leaves out', () => {
    // A bank closing day, and the poya days the mercantile gazette omits —
    // both are gazetted, both are worked here.
    expect(excusesWork(['bank'])).toBe(false)
    expect(excusesWork(['public', 'bank', 'poya'])).toBe(false)
  })

  it('is false for no categories at all', () => {
    expect(excusesWork([])).toBe(false)
    expect(excusesWork(undefined)).toBe(false)
  })
})

describe('isMercantileHoliday', () => {
  it('does NOT excuse work on the bank-only closing days', () => {
    // The whole point: these two are gazetted and are ordinary working days.
    expect(isMercantileHoliday('2026-06-30')).toBe(false) // Bank Half-Year Closing
    expect(isMercantileHoliday('2026-12-31')).toBe(false) // Bank Annual Closing
  })

  it('still lists those days as gazetted, for the calendar', () => {
    // The legal effect changed; the calendar fact did not. A day the office
    // works through is still a day worth showing on a calendar.
    expect(getLkHoliday(new Date('2026-06-30T06:00:00Z'))?.name).toBe('Bank Half-Year Closing')
    expect(getLkHolidayName(new Date('2026-12-31T06:00:00Z'))).toBe('Bank Annual Closing')
  })

  it('excuses work on a mercantile holiday', () => {
    expect(isMercantileHoliday('2026-05-01')).toBe(true) // Vesak — all four lists
    expect(isMercantileHoliday('2026-02-04')).toBe(true) // Independence Day
    // Not in the public gazette, but a day the shops close all the same.
    expect(isMercantileHoliday('2026-01-01')).toBe(true) // New Year's Day
  })

  it('reads the categories, not the key — so correcting a poya day is a data edit', () => {
    // Today every 2026 poya derives 'mercantile' from 'public' (see the warning
    // in lk-holidays.ts), so a poya day is currently exempt AND gazetted.
    expect(isMercantileHoliday('2026-06-29')).toBe(true) // Poson Poya
    expect(getLkHoliday(new Date('2026-06-29T06:00:00Z'))?.categories).toContain('poya')
  })

  it('is false for an ordinary day', () => {
    expect(isMercantileHoliday('2026-02-05')).toBe(false)
    expect(isMercantileHoliday('not-a-date')).toBe(false)
  })
})
