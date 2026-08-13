import { beforeEach, describe, expect, it, vi } from 'vitest'
import { tasks } from '@/db/schema'
import { liveTasks } from '@/db/live'

// deleteTask is soft-delete (D3): the row is marked deletedAt/deletedBy,
// never removed. Same mocked-action idiom as
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

let taskQueue: unknown[][] = []
let updateReturningQueue: unknown[][] = []

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        // taskById (deleteTask's read) goes through liveTasks (D4) — the
        // write below is still the raw `tasks` table, which is what
        // writeSpy asserts against.
        where: async () => (table === liveTasks ? taskQueue.shift() ?? [] : []),
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            writeSpy(table, values)
            return updateReturningQueue.shift() ?? []
          },
        }),
      }),
    }),
    delete: deleteSpy,
  },
}))

const { deleteTask } = await import('./task-actions')

const TASK_ID = '22222222-2222-4222-8222-222222222222'

const asAdmin = () => authMock.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
const asMember = () => authMock.mockResolvedValue({ user: { id: 'member-1', role: 'member' } })

function baseTask(overrides: Record<string, unknown> = {}) {
  return { id: TASK_ID, title: 'Fix the flaky test', appId: 'app-1', ...overrides }
}

beforeEach(() => {
  authMock.mockReset()
  writeSpy.mockReset()
  deleteSpy.mockReset()
  logActivityMock.mockReset()
  taskQueue = []
  updateReturningQueue = []
})

describe('deleteTask', () => {
  it('rejects a non-admin caller and writes nothing', async () => {
    asMember()
    const res = await deleteTask(TASK_ID)
    expect(res).toEqual({ ok: false, error: 'Admins only' })
    expect(writeSpy).not.toHaveBeenCalled()
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('a second delete of an already-trashed task returns err and does no further write', async () => {
    asAdmin()
    taskQueue = [[baseTask()]]
    // isNull(deletedAt) guard matched nothing — already trashed.
    updateReturningQueue = [[]]
    const res = await deleteTask(TASK_ID)
    expect(res).toEqual({ ok: false, error: 'Task not found' })
    expect(writeSpy).toHaveBeenCalledTimes(1)
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('marks the row deleted rather than removing it', async () => {
    asAdmin()
    taskQueue = [[baseTask()]]
    updateReturningQueue = [[{ id: TASK_ID }]]

    const res = await deleteTask(TASK_ID)

    expect(res).toEqual({ ok: true, data: undefined })
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(writeSpy).toHaveBeenCalledWith(
      tasks,
      expect.objectContaining({ deletedAt: expect.any(Date), deletedBy: 'admin-1' }),
    )
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'deleted', entityType: 'task', entityId: TASK_ID }),
    )
  })
})
