import { describe, expect, it } from 'vitest'

import { absenceDays } from './absence-days'

const range = (startDate: string, endDate: string) => ({ startDate, endDate })

describe('absenceDays', () => {
  it('includes both stated ends — the dates a person wrote down are days off', () => {
    const days = absenceDays([range('2026-08-17', '2026-08-19')], '2026-08-01', '2026-09-01')
    expect([...days].sort()).toEqual(['2026-08-17', '2026-08-18', '2026-08-19'])
  })

  it('treats the window as half-open, so the `to` day itself is outside', () => {
    const days = absenceDays([range('2026-08-19', '2026-08-25')], '2026-08-01', '2026-08-21')
    expect(days.has('2026-08-20')).toBe(true)
    expect(days.has('2026-08-21')).toBe(false)
  })

  it('clips an absence that started before the window without losing its tail', () => {
    const days = absenceDays([range('2026-07-28', '2026-08-02')], '2026-08-01', '2026-09-01')
    expect([...days].sort()).toEqual(['2026-08-01', '2026-08-02'])
  })

  it('returns nothing for an absence wholly outside the window', () => {
    expect(absenceDays([range('2026-06-01', '2026-06-05')], '2026-08-01', '2026-09-01').size).toBe(0)
  })

  it('merges overlapping absences instead of double-counting a day', () => {
    const days = absenceDays(
      [range('2026-08-17', '2026-08-19'), range('2026-08-18', '2026-08-20')],
      '2026-08-01',
      '2026-09-01',
    )
    expect(days.size).toBe(4)
  })

  it('crosses a month boundary — the walk is day arithmetic, not string maths', () => {
    const days = absenceDays([range('2026-08-30', '2026-09-02')], '2026-08-01', '2026-10-01')
    expect([...days].sort()).toEqual(['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02'])
  })

  it('handles a single-day absence', () => {
    const days = absenceDays([range('2026-08-20', '2026-08-20')], '2026-08-01', '2026-09-01')
    expect([...days]).toEqual(['2026-08-20'])
  })

  it('ignores a backwards range rather than looping forever', () => {
    expect(absenceDays([range('2026-08-20', '2026-08-18')], '2026-08-01', '2026-09-01').size).toBe(0)
  })
})
