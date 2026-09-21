import { beforeEach, describe, expect, it, vi } from 'vitest'
import { appRoleHistory, assignments, tasks } from '@/db/schema'
import { liveTasks } from '@/db/live'

// deleteTask is soft-delete (D3): the row is marked deletedAt/deletedBy,
// never removed. Same mocked-action idiom as
// src/features/admin/set-user-title.test.ts.
//
// updateTask's permission check now goes through requireCapability/loadActor
// (task.edit is manager/editor: scoped, member: own — see capabilities.ts),
// which for a scoped role reads `appRoleHistory` in addition to task-actions'
// own `liveTasks` read. The select mock is table-keyed (same idiom as
// bugs/actions.test.ts) so a test can say "this task is in app-1" and "this
// manager's scope covers app-1" independently.
const { authMock, writeSpy, deleteSpy, logActivityMock, selectRows, updateReturningQueue } =
  vi.hoisted(() => ({
    authMock: vi.fn(),
    writeSpy: vi.fn(),
    deleteSpy: vi.fn(),
    logActivityMock: vi.fn(),
    selectRows: new Map<unknown, unknown[]>(),
    updateReturningQueue: [] as unknown[][],
  }))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/features/activity/log', () => ({ logActivity: logActivityMock }))

vi.mock('@/db', () => {
  function builder(table: unknown) {
    const rows = () => selectRows.get(table) ?? []
    const self: Record<string, unknown> = {}
    for (const method of ['where', 'limit']) self[method] = () => self
    self.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows()).then(resolve, reject)
    return self
  }
  return {
    db: {
      select: () => ({ from: (table: unknown) => builder(table) }),
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: () => {
            writeSpy(table, values)
            const result = updateReturningQueue.shift() ?? []
            return {
              returning: async () => result,
              // updateTask (unlike deleteTask) never calls `.returning()` — it
              // awaits this object directly and discards the value, so it
              // must itself be a thenable.
              then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
                Promise.resolve(result).then(resolve, reject),
            }
          },
        }),
      }),
      delete: deleteSpy,
    },
  }
})

const { deleteTask, updateTask, moveTaskOnBoard, bulkUpdateTasks } = await import('./task-actions')

const TASK_ID = '22222222-2222-4222-8222-222222222222'

const asAdmin = () => authMock.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
const asMember = (id = 'member-1') => authMock.mockResolvedValue({ user: { id, role: 'member' } })
const asManager = (id = 'mgr-1') => authMock.mockResolvedValue({ user: { id, role: 'manager' } })
const asEditor = (id = 'editor-1') => authMock.mockResolvedValue({ user: { id, role: 'editor' } })

function baseTask(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    title: 'Fix the flaky test',
    appId: 'app-1',
    assigneeId: null,
    dueDate: null,
    dueKind: 'target',
    dueCommitmentNote: null,
    originalDueDate: null,
    dueChangedCount: 0,
    status: 'todo',
    ...overrides,
  }
}

beforeEach(() => {
  authMock.mockReset()
  writeSpy.mockReset()
  deleteSpy.mockReset()
  logActivityMock.mockReset()
  selectRows.clear()
  updateReturningQueue.length = 0
})

