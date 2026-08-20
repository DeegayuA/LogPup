import { describe, expect, it } from 'vitest'
import { STUDIO_DEFAULT_PATTERN } from '@/features/worklog/schedules'
import {
  FULL_DAY_HOURS,
  allocatedHours,
  hoursForFraction,
  hoursLoad,
  weeklyCapacityHours,
} from './capacity-hours'

/** Someone on Mondays, Tuesdays and Wednesdays only. 24 hours. */
const PART_TIME: typeof STUDIO_DEFAULT_PATTERN = {
  mon: 1, tue: 1, wed: 1, thu: 0, fri: 0, sat: 0, sun: 0,
}

/** Signed off entirely — a pattern of zeros, which must not divide by zero. */
const NO_WEEK: typeof STUDIO_DEFAULT_PATTERN = {
  mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0,
}

describe('the studio week in hours', () => {
  it('is 44 hours: five whole days plus a half Saturday', () => {
    // The number the whole module rests on. If working-days.ts ever stops
    // making Saturday a half day, this fails here first — which is the point.
    expect(weeklyCapacityHours(STUDIO_DEFAULT_PATTERN)).toBe(44)
  })

  it('defaults to the studio week when nobody has a schedule row', () => {
    // work_schedules stays near-empty on purpose — a row exists only for
    // someone who deviates — so the default has to be the common path.
    expect(weeklyCapacityHours()).toBe(44)
  })

  it('follows a part-time pattern instead of assuming five days', () => {
    expect(weeklyCapacityHours(PART_TIME)).toBe(24)
  })

  it('keeps Saturday at half a day with no special case', () => {
    expect(hoursForFraction(1)).toBe(FULL_DAY_HOURS)
    expect(hoursForFraction(0.5)).toBe(4)
    expect(hoursForFraction(0)).toBe(0)
  })
})

describe('what a percentage is worth in hours', () => {
  it('is measured against the person’s OWN week, not a nominal one', () => {
    // The defect this module exists to fix: both are "50%", and they are not
    // the same amount of work.
    expect(allocatedHours(50, STUDIO_DEFAULT_PATTERN)).toBe(22)
    expect(allocatedHours(50, PART_TIME)).toBe(12)
  })

  it('holds the halves rather than rounding them away', () => {
    // 25% of 44 is 11 exactly; 30% is 13.2. Rounding to whole hours here would
    // make a day and a half look like a day.
    expect(allocatedHours(25)).toBe(11)
    expect(allocatedHours(30)).toBe(13.2)
  })
})

describe('a person’s load', () => {
  it('sums several projects into hours, and leaves the remainder', () => {
    const load = hoursLoad([50, 25])
    expect(load.allocated).toBe(33)
    expect(load.capacity).toBe(44)
    expect(load.remaining).toBe(11)
    expect(load.percent).toBe(75)
  })

  it('goes negative on remaining when somebody is overcommitted', () => {
    // Overcommitment has to be visible as a quantity rather than clamped to
    // zero: "17.6 hours over" is actionable, "at capacity" is not.
    const load = hoursLoad([80, 60])
    expect(load.allocated).toBe(61.6)
    expect(load.remaining).toBe(-17.6)
    expect(load.percent).toBe(140)
  })

  it('reports a part-timer at 100% as full, though it is half a full week', () => {
    // The argument for hours, stated as a test: 24 of 24 hours IS full. The
    // percentage keeps the existing 80/100 thresholds meaningful while the
    // hours say how much work that actually is.
    const load = hoursLoad([100], PART_TIME)
    expect(load.percent).toBe(100)
    expect(load.allocated).toBe(24)
    expect(load.capacity).toBe(24)
  })

  it('does not divide by zero for a week with no working days', () => {
    // Someone wholly on leave. NaN renders as a broken bar and Infinity paints
    // them permanently over capacity; 0% says "no commitment against no time".
    const load = hoursLoad([50], NO_WEEK)
    expect(load.capacity).toBe(0)
    expect(load.percent).toBe(0)
    expect(Number.isNaN(load.percent)).toBe(false)
  })

  it('is zero across the board for somebody with no assignments', () => {
    const load = hoursLoad([])
    expect(load.allocated).toBe(0)
    expect(load.remaining).toBe(44)
    expect(load.percent).toBe(0)
  })
})
