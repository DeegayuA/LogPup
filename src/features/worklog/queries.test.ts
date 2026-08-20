import { beforeEach, describe, expect, it, vi } from 'vitest'

// getOrgHolidayDays is one `select(...).from(orgHolidays).where(...)`, awaited
// on .where() directly. The mock only has to hand back the rows that query
// would have returned — the point of these tests is what the function does
// with `revoked_from` AFTER the read, which is where the bug was.
let rows: { day: string; revokedFrom: string | null }[] = []
let selected: Record<string, unknown> = {}

vi.mock('@/db', () => ({
  db: {
    select: (columns: Record<string, unknown>) => {
      selected = columns
      return { from: () => ({ where: async () => rows }) }
    },
  },
}))

const { getOrgHolidayDays } = await import('./queries')

beforeEach(() => {
  rows = []
  selected = {}
})

// org_holidays is REVOKED, NOT DELETED, and revocation does not reach
// backwards (see the comment on the table in src/db/schema.ts and the pure
// rule in org-holidays.ts). This read used to select `day` alone, which threw
// that rule away: /worklog's catch-up panel went on exempting days from
// shutdowns that had been called off, while getCoverage — reading the same
// table through orgHolidaySet — counted those same days owed. Same person,
// same days, two different denominators.
describe('getOrgHolidayDays', () => {
  it('reads revoked_from at all — selecting `day` alone is the bug', async () => {
    await getOrgHolidayDays('2026-01-01', '2026-12-31')
    expect(Object.keys(selected)).toContain('revokedFrom')
  })

  it('keeps a shutdown that was never called off', async () => {
    rows = [{ day: '2026-04-14', revokedFrom: null }]
    expect(await getOrgHolidayDays('2026-01-01', '2026-12-31')).toEqual(['2026-04-14'])
  })

  it('drops a shutdown cancelled before it happened', async () => {
    rows = [{ day: '2026-12-24', revokedFrom: '2026-12-01' }]
    expect(await getOrgHolidayDays('2026-01-01', '2026-12-31')).toEqual([])
  })

  // The half that protects people: you can call off a shutdown that has not
  // happened yet, but you cannot un-hold one people already took.
  it('keeps a day people already took, even after the shutdown was cancelled', async () => {
    rows = [{ day: '2026-04-14', revokedFrom: '2026-06-01' }]
    expect(await getOrgHolidayDays('2026-01-01', '2026-12-31')).toEqual(['2026-04-14'])
  })

  // Strict `<`: cancelling on the morning of the shutdown calls off that day
  // too, which is what an operator means by cancelling something today.
  it('drops the day when the cancellation lands on it', async () => {
    rows = [{ day: '2026-04-14', revokedFrom: '2026-04-14' }]
    expect(await getOrgHolidayDays('2026-01-01', '2026-12-31')).toEqual([])
  })

  it('agrees with getCoverage row for row, which is the whole point', async () => {
    const { orgHolidaySet } = await import('./org-holidays')
    rows = [
      { day: '2026-04-13', revokedFrom: null },
      { day: '2026-04-14', revokedFrom: '2026-06-01' },
      { day: '2026-12-24', revokedFrom: '2026-12-01' },
    ]
    const panel = new Set(await getOrgHolidayDays('2026-01-01', '2026-12-31'))
    const coverage = orgHolidaySet(rows)
    expect([...panel].sort()).toEqual([...coverage].sort())
  })
})
