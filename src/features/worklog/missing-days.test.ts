import { describe, expect, it } from 'vitest'
import { MAX_BACKFILL_DAYS, isRequiredWorkDay, missingWorkDays } from './missing-days'

// 2026-08-13 is a Thursday. 2026-08-15/16 are Sat/Sun.
const THURSDAY = '2026-08-13'

describe('isRequiredWorkDay', () => {
  it('requires an ordinary weekday', () => {
    expect(isRequiredWorkDay('2026-08-13')).toBe(true)
  })

  it('requires Saturday — it is a half working day here, not a day off', () => {
    expect(isRequiredWorkDay('2026-08-15')).toBe(true)
  })

  it('does not require Sunday', () => {
    expect(isRequiredWorkDay('2026-08-16')).toBe(false)
  })

  it('lets a holiday win over Saturday — a Saturday Poya day is not a half day', () => {
    const holiday = (iso: string) => iso === '2026-08-15'
    expect(isRequiredWorkDay('2026-08-15', holiday)).toBe(false)
  })

  it('does not require a gazetted holiday', () => {
    // Whatever the map holds, a listed holiday must never be required —
    // otherwise the backlog goes permanently red after every Poya day.
    const holiday = (iso: string) => iso === '2026-08-13'
    expect(isRequiredWorkDay('2026-08-13', holiday)).toBe(false)
  })

  it('does not require a mercantile holiday even with no callback passed', () => {
    // The default is the mercantile rule, so a caller that passes nothing
    // still gets the days the office is actually shut. 2026-05-01 is Vesak.
    expect(isRequiredWorkDay('2026-05-01')).toBe(false)
  })

  it('DOES require the bank closing days — gazetted is not the same as off', () => {
    // Both are in LK_HOLIDAYS and neither is on the mercantile list; the banks
    // shut, this studio does not. Asking for the log is correct.
    expect(isRequiredWorkDay('2026-06-30')).toBe(true)
    expect(isRequiredWorkDay('2026-12-31')).toBe(true)
  })
})

describe('missingWorkDays', () => {
  it('is empty when every required day is logged', () => {
    const missing = missingWorkDays({
      today: THURSDAY,
      joinedOn: '2026-08-10',
      logged: new Set(['2026-08-10', '2026-08-11', '2026-08-12']),
    })
    expect(missing).toEqual([])
  })

  it('excludes today — a day is not missed until it is over', () => {
    const missing = missingWorkDays({
      today: THURSDAY,
      joinedOn: '2026-08-10',
      logged: new Set(['2026-08-10', '2026-08-11', '2026-08-12']),
    })
    expect(missing).not.toContain(THURSDAY)
  })

  it('lists unlogged weekdays, oldest first', () => {
    const missing = missingWorkDays({
      today: THURSDAY,
      joinedOn: '2026-08-10',
      logged: new Set(['2026-08-11']),
    })
    expect(missing).toEqual(['2026-08-10', '2026-08-12'])
  })

  it('skips Sunday but keeps Saturday', () => {
    // Mon 2026-08-17 back through the weekend to Fri 2026-08-14. Saturday
    // the 15th is a half working day and still owes a log; Sunday does not.
    const missing = missingWorkDays({
      today: '2026-08-17',
      joinedOn: '2026-08-14',
      logged: new Set(),
    })
    expect(missing).toEqual(['2026-08-14', '2026-08-15'])
  })

  it('never asks for days before the person joined', () => {
    const missing = missingWorkDays({
      today: THURSDAY,
      joinedOn: '2026-08-12',
      logged: new Set(),
    })
    expect(missing).toEqual(['2026-08-12'])
  })

  it('caps the window so someone back from leave is not buried', () => {
    const missing = missingWorkDays({
      today: THURSDAY,
      joinedOn: '2020-01-01',
      logged: new Set(),
    })
    expect(missing.length).toBeLessThanOrEqual(MAX_BACKFILL_DAYS)
  })

  it('returns nothing for someone who joined today', () => {
    expect(missingWorkDays({ today: THURSDAY, joinedOn: THURSDAY, logged: new Set() })).toEqual([])
  })
})
