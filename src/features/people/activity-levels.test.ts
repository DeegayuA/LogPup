import { describe, it, expect } from 'vitest'
import {
  ACTIVITY_THRESHOLDS,
  activityLevel,
  activityPeak,
  activityTotal,
  buildActivitySeries,
} from './activity-levels'

describe('activityLevel', () => {
  it('maps counts onto the documented ramp', () => {
    expect(activityLevel(0)).toBe(0)
    expect(activityLevel(1)).toBe(1)
    expect(activityLevel(2)).toBe(2)
    expect(activityLevel(3)).toBe(2)
    expect(activityLevel(4)).toBe(3)
    expect(activityLevel(5)).toBe(3)
    expect(activityLevel(6)).toBe(4)
    expect(activityLevel(200)).toBe(4)
  })

  it('never returns a level the graph would reject', () => {
    for (const count of [-5, 0, 1, 7, Number.NaN]) {
      const level = activityLevel(count)
      expect(level).toBeGreaterThanOrEqual(0)
      expect(level).toBeLessThanOrEqual(4)
    }
  })

  it('agrees with the legend thresholds it is rendered next to', () => {
    for (const threshold of ACTIVITY_THRESHOLDS) {
      expect(activityLevel(threshold.min)).toBe(threshold.level)
    }
  })
})

describe('buildActivitySeries', () => {
  it('zero-fills every day in the range', () => {
    const series = buildActivitySeries([{ day: '2026-08-11', count: 3 }], '2026-08-10', '2026-08-12')
    expect(series).toEqual([
      { date: '2026-08-10', count: 0, level: 0 },
      { date: '2026-08-11', count: 3, level: 2 },
      { date: '2026-08-12', count: 0, level: 0 },
    ])
  })

  it('ignores counts outside the range rather than folding them into an edge', () => {
    const series = buildActivitySeries(
      [
        { day: '2026-08-01', count: 9 },
        { day: '2026-08-11', count: 1 },
      ],
      '2026-08-10',
      '2026-08-12',
    )
    expect(series.map((d) => d.count)).toEqual([0, 1, 0])
  })

  it('covers a whole 26-week window with no gaps and no duplicates', () => {
    const series = buildActivitySeries([], '2026-02-11', '2026-08-12')
    const days = new Set(series.map((d) => d.date))
    expect(series).toHaveLength(days.size)
    expect(series[0].date).toBe('2026-02-11')
    expect(series[series.length - 1].date).toBe('2026-08-12')
  })

  it('is empty for an inverted range', () => {
    expect(buildActivitySeries([], '2026-08-12', '2026-08-10')).toEqual([])
  })
})

describe('activityTotal / activityPeak', () => {
  const series = buildActivitySeries(
    [
      { day: '2026-08-10', count: 2 },
      { day: '2026-08-12', count: 7 },
    ],
    '2026-08-10',
    '2026-08-12',
  )

  it('sums every day', () => {
    expect(activityTotal(series)).toBe(9)
  })

  it('reports the busiest single day', () => {
    expect(activityPeak(series)).toBe(7)
  })

  it('is zero for an empty series', () => {
    expect(activityTotal([])).toBe(0)
    expect(activityPeak([])).toBe(0)
  })
})
