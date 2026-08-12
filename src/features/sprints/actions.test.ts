import { beforeEach, describe, expect, it, vi } from 'vitest'
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

// db.update(...).where(...) — WITHOUT a .returning() — must still be
// directly awaitable, because deleteSprint hands it straight to db.batch()
// as the tasks-release statement. A thenable stands in for that.
function updateWhereResult(table: unknown, values: Record<string, unknown>) {
  writeSpy(table, values)
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
        where: () => updateWhereResult(table, values),
      }),
    }),
    batch: async (queries: unknown[]) => Promise.all(queries),
    delete: deleteSpy,
  },
}))

const { deleteSprint } = await import('./actions')

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
