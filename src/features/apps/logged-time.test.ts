import { describe, expect, it } from 'vitest'

import { MONTH_PATTERN, groupLoggedTime, monthLabel, monthRange, shiftMonth } from './logged-time'

const row = (appId: string, userId: string, minutes: number, name = userId) => ({
  appId,
  userId,
  name,
  avatarUrl: null,
  minutes,
})

describe('groupLoggedTime', () => {
  it('groups per app, one entry per person', () => {
    const byApp = groupLoggedTime([row('a', 'u1', 120), row('a', 'u2', 30), row('b', 'u1', 60)])
    expect(byApp.get('a')?.map((p) => [p.userId, p.minutes])).toEqual([
      ['u1', 120],
      ['u2', 30],
    ])
    expect(byApp.get('b')?.map((p) => p.userId)).toEqual(['u1'])
  })

  it('lists the person with the most time first, ties by name', () => {
    const byApp = groupLoggedTime([
      row('a', 'u1', 60, 'Zara'),
      row('a', 'u2', 300, 'Irushi'),
      row('a', 'u3', 60, 'Amal'),
    ])
    expect(byApp.get('a')?.map((p) => p.name)).toEqual(['Irushi', 'Amal', 'Zara'])
  })

  it('drops rows that would print as "0h", and null-app rows', () => {
    const byApp = groupLoggedTime([
      row('a', 'u1', 0),
      row('a', 'u2', 2),
      { ...row('a', 'u3', 90), appId: null },
    ])
    expect(byApp.size).toBe(0)
  })

  it('has no entry for an app nobody logged time on', () => {
    expect(groupLoggedTime([]).get('a')).toBeUndefined()
  })

  it('keeps only the rows the viewer may see', () => {
    // A member: worklog.view is 'own', so only their own row survives.
    const byApp = groupLoggedTime(
      [row('a', 'me', 120), row('a', 'other', 300), row('b', 'other', 60)],
      (r) => r.userId === 'me',
    )
    expect(byApp.get('a')?.map((p) => p.userId)).toEqual(['me'])
    expect(byApp.has('b')).toBe(false)
  })
})

describe('month helpers', () => {
  it('gives an end-exclusive day range, across a year boundary', () => {
    expect(monthRange('2026-10')).toEqual({ start: '2026-10-01', end: '2026-11-01' })
    expect(monthRange('2026-12')).toEqual({ start: '2026-12-01', end: '2027-01-01' })
  })

  it('shifts months both ways across years', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-10', 0)).toBe('2026-10')
  })

  it('names the month and year', () => {
    expect(monthLabel('2026-10')).toBe('October 2026')
    expect(monthLabel('2026-10', 'short')).toBe('Oct 2026')
  })

  it('validates the YYYY-MM shape', () => {
    expect(MONTH_PATTERN.test('2026-10')).toBe(true)
    expect(MONTH_PATTERN.test('2026-13')).toBe(false)
    expect(MONTH_PATTERN.test('2026-1')).toBe(false)
  })
})
