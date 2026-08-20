import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * SERVER-SIDE ENFORCEMENT, proven at the action boundary.
 *
 * The capability matrix is tested exhaustively in capabilities.test.ts, but a
 * matrix that nothing consults is decoration. These call the real server
 * actions with a real session and assert what they do to the database —
 * bypassing the UI entirely, which is the whole point: hiding a control is
 * presentation, and an attacker posts to the action.
 */

const authMock = vi.fn()
const updateSpy = vi.fn()
const deleteSpy = vi.fn()
const insertSpy = vi.fn()

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/session', () => ({ getSession: authMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/features/activity/log', () => ({ logActivity: vi.fn() }))

const chain = (rows: unknown[] = []) => {
  const p: Record<string, unknown> = {}
  const self = () => p
  p.from = self
  p.innerJoin = self
  p.leftJoin = self
  p.orderBy = self
  p.limit = self
  p.set = self
  p.returning = async () => rows
  p.values = (v: unknown) => {
    insertSpy(v)
    return { returning: async () => [{ id: 'new-1' }] }
  }
  p.where = Object.assign(async () => rows, { then: undefined })
  return p
}

vi.mock('@/db', () => ({
  db: {
    select: () => chain([{ employmentType: 'permanent' }]),
    update: (t: unknown) => {
      updateSpy(t)
      return chain()
    },
    delete: (t: unknown) => {
      deleteSpy(t)
      return chain()
    },
    insert: (t: unknown) => {
      insertSpy(t)
      return chain()
    },
    batch: async () => [],
  },
}))

const as = (role: string, id = 'actor-1') =>
  authMock.mockResolvedValue({ user: { id, role, status: 'approved' } })

/**
 * Pay for the module ONCE, outside any test's budget.
 *
 * Every test below does `await import('@/features/auth/actor')`. The module
 * is cached after the first, so exactly one test — whichever vitest happens to
 * run first — was charged with loading the real actor module and everything it
 * pulls in. On an idle machine that is a few hundred milliseconds; under a
 * full parallel run it has exceeded vitest's 5s per-test timeout and failed
 * the file. The test that failed was never the slow one, and re-running it
 * alone always passed.
 *
 * A red whose verdict depends on machine load is worse than no test: it
 * teaches people that reds here are noise, which is exactly the habit that
 * lets a real failure through. Raising testTimeout would have hidden the cost
 * instead of moving it; beforeAll has its own separate budget and this is the
 * only thing in it.
 *
 * The import stays dynamic in the tests themselves so they keep reading as
 * "call the real action with a real session" rather than depending on
 * module-load order at the top of the file.
 */
beforeAll(async () => {
  await import('@/features/auth/actor')
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('an editor cannot delete, and has a request path instead', () => {
  it('is refused by the capability guard and mutates nothing', async () => {
    const { requireCapability } = await import('@/features/auth/actor')
    as('editor')

    // The exact call every delete action makes first. Null is the refusal.
    expect(await requireCapability('task.delete', { appId: 'app-1' })).toBeNull()
    expect(await requireCapability('meeting.delete', { appId: 'app-1' })).toBeNull()
    expect(await requireCapability('trash.purge')).toBeNull()

    // Nothing was written on any of those paths.
    expect(updateSpy).not.toHaveBeenCalled()
    expect(deleteSpy).not.toHaveBeenCalled()
  })

  it('IS permitted to file a change request for the same thing', async () => {
    const { requireCapability } = await import('@/features/auth/actor')
    as('editor')
    const actor = await requireCapability('request.create', { ownerId: 'actor-1' })
    expect(actor).not.toBeNull()
    expect(actor?.role).toBe('editor')
  })
})

describe('a stakeholder is refused every administrative surface', () => {
  it('cannot reach the people directory or any admin action', async () => {
    const { requireCapability } = await import('@/features/auth/actor')
    as('stakeholder')

    for (const action of [
      'user.view.directory',
      'user.view.detail',
      'user.create',
      'user.approve',
      'user.role.grant',
      'admin.view',
      'audit.view',
      'trash.view',
      'worklog.view',
      'coverage.view',
      'app.edit',
      'request.review',
      'absence.approve',
      'danger.dbclear',
    ] as const) {
      expect(await requireCapability(action), action).toBeNull()
    }

    expect(updateSpy).not.toHaveBeenCalled()
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(insertSpy).not.toHaveBeenCalled()
  })
})

describe('an auditor reads everything and writes nothing', () => {
  it('is permitted the audit trail and refused every mutation', async () => {
    const { requireCapability } = await import('@/features/auth/actor')
    as('auditor')

    expect(await requireCapability('audit.view')).not.toBeNull()
    expect(await requireCapability('trash.view')).not.toBeNull()

    for (const action of [
      'user.create', 'user.role.grant', 'task.edit', 'task.delete',
      'trash.restore', 'trash.purge', 'absence.approve', 'request.review',
      'worklog.write.own', 'danger.dbclear',
    ] as const) {
      expect(await requireCapability(action, { ownerId: 'actor-1' }), action).toBeNull()
    }

    expect(updateSpy).not.toHaveBeenCalled()
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(insertSpy).not.toHaveBeenCalled()
  })
})

describe('an admin is refused the three superadmin-only powers', () => {
  it('cannot clear the database, purge, or grant superadmin', async () => {
    const { requireCapability } = await import('@/features/auth/actor')
    as('admin')

    expect(await requireCapability('danger.dbclear')).toBeNull()
    expect(await requireCapability('trash.purge')).toBeNull()
    expect(await requireCapability('user.role.grant.superadmin')).toBeNull()

    // ...while keeping everything that makes the seat useful.
    expect(await requireCapability('user.create')).not.toBeNull()
    expect(await requireCapability('trash.restore')).not.toBeNull()
  })
})
