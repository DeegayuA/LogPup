import { describe, expect, it } from 'vitest'
import {
  ALL_DAY_MIN_MINUTES,
  DEFAULT_PX_PER_HOUR,
  MAX_PX_PER_HOUR,
  MIN_EVENT_HEIGHT_PX,
  MIN_PX_PER_HOUR,
  MINUTES_PER_DAY,
  clampPxPerHour,
  clipToDay,
  dayWindow,
  eventGeometry,
  hourLabel,
  isAllDayMeeting,
  isWorkingHour,
  minEventMinutes,
  minutesIntoDay,
  zonedDayStartMs,
} from './calendar-grid'

const HOUR_MS = 3_600_000

/** UTC instant for a Colombo (+05:30) wall clock on 2026-08-12. */
const colombo = (hour: number, minute = 0): number =>
  Date.UTC(2026, 7, 12, hour, minute) - 5.5 * HOUR_MS

describe('clampPxPerHour', () => {
  it('passes a sane value straight through', () => {
    expect(clampPxPerHour(56)).toBe(56)
  })

  it('clamps to the named range rather than letting the grid collapse or explode', () => {
    expect(clampPxPerHour(4)).toBe(MIN_PX_PER_HOUR)
    expect(clampPxPerHour(10_000)).toBe(MAX_PX_PER_HOUR)
  })

  it('rounds to whole pixels', () => {
    expect(clampPxPerHour(56.4)).toBe(56)
    expect(clampPxPerHour(56.6)).toBe(57)
  })

  it('falls back to the default for a corrupted stored preference', () => {
    // localStorage can hand back anything; Number('banana') is NaN.
    expect(clampPxPerHour(Number.NaN)).toBe(DEFAULT_PX_PER_HOUR)
    expect(clampPxPerHour(Number.POSITIVE_INFINITY)).toBe(DEFAULT_PX_PER_HOUR)
  })
})

describe('isAllDayMeeting', () => {
  it('sends a midnight-to-midnight block to the all-day strip', () => {
    expect(isAllDayMeeting(colombo(0), colombo(24))).toBe(true)
  })

  it('sends an 00:00–23:59 block there too', () => {
    // The shape an .ics import or a hand-typed all-day block usually has —
    // the reason the rule is a duration and not "ends at midnight".
    expect(isAllDayMeeting(colombo(0), colombo(23, 59))).toBe(true)
  })

  it('sends a multi-day offsite there', () => {
    expect(isAllDayMeeting(colombo(9), colombo(9) + 48 * HOUR_MS)).toBe(true)
  })

  it('sits exactly on the 20-hour threshold', () => {
    expect(ALL_DAY_MIN_MINUTES).toBe(20 * 60)
    expect(isAllDayMeeting(colombo(0), colombo(20))).toBe(true)
    expect(isAllDayMeeting(colombo(0), colombo(19, 59))).toBe(false)
  })

  it('leaves an ordinary meeting in the grid', () => {
    expect(isAllDayMeeting(colombo(9), colombo(10))).toBe(false)
    expect(isAllDayMeeting(colombo(9), colombo(9, 15))).toBe(false)
  })

  it('leaves a meeting that merely crosses midnight in the grid', () => {
    // 22:00 → 02:00 is four hours of real meeting, drawn as a block on each
    // of the two days — not an all-day banner.
    expect(isAllDayMeeting(colombo(22), colombo(26))).toBe(false)
  })

  it('is false for a zero-length or inverted range', () => {
    expect(isAllDayMeeting(colombo(9), colombo(9))).toBe(false)
    expect(isAllDayMeeting(colombo(9), colombo(8))).toBe(false)
  })
})

