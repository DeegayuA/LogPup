import { describe, expect, it } from 'vitest'
import { SNAP_MINUTES, draggedMinutes, isRealMove, moveMeetingByDrag } from './time-drag'

const GRID_START = 7
const GRID_END = 22

/** 10:00–11:00 on a Wednesday. */
const START = new Date(2026, 7, 12, 10, 0, 0, 0)
const END = new Date(2026, 7, 12, 11, 0, 0, 0)

function move(over: Partial<Parameters<typeof moveMeetingByDrag>[0]> = {}) {
  return moveMeetingByDrag({
    startsAt: START,
    endsAt: END,
    dayDelta: 0,
    minuteDelta: 0,
    gridStartHour: GRID_START,
    gridEndHour: GRID_END,
    ...over,
  })
}

describe('draggedMinutes', () => {
  it('converts pixels to minutes against the current zoom', () => {
    // 60px/hour: 60px dragged is one hour.
    expect(draggedMinutes(60, 60)).toBe(60)
    // 120px/hour: the same 60px is only half an hour.
    expect(draggedMinutes(60, 120)).toBe(30)
  })

  it('snaps to the quarter hour, up and down', () => {
    // The midpoint is 7.5 minutes: 10 rounds up to 15, 7 rounds down to 0.
    expect(draggedMinutes(10, 60)).toBe(SNAP_MINUTES)
    expect(draggedMinutes(7, 60)).toBe(0)
    expect(draggedMinutes(3, 60)).toBe(0)
    expect(draggedMinutes(-10, 60)).toBe(-SNAP_MINUTES)
  })

  it('handles upward drags as negative minutes', () => {
    expect(draggedMinutes(-60, 60)).toBe(-60)
  })

  it('refuses to produce NaN or Infinity from a nonsensical scale', () => {
    // A zero pxPerHour must mean "no movement", never a jump to the epoch.
    expect(draggedMinutes(100, 0)).toBe(0)
    expect(draggedMinutes(100, -60)).toBe(0)
    expect(draggedMinutes(Number.NaN, 60)).toBe(0)
    expect(draggedMinutes(Number.POSITIVE_INFINITY, 60)).toBe(0)
  })
})

describe('moveMeetingByDrag', () => {
  it('leaves a meeting untouched when nothing moved', () => {
    const result = move()
    expect(result.startsAt.getTime()).toBe(START.getTime())
    expect(result.endsAt.getTime()).toBe(END.getTime())
  })

  it('shifts the time and keeps the duration', () => {
    const result = move({ minuteDelta: 90 })
    expect(result.startsAt.getHours()).toBe(11)
    expect(result.startsAt.getMinutes()).toBe(30)
    expect(result.endsAt.getTime() - result.startsAt.getTime()).toBe(60 * 60 * 1000)
  })

  it('moves across day columns, keeping the clock time', () => {
    const result = move({ dayDelta: 2 })
    expect(result.startsAt.getDate()).toBe(14)
    expect(result.startsAt.getHours()).toBe(10)
  })

  it('moves backwards in time and across days', () => {
    const result = move({ dayDelta: -1, minuteDelta: -60 })
    expect(result.startsAt.getDate()).toBe(11)
    expect(result.startsAt.getHours()).toBe(9)
  })

  it('clamps a drag above the grid to its first hour instead of hiding it', () => {
    // Six hours up from 10:00 would be 04:00, off a grid starting at 07:00.
    const result = move({ minuteDelta: -6 * 60 })
    expect(result.startsAt.getHours()).toBe(GRID_START)
    expect(result.startsAt.getMinutes()).toBe(0)
    expect(result.startsAt.getDate()).toBe(12) // same day, not rolled back
  })

  it('clamps a drag below the grid to its last hour', () => {
    const result = move({ minuteDelta: 20 * 60 })
    expect(result.startsAt.getHours()).toBe(GRID_END - 1)
    expect(result.startsAt.getDate()).toBe(12)
  })

  it('preserves duration even when clamped', () => {
    const long = moveMeetingByDrag({
      startsAt: START,
      endsAt: new Date(2026, 7, 12, 13, 0, 0, 0), // 3 hours
      dayDelta: 0,
      minuteDelta: -10 * 60,
      gridStartHour: GRID_START,
      gridEndHour: GRID_END,
    })
    expect(long.endsAt.getTime() - long.startsAt.getTime()).toBe(3 * 60 * 60 * 1000)
  })

  it('clamps against the DESTINATION day, not the original one', () => {
    // Two days forward AND dragged above the grid: it must land at 07:00 on
    // the 14th, not be dragged back toward the 12th.
    const result = move({ dayDelta: 2, minuteDelta: -6 * 60 })
    expect(result.startsAt.getDate()).toBe(14)
    expect(result.startsAt.getHours()).toBe(GRID_START)
  })

  it('lets a long meeting end past the grid, as a scheduled one already can', () => {
    const result = moveMeetingByDrag({
      startsAt: START,
      endsAt: new Date(2026, 7, 12, 16, 0, 0, 0), // 6 hours
      dayDelta: 0,
      minuteDelta: 10 * 60,
      gridStartHour: GRID_START,
      gridEndHour: GRID_END,
    })
    // Compared as an instant, not as an hour: this end runs past midnight,
    // where getHours() wraps back to a small number.
    expect(result.endsAt.getTime()).toBeGreaterThan(new Date(2026, 7, 12, GRID_END, 0).getTime())
  })
})

describe('isRealMove', () => {
  it('rejects a drag that snapped back to where it started', () => {
    expect(isRealMove(0, 0)).toBe(false)
  })

  it('accepts a move in either dimension', () => {
    expect(isRealMove(1, 0)).toBe(true)
    expect(isRealMove(0, -15)).toBe(true)
  })
})
