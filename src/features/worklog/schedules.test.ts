import { describe, expect, it } from 'vitest'
import { STUDIO_DEFAULT_PATTERN, overlaps, patternForDay } from '@/features/worklog/schedules'

const row = (from: string, to: string | null, sat: number) => ({
  effectiveFrom: from,
  effectiveTo: to,
  pattern: { ...STUDIO_DEFAULT_PATTERN, sat },
})

describe('STUDIO_DEFAULT_PATTERN', () => {
  it('is Mon-Fri full, Saturday half, Sunday none', () => {
    // The default lives in working-days.ts and must not fork. A schedule row
    // exists ONLY for someone who deviates from it.
    expect(STUDIO_DEFAULT_PATTERN).toEqual({
      mon: 1, tue: 1, wed: 1, thu: 1, fri: 1, sat: 0.5, sun: 0,
    })
  })
})

describe('patternForDay', () => {
  it('returns the studio default when nobody has a row', () => {
    expect(patternForDay([], '2026-04-08')).toEqual(STUDIO_DEFAULT_PATTERN)
  })

  it('picks the row whose half-open interval covers the day', () => {
    const rows = [row('2026-01-01', '2026-04-01', 0.5), row('2026-04-01', null, 0)]
    expect(patternForDay(rows, '2026-03-31').sat).toBe(0.5)
    expect(patternForDay(rows, '2026-04-01').sat).toBe(0)
  })

  it('treats effectiveTo as exclusive', () => {
    // Half-open [from, to), same as app_role_history. An inclusive end would
    // make two adjacent rows both cover the boundary day.
    expect(patternForDay([row('2026-01-01', '2026-04-01', 0.5)], '2026-04-01'))
      .toEqual(STUDIO_DEFAULT_PATTERN)
  })

  it('falls back to the default before the earliest row starts', () => {
    expect(patternForDay([row('2026-04-01', null, 0)], '2026-03-01'))
      .toEqual(STUDIO_DEFAULT_PATTERN)
  })

  it('follows an open row forever forward', () => {
    expect(patternForDay([row('2026-04-01', null, 0)], '2030-01-01').sat).toBe(0)
  })
})

describe('overlaps', () => {
  it('detects two absences sharing a day, inclusive on both ends', () => {
    expect(overlaps(
      { startDate: '2026-04-06', endDate: '2026-04-08' },
      { startDate: '2026-04-08', endDate: '2026-04-10' },
    )).toBe(true)
  })

  it('allows adjacent absences', () => {
    expect(overlaps(
      { startDate: '2026-04-06', endDate: '2026-04-07' },
      { startDate: '2026-04-08', endDate: '2026-04-10' },
    )).toBe(false)
  })

  it('detects full containment either way round', () => {
    const outer = { startDate: '2026-04-01', endDate: '2026-04-30' }
    const inner = { startDate: '2026-04-10', endDate: '2026-04-12' }
    expect(overlaps(outer, inner)).toBe(true)
    expect(overlaps(inner, outer)).toBe(true)
  })

  it('detects a single shared day', () => {
    expect(overlaps(
      { startDate: '2026-04-08', endDate: '2026-04-08' },
      { startDate: '2026-04-08', endDate: '2026-04-08' },
    )).toBe(true)
  })
})