describe('zonedDayStartMs', () => {
  it('resolves a Colombo day to its own 00:00, not UTC midnight', () => {
    // +05:30 means the day starts at 18:30 UTC the evening before. Reading
    // the date off a UTC midnight would be a day out around the boundary.
    expect(zonedDayStartMs('2026-08-12')).toBe(Date.UTC(2026, 7, 11, 18, 30))
  })

  it('handles a zone west of UTC', () => {
    expect(zonedDayStartMs('2026-08-12', 'America/Bogota')).toBe(Date.UTC(2026, 7, 12, 5))
  })

  it('is exact on a DST boundary in a zone that has one', () => {
    // Europe/London springs forward at 01:00 UTC on 2026-03-29, so that day
    // still begins at 00:00 UTC — but the NEXT one begins at 23:00 UTC.
    expect(zonedDayStartMs('2026-03-29', 'Europe/London')).toBe(Date.UTC(2026, 2, 29, 0))
    expect(zonedDayStartMs('2026-03-30', 'Europe/London')).toBe(Date.UTC(2026, 2, 29, 23))
  })
})

describe('dayWindow', () => {
  it('spans exactly one Colombo day', () => {
    const window = dayWindow('2026-08-12')
    expect(window.iso).toBe('2026-08-12')
    expect(window.startMs).toBe(Date.UTC(2026, 7, 11, 18, 30))
    expect(window.endMs - window.startMs).toBe(24 * HOUR_MS)
  })

  it('tiles without gaps or overlaps', () => {
    expect(dayWindow('2026-08-12').endMs).toBe(dayWindow('2026-08-13').startMs)
  })

  it('is 23 hours long on a spring-forward day', () => {
    // Derived from the two neighbouring midnights, not `start + 24h` — which
    // would put the last hour of the day into the following one.
    const window = dayWindow('2026-03-29', 'Europe/London')
    expect(window.endMs - window.startMs).toBe(23 * HOUR_MS)
  })
})

describe('clipToDay', () => {
  const window = dayWindow('2026-08-12')

  it('reports an ordinary meeting as minutes from midnight', () => {
    expect(clipToDay(colombo(9), colombo(10, 30), window)).toEqual({
      startMinutes: 9 * 60,
      endMinutes: 10 * 60 + 30,
      continuesBefore: false,
      continuesAfter: false,
    })
  })

  it('cuts the tail off a meeting running past midnight', () => {
    expect(clipToDay(colombo(22), colombo(26), window)).toEqual({
      startMinutes: 22 * 60,
      endMinutes: MINUTES_PER_DAY,
      continuesBefore: false,
      continuesAfter: true,
    })
  })

  it('cuts the head off the same meeting on the following day', () => {
    expect(clipToDay(colombo(22), colombo(26), dayWindow('2026-08-13'))).toEqual({
      startMinutes: 0,
      endMinutes: 120,
      continuesBefore: true,
      continuesAfter: false,
    })
  })

  it('returns null for a meeting on another day', () => {
    expect(clipToDay(colombo(33), colombo(34), window)).toBeNull()
    expect(clipToDay(colombo(-4), colombo(-3), window)).toBeNull()
  })

  it('does not leave a zero-height sliver on the next day', () => {
    // 23:00 → midnight belongs to the 12th only.
    expect(clipToDay(colombo(23), colombo(24), dayWindow('2026-08-13'))).toBeNull()
    expect(clipToDay(colombo(23), colombo(24), window)?.endMinutes).toBe(MINUTES_PER_DAY)
  })

  it('keeps a zero-length meeting on the day its instant lands in', () => {
    expect(clipToDay(colombo(10), colombo(10), window)).toEqual({
      startMinutes: 600,
      endMinutes: 600,
      continuesBefore: false,
      continuesAfter: false,
    })
  })

  it('does not let an inverted range produce a negative span', () => {
    const segment = clipToDay(colombo(10), colombo(8), window)
    expect(segment?.endMinutes).toBe(segment?.startMinutes)
  })
})

