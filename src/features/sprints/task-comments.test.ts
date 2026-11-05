import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assignments, taskComments, users } from '@/db/schema'
import { liveTaskComments, liveTasks } from '@/db/live'

// Same mocked-action idiom as task-actions.test.ts: a table-keyed select mock
// (so "this task is in app-1" and "this member's scope covers app-1" are set
// independently), with the permission path running for real through
// requireCapability/loadActor against the mocked session.
const {
  authMock,
  insertSpy,
  updateSpy,
  deleteSpy,
  logActivityMock,
  recordMentionsMock,
  selectRows,
  updateReturning,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  insertSpy: vi.fn(),
  updateSpy: vi.fn(),
  deleteSpy: vi.fn(),
  logActivityMock: vi.fn(),
  recordMentionsMock: vi.fn(),
  selectRows: new Map<unknown, unknown[]>(),
  updateReturning: { rows: [] as unknown[] },
}))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/features/activity/log', () => ({ logActivity: logActivityMock }))
vi.mock('@/features/notifications/notify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/notifications/notify')>()
  return { ...actual, recordMentions: recordMentionsMock }
})

vi.mock('@/db', () => {
  function builder(table: unknown) {
    const rows = () => selectRows.get(table) ?? []
    const self: Record<string, unknown> = {}
    for (const method of ['where', 'limit', 'innerJoin', 'leftJoin', 'orderBy']) self[method] = () => self
    self.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows()).then(resolve, reject)
    return self
  }
  return {
    db: {
      select: () => ({ from: (table: unknown) => builder(table) }),
      insert: (table: unknown) => ({
        values: (values: Record<string, unknown>) => {
          insertSpy(table, values)
          return {
            returning: async () => [{ id: NEW_COMMENT_ID, createdAt: new Date('2026-10-29T10:00:00Z') }],
          }
        },
      }),
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: () => {
            updateSpy(table, values)
            return { returning: async () => updateReturning.rows }
          },
        }),
      }),
      delete: deleteSpy,
    },
  }
})

const NEW_COMMENT_ID = '44444444-4444-4444-8444-444444444444'
const TASK_ID = '22222222-2222-4222-8222-222222222222'
const COMMENT_ID = '33333333-3333-4333-8333-333333333333'

const { listTaskComments, addTaskComment, editTaskComment, deleteTaskComment } = await import(
  './task-comments-actions'
)

const asAdmin = (id = 'admin-1') => authMock.mockResolvedValue({ user: { id, role: 'admin' } })
const asMember = (id = 'member-1') => authMock.mockResolvedValue({ user: { id, role: 'member' } })

function task(overrides: Record<string, unknown> = {}) {
  return { id: TASK_ID, appId: 'app-1', title: 'Fix the flaky test', appName: 'Atlas', appSlug: 'atlas', ...overrides }
}

function comment(overrides: Record<string, unknown> = {}) {
  return { id: COMMENT_ID, taskId: TASK_ID, authorId: 'member-1', body: 'hello', ...overrides }
}

beforeEach(() => {
  authMock.mockReset()
  insertSpy.mockReset()
  updateSpy.mockReset()
  deleteSpy.mockReset()
  logActivityMock.mockReset()
  recordMentionsMock.mockReset()
  recordMentionsMock.mockResolvedValue({ notified: [], suppressed: [], advisory: null })
  selectRows.clear()
  updateReturning.rows = [{ id: COMMENT_ID }]
  // An admin, so Ama is in every project's mention pool (appViewers).
  selectRows.set(users, [{ id: 'u-ama', name: 'Ama', avatarUrl: null, role: 'admin' }])
})

const asAuditor = (id = 'auditor-1') => authMock.mockResolvedValue({ user: { id, role: 'auditor' } })

