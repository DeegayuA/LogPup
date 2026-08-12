import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryBuilder } from 'drizzle-orm/pg-core'
import { sprints, tasks } from '@/db/schema'
import { liveSprints, liveTasks } from '@/db/live'

// deleteSprint is soft-delete (D3): the sprint row is marked deletedAt/
// deletedBy, never removed — and because that no longer fires the old
// ON DELETE SET NULL cascade, its live tasks are released back to the
// backlog explicitly, in the same db.batch. Same mocked-action idiom as
// src/features/admin/set-user-title.test.ts.
const { authMock, writeSpy, deleteSpy, logActivityMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  writeSpy: vi.fn(),
  deleteSpy: vi.fn(),
  logActivityMock: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/features/activity/log', () => ({ logActivity: logActivityMock }))

let sprintQueue: unknown[][] = []
let taskCountQueue: unknown[][] = []
let sprintReturningQueue: unknown[][] = []
let sprintInsertReturningQueue: unknown[][] = []

// Every `db.update(sprints).set({ status: 'done' }).where(<cond>)` demote
// call this test suite sees — captured so the "demote active siblings" tests
// below can render <cond> to real SQL (via QueryBuilder, connection-free,
// same technique as src/db/live.test.ts) and assert it actually excludes
// trashed sprints, not just simulate a happy-path result.
const demoteWhereConditions: unknown[] = []

// db.update(...).where(...) — WITHOUT a .returning() — must still be
// directly awaitable, because deleteSprint/createSprint/updateSprintStatus
// all hand it straight to db.batch() in their active-sprint branches. A
// thenable stands in for that.
function updateWhereResult(table: unknown, values: Record<string, unknown>, whereArg: unknown) {
  writeSpy(table, values)
  if (table === sprints && values.status === 'done') demoteWhereConditions.push(whereArg)
  const rows = table === sprints ? sprintReturningQueue.shift() ?? [] : []
  return {
    then(onFulfilled: (v: unknown) => unknown) {
      return Promise.resolve(undefined).then(onFulfilled)
    },
    returning: async () => rows,
  }
}

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        // deleteSprint's reads go through liveSprints/liveTasks (D4); its
        // writes below are still the raw sprints/tasks tables, which is
        // what writeSpy asserts against.
        where: async () => {
          if (table === liveSprints) return sprintQueue.shift() ?? []
          if (table === liveTasks) return taskCountQueue.shift() ?? []
          return []
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: (whereArg: unknown) => updateWhereResult(table, values, whereArg),
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        writeSpy(table, values)
        return {
          then(onFulfilled: (v: unknown) => unknown) {
            return Promise.resolve(undefined).then(onFulfilled)
          },
          returning: async () => (table === sprints ? sprintInsertReturningQueue.shift() ?? [] : []),
        }
      },
    }),
    batch: async (queries: unknown[]) => Promise.all(queries),
    delete: deleteSpy,
  },
}))

const { createSprint, deleteSprint, updateSprintStatus } = await import('./actions')

const SPRINT_ID = '33333333-3333-4333-8333-333333333333'

const asAdmin = () => authMock.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
const asMember = () => authMock.mockResolvedValue({ user: { id: 'member-1', role: 'member' } })

beforeEach(() => {
  authMock.mockReset()
  writeSpy.mockReset()
  deleteSpy.mockReset()
  logActivityMock.mockReset()
  sprintQueue = []
  taskCountQueue = []
  sprintReturningQueue = []
  sprintInsertReturningQueue = []
  demoteWhereConditions.length = 0
})

describe('deleteSprint', () => {
  it('rejects a non-admin caller and writes nothing', async () => {
    asMember()
    const res = await deleteSprint(SPRINT_ID)
    expect(res).toEqual({ ok: false, error: 'Admins only' })
    expect(writeSpy).not.toHaveBeenCalled()
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('a second delete of an already-trashed sprint returns err and logs no activity', async () => {
    asAdmin()
    sprintQueue = [[{ appId: 'app-1', name: 'Sprint 1' }]]
    taskCountQueue = [[{ total: 0 }]]
    // isNull(deletedAt) guard matched nothing — already trashed.
    sprintReturningQueue = [[]]

    const res = await deleteSprint(SPRINT_ID)

    expect(res).toEqual({ ok: false, error: 'Sprint not found' })
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('marks the sprint deleted and releases its live tasks to the backlog', async () => {
    asAdmin()
    sprintQueue = [[{ appId: 'app-1', name: 'Sprint 1' }]]
    taskCountQueue = [[{ total: 3 }]]
    sprintReturningQueue = [[{ id: SPRINT_ID }]]

    const res = await deleteSprint(SPRINT_ID)

    expect(res).toEqual({ ok: true, data: { releasedTasks: 3 } })
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(writeSpy).toHaveBeenCalledWith(
      sprints,
      expect.objectContaining({ deletedAt: expect.any(Date), deletedBy: 'admin-1' }),
    )
    expect(writeSpy).toHaveBeenCalledWith(tasks, expect.objectContaining({ sprintId: null }))
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'deleted', entityType: 'sprint', entityId: SPRINT_ID }),
    )
  })
})

// D5 review fix: createSprint and updateSprintStatus demote sibling 'active'
// sprints without an isNull(deletedAt) filter, so a trashed-but-active sprint
// silently got flipped to 'done' — and a later restore would bring it back
// mutated. These tests render the ACTUAL where-clause SQL the demote
// statement runs with (via QueryBuilder, connection-free — same technique as
// src/db/live.test.ts) rather than only simulating a happy-path result, so a
// regression that drops the filter again fails here even though the mocked
// rows would still make the action itself return `ok`.
function demoteWhereSql(condition: unknown): string {
  const qb = new QueryBuilder()
  const withFrom = qb.select().from(sprints)
  return withFrom.where(condition as Parameters<typeof withFrom.where>[0]).toSQL().sql.toLowerCase()
}

describe('createSprint / updateSprintStatus: the demote-siblings guard excludes trashed sprints', () => {
  it('createSprint (born active) demotes only LIVE active siblings', async () => {
    asAdmin()
    sprintInsertReturningQueue = [[]]

    const res = await createSprint({
      appId: '55555555-5555-4555-8555-555555555555',
      name: 'Sprint born active',
      startDate: '2000-01-01',
      endDate: '2999-01-01',
    })

    expect(res.ok).toBe(true)
    expect(demoteWhereConditions).toHaveLength(1)
    const sql = demoteWhereSql(demoteWhereConditions[0])
    expect(sql).toContain('deleted_at')
    expect(sql).toContain('is null')
  })

  it('updateSprintStatus(→active) demotes only LIVE active siblings', async () => {
    asAdmin()
    sprintQueue = [[{ appId: 'app-1', name: 'Sprint 1', status: 'planned' }]]

    const res = await updateSprintStatus(SPRINT_ID, 'active')

    expect(res.ok).toBe(true)
    expect(demoteWhereConditions).toHaveLength(1)
    const sql = demoteWhereSql(demoteWhereConditions[0])
    expect(sql).toContain('deleted_at')
    expect(sql).toContain('is null')
  })
})
