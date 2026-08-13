import { describe, expect, it } from 'vitest'
import { MAX_BACKFILL_DAYS, isRequiredWorkDay, missingWorkDays } from './missing-days'

// 2026-08-13 is a Thursday. 2026-08-15/16 are Sat/Sun.
const THURSDAY = '2026-08-13'

describe('isRequiredWorkDay', () => {
  it('requires an ordinary weekday', () => {
    expect(isRequiredWorkDay('2026-08-13')).toBe(true)
  })

  it('does not require Saturday or Sunday', () => {
    expect(isRequiredWorkDay('2026-08-15')).toBe(false)
    expect(isRequiredWorkDay('2026-08-16')).toBe(false)
  })

  it('does not require a gazetted holiday', () => {
    // Whatever the map holds, a listed holiday must never be required —
    // otherwise the backlog goes permanently red after every Poya day.
    const holiday = (iso: string) => iso === '2026-08-13'
    expect(isRequiredWorkDay('2026-08-13', holiday)).toBe(false)
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

  it('skips weekends', () => {
    // Mon 2026-08-17 back through the weekend to Fri 2026-08-14.
    const missing = missingWorkDays({
      today: '2026-08-17',
      joinedOn: '2026-08-14',
      logged: new Set(),
    })
    expect(missing).toEqual(['2026-08-14'])
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