describe('listTaskComments', () => {
  it('rejects a malformed id without touching the database', async () => {
    asAdmin()
    const res = await listTaskComments('not-a-uuid')
    expect(res).toEqual({ ok: false, error: 'Task not found' })
  })

  it('reports a trashed or missing task as not found', async () => {
    asAdmin()
    const res = await listTaskComments(TASK_ID)
    expect(res).toEqual({ ok: false, error: 'Task not found' })
  })

  it('refuses a member whose scope does not cover the task’s project', async () => {
    asMember()
    selectRows.set(liveTasks, [task()])
    selectRows.set(assignments, [{ appId: 'other-app' }])
    const res = await listTaskComments(TASK_ID)
    expect(res).toEqual({ ok: false, error: 'Not allowed' })
  })

  it('marks the viewer’s own comments and keeps the query order', async () => {
    asMember()
    selectRows.set(liveTasks, [task()])
    selectRows.set(assignments, [{ appId: 'app-1' }])
    selectRows.set(liveTaskComments, [
      { id: 'c1', body: 'first', authorId: 'someone', authorName: 'Sana', authorAvatarUrl: null },
      { id: 'c2', body: 'second', authorId: 'member-1', authorName: 'Me', authorAvatarUrl: null },
    ])
    const res = await listTaskComments(TASK_ID)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data.comments.map((c) => [c.id, c.mine])).toEqual([
      ['c1', false],
      ['c2', true],
    ])
    // A member holds no task.delete — they may delete only their own.
    expect(res.data.canModerate).toBe(false)
    expect(res.data.viewer.id).toBe('member-1')
  })

  it('lets an admin moderate', async () => {
    asAdmin()
    selectRows.set(liveTasks, [task()])
    const res = await listTaskComments(TASK_ID)
    expect(res.ok && res.data.canModerate).toBe(true)
    expect(res.ok && res.data.canComment).toBe(true)
  })

  it('shows an auditor the thread but says they cannot comment', async () => {
    asAuditor()
    selectRows.set(liveTasks, [task()])
    const res = await listTaskComments(TASK_ID)
    expect(res.ok).toBe(true)
    expect(res.ok && res.data.canComment).toBe(false)
  })

  it('lets a member on the project comment', async () => {
    asMember()
    selectRows.set(liveTasks, [task()])
    selectRows.set(assignments, [{ appId: 'app-1', userId: 'member-1' }])
    const res = await listTaskComments(TASK_ID)
    expect(res.ok && res.data.canComment).toBe(true)
  })

  // Regression: the pool was every approved person in the workspace, handed
  // to every viewer of the thread — a stakeholder included.
  it('offers only people who can open the project as mentions', async () => {
    asAdmin()
    selectRows.set(liveTasks, [task()])
    selectRows.set(users, [
      { id: 'u-ama', name: 'Ama', avatarUrl: null, role: 'admin' },
      { id: 'u-bo', name: 'Bo', avatarUrl: null, role: 'member' },
      { id: 'u-cy', name: 'Cy', avatarUrl: null, role: 'member' },
    ])
    // Cy is assigned to the project; Bo is not.
    selectRows.set(assignments, [{ appId: 'app-1', userId: 'u-cy' }])
    const res = await listTaskComments(TASK_ID)
    expect(res.ok && res.data.mentionUsers).toEqual([
      { id: 'u-ama', name: 'Ama' },
      { id: 'u-cy', name: 'Cy' },
    ])
  })
})

