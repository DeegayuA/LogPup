import { describe, expect, it } from 'vitest'

import {
  addDaysIso,
  eachDayInclusive,
  mondayOf,
  parseProgressParams,
  progressHref,
  resolveProgressWindow,
} from './progress-params'

// 2026-08-20 is a Thursday; the Monday of its week is 2026-08-17.
const today = '2026-08-20'

describe('parseProgressParams', () => {
  it('defaults everything on an empty query string', () => {
    expect(parseProgressParams({})).toEqual({ range: 'fortnight', start: null, q: '', app: null })
  })

  it('degrades malformed values instead of throwing', () => {
    expect(
      parseProgressParams({ range: 'decade', start: '2026-02-31', q: '  ', app: '' }),
    ).toEqual({ range: 'fortnight', start: null, q: '', app: null })
  })

  it('takes the first value when a param repeats', () => {
    expect(parseProgressParams({ range: ['month', 'fortnight'] }).range).toBe('month')
  })

  it('keeps a well-formed start and trims the name filter', () => {
    const parsed = parseProgressParams({ start: '2026-07-06', q: ' nuwan ' })
    expect(parsed.start).toBe('2026-07-06')
    expect(parsed.q).toBe('nuwan')
  })
})

describe('resolveProgressWindow — fortnight', () => {
  it('defaults to last week plus this one, Monday start', () => {
    const window = resolveProgressWindow(parseProgressParams({}), today)
    expect(window.from).toBe('2026-08-10')
    expect(window.to).toBe('2026-08-23')
    expect(window.days).toHaveLength(14)
    expect(window.days[0]).toBe('2026-08-10')
    expect(window.days[13]).toBe('2026-08-23')
  })

  it('snaps any start back to its Monday', () => {
    const window = resolveProgressWindow(parseProgressParams({ start: '2026-08-20' }), today)
    expect(window.from).toBe('2026-08-17')
    expect(window.to).toBe('2026-08-30')
  })

  it('steps by whole fortnights and stops paging into pure future', () => {
    const window = resolveProgressWindow(parseProgressParams({}), today)
    expect(window.prevStart).toBe('2026-07-27')
    expect(window.nextStart).toBe('2026-08-24')
    // 2026-08-24 > today, so the next window would contain no loggable day.
    expect(window.hasNext).toBe(false)
  })
})

describe('resolveProgressWindow — month', () => {
  it('covers the whole calendar month of the anchor', () => {
    const window = resolveProgressWindow(
      parseProgressParams({ range: 'month', start: '2026-02-10' }),
      today,
    )
    expect(window.from).toBe('2026-02-01')
    expect(window.to).toBe('2026-02-28')
    expect(window.days).toHaveLength(28)
  })

  it('crosses year boundaries in both directions', () => {
    const window = resolveProgressWindow(
      parseProgressParams({ range: 'month', start: '2026-01-15' }),
      today,
    )
    expect(window.prevStart).toBe('2025-12-01')
    expect(window.nextStart).toBe('2026-02-01')
    expect(window.hasNext).toBe(true)
  })
})

describe('day arithmetic', () => {
  it('addDaysIso survives month and year boundaries', () => {
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('mondayOf is a fixed point on Mondays', () => {
    expect(mondayOf('2026-08-17')).toBe('2026-08-17')
    expect(mondayOf('2026-08-23')).toBe('2026-08-17')
  })

  it('eachDayInclusive includes both ends', () => {
    expect(eachDayInclusive('2026-08-30', '2026-09-01')).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
    ])
  })
})

describe('progressHref', () => {
  const defaults = parseProgressParams({})

  it('omits every default so bare /progress stays canonical', () => {
    expect(progressHref(defaults, {})).toBe('/progress')
  })

  it('round-trips through parse', () => {
    const href = progressHref(defaults, { range: 'month', start: '2026-07-01', q: 'perera' })
    const query = Object.fromEntries(new URL(`https://x${href}`).searchParams)
    expect(parseProgressParams(query)).toEqual({
      range: 'month',
      start: '2026-07-01',
      q: 'perera',
      app: null,
    })
  })

  it('clearing a filter drops its param', () => {
    const withApp = parseProgressParams({ app: 'abc' })
    expect(progressHref(withApp, { app: null })).toBe('/progress')
  })
})
