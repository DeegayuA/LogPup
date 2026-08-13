import { describe, expect, it } from 'vitest'
import { DEFAULT_PX_PER_HOUR } from './calendar-grid'
import {
  MIN_MEETING_MINUTES,
  SNAP_MINUTES,
  dragCreateRange,
  draggedMinutes,
  isRealMove,
  isRealResize,
  moveMeetingByDrag,
  resizeMeetingEndByDrag,
  resizeMeetingStartByDrag,
} from './time-drag'

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

describe('resizeMeetingStartByDrag', () => {
  it('moves the start and leaves the end untouched', () => {
    const result = resizeMeetingStartByDrag({ startsAt: START, endsAt: END, minuteDelta: -30 })
    expect(result.startsAt.getHours()).toBe(9)
    expect(result.startsAt.getMinutes()).toBe(30)
    expect(result.endsAt.getTime()).toBe(END.getTime())
  })

  it('shrinks the meeting when dragged down, still leaving the end untouched', () => {
    const result = resizeMeetingStartByDrag({ startsAt: START, endsAt: END, minuteDelta: 15 })
    expect(result.startsAt.getHours()).toBe(10)
    expect(result.startsAt.getMinutes()).toBe(15)
    expect(result.endsAt.getTime()).toBe(END.getTime())
  })

  it('clamps to the minimum duration instead of crossing past the end', () => {
    // Dragging the top edge down by two hours would put the start at noon,
    // an hour past the 11:00 end — must clamp, not invert.
    const result = resizeMeetingStartByDrag({ startsAt: START, endsAt: END, minuteDelta: 120 })
    expect(result.startsAt.getTime()).toBe(END.getTime() - MIN_MEETING_MINUTES * 60_000)
    expect(result.endsAt.getTime()).toBe(END.getTime())
    expect(result.endsAt.getTime() - result.startsAt.getTime()).toBe(MIN_MEETING_MINUTES * 60_000)
  })

  it('never inverts start and end even at an extreme drag', () => {
    const result = resizeMeetingStartByDrag({ startsAt: START, endsAt: END, minuteDelta: 10_000 })
    expect(result.startsAt.getTime()).toBeLessThan(result.endsAt.getTime())
  })

  it('snaps a small drag to the quarter hour at the default zoom', () => {
    // 7px at 56px/hour (DEFAULT_PX_PER_HOUR) is 7.5 raw minutes — the
    // boundary case that must still land on a quarter hour, not "7" or "8".
    const minuteDelta = draggedMinutes(7, DEFAULT_PX_PER_HOUR)
    expect(minuteDelta % SNAP_MINUTES).toBe(0)
    const result = resizeMeetingStartByDrag({ startsAt: START, endsAt: END, minuteDelta })
    expect(result.startsAt.getMinutes() % SNAP_MINUTES).toBe(0)
  })
})

describe('resizeMeetingEndByDrag', () => {
  it('moves the end and leaves the start untouched', () => {
    const result = resizeMeetingEndByDrag({ startsAt: START, endsAt: END, minuteDelta: 30 })
    expect(result.endsAt.getHours()).toBe(11)
    expect(result.endsAt.getMinutes()).toBe(30)
    expect(result.startsAt.getTime()).toBe(START.getTime())
  })

  it('shrinks the meeting when dragged up, still leaving the start untouched', () => {
    const result = resizeMeetingEndByDrag({ startsAt: START, endsAt: END, minuteDelta: -15 })
    expect(result.endsAt.getHours()).toBe(10)
    expect(result.endsAt.getMinutes()).toBe(45)
    expect(result.startsAt.getTime()).toBe(START.getTime())
  })

  it('clamps to the minimum duration instead of crossing above the start', () => {
    // Dragging the bottom edge up by two hours would put the end at 09:00,
    // an hour before the 10:00 start — must clamp, not invert.
    const result = resizeMeetingEndByDrag({ startsAt: START, endsAt: END, minuteDelta: -120 })
    expect(result.endsAt.getTime()).toBe(START.getTime() + MIN_MEETING_MINUTES * 60_000)
    expect(result.startsAt.getTime()).toBe(START.getTime())
    expect(result.endsAt.getTime() - result.startsAt.getTime()).toBe(MIN_MEETING_MINUTES * 60_000)
  })

  it('never inverts start and end even at an extreme drag', () => {
    const result = resizeMeetingEndByDrag({ startsAt: START, endsAt: END, minuteDelta: -10_000 })
    expect(result.endsAt.getTime()).toBeGreaterThan(result.startsAt.getTime())
  })

  it('snaps a small drag to the quarter hour at the default zoom', () => {
    const minuteDelta = draggedMinutes(7, DEFAULT_PX_PER_HOUR)
    const result = resizeMeetingEndByDrag({ startsAt: START, endsAt: END, minuteDelta })
    expect(result.endsAt.getMinutes() % SNAP_MINUTES).toBe(0)
  })
})

