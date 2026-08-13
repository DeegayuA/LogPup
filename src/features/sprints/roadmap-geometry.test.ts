import { describe, it, expect } from 'vitest'
import { PX_PER_DAY, daysFromOffset, resizeEnd, resizeStart, shiftRange } from './roadmap-geometry'

describe('daysFromOffset', () => {
  it('rounds a positive offset to the nearest whole day', () => {
    expect(daysFromOffset(PX_PER_DAY * 3)).toBe(3)
    expect(daysFromOffset(PX_PER_DAY * 3 + 1)).toBe(3)
    expect(daysFromOffset(PX_PER_DAY * 3 - 1)).toBe(3)
  })

  it('rounds a negative offset to the nearest whole day', () => {
    expect(daysFromOffset(-PX_PER_DAY * 2)).toBe(-2)
  })

  it('a sub-half-day offset rounds to zero days (no-op)', () => {
    expect(daysFromOffset(1)).toBe(0)
    expect(daysFromOffset(-1)).toBe(0)
  })
})

describe('shiftRange', () => {
  it('moves both dates by the same amount, holding duration', () => {
    const result = shiftRange('2026-08-10', '2026-08-16', 3)
    expect(result).toEqual({ start: '2026-08-13', end: '2026-08-19' })
  })

  it('shifts earlier with a negative day count', () => {
    const result = shiftRange('2026-08-10', '2026-08-16', -3)
    expect(result).toEqual({ start: '2026-08-07', end: '2026-08-13' })
  })

  it('zero days is a no-op', () => {
    const result = shiftRange('2026-08-10', '2026-08-16', 0)
    expect(result).toEqual({ start: '2026-08-10', end: '2026-08-16' })
  })

  it('shifts cleanly across a month boundary', () => {
    const result = shiftRange('2026-08-29', '2026-08-31', 3)
    expect(result).toEqual({ start: '2026-09-01', end: '2026-09-03' })
  })
})

describe('resizeStart', () => {
  it('moves the start date, leaving the end untouched', () => {
    expect(resizeStart('2026-08-10', '2026-08-16', -2)).toBe('2026-08-08')
    expect(resizeStart('2026-08-10', '2026-08-16', 2)).toBe('2026-08-12')
  })

  // Clamp: dragging the start edge up to (or past) the end date would
  // collapse or invert the range. It must stop one day short of the end,
  // preserving MIN_SPRINT_DAYS = 1.
  it('clamps the start edge so it cannot reach the end date', () => {
    expect(resizeStart('2026-08-10', '2026-08-16', 10)).toBe('2026-08-16')
  })

  it('clamps exactly at the boundary — one day before end is allowed', () => {
    expect(resizeStart('2026-08-10', '2026-08-16', 5)).toBe('2026-08-15')
  })

  it('a single-day sprint cannot be resized from the start at all', () => {
    expect(resizeStart('2026-08-10', '2026-08-10', 1)).toBe('2026-08-10')
    expect(resizeStart('2026-08-10', '2026-08-10', -1)).toBe('2026-08-09')
  })
})

describe('resizeEnd', () => {
  it('moves the end date, leaving the start untouched', () => {
    expect(resizeEnd('2026-08-10', '2026-08-16', 2)).toBe('2026-08-18')
    expect(resizeEnd('2026-08-10', '2026-08-16', -2)).toBe('2026-08-14')
  })

  // Clamp: dragging the end edge back past (or onto) the start date would
  // collapse or invert the range.
  it('clamps the end edge so it cannot reach the start date', () => {
    expect(resizeEnd('2026-08-10', '2026-08-16', -10)).toBe('2026-08-10')
  })

  it('clamps exactly at the boundary — one day after start is allowed', () => {
    expect(resizeEnd('2026-08-10', '2026-08-16', -5)).toBe('2026-08-11')
  })

  it('a single-day sprint cannot be resized from the end at all', () => {
    expect(resizeEnd('2026-08-10', '2026-08-10', -1)).toBe('2026-08-10')
    expect(resizeEnd('2026-08-10', '2026-08-10', 1)).toBe('2026-08-11')
  })
})