describe('deleteTask', () => {
  // Regression: the session guard used to sit BELOW taskById, so an
  // unauthenticated POST still ran the read and could tell 'Task not found'
  // apart from 'Not allowed' — a leak, before any capability was consulted.
  it('refuses an unauthenticated caller before reading the task', async () => {
    authMock.mockResolvedValue(null)
    selectRows.set(liveTasks, [baseTask()])

    const res = await deleteTask(TASK_ID)

    expect(res).toEqual({ ok: false, error: 'Sign in required' })
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('rejects a non-admin caller and writes nothing', async () => {
    asMember()
    selectRows.set(liveTasks, [baseTask()])
    const res = await deleteTask(TASK_ID)
    expect(res).toEqual({ ok: false, error: 'Not allowed' })
    expect(writeSpy).not.toHaveBeenCalled()
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  // Regression: the guard used to run BEFORE the read that has the task's
  // appId, so it asked task.delete with no resource — 'scoped' + no resource
  // fails closed (capabilities.ts can()), refusing every manager even on
  // their own app while updateTask's identical shape already allowed them.
  it('lets a manager scoped to the task’s app delete it (scoped)', async () => {
    asManager('mgr-1')
    selectRows.set(liveTasks, [baseTask({ appId: 'app-1' })])
    selectRows.set(appRoleHistory, [{ appId: 'app-1' }])
    updateReturningQueue.push([{ id: TASK_ID }])

    const res = await deleteTask(TASK_ID)

    expect(res).toEqual({ ok: true, data: undefined })
    expect(writeSpy).toHaveBeenCalledWith(
      tasks,
      expect.objectContaining({ deletedAt: expect.any(Date), deletedBy: 'mgr-1' }),
    )
  })

  it('refuses a manager scoped to a different app', async () => {
    asManager('mgr-1')
    selectRows.set(liveTasks, [baseTask({ appId: 'app-1' })])
    selectRows.set(appRoleHistory, [{ appId: 'app-2' }])

    const res = await deleteTask(TASK_ID)

    expect(res).toEqual({ ok: false, error: 'Not allowed' })
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('a second delete of an already-trashed task returns err and does no further write', async () => {
    asAdmin()
    selectRows.set(liveTasks, [baseTask()])
    // isNull(deletedAt) guard matched nothing — already trashed.
    updateReturningQueue.push([])
    const res = await deleteTask(TASK_ID)
    expect(res).toEqual({ ok: false, error: 'Task not found' })
    expect(writeSpy).toHaveBeenCalledTimes(1)
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('marks the row deleted rather than removing it', async () => {
    asAdmin()
    selectRows.set(liveTasks, [baseTask()])
    updateReturningQueue.push([{ id: TASK_ID }])

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

describe('updateTask authorisation', () => {
  it('lets the task’s own assignee edit it (member, own)', async () => {
    asMember('member-1')
    selectRows.set(liveTasks, [baseTask({ assigneeId: 'member-1' })])

    const res = await updateTask(TASK_ID, { title: 'Fix the flakier test' })

    expect(res).toEqual({ ok: true, data: undefined })
    expect(writeSpy).toHaveBeenCalledWith(
      tasks,
      expect.objectContaining({ title: 'Fix the flakier test' }),
    )
  })

  it('lets a manager scoped to the task’s app edit it, even unassigned (scoped)', async () => {
    asManager('mgr-1')
    selectRows.set(liveTasks, [baseTask({ appId: 'app-1', assigneeId: null })])
    // loadActor resolves a manager's scope from appRoleHistory.
    selectRows.set(appRoleHistory, [{ appId: 'app-1' }])

    const res = await updateTask(TASK_ID, { title: 'Reassign this' })

    expect(res).toEqual({ ok: true, data: undefined })
    expect(writeSpy).toHaveBeenCalledWith(
      tasks,
      expect.objectContaining({ title: 'Reassign this' }),
    )
  })

  it('refuses a member who is not the assignee', async () => {
    asMember('member-1')
    selectRows.set(liveTasks, [baseTask({ assigneeId: 'someone-else' })])

    const res = await updateTask(TASK_ID, { title: 'Not mine' })

    expect(res).toEqual({ ok: false, error: 'Not allowed' })
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('refuses a manager scoped to a different app', async () => {
    asManager('mgr-1')
    selectRows.set(liveTasks, [baseTask({ appId: 'app-1', assigneeId: null })])
    selectRows.set(appRoleHistory, [{ appId: 'app-2' }])

    const res = await updateTask(TASK_ID, { title: 'Not my app' })

    expect(res).toEqual({ ok: false, error: 'Not allowed' })
    expect(writeSpy).not.toHaveBeenCalled()
  })
})

// task.edit (own/scoped) covers an ordinary due-date edit, but moving a
// COMMITTED deadline is the strictly narrower 'deadline.move.committed'
// (manager: scoped, editor: NONE) — see task-actions.ts. Gated on the date
// actually differing, so a resave of the same value never needs the seat.
describe('updateTask — moving a committed deadline', () => {
  const committedTask = (overrides: Record<string, unknown> = {}) =>
    baseTask({
      appId: 'app-1',
      dueKind: 'committed',
      dueDate: '2026-09-01',
      dueCommitmentNote: 'Promised to the client',
      originalDueDate: '2026-09-01',
      dueChangedCount: 0,
      ...overrides,
    })

  it('refuses a scoped editor moving the date (deadline.move.committed is none for editor)', async () => {
    asEditor('editor-1')
    // assigneeId set to the editor themselves: task.edit must pass (own AND
    // scope both grant it) so the refusal below can only come from the
    // deadline.move.committed gate, not from task.edit itself — an
    // unassigned task would already be refused earlier for a different
    // reason and never reach the gate this test exists to cover.
    selectRows.set(liveTasks, [committedTask({ assigneeId: 'editor-1' })])
    // task.edit is editor: scoped — grants the edit itself via assignments.
    selectRows.set(assignments, [{ appId: 'app-1' }])

    const res = await updateTask(TASK_ID, { dueDate: '2026-09-10' })

    expect(res).toEqual({ ok: false, error: 'Not allowed' })
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('lets a scoped manager move it (deadline.move.committed is scoped for manager)', async () => {
    asManager('mgr-1')
    selectRows.set(liveTasks, [committedTask()])
    selectRows.set(appRoleHistory, [{ appId: 'app-1' }])

    const res = await updateTask(TASK_ID, { dueDate: '2026-09-10' })

    expect(res).toEqual({ ok: true, data: undefined })
    expect(writeSpy).toHaveBeenCalledWith(
      tasks,
      expect.objectContaining({ dueDate: '2026-09-10', dueKind: 'committed' }),
    )
  })

  it('never asks deadline.move.committed when the date is unchanged', async () => {
    // Member, own task, editing only the title — but the dialog still
    // resends the unchanged committed date. If the permission ran anyway it
    // would refuse (member holds 'none' on deadline.move.committed).
    asMember('member-1')
    selectRows.set(liveTasks, [committedTask({ assigneeId: 'member-1' })])

    const res = await updateTask(TASK_ID, { title: 'Same date, new title', dueDate: '2026-09-01' })

    expect(res).toEqual({ ok: true, data: undefined })
    expect(writeSpy).toHaveBeenCalledWith(
      tasks,
      expect.objectContaining({ title: 'Same date, new title', dueDate: '2026-09-01' }),
    )
  })
})

describe('moveTaskOnBoard', () => {
  // Regression: this used to authorise via canMoveTask(role, userId,
  // assigneeId) — an EMPTY scope set — so a manager/editor scoped to the
  // app could never move a teammate's card server-side although task.move is
  // manager/editor: scoped. requireCapability resolves the real scope.
  it('lets a manager scoped to the app move a teammate’s task', async () => {
    asManager('mgr-1')
    selectRows.set(liveTasks, [baseTask({ appId: 'app-1', assigneeId: 'member-1' })])
    selectRows.set(appRoleHistory, [{ appId: 'app-1' }])

    const res = await moveTaskOnBoard({ taskId: TASK_ID, sortOrder: 100 })

    expect(res).toEqual({ ok: true, data: undefined })
    expect(writeSpy).toHaveBeenCalledWith(tasks, expect.objectContaining({ sortOrder: 100 }))
  })

  it('lets a member move their own task (own arm)', async () => {
    asMember('member-1')
    selectRows.set(liveTasks, [baseTask({ appId: 'app-1', assigneeId: 'member-1' })])

    const res = await moveTaskOnBoard({ taskId: TASK_ID, sortOrder: 100 })

    expect(res).toEqual({ ok: true, data: undefined })
  })

  it('refuses a member moving a teammate’s task', async () => {
    asMember('member-1')
    selectRows.set(liveTasks, [baseTask({ appId: 'app-1', assigneeId: 'someone-else' })])

    const res = await moveTaskOnBoard({ taskId: TASK_ID, sortOrder: 100 })

    expect(res).toEqual({ ok: false, error: 'You can only move your own tasks' })
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('refuses a manager scoped to a different app', async () => {
    asManager('mgr-1')
    selectRows.set(liveTasks, [baseTask({ appId: 'app-1', assigneeId: 'member-1' })])
    selectRows.set(appRoleHistory, [{ appId: 'app-2' }])

    const res = await moveTaskOnBoard({ taskId: TASK_ID, sortOrder: 100 })

    expect(res).toEqual({ ok: false, error: 'You can only move your own tasks' })
    expect(writeSpy).not.toHaveBeenCalled()
  })
})

describe('bulkUpdateTasks', () => {
  // Same regression as moveTaskOnBoard, per row: canMoveTask's empty scope
  // set used to under-grant every scoped manager/editor here too.
  it('lets a manager scoped to the app move a teammate’s task in the batch', async () => {
    asManager('mgr-1')
    selectRows.set(liveTasks, [
      { id: TASK_ID, appId: 'app-1', assigneeId: 'member-1', title: 'Fix the flaky test', status: 'todo' },
    ])
    selectRows.set(appRoleHistory, [{ appId: 'app-1' }])

    const res = await bulkUpdateTasks({ taskIds: [TASK_ID], patch: { priority: 2 } })

    expect(res).toEqual({ ok: true, data: { updated: 1, skipped: 0 } })
    expect(writeSpy).toHaveBeenCalledWith(tasks, expect.objectContaining({ priority: 2 }))
  })

  it('skips a teammate’s task a plain member cannot move, reporting it rather than failing', async () => {
    asMember('member-1')
    selectRows.set(liveTasks, [
      { id: TASK_ID, appId: 'app-1', assigneeId: 'someone-else', title: 'Fix the flaky test', status: 'todo' },
    ])

    const res = await bulkUpdateTasks({ taskIds: [TASK_ID], patch: { priority: 2 } })

    expect(res).toEqual({ ok: false, error: 'You can only change your own tasks' })
    expect(writeSpy).not.toHaveBeenCalled()
  })
})
