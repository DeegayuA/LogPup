import { beforeEach, describe, expect, it, vi } from 'vitest'
import { absences, assignments } from '@/db/schema'
import type { Actor } from '@/features/auth/capabilities'

// Same mock shape as absence-queries.test.ts: rows keyed by table, every
// query-builder method a passthrough, `.where()`'s own argument ignored by
// the stub (the overlap-predicate test below asserts on the REAL drizzle-orm
// operators instead, via the spies wired up in the mock below).
const { selectRows } = vi.hoisted(() => ({ selectRows: new Map<unknown, unknown[]>() }))

vi.mock('@/db', () => {
  function builder(table: unknown) {
    const rows = () => selectRows.get(table) ?? []
    const self: Record<string, unknown> = {}
    for (const method of ['innerJoin', 'where', 'orderBy', 'limit']) self[method] = () => self
    self.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows()).then(resolve, reject)
    return self
  }
  return { db: { select: () => ({ from: (table: unknown) => builder(table) }) } }
})

// getOrgHolidayDays is real code in worklog/queries.ts (not edited, not
// re-implemented here) but it touches `@/db` for a table this file's mock
// above knows nothing about, so it is mocked at the boundary this module
// calls it through — loadAbsenceCalendar's own contract is just "compose the
// two reads", which this checks without needing a third table in the db mock.
vi.mock('@/features/worklog/queries', () => ({
  getOrgHolidayDays: vi.fn(async () => ['2026-09-15']),
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return { ...actual, lte: vi.fn(actual.lte), gte: vi.fn(actual.gte) }
})

const { listAbsencesForRange, loadAbsenceCalendar } = await import('./absence-calendar-queries')
const { lte, gte } = await import('drizzle-orm')

const manager = (id = 'mgr-1', scopeAppIds: string[] = ['app-1']): Actor => ({
  id,
  role: 'manager',
  scopeAppIds: new Set(scopeAppIds),
})
const admin = (id = 'admin-1'): Actor => ({ id, role: 'admin', scopeAppIds: new Set() })
const superadmin = (id = 'super-1'): Actor => ({ id, role: 'superadmin', scopeAppIds: new Set() })
const stakeholder = (id = 'stake-1'): Actor => ({ id, role: 'stakeholder', scopeAppIds: new Set() })

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'absence-1',
  userId: 'person-1',
  userName: 'Person One',
  kind: 'annual',
  status: 'approved',
  startDate: '2026-09-05',
  endDate: '2026-09-05',
  reason: null,
  ...overrides,
})

beforeEach(() => {
  selectRows.clear()
  vi.clearAllMocks()
})

describe('listAbsencesForRange', () => {
  it('asks the overlap predicate on both bounds, inclusive — startDate<=to, endDate>=from', async () => {
    selectRows.set(absences, [row()])
    await listAbsencesForRange(admin(), '2026-09-01', '2026-09-30')

    expect(lte).toHaveBeenCalledWith(absences.startDate, '2026-09-30')
    expect(gte).toHaveBeenCalledWith(absences.endDate, '2026-09-01')
  })

  it('is view-gated the same as listRecentAbsences — a stakeholder sees nothing', async () => {
    selectRows.set(absences, [row()])
    const result = await listAbsencesForRange(stakeholder(), '2026-09-01', '2026-09-30')
    expect(result).toEqual([])
  })

  it('refuses canReview for a manager whose scope does not cover the absent person’s apps', async () => {
    selectRows.set(absences, [row({ userId: 'person-1' })])
    selectRows.set(assignments, [{ userId: 'person-1', appId: 'app-2' }])

    const result = await listAbsencesForRange(manager('mgr-1', ['app-1']), '2026-09-01', '2026-09-30')

    expect(result).toHaveLength(1)
    expect(result[0].canReview).toBe(false)
  })

  it('grants canReview for a manager whose scope covers the absent person’s app', async () => {
    selectRows.set(absences, [row({ userId: 'person-1' })])
    selectRows.set(assignments, [{ userId: 'person-1', appId: 'app-1' }])

    const result = await listAbsencesForRange(manager('mgr-1', ['app-1']), '2026-09-01', '2026-09-30')

    expect(result[0].canReview).toBe(true)
  })

  it('grants canReview to admin with no per-row app check at all', async () => {
    selectRows.set(absences, [row({ userId: 'person-1' })])
    // No assignments row set — admin must not need one to be trusted.
    const result = await listAbsencesForRange(admin(), '2026-09-01', '2026-09-30')
    expect(result[0].canReview).toBe(true)
  })

  it('routes a self row through request.review.self, not canReviewAbsence', async () => {
    selectRows.set(absences, [row({ userId: 'super-1' })])
    const asSuperadmin = await listAbsencesForRange(superadmin('super-1'), '2026-09-01', '2026-09-30')
    expect(asSuperadmin[0].canReview).toBe(true) // request.review.self is 'own' for superadmin

    selectRows.set(absences, [row({ userId: 'mgr-1' })])
    const asManager = await listAbsencesForRange(manager('mgr-1'), '2026-09-01', '2026-09-30')
    expect(asManager[0].canReview).toBe(false) // 'none' for manager — nobody reviews their own
  })
})

describe('loadAbsenceCalendar', () => {
  it('reads absences and org holiday days in one round trip', async () => {
    selectRows.set(absences, [row()])
    const result = await loadAbsenceCalendar(admin(), '2026-09-01', '2026-09-30')
    expect(result.rows).toHaveLength(1)
    expect(result.orgHolidayDays).toEqual(['2026-09-15'])
  })
})
