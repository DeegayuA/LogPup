import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SPRINT_DAYS,
  addCalendarDays,
  dayDelta,
  defaultSprintRange,
  inclusiveDayCount,
  initialSprintStatus,
  isSprintRunningNow,
  moveSprintRange,
  resizeSprintEnd,
  resizeSprintStart,
  shiftEndDate,
  sprintDurationLabel,
} from './sprint-date-range'

// All dates below are plain `yyyy-mm-dd` calendar strings, matched to the
// `sprints` table's `date` columns — there is no timezone in play anywhere
// in this file, only calendar-day arithmetic.

describe('DEFAULT_SPRINT_DAYS', () => {
  it('is 7', () => expect(DEFAULT_SPRINT_DAYS).toBe(7))
})

describe('defaultSprintRange', () => {
  it('is 7 inclusive calendar days starting today (start + 6 = end)', () => {
    expect(defaultSprintRange('2026-08-11')).toEqual({
      startDate: '2026-08-11',
      endDate: '2026-08-17',
    })
  })

  it('crosses a month boundary correctly (Aug 28 -> Sep 3)', () => {
    expect(defaultSprintRange('2026-08-28')).toEqual({
      startDate: '2026-08-28',
      endDate: '2026-09-03',
    })
  })

  it('crosses the February/March boundary in a leap year (2028 has Feb 29)', () => {
    expect(defaultSprintRange('2028-02-25')).toEqual({
      startDate: '2028-02-25',
      endDate: '2028-03-02',
    })
  })

  it('crosses the February/March boundary in a non-leap year (2026 has 28 days)', () => {
    // One day further into March than the 2028 leap-year case above, since
    // February is a day shorter — confirms the leap day is actually being
    // accounted for and not just coincidentally landing on the same date.
    expect(defaultSprintRange('2026-02-25')).toEqual({
      startDate: '2026-02-25',
      endDate: '2026-03-03',
    })
  })

  it('crosses a year boundary (Dec 28 -> Jan 3)', () => {
    expect(defaultSprintRange('2026-12-28')).toEqual({
      startDate: '2026-12-28',
      endDate: '2027-01-03',
    })
  })
})

describe('shiftEndDate', () => {
  it('preserves the duration when the start date moves forward', () => {
    // 2026-08-11..2026-08-17 is a 7-day span; moving the start forward a
    // week should move the end forward a week too.
    expect(shiftEndDate('2026-08-11', '2026-08-17', '2026-08-18')).toBe('2026-08-24')
  })

  it('preserves the duration when the start date moves backward', () => {
    expect(shiftEndDate('2026-08-11', '2026-08-17', '2026-08-04')).toBe('2026-08-10')
  })

  it('preserves a non-default duration, not just DEFAULT_SPRINT_DAYS', () => {
    // A 3-day span (inclusive): 08-01, 08-02, 08-03.
    expect(shiftEndDate('2026-08-01', '2026-08-03', '2026-08-10')).toBe('2026-08-12')
  })

  it('preserves duration across a month boundary shift', () => {
    // Same 7-day span as the defaultSprintRange month-boundary case above,
    // nudged one day later so the shifted end also crosses into September.
    expect(shiftEndDate('2026-08-28', '2026-09-03', '2026-08-29')).toBe('2026-09-04')
  })
})

describe('sprintDurationLabel', () => {
  it('pluralizes multi-day ranges', () => {
    expect(sprintDurationLabel('2026-08-11', '2026-08-17')).toBe('7 days')
  })

  it('does not pluralize a single-day range', () => {
    expect(sprintDurationLabel('2026-08-11', '2026-08-11')).toBe('1 day')
  })

  it('returns null when the end date is before the start date', () => {
    expect(sprintDurationLabel('2026-08-17', '2026-08-11')).toBeNull()
  })

  it('returns null when either date is missing', () => {
    expect(sprintDurationLabel('', '2026-08-17')).toBeNull()
    expect(sprintDurationLabel('2026-08-11', '')).toBeNull()
    expect(sprintDurationLabel('', '')).toBeNull()
  })
})

describe('initialSprintStatus', () => {
  it('starts active when the range contains today', () => {
    expect(initialSprintStatus('2026-08-08', '2026-08-15', '2026-08-11')).toBe('active')
  })

  it('starts planned when the range is wholly in the future', () => {
    expect(initialSprintStatus('2026-08-18', '2026-08-25', '2026-08-11')).toBe('planned')
  })

  it('starts done when the range is wholly in the past', () => {
    expect(initialSprintStatus('2026-07-01', '2026-07-08', '2026-08-11')).toBe('done')
  })

  it('starts active for a single-day sprint today', () => {
    expect(initialSprintStatus('2026-08-11', '2026-08-11', '2026-08-11')).toBe('active')
  })

  it('starts active on the boundary where today equals the start date', () => {
    expect(initialSprintStatus('2026-08-11', '2026-08-18', '2026-08-11')).toBe('active')
  })

  it('starts active on the boundary where today equals the end date', () => {
    expect(initialSprintStatus('2026-08-04', '2026-08-11', '2026-08-11')).toBe('active')
  })
})

