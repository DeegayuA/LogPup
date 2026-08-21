import { describe, expect, it } from 'vitest'
import { TREND_WEEKS, TREND_Y_FLOOR_HOURS, buildLoadTrend } from './trend-points'

const NOW = new Date('2026-08-21T09:00:00Z') // Friday; its Colombo week starts 2026-08-17

describe('buildLoadTrend', () => {
  it('always produces twelve points ending in the current week', () => {
    const trend = buildLoadTrend([], NOW)
    expect(trend.points).toHaveLength(TREND_WEEKS)
    expect(trend.points[TREND_WEEKS - 1].weekStartIso).toBe('2026-08-17')
  })

  it('is ordered oldest to newest', () => {
    const points = buildLoadTrend([], NOW).points
    expect(points[0].weekStartIso).toBe('2026-06-01')
    expect(points[0].weekStartIso < points[1].weekStartIso).toBe(true)
  })

  it('fills an empty middle week as zero rather than dropping it', () => {
    // A dropped week would compress the axis and make a fortnight of silence
    // look like two busy weeks side by side — the chart telling the opposite
    // of the truth.
    const trend = buildLoadTrend([
      { weekStartIso: '2026-08-03', hours: 10 },
      { weekStartIso: '2026-08-17', hours: 12 },
    ], NOW)
    const gap = trend.points.find((p) => p.weekStartIso === '2026-08-10')
    expect(gap).toEqual({ weekStartIso: '2026-08-10', hours: 0 })
    expect(trend.points).toHaveLength(TREND_WEEKS)
  })

  it('scales the axis to the peak', () => {
    expect(buildLoadTrend([{ weekStartIso: '2026-08-17', hours: 22.5 }], NOW).yMax).toBe(22.5)
  })

  it('floors the axis so twelve empty weeks do not divide by zero', () => {
    expect(buildLoadTrend([], NOW).yMax).toBe(TREND_Y_FLOOR_HOURS)
  })

  it('ignores weeks outside the window rather than stretching to reach them', () => {
    const trend = buildLoadTrend([{ weekStartIso: '2025-01-06', hours: 99 }], NOW)
    expect(trend.yMax).toBe(TREND_Y_FLOOR_HOURS)
    expect(trend.points.every((p) => p.hours === 0)).toBe(true)
  })
})
