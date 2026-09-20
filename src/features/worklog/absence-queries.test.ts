import { beforeEach, describe, expect, it, vi } from 'vitest'
import { absences, assignments } from '@/db/schema'
import type { Actor } from '@/features/auth/capabilities'

// listPendingAbsences used to gate on `can(actor, 'absence.approve', {
// appId: null })`, and absence.approve is 'scoped' for manager — a scoped
// grant asked with no resource always fails closed, so every manager got []
// regardless of who they actually manage. The fix asks the SEAT question
// (effectiveGrant) for the door, then scopes each row against the absent
// PERSON's own apps (assignments), which this mock keys by table the same
// way task-actions.test.ts does.
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

const { listPendingAbsences, canReviewAbsence } = await import('./absence-queries')

const manager = (id = 'mgr-1', scopeAppIds: string[] = ['app-1']): Actor => ({
  id,
  role: 'manager',
  scopeAppIds: new Set(scopeAppIds),
})
const admin = (id = 'admin-1'): Actor => ({ id, role: 'admin', scopeAppIds: new Set() })

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'absence-1',
  userId: 'person-1',
  userName: 'Person One',
  kind: 'vacation',
  status: 'pending',
  startDate: '2026-09-20',
  endDate: '2026-09-20',
  reason: null,
  ...overrides,
})

beforeEach(() => {
  selectRows.clear()
})

describe('listPendingAbsences', () => {
  it('gives a manager the pending absences of someone on an app they run (scoped)', async () => {
    selectRows.set(absences, [row({ userId: 'person-1' })])
    selectRows.set(assignments, [{ userId: 'person-1', appId: 'app-1' }])

    const result = await listPendingAbsences(manager('mgr-1'))

    expect(result.map((r) => r.id)).toEqual(['absence-1'])
  })

  it('hides a pending absence for someone on a different app', async () => {
    selectRows.set(absences, [row({ userId: 'person-1' })])
    selectRows.set(assignments, [{ userId: 'person-1', appId: 'app-2' }])

    const result = await listPendingAbsences(manager('mgr-1'))

    expect(result).toEqual([])
  })

  it('gives admin every pending absence with no per-row app check', async () => {
    selectRows.set(absences, [row({ userId: 'person-1' }), row({ id: 'absence-2', userId: 'person-2' })])

    const result = await listPendingAbsences(admin())

    expect(result.map((r) => r.id)).toEqual(['absence-1', 'absence-2'])
  })

  it('excludes a manager’s own pending absence — nobody reviews their own', async () => {
    selectRows.set(absences, [row({ userId: 'mgr-1' })])
    selectRows.set(assignments, [{ userId: 'mgr-1', appId: 'app-1' }])

    const result = await listPendingAbsences(manager('mgr-1'))

    expect(result).toEqual([])
  })
})

// canReviewAbsence is what listPendingAbsences' filter above and review() in
// absence-actions.ts both call — the bug being fixed is that they used to ask
// two DIFFERENT questions (this filter scoped against the absent person's own
// apps; review() asked `can()` with no appId at all, which 'scoped' always
// refuses), so a manager's approval dead-ended right after the list showed
// them the row. Real `can`/`effectiveGrant` here, not the mocked module —
// this is the actual scoping logic the fix depends on.
describe('canReviewAbsence', () => {
  it('lets a scoped manager review a row on an app they run', () => {
    const actor = manager('mgr-1', ['app-1'])
    expect(canReviewAbsence(actor, { userId: 'person-1', appIds: ['app-1'] })).toBe(true)
  })

  it('refuses a manager scoped to a different app', () => {
    const actor = manager('mgr-1', ['app-1'])
    expect(canReviewAbsence(actor, { userId: 'person-1', appIds: ['app-2'] })).toBe(false)
  })

  it('lets admin through with no appIds at all — absence.approve is "all" for admin', () => {
    expect(canReviewAbsence(admin(), { userId: 'person-1', appIds: [] })).toBe(true)
  })

  it('refuses outright when the target is the actor themselves, regardless of scope', () => {
    const actor = manager('mgr-1', ['app-1'])
    expect(canReviewAbsence(actor, { userId: 'mgr-1', appIds: ['app-1'] })).toBe(false)
  })
})