describe('isSprintRunningNow', () => {
  it('includes a sprint whose status is already active, regardless of dates', () => {
    expect(isSprintRunningNow('active', '2026-01-01', '2026-01-08', '2026-08-11')).toBe(true)
  })

  it('includes a planned sprint whose range contains today', () => {
    expect(isSprintRunningNow('planned', '2026-08-08', '2026-08-15', '2026-08-11')).toBe(true)
  })

  it('excludes a planned sprint whose range is wholly in the future', () => {
    expect(isSprintRunningNow('planned', '2026-08-18', '2026-08-25', '2026-08-11')).toBe(false)
  })

  it('excludes a done sprint even if its range contains today', () => {
    expect(isSprintRunningNow('done', '2026-08-08', '2026-08-15', '2026-08-11')).toBe(false)
  })
})

describe('addCalendarDays', () => {
  it('adds within a month', () => expect(addCalendarDays('2026-08-12', 3)).toBe('2026-08-15'))
  it('subtracts across a month boundary', () =>
    expect(addCalendarDays('2026-08-01', -1)).toBe('2026-07-31'))
  it('crosses a year boundary', () =>
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01'))
  it('handles a leap day', () => expect(addCalendarDays('2028-02-28', 1)).toBe('2028-02-29'))
  it('is a no-op at zero', () => expect(addCalendarDays('2026-08-12', 0)).toBe('2026-08-12'))
})

describe('dayDelta', () => {
  it('is 0 for the same day', () => expect(dayDelta('2026-08-12', '2026-08-12')).toBe(0))
  it('is positive forwards', () => expect(dayDelta('2026-08-12', '2026-08-15')).toBe(3))
  it('is negative backwards', () => expect(dayDelta('2026-08-15', '2026-08-12')).toBe(-3))
  it('counts across a DST-shifting month without drifting', () =>
    // The whole point of the UTC round trip: a naive local-Date subtraction
    // over a DST boundary yields 30.958… days and rounds wrong.
    expect(dayDelta('2026-03-01', '2026-04-01')).toBe(31))
  it('round-trips with addCalendarDays', () =>
    expect(addCalendarDays('2026-08-12', dayDelta('2026-08-12', '2026-11-03'))).toBe('2026-11-03'))
})

describe('inclusiveDayCount', () => {
  it('counts a single day as 1', () =>
    expect(inclusiveDayCount('2026-08-12', '2026-08-12')).toBe(1))
  it('counts a week as 7', () => expect(inclusiveDayCount('2026-08-10', '2026-08-16')).toBe(7))
  it('goes non-positive on an inverted range', () =>
    expect(inclusiveDayCount('2026-08-16', '2026-08-10')).toBeLessThan(1))
})

describe('moveSprintRange', () => {
  it('slides both ends and keeps the duration', () => {
    const moved = moveSprintRange('2026-08-10', '2026-08-16', 5)
    expect(moved).toEqual({ startDate: '2026-08-15', endDate: '2026-08-21' })
    expect(inclusiveDayCount(moved.startDate, moved.endDate)).toBe(7)
  })
  it('slides backwards', () =>
    expect(moveSprintRange('2026-08-10', '2026-08-16', -10)).toEqual({
      startDate: '2026-07-31',
      endDate: '2026-08-06',
    }))
  it('is identity at zero, so a no-op drag writes nothing', () =>
    expect(moveSprintRange('2026-08-10', '2026-08-16', 0)).toEqual({
      startDate: '2026-08-10',
      endDate: '2026-08-16',
    }))
})

describe('resizeSprintStart', () => {
  it('moves the start and leaves the end alone', () =>
    expect(resizeSprintStart('2026-08-10', '2026-08-16', -3)).toEqual({
      startDate: '2026-08-07',
      endDate: '2026-08-16',
    }))
  it('clamps at the end date rather than inverting the sprint', () =>
    expect(resizeSprintStart('2026-08-10', '2026-08-16', 50)).toEqual({
      startDate: '2026-08-16',
      endDate: '2026-08-16',
    }))
  it('allows a one-day sprint exactly at the clamp', () =>
    expect(resizeSprintStart('2026-08-10', '2026-08-16', 6).startDate).toBe('2026-08-16'))
})

describe('resizeSprintEnd', () => {
  it('moves the end and leaves the start alone', () =>
    expect(resizeSprintEnd('2026-08-10', '2026-08-16', 4)).toEqual({
      startDate: '2026-08-10',
      endDate: '2026-08-20',
    }))
  it('clamps at the start date rather than inverting the sprint', () =>
    expect(resizeSprintEnd('2026-08-10', '2026-08-16', -50)).toEqual({
      startDate: '2026-08-10',
      endDate: '2026-08-10',
    }))
  it('never produces a range createSprint would reject', () => {
    for (const delta of [-100, -7, -1, 0, 1, 100]) {
      const range = resizeSprintEnd('2026-08-10', '2026-08-16', delta)
      expect(range.endDate >= range.startDate).toBe(true)
    }
  })
})
