import { describe, expect, it } from 'vitest'
import { buildHolidayCalendar, splitByDay } from '@/features/worklog/holiday-listing'
import { LK_HOLIDAYS } from '@/lib/lk-holidays'
import type { OrgHolidayRow } from '@/features/worklog/org-holiday-queries'

const gazette = {
  '2026-04-14': { name: 'Sinhala and Tamil New Year Day', categories: ['public', 'bank', 'mercantile'] as const },
  '2026-05-01': { name: 'Vesak Full Moon Poya Day', categories: ['public', 'bank', 'mercantile', 'poya'] as const },
}

function orgRow(overrides: Partial<OrgHolidayRow> & Pick<OrgHolidayRow, 'id' | 'day' | 'name'>): OrgHolidayRow {
  return {
    note: null,
    createdByName: null,
    revokedFrom: null,
    ...overrides,
  }
}

describe('buildHolidayCalendar', () => {
  it('lists gazetted days the page never used to show, alongside company ones', () => {
    const rows = buildHolidayCalendar(
      [orgRow({ id: 'a', day: '2026-04-20', name: 'Studio shutdown' })],
      gazette as never,
    )
    expect(rows.map((r) => [r.day, r.source])).toEqual([
      ['2026-04-14', 'gazette'],
      ['2026-04-20', 'company'],
      ['2026-05-01', 'gazette'],
    ])
  })

  it('keeps both records on a shared date, gazetted first', () => {
    // The add form warns that adding a company holiday on a gazetted day will
    // "show as a duplicate in the list below" — that promise only holds if
    // both rows survive the merge.
    const rows = buildHolidayCalendar(
      [orgRow({ id: 'a', day: '2026-05-01', name: 'Extra day off' })],
      gazette as never,
    )
    expect(rows.filter((r) => r.day === '2026-05-01').map((r) => r.source)).toEqual([
      'gazette',
      'company',
    ])
  })

  it('carries the gazette categories through, and gives company rows none', () => {
    const rows = buildHolidayCalendar(
      [orgRow({ id: 'a', day: '2026-05-01', name: 'Extra day off' })],
      gazette as never,
    )
    const [gazetted, company] = rows.filter((r) => r.day === '2026-05-01')
    expect(gazetted.categories).toEqual(['public', 'bank', 'mercantile', 'poya'])
    // A studio shutdown is not gazetted as anything; claiming 'public' here
    // would be a claim about the law.
    expect(company.categories).toEqual([])
  })

  it('keeps a revoked company holiday in the list, marked', () => {
    const rows = buildHolidayCalendar(
      [orgRow({ id: 'a', day: '2026-06-02', name: 'Cancelled shutdown', revokedFrom: '2026-05-20' })],
      gazette as never,
    )
    expect(rows.find((r) => r.orgId === 'a')?.revokedFrom).toBe('2026-05-20')
  })

  it('defaults to the real gazetted calendar', () => {
    const rows = buildHolidayCalendar([])
    expect(rows).toHaveLength(Object.keys(LK_HOLIDAYS).length)
    expect(rows.every((r) => r.source === 'gazette')).toBe(true)
    // Sorted, so the page can render straight from it.
    expect([...rows].sort((a, b) => (a.day < b.day ? -1 : 1))).toEqual(rows)
  })
})

describe('splitByDay', () => {
  const rows = buildHolidayCalendar(
    [orgRow({ id: 'a', day: '2026-04-20', name: 'Studio shutdown' })],
    gazette as never,
  )

  it('counts today as upcoming — a day off you are having has not passed', () => {
    expect(splitByDay(rows, '2026-04-20').upcoming.map((r) => r.day)).toEqual([
      '2026-04-20',
      '2026-05-01',
    ])
  })

  it('returns past days newest first', () => {
    expect(splitByDay(rows, '2026-06-01').past.map((r) => r.day)).toEqual([
      '2026-05-01',
      '2026-04-20',
      '2026-04-14',
    ])
  })
})
