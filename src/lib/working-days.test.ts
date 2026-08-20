import { describe, expect, it } from 'vitest'
import { isHalfWorkingDay, isWorkingDay, workingDayFraction } from './working-days'

/*
 * Weekdays used below, all 2026 (Asia/Colombo):
 *   06-30 Tue  Bank Half-Year Closing — gazetted, bank only
 *   12-31 Thu  Bank Annual Closing    — gazetted, bank only
 *   01-01 Thu  New Year's Day         — bank AND mercantile
 *   05-01 Fri  Vesak                  — public, bank, mercantile, poya
 *   06-29 Mon  Poson Poya             — mercantile today (derived from public)
 *   08-15 Sat  ordinary Saturday      08-16 Sun  ordinary Sunday
 */

describe('workingDayFraction', () => {
  it('is a whole day Monday to Friday, half on Saturday, none on Sunday', () => {
    expect(workingDayFraction('2026-08-13')).toBe(1)
    expect(workingDayFraction('2026-08-15')).toBe(0.5)
    expect(workingDayFraction('2026-08-16')).toBe(0)
  })

  it('WORKS the bank-only closing days — they shut the banks, not this office', () => {
    // The rule these pin: gazetted is not the same as off. Both dates are in
    // LK_HOLIDAYS and both are ordinary working days here.
    expect(workingDayFraction('2026-06-30')).toBe(1)
    expect(workingDayFraction('2026-12-31')).toBe(1)
    expect(isWorkingDay('2026-06-30')).toBe(true)
    expect(isWorkingDay('2026-12-31')).toBe(true)
  })

  it('takes a mercantile holiday off, whether or not it is in the public gazette', () => {
    expect(workingDayFraction('2026-05-01')).toBe(0) // Vesak — all four lists
    // New Year's Day is not a gazetted PUBLIC holiday, but it is mercantile,
    // and mercantile is the only list that decides this.
    expect(workingDayFraction('2026-01-01')).toBe(0)
    expect(isWorkingDay('2026-01-01')).toBe(false)
  })

  it('takes a poya day off while it still carries mercantile', () => {
    // Today every 2026 poya derives 'mercantile' from 'public'. When someone
    // corrects that against the gazette this expectation flips — which is the
    // point: it is a data edit in lk-holidays.ts, not a change here.
    expect(workingDayFraction('2026-06-29')).toBe(0)
  })

  it('lets a holiday win over Saturday rather than halving it', () => {
    // A Saturday that excuses work is off, not half off — otherwise it lands
    // in everyone's backfill list as a day they never owed.
    expect(workingDayFraction('2026-08-15', (iso) => iso === '2026-08-15')).toBe(0)
    expect(isHalfWorkingDay('2026-08-15', (iso) => iso === '2026-08-15')).toBe(false)
  })

  it('lets a caller compose company holidays on top without losing the default', () => {
    // How coverage-queries.ts and /worklog build their predicate: the
    // mercantile rule OR an org_holidays day. A bank closing day only becomes
    // a day off if somebody records it as a company holiday.
    const withShutdown = (iso: string) => iso === '2026-06-30'
    expect(workingDayFraction('2026-06-30', withShutdown)).toBe(0)
    // ...and the callback fully replaces the default, so a caller that passes
    // one must include the gazetted rule itself or lose it.
    expect(workingDayFraction('2026-05-01', withShutdown)).toBe(1)
  })
})

describe('isHalfWorkingDay', () => {
  it('is true only for a Saturday nobody has excused', () => {
    expect(isHalfWorkingDay('2026-08-15')).toBe(true)
    expect(isHalfWorkingDay('2026-08-14')).toBe(false)
    expect(isHalfWorkingDay('2026-08-16')).toBe(false)
  })
})