describe('eventGeometry', () => {
  it('turns minutes into pixels by the zoom alone', () => {
    expect(eventGeometry(9 * 60, 10 * 60, 60)).toEqual({ top: 540, height: 60 })
    expect(eventGeometry(9 * 60, 10 * 60, 120)).toEqual({ top: 1080, height: 120 })
  })

  it('scales a part-hour meeting proportionally', () => {
    expect(eventGeometry(9 * 60 + 30, 10 * 60 + 15, 48)).toEqual({ top: 456, height: 36 })
  })

  it('floors a short meeting at the minimum readable height', () => {
    // 15 minutes at the minimum zoom is 8px — unreadable and barely clickable.
    const { height } = eventGeometry(9 * 60, 9 * 60 + 15, MIN_PX_PER_HOUR)
    expect(height).toBe(MIN_EVENT_HEIGHT_PX)
  })

  it('does not shorten a meeting that is already taller than the minimum', () => {
    expect(eventGeometry(9 * 60, 11 * 60, 60).height).toBe(120)
  })

  it('pulls a late meeting up so the minimum height stays inside the grid', () => {
    // 23:50 → midnight at 48px/hour is 8px of real duration stretched to the
    // 22px floor; unclamped it would paint 14px below the end of the day.
    const pxPerHour = 48
    const dayHeight = (MINUTES_PER_DAY * pxPerHour) / 60
    const { top, height } = eventGeometry(23 * 60 + 50, MINUTES_PER_DAY, pxPerHour)
    expect(height).toBe(MIN_EVENT_HEIGHT_PX)
    expect(top + height).toBe(dayHeight)
  })

  it('never returns a negative top', () => {
    expect(eventGeometry(-30, 30, 60).top).toBe(0)
  })

  it('gives a zero-length meeting the minimum height', () => {
    expect(eventGeometry(600, 600, 60)).toEqual({ top: 600, height: MIN_EVENT_HEIGHT_PX })
  })

  it('never returns a negative height for an inverted segment', () => {
    expect(eventGeometry(600, 480, 60).height).toBe(MIN_EVENT_HEIGHT_PX)
  })
})

describe('minEventHeight', () => {
  it('clears the 24px floor of WCAG 2.5.8 before any hit-slop is added', () => {
    expect(MIN_EVENT_HEIGHT_PX).toBeGreaterThanOrEqual(24)
  })
})

describe('minEventMinutes', () => {
  it('is the duration the minimum block height actually covers', () => {
    // One pixel per minute, so the floor is exactly MIN_EVENT_HEIGHT_PX minutes.
    expect(minEventMinutes(60)).toBe(MIN_EVENT_HEIGHT_PX)
  })

  it('grows as the grid is zoomed out, because the floor eats more of the day', () => {
    expect(minEventMinutes(MIN_PX_PER_HOUR)).toBeGreaterThan(minEventMinutes(DEFAULT_PX_PER_HOUR))
  })

  it('makes two back-to-back 15-minute meetings collide at the default zoom', () => {
    // The whole reason this exists: at 56px/hour the first standup is drawn
    // over the start of the second, so the packer has to be told they overlap
    // or the second one's opaque fill erases the first.
    const floor = minEventMinutes(DEFAULT_PX_PER_HOUR)
    expect(9 * 60 + floor).toBeGreaterThan(9 * 60 + 15)
  })

  it('is a no-op on a nonsensical zoom rather than Infinity', () => {
    expect(minEventMinutes(0)).toBe(0)
    expect(minEventMinutes(Number.NaN)).toBe(0)
  })
})

describe('minutesIntoDay', () => {
  const window = dayWindow('2026-08-12')

  it('places an instant inside the day', () => {
    expect(minutesIntoDay(colombo(14, 30), window)).toBe(14 * 60 + 30)
  })

  it('is zero at the very start of the day', () => {
    expect(minutesIntoDay(window.startMs, window)).toBe(0)
  })

  it('returns null for any other day, so the now line renders nowhere else', () => {
    expect(minutesIntoDay(window.endMs, window)).toBeNull()
    expect(minutesIntoDay(window.startMs - 1, window)).toBeNull()
  })
})

describe('hour row helpers', () => {
  it('labels hours in a fixed-width 24-hour form', () => {
    expect(hourLabel(0)).toBe('00:00')
    expect(hourLabel(9)).toBe('09:00')
    expect(hourLabel(23)).toBe('23:00')
  })

  it('marks 08:00–17:59 as working hours', () => {
    expect(isWorkingHour(7)).toBe(false)
    expect(isWorkingHour(8)).toBe(true)
    expect(isWorkingHour(17)).toBe(true)
    expect(isWorkingHour(18)).toBe(false)
  })
})