describe('addTaskComment', () => {
  it('rejects a blank body after trimming', async () => {
    asAdmin()
    selectRows.set(liveTasks, [task()])
    expect(await addTaskComment(TASK_ID, '    ')).toEqual({ ok: false, error: 'Write something first' })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('rejects a body over 4000 characters', async () => {
    asAdmin()
    selectRows.set(liveTasks, [task()])
    expect(await addTaskComment(TASK_ID, 'x'.repeat(4001))).toEqual({
      ok: false,
      error: 'Comment is too long',
    })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('refuses a viewer outside the project and writes nothing', async () => {
    asMember()
    selectRows.set(liveTasks, [task()])
    const res = await addTaskComment(TASK_ID, 'hi')
    expect(res).toEqual({ ok: false, error: 'Not allowed' })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  // Regression: posting was gated on app.view, a read the auditor holds at
  // 'all' and a maintenance freeze never stops.
  it('refuses the read-only auditor and writes nothing', async () => {
    asAuditor()
    selectRows.set(liveTasks, [task()])
    expect(await addTaskComment(TASK_ID, 'hi')).toEqual({ ok: false, error: 'Not allowed' })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('inserts the trimmed body, logs a "commented" row with the task’s own appId', async () => {
    asMember()
    selectRows.set(liveTasks, [task()])
    selectRows.set(assignments, [{ appId: 'app-1' }])
    const res = await addTaskComment(TASK_ID, '  looks good  ')
    expect(res.ok).toBe(true)
    expect(insertSpy).toHaveBeenCalledWith(taskComments, {
      taskId: TASK_ID,
      authorId: 'member-1',
      body: 'looks good',
    })
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'commented', entityType: 'task', entityId: TASK_ID, appId: 'app-1' }),
    )
    if (res.ok) expect(res.data.comment).toMatchObject({ id: NEW_COMMENT_ID, mine: true, editedAt: null })
  })

  it('records @mentions through the mentions ledger and surfaces its advisory', async () => {
    asAdmin()
    selectRows.set(liveTasks, [task()])
    recordMentionsMock.mockResolvedValue({
      notified: [],
      suppressed: [{ name: 'Ama', reason: 'no_access' }],
      advisory: 'Ama can’t see Fix the flaky test — mention recorded, not notified.',
    })
    const res = await addTaskComment(TASK_ID, 'ping @Ama about this')
    expect(recordMentionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'task',
        sourceId: TASK_ID,
        appId: 'app-1',
        mentioned: [{ userId: 'u-ama', name: 'Ama' }],
        link: '/apps/atlas',
      }),
    )
    expect(res.ok && res.data.mentionAdvisory).toContain('Ama')
  })

  it('does not notify somebody outside the project', async () => {
    asAdmin()
    selectRows.set(liveTasks, [task()])
    selectRows.set(users, [{ id: 'u-bo', name: 'Bo', avatarUrl: null, role: 'member' }])
    await addTaskComment(TASK_ID, 'ping @Bo')
    expect(recordMentionsMock).not.toHaveBeenCalled()
  })

  it('skips the ledger when nobody is named', async () => {
    asAdmin()
    selectRows.set(liveTasks, [task()])
    await addTaskComment(TASK_ID, 'no names here')
    expect(recordMentionsMock).not.toHaveBeenCalled()
  })
})

describe('editTaskComment', () => {
  it('refuses anyone but the author — admins included', async () => {
    asAdmin()
    selectRows.set(liveTaskComments, [comment()])
    selectRows.set(liveTasks, [task()])
    const res = await editTaskComment(COMMENT_ID, 'rewritten')
    expect(res).toEqual({ ok: false, error: 'Only the author can edit a comment' })
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('refuses an author who has become a read-only auditor', async () => {
    asAuditor('member-1')
    selectRows.set(liveTaskComments, [comment()])
    selectRows.set(liveTasks, [task()])
    expect(await editTaskComment(COMMENT_ID, 'x')).toEqual({ ok: false, error: 'Not allowed' })
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('updates body and editedAt for the author', async () => {
    asMember()
    selectRows.set(liveTaskComments, [comment()])
    selectRows.set(liveTasks, [task()])
    selectRows.set(assignments, [{ appId: 'app-1' }])
    const res = await editTaskComment(COMMENT_ID, ' better words ')
    expect(res.ok).toBe(true)
    expect(updateSpy).toHaveBeenCalledWith(
      taskComments,
      expect.objectContaining({ body: 'better words', editedAt: expect.any(Date) }),
    )
  })

  it('reports a comment trashed mid-edit as not found', async () => {
    asMember()
    selectRows.set(liveTaskComments, [comment()])
    selectRows.set(liveTasks, [task()])
    selectRows.set(assignments, [{ appId: 'app-1' }])
    updateReturning.rows = []
    expect(await editTaskComment(COMMENT_ID, 'x')).toEqual({ ok: false, error: 'Comment not found' })
  })
})

describe('deleteTaskComment', () => {
  it('soft-deletes the author’s own comment and never hard-deletes', async () => {
    asMember()
    selectRows.set(liveTaskComments, [comment()])
    selectRows.set(liveTasks, [task()])
    selectRows.set(assignments, [{ appId: 'app-1' }])
    const res = await deleteTaskComment(COMMENT_ID)
    expect(res).toEqual({ ok: true, data: undefined })
    expect(updateSpy).toHaveBeenCalledWith(
      taskComments,
      expect.objectContaining({ deletedAt: expect.any(Date), deletedBy: 'member-1' }),
    )
    expect(deleteSpy).not.toHaveBeenCalled()
    // The author's own delete is not a trail event.
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('refuses a member deleting somebody else’s comment', async () => {
    asMember('member-2')
    selectRows.set(liveTaskComments, [comment()])
    selectRows.set(liveTasks, [task()])
    selectRows.set(assignments, [{ appId: 'app-1' }])
    expect(await deleteTaskComment(COMMENT_ID)).toEqual({ ok: false, error: 'Not allowed' })
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('lets an admin remove another person’s comment, and logs it', async () => {
    asAdmin()
    selectRows.set(liveTaskComments, [comment()])
    selectRows.set(liveTasks, [task()])
    const res = await deleteTaskComment(COMMENT_ID)
    expect(res.ok).toBe(true)
    expect(updateSpy).toHaveBeenCalledWith(
      taskComments,
      expect.objectContaining({ deletedBy: 'admin-1' }),
    )
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'deleted', entityType: 'comment', entityId: COMMENT_ID }),
    )
  })
})
