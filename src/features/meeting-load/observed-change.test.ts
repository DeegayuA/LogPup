import { describe, expect, it } from 'vitest'
import { observedChangeFor } from './observed-change'

const weeks = (...hours: number[]) =>
  hours.map((h, i) => ({ weekStartIso: `2026-0${i + 1}-05`, hours: h }))

const DECIDED = new Date('2026-08-21T09:00:00Z')

describe('observedChangeFor', () => {
  it('averages each side and reports the difference', () => {
    // AVERAGE, not sum: summing a weekly rate into a total is exactly how the
    // rejected "hours saved to date" figure inflated.
    const result = observedChangeFor({
      decidedAt: DECIDED,
      beforeWeeklyHours: weeks(10, 10, 10, 10),
      afterWeeklyHours: weeks(6, 6, 6, 6),
    })
    expect(result).toEqual({
      status: 'measured', beforeAvgHours: 10, afterAvgHours: 6, deltaHours: -4,
    })
  })

  it('reports an increase as-is rather than clamping it away', () => {
    // The ledger holds the feature accountable, so it has to be able to say the
    // decision made things worse.
    const result = observedChangeFor({
      decidedAt: DECIDED,
      beforeWeeklyHours: weeks(4, 4, 4, 4),
      afterWeeklyHours: weeks(9, 9, 9, 9),
    })
    expect(result).toEqual({
      status: 'measured', beforeAvgHours: 4, afterAvgHours: 9, deltaHours: 5,
    })
  })

  it('says no-data-yet when the series has not met since', () => {
    // Never a fabricated zero: "no occurrences yet" and "the same load as
    // before" are different facts, and the second would credit a decision that
    // has not been tested.
    expect(observedChangeFor({
      decidedAt: DECIDED,
      beforeWeeklyHours: weeks(10, 10, 10, 10),
      afterWeeklyHours: weeks(0, 0, 0, 0),
    })).toEqual({ status: 'no-data-yet' })

    expect(observedChangeFor({
      decidedAt: DECIDED, beforeWeeklyHours: weeks(10), afterWeeklyHours: [],
    })).toEqual({ status: 'no-data-yet' })
  })

  it('measures against a zero before-average without dividing by zero', () => {
    const result = observedChangeFor({
      decidedAt: DECIDED, beforeWeeklyHours: [], afterWeeklyHours: weeks(3, 3),
    })
    expect(result).toEqual({
      status: 'measured', beforeAvgHours: 0, afterAvgHours: 3, deltaHours: 3,
    })
  })
})