describe('isRealResize', () => {
  it('rejects a resize that produced the same window', () => {
    const same = { startsAt: START, endsAt: END }
    expect(isRealResize(same, same)).toBe(false)
  })

  it('rejects a resize clamped back to the original window', () => {
    // Zero minutes of drag clamps to exactly where it started.
    const after = resizeMeetingStartByDrag({ startsAt: START, endsAt: END, minuteDelta: 0 })
    expect(isRealResize({ startsAt: START, endsAt: END }, after)).toBe(false)
  })

  it('accepts a resize that actually changed the start or end', () => {
    const after = resizeMeetingStartByDrag({ startsAt: START, endsAt: END, minuteDelta: -30 })
    expect(isRealResize({ startsAt: START, endsAt: END }, after)).toBe(true)
  })
})

describe('dragCreateRange', () => {
  // 60px/hour: one pixel is one minute, so the arithmetic below is legible.
  const PX = 60

  it('anchors the press to the slot it landed in, floored', () => {
    // Pressed at 10:20 (620px) — that is the 10:15 slot, not 10:30.
    const range = dragCreateRange({ anchorPx: 620, pointerPx: 620, pxPerHour: PX })
    expect(range.startMinutes).toBe(615)
    expect(range.endMinutes).toBe(615 + MIN_MEETING_MINUTES)
  })

  it('shows a minimum-length ghost before the drag has travelled', () => {
    const range = dragCreateRange({ anchorPx: 600, pointerPx: 603, pxPerHour: PX })
    expect(range).toEqual({ startMinutes: 600, endMinutes: 600 + MIN_MEETING_MINUTES })
  })

  it('grows the end as the pointer drags down, snapped to the quarter hour', () => {
    expect(dragCreateRange({ anchorPx: 600, pointerPx: 660, pxPerHour: PX })).toEqual({
      startMinutes: 600,
      endMinutes: 660,
    })
    // 40 raw minutes of travel rounds to 45 — the ghost lands on the snap
    // grid, never on 10:40.
    expect(dragCreateRange({ anchorPx: 600, pointerPx: 640, pxPerHour: PX }).endMinutes).toBe(645)
  })

  it('grows upward from the anchor when dragged up, never inverted', () => {
    const range = dragCreateRange({ anchorPx: 600, pointerPx: 540, pxPerHour: PX })
    expect(range).toEqual({ startMinutes: 540, endMinutes: 600 })
  })

  it('converts pixels against the zoom the way draggedMinutes does', () => {
    // 120px/hour: the same 60px of travel is only half an hour.
    const range = dragCreateRange({ anchorPx: 1200, pointerPx: 1260, pxPerHour: 120 })
    expect(range).toEqual({ startMinutes: 600, endMinutes: 630 })
  })

  it('clamps at the top of the day without collapsing below the floor', () => {
    // Pressed in the first slot and dragged far above the grid: both ends
    // clamp to 0, and the range must re-grow downward, not vanish.
    const range = dragCreateRange({ anchorPx: 3, pointerPx: -200, pxPerHour: PX })
    expect(range).toEqual({ startMinutes: 0, endMinutes: MIN_MEETING_MINUTES })
  })

  it('clamps the end to midnight', () => {
    const range = dragCreateRange({ anchorPx: 1439, pointerPx: 2000, pxPerHour: PX })
    expect(range.startMinutes).toBe(1425)
    expect(range.endMinutes).toBe(1440)
  })

  it('refuses to produce NaN geometry from a nonsensical scale', () => {
    expect(dragCreateRange({ anchorPx: 100, pointerPx: 200, pxPerHour: 0 })).toEqual({
      startMinutes: 0,
      endMinutes: MIN_MEETING_MINUTES,
    })
  })
})
