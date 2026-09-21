import { describe, expect, it } from 'vitest'
import {
  absenceMonthGrid,
  dayAbsences,
  GRID_STATUSES,
  groupAbsencesByDay,
  makeIsHoliday,
  parseAbsenceDay,
  parseAbsenceKind,
  parseAbsenceMonth,
  shiftAbsenceMonth,
  type AbsenceSpan,
} from './absence-calendar'

const span = (overrides: Partial<AbsenceSpan> = {}): AbsenceSpan => ({
  id: 'a1',
  userId: 'u1',
  userName: 'Nimal',
  kind: 'annual',
  status: 'approved',
  startDate: '2026-09-01',
  endDate: '2026-09-01',
  ...overrides,
})

describe('parseAbsenceMonth', () => {
  it('accepts a well-formed yyyy-mm', () => {
    expect(parseAbsenceMonth('2026-09', '2026-01-01')).toBe('2026-09')
  })

  it('falls back to today’s month on a month number that does not exist', () => {
    expect(parseAbsenceMonth('2026-13', '2026-01-15')).toBe('2026-01')
    expect(parseAbsenceMonth('2026-00', '2026-01-15')).toBe('2026-01')
  })

  it('falls back to today’s month on hand-mangled input', () => {
    expect(parseAbsenceMonth('not-a-month', '2026-01-15')).toBe('2026-01')
    expect(parseAbsenceMonth(null, '2026-01-15')).toBe('2026-01')
    expect(parseAbsenceMonth(undefined, '2026-01-15')).toBe('2026-01')
  })
})

describe('shiftAbsenceMonth', () => {
  it('adds and subtracts whole months, rolling the year over', () => {
    expect(shiftAbsenceMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftAbsenceMonth('2026-12', 1)).toBe('2027-01')
  })
})

describe('absenceMonthGrid + groupAbsencesByDay', () => {
  const grid = absenceMonthGrid('2026-09')

  it('covers whole Monday-started weeks (28/35/42 days)', () => {
    expect(grid.days.length % 7).toBe(0)
    expect(grid.from).toBe(grid.days[0])
    expect(grid.to).toBe(grid.days[grid.days.length - 1])
  })

  it('an absence ending on the LAST grid day appears there — the half-open clip', () => {
    const lastDay = grid.to
    const rows = [span({ startDate: lastDay, endDate: lastDay })]
    const byDay = groupAbsencesByDay(rows, grid.days)
    expect(byDay.get(lastDay)?.map((r) => r.id)).toEqual(['a1'])
  })

  it('a span covering the whole grid appears in every cell', () => {
    const rows = [span({ startDate: grid.from, endDate: grid.to })]
    const byDay = groupAbsencesByDay(rows, grid.days)
    for (const day of grid.days) {
      expect(byDay.get(day)?.map((r) => r.id)).toEqual(['a1'])
    }
  })

  it('excludes rejected and withdrawn rows; keeps pending and approved', () => {
    const rows = [
      span({ id: 'rejected', status: 'rejected' }),
      span({ id: 'withdrawn', status: 'withdrawn' }),
      span({ id: 'pending', status: 'pending' }),
      span({ id: 'approved', status: 'approved' }),
    ]
    const byDay = groupAbsencesByDay(rows, grid.days)
    expect(byDay.get('2026-09-01')?.map((r) => r.id).sort()).toEqual(['approved', 'pending'])
  })
})

describe('dayAbsences', () => {
  it('includes all four statuses, pending first, then by name', () => {
    const rows = [
      span({ id: 'approved-b', userName: 'Zara', status: 'approved', startDate: '2026-09-05', endDate: '2026-09-05' }),
      span({ id: 'rejected-a', userName: 'Amali', status: 'rejected', startDate: '2026-09-05', endDate: '2026-09-05' }),
      span({ id: 'pending-a', userName: 'Nadun', status: 'pending', startDate: '2026-09-05', endDate: '2026-09-05' }),
      span({ id: 'withdrawn-a', userName: 'Kavi', status: 'withdrawn', startDate: '2026-09-05', endDate: '2026-09-05' }),
      span({ id: 'other-day', startDate: '2026-09-06', endDate: '2026-09-06' }),
    ]
    const result = dayAbsences(rows, '2026-09-05')
    expect(result.map((r) => r.id)).toEqual(['pending-a', 'rejected-a', 'withdrawn-a', 'approved-b'])
  })

  it('breaks ties among non-pending rows by startDate before name', () => {
    const rows = [
      span({ id: 'later', status: 'approved', userName: 'Zed', startDate: '2026-09-05', endDate: '2026-09-06' }),
      span({ id: 'earlier', status: 'approved', userName: 'Amal', startDate: '2026-09-04', endDate: '2026-09-06' }),
    ]
    const result = dayAbsences(rows, '2026-09-05')
    expect(result.map((r) => r.id)).toEqual(['earlier', 'later'])
  })
})

describe('parseAbsenceDay', () => {
  const days = absenceMonthGrid('2026-09').days

  it('accepts a day on the current grid', () => {
    expect(parseAbsenceDay(days[0], days)).toBe(days[0])
  })

  it('rejects a day off the grid', () => {
    expect(parseAbsenceDay('2099-01-01', days)).toBeNull()
  })

  it('rejects hand-mangled or missing input', () => {
    expect(parseAbsenceDay('not-a-day', days)).toBeNull()
    expect(parseAbsenceDay(null, days)).toBeNull()
    expect(parseAbsenceDay(undefined, days)).toBeNull()
  })
})

describe('parseAbsenceKind', () => {
  it('accepts a real kind', () => {
    expect(parseAbsenceKind('annual')).toBe('annual')
    expect(parseAbsenceKind('half_day')).toBe('half_day')
  })

  it('rejects an unknown kind or missing input', () => {
    expect(parseAbsenceKind('vacation')).toBeNull()
    expect(parseAbsenceKind(null)).toBeNull()
    expect(parseAbsenceKind(undefined)).toBeNull()
  })
})

describe('GRID_STATUSES', () => {
  it('is pending and approved only', () => {
    expect(GRID_STATUSES).toEqual(['pending', 'approved'])
  })
})

describe('makeIsHoliday', () => {
  it('is true for a gazetted mercantile holiday (an org day off with no gazette entry)', () => {
    const isHoliday = makeIsHoliday([])
    // Tamil Thai Pongal Day 2026-01-15 is in PUBLIC, which derives 'mercantile'.
    expect(isHoliday('2026-01-15')).toBe(true)
  })

  it('is false for a bank-only closing day — bank-only excuses nothing here', () => {
    const isHoliday = makeIsHoliday([])
    // Bank Half-Year Closing: categories: ['bank'] only, no 'mercantile'.
    expect(isHoliday('2026-06-30')).toBe(false)
  })

  it('is true for an org holiday the gazette does not know about', () => {
    const isHoliday = makeIsHoliday(['2026-09-15'])
    expect(isHoliday('2026-09-15')).toBe(true)
    expect(isHoliday('2026-09-16')).toBe(false)
  })
})
