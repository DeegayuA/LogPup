import { describe, expect, it } from 'vitest'
import { Briefcase, Clock, FileText, Plane } from 'lucide-react'
import {
  absenceGroupIcon,
  dayCellAccessibleName,
  initialFocusedDay,
  stepFocusIndex,
} from './absence-month-grid'

// This repo has zero `.test.tsx` (vitest.config.ts only globs `*.test.ts`),
// so the pure helpers the grid's roving tabindex and rendering depend on are
// exported from the `.tsx` component itself and tested from here, a plain
// `.ts` file — import resolution doesn't care about the importer's own
// extension, only test DISCOVERY does.

describe('absenceGroupIcon', () => {
  it('maps each absence group to its own glyph — kind is a shape, never a hue', () => {
    expect(absenceGroupIcon('annual')).toBe(Plane) // Time off
    expect(absenceGroupIcon('half_day')).toBe(Clock) // Part of a day
    expect(absenceGroupIcon('training')).toBe(Briefcase) // Working, elsewhere
    expect(absenceGroupIcon('no_work_assigned')).toBe(FileText) // Filed for you
  })

  it('falls back to the plainest glyph for a kind the list does not know, rather than throwing', () => {
    expect(absenceGroupIcon('made_up_kind')).toBe(FileText)
  })
})

describe('stepFocusIndex', () => {
  const total = 35

  it('moves by one column, clipped at the grid edges', () => {
    expect(stepFocusIndex(3, 'ArrowRight', total)).toBe(4)
    expect(stepFocusIndex(0, 'ArrowLeft', total)).toBe(0)
    expect(stepFocusIndex(total - 1, 'ArrowRight', total)).toBe(total - 1)
  })

  it('moves by one week (±7), clipped at the grid edges — never wraps into another month', () => {
    expect(stepFocusIndex(3, 'ArrowDown', total)).toBe(10)
    expect(stepFocusIndex(3, 'ArrowUp', total)).toBe(3)
    expect(stepFocusIndex(32, 'ArrowDown', total)).toBe(32)
  })

  it('Home/End jump to the start/end of the CURRENT week row, not the grid', () => {
    expect(stepFocusIndex(10, 'Home', total)).toBe(7)
    expect(stepFocusIndex(10, 'End', total)).toBe(13)
    // The last row of a 35-day grid may fall short of a full week's worth of
    // indices remaining — End still clips to the grid's own last index.
    expect(stepFocusIndex(31, 'End', total)).toBe(34)
  })

  it('returns null for a key it does not move on — the caller handles Enter/Space/PageUp/PageDown itself', () => {
    expect(stepFocusIndex(10, 'Enter', total)).toBeNull()
    expect(stepFocusIndex(10, 'PageUp', total)).toBeNull()
    expect(stepFocusIndex(10, 'Tab', total)).toBeNull()
  })
})

describe('initialFocusedDay', () => {
  const days = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 7, 31 + i)) // 2026-08-31 .. 2026-10-04
    return d.toISOString().slice(0, 10)
  })

  it('prefers the selected day when it is on the grid', () => {
    expect(initialFocusedDay(days, '2026-09-18', '2026-09-01')).toBe('2026-09-18')
  })

  it('falls back to today when nothing is selected', () => {
    expect(initialFocusedDay(days, null, '2026-09-05')).toBe('2026-09-05')
  })

  it('falls back to the grid\'s first day when today is off-grid and nothing is selected', () => {
    expect(initialFocusedDay(days, null, '2027-01-01')).toBe(days[0])
  })

  it('ignores a selected day that is not actually on the grid', () => {
    expect(initialFocusedDay(days, '2026-11-30', '2026-09-05')).toBe('2026-09-05')
  })
})

describe('dayCellAccessibleName', () => {
  it('states nobody away, in words, when the day has no rows', () => {
    const name = dayCellAccessibleName({
      iso: '2026-09-18',
      isToday: false,
      rows: [],
      holidayCategoryLabel: null,
      holidayName: null,
    })
    expect(name).not.toContain('away')
    expect(name).not.toContain('today')
  })

  it('names every row — status and kind are words, never colour alone', () => {
    const name = dayCellAccessibleName({
      iso: '2026-09-18',
      isToday: true,
      rows: [
        { userName: 'Nimal Perera', kind: 'annual', status: 'approved' },
        { userName: 'Kasun', kind: 'half_day', status: 'pending' },
      ],
      holidayCategoryLabel: 'Mercantile holiday',
      holidayName: 'Binara Full Moon Poya Day',
    })
    expect(name).toContain('today')
    expect(name).toContain('2 away')
    expect(name).toContain('Nimal')
    expect(name).toContain('approved')
    expect(name).toContain('Kasun')
    expect(name).toContain('pending')
    expect(name).toContain('Mercantile holiday: Binara Full Moon Poya Day')
  })

  it('says "Non-working day" for a quiet day with no holiday name (a plain Sunday)', () => {
    const name = dayCellAccessibleName({
      iso: '2026-09-20',
      isToday: false,
      rows: [],
      holidayCategoryLabel: null,
      holidayName: null,
      isQuietDay: true,
    })
    expect(name).toContain('Non-working day')
  })

  it('says nothing extra for an ordinary working day with no filings', () => {
    const name = dayCellAccessibleName({
      iso: '2026-09-21',
      isToday: false,
      rows: [],
      holidayCategoryLabel: null,
      holidayName: null,
      isQuietDay: false,
    })
    expect(name).not.toContain('Non-working day')
    expect(name).not.toContain('Holiday')
  })
})
