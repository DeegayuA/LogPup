import { describe, expect, it } from 'vitest'
import {
  PX_PER_DAY,
  barGeometry,
  offsetOfDate,
  packRows,
  parseZoom,
  rowCount,
  snapDays,
  timelineWindow,
  type Span,
} from './roadmap-layout'

const span = (id: string, startDate: string, endDate: string): Span => ({ id, startDate, endDate })

describe('parseZoom', () => {
  it('defaults to month', () => expect(parseZoom(null)).toBe('month'))
  it('accepts every level', () => {
    expect(parseZoom('week')).toBe('week')
    expect(parseZoom('quarter')).toBe('quarter')
  })
  it('falls back on nonsense', () => expect(parseZoom('decade')).toBe('month'))
})

describe('packRows', () => {
  it('keeps non-overlapping sprints on one row', () => {
    const rows = packRows([
      span('a', '2026-08-01', '2026-08-07'),
      span('b', '2026-08-08', '2026-08-14'),
      span('c', '2026-08-15', '2026-08-21'),
    ])
    expect([...rows.values()]).toEqual([0, 0, 0])
    expect(rowCount(rows)).toBe(1)
  })

  it('pushes an overlapping sprint onto the next row', () => {
    const rows = packRows([
      span('a', '2026-08-01', '2026-08-14'),
      span('b', '2026-08-07', '2026-08-21'),
    ])
    expect(rows.get('a')).toBe(0)
    expect(rows.get('b')).toBe(1)
  })

  it('uses exactly as many rows as there are concurrent sprints', () => {
    // Three sprints all live on 2026-08-10 -> three rows, no more.
    const rows = packRows([
      span('a', '2026-08-01', '2026-08-20'),
      span('b', '2026-08-05', '2026-08-25'),
      span('c', '2026-08-10', '2026-08-30'),
      span('d', '2026-09-01', '2026-09-10'),
    ])
    expect(rowCount(rows)).toBe(3)
    // The fourth starts after all three finish, so it reuses row 0.
    expect(rows.get('d')).toBe(0)
  })

  it('treats a same-day handoff as non-overlapping', () => {
    // One ends the 7th, the next starts the 8th: no shared day.
    const rows = packRows([
      span('a', '2026-08-01', '2026-08-07'),
      span('b', '2026-08-08', '2026-08-10'),
    ])
    expect(rows.get('b')).toBe(0)
  })

  it('treats a shared end/start day as an overlap', () => {
    const rows = packRows([
      span('a', '2026-08-01', '2026-08-08'),
      span('b', '2026-08-08', '2026-08-10'),
    ])
    expect(rows.get('b')).toBe(1)
  })

  it('honours a day gap so adjacent bars do not read as one', () => {
    const rows = packRows(
      [span('a', '2026-08-01', '2026-08-07'), span('b', '2026-08-08', '2026-08-10')],
      2,
    )
    expect(rows.get('b')).toBe(1)
  })

  it('is deterministic regardless of input order', () => {
    const spans = [
      span('c', '2026-08-10', '2026-08-30'),
      span('a', '2026-08-01', '2026-08-20'),
      span('b', '2026-08-05', '2026-08-25'),
    ]
    const forwards = packRows(spans)
    const backwards = packRows([...spans].reverse())
    expect([...forwards.entries()].sort()).toEqual([...backwards.entries()].sort())
  })

  it('still places an inverted range instead of colliding with everything', () => {
    const rows = packRows([
      span('a', '2026-08-10', '2026-08-01'),
      span('b', '2026-08-11', '2026-08-20'),
    ])
    expect(rows.get('a')).toBe(0)
    expect(rows.get('b')).toBe(0)
  })

  it('gives an empty roadmap zero rows', () => expect(rowCount(packRows([]))).toBe(0))
})

describe('timelineWindow', () => {
  it('always contains today, even when every sprint is in the past', () => {
    const win = timelineWindow([span('a', '2025-01-01', '2025-01-07')], '2026-08-12', 7)
    expect(win.startDate).toBe('2024-12-25')
    expect(win.endDate).toBe('2026-08-19')
  })

  it('pads both ends so a bar can be dragged past the extremes', () => {
    const win = timelineWindow([span('a', '2026-08-10', '2026-08-16')], '2026-08-12', 7)
    expect(win.startDate).toBe('2026-08-03')
    expect(win.endDate).toBe('2026-08-23')
  })

  it('reports the inclusive day count of the axis', () => {
    const win = timelineWindow([span('a', '2026-08-12', '2026-08-12')], '2026-08-12', 1)
    expect(win).toEqual({ startDate: '2026-08-11', endDate: '2026-08-13', totalDays: 3 })
  })

  it('degenerates to today plus padding with no sprints at all', () => {
    const win = timelineWindow([], '2026-08-12', 3)
    expect(win).toEqual({ startDate: '2026-08-09', endDate: '2026-08-15', totalDays: 7 })
  })
})

describe('barGeometry', () => {
  const win = timelineWindow([span('a', '2026-08-10', '2026-08-16')], '2026-08-12', 7)

  it('places the bar at its day offset', () => {
    // Window starts 2026-08-03; the sprint starts 7 days later.
    expect(barGeometry(span('a', '2026-08-10', '2026-08-16'), win, 'month')).toEqual({
      left: 7 * PX_PER_DAY.month,
      width: 7 * PX_PER_DAY.month,
    })
  })

  it('scales with zoom', () => {
    const wide = barGeometry(span('a', '2026-08-10', '2026-08-16'), win, 'week')
    expect(wide.width).toBe(7 * PX_PER_DAY.week)
  })

  it('gives a one-day sprint a full day of width', () =>
    expect(barGeometry(span('a', '2026-08-10', '2026-08-10'), win, 'month').width).toBe(
      PX_PER_DAY.month,
    ))

  it('never returns a negative width for an inverted range', () =>
    expect(
      barGeometry(span('a', '2026-08-16', '2026-08-10'), win, 'month').width,
    ).toBeGreaterThan(0))
})

describe('snapDays', () => {
  it('is zero for no movement', () => expect(snapDays(0, 'month')).toBe(0))
  it('converts a whole day of pixels to one day', () =>
    expect(snapDays(PX_PER_DAY.month, 'month')).toBe(1))
  it('snaps to the nearest day, not the one already passed', () =>
    expect(snapDays(PX_PER_DAY.month * 0.6, 'month')).toBe(1))
  it('stays put below the halfway point', () =>
    expect(snapDays(PX_PER_DAY.month * 0.4, 'month')).toBe(0))
  it('handles a backwards drag', () =>
    expect(snapDays(-PX_PER_DAY.week * 3, 'week')).toBe(-3))
  it('refuses a non-finite delta rather than producing NaN days', () =>
    expect(snapDays(Number.NaN, 'month')).toBe(0))
})

describe('offsetOfDate', () => {
  // Window: 2026-08-10 minus 7 days of padding → starts 2026-08-03.
  const win = timelineWindow([span('a', '2026-08-10', '2026-08-16')], '2026-08-12', 7)

  it('puts the window’s own first day at column zero', () =>
    expect(offsetOfDate(win, win.startDate)).toBe(0))

  it('counts whole day columns from the window’s first day', () =>
    expect(offsetOfDate(win, '2026-08-14')).toBe(11))

  it('reports a negative offset for a date before the window', () =>
    expect(offsetOfDate(win, '2026-08-01')).toBeLessThan(0))
})

