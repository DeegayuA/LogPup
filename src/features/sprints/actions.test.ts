import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryBuilder } from 'drizzle-orm/pg-core'
import { sprints, tasks } from '@/db/schema'
import { liveSprints, liveTasks } from '@/db/live'

// deleteSprint is soft-delete (D3): the sprint row is marked deletedAt/
// deletedBy, never removed — and its tasks are deliberately left pointing at
// it, so a restore is lossless. Nothing else is written; the tasks stay
// visible through the backlog rule in backlog.ts, not through a mutation.
//
// requireCapability is mocked directly (same idiom as
// admin/bulk-actions.test.ts) rather than the session: sprint.manage is
// SCOPED for manager, and the thing worth pinning here is that every guard
// site hands it the sprint's REAL appId — not that the matrix agrees with
// itself, which capabilities.test.ts already covers.
const { requireCapabilityMock, writeSpy, deleteSpy, logActivityMock } = vi.hoisted(() => ({
  requireCapabilityMock: vi.fn(),
  writeSpy: vi.fn(),
  deleteSpy: vi.fn(),
  logActivityMock: vi.fn(),
}))

// D6 fix added a `requireSession()`-shaped `auth()` check ABOVE the read in
// every guard here (updateSprint/deleteSprint/updateSprintStatus/
// updateSprintDates/renameSprint) — see actions.ts. It only asks "is anyone
// signed in", never which one, so a resolved session is the default and
// `requireCapabilityMock` (below) stays the one mock that decides who is
// allowed to act.
vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue({ user: { id: 'session-user' } }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/features/activity/log', () => ({ logActivity: logActivityMock }))
vi.mock('@/features/auth/actor', () => ({ requireCapability: requireCapabilityMock }))

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

const { createSprint, deleteSprint, renameSprint, updateSprintStatus } = await import('./actions')

const SPRINT_ID = '33333333-3333-4333-8333-333333333333'
const APP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const APP_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const asAdmin = () => requireCapabilityMock.mockResolvedValue({ id: 'admin-1', role: 'admin' })
const asNobody = () => requireCapabilityMock.mockResolvedValue(null)
// D6 fix: sprint.manage is SCOPED for manager, and `can()` fails closed on
// 'scoped' with no resource. This stands in for the real matrix's per-app
// scope check without pulling in loadActor's own appRoleHistory query —
// what's under test is which appId each guard site hands over, not whether
// the matrix agrees with itself.
const asManagerOf = (appId: string) =>
  requireCapabilityMock.mockImplementation(async (_action: string, resource?: { appId?: string }) =>
    resource?.appId === appId ? { id: 'manager-1', role: 'manager' } : null,
  )

beforeEach(() => {
  requireCapabilityMock.mockReset()
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
  it('rejects a refused caller and writes nothing', async () => {
    asNobody()
    sprintQueue = [[{ appId: APP_A, name: 'Sprint 1' }]]
    const res = await deleteSprint(SPRINT_ID)
    expect(res).toEqual({ ok: false, error: 'Not allowed' })
    expect(writeSpy).not.toHaveBeenCalled()
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('a second delete of an already-trashed sprint returns err and logs no activity', async () => {
    asAdmin()
    sprintQueue = [[{ appId: APP_A, name: 'Sprint 1' }]]
    taskCountQueue = [[{ total: 0 }]]
    // isNull(deletedAt) guard matched nothing — already trashed.
    sprintReturningQueue = [[]]

    const res = await deleteSprint(SPRINT_ID)

    expect(res).toEqual({ ok: false, error: 'Sprint not found' })
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('marks the sprint deleted and NEVER writes the tasks table', async () => {
    asAdmin()
    sprintQueue = [[{ appId: APP_A, name: 'Sprint 1' }]]
    taskCountQueue = [[{ total: 3 }]]
    sprintReturningQueue = [[{ id: SPRINT_ID }]]

    const res = await deleteSprint(SPRINT_ID)

    expect(res).toEqual({ ok: true, data: { backlogTasks: 3 } })
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(writeSpy).toHaveBeenCalledWith(
      sprints,
      expect.objectContaining({ deletedAt: expect.any(Date), deletedBy: 'admin-1' }),
    )
    // THE point of the whole soft delete: sprint↔task membership survives it.
    // An earlier version nulled tasks.sprintId here "to release them to the
    // backlog", which destroyed the mapping permanently — restoreSprint could
    // only ever bring back an empty sprint. Tasks stay visible via the backlog
    // rule instead (backlog.ts), which needs no write at all, so the tasks
    // table must not be touched by a sprint delete under any circumstances.
    expect(writeSpy).not.toHaveBeenCalledWith(tasks, expect.anything())
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'deleted', entityType: 'sprint', entityId: SPRINT_ID }),
    )
  })

  it('a losing concurrent double-delete writes nothing at all', async () => {
    asAdmin()
    sprintQueue = [[{ appId: APP_A, name: 'Sprint 1' }]]
    taskCountQueue = [[{ total: 3 }]]
    // isNull(deletedAt) matched nothing — the other caller already trashed it.
    sprintReturningQueue = [[]]

    const res = await deleteSprint(SPRINT_ID)

    expect(res).toEqual({ ok: false, error: 'Sprint not found' })
    // The old two-statement db.batch ran BOTH statements before this guard, so
    // the loser of the race still stripped sprintId off every live task while
    // telling the caller "Sprint not found". One guarded statement can't.
    expect(writeSpy).not.toHaveBeenCalledWith(tasks, expect.anything())
    expect(deleteSpy).not.toHaveBeenCalled()
  })

  // D6: the guard used to call requireCapability('sprint.manage') with NO
  // resource at all. sprint.manage is SCOPED for manager, and `can()` fails
  // closed on 'scoped' with no resource — so every PM was refused on their
  // own app's sprint. Fix reads the sprint's appId first and hands it over.
  it('a manager scoped to the sprint app can delete it', async () => {
    asManagerOf(APP_A)
    sprintQueue = [[{ appId: APP_A, name: 'Sprint 1' }]]
    taskCountQueue = [[{ total: 0 }]]
    sprintReturningQueue = [[{ id: SPRINT_ID }]]

    const res = await deleteSprint(SPRINT_ID)

    expect(res).toEqual({ ok: true, data: { backlogTasks: 0 } })
    expect(requireCapabilityMock).toHaveBeenCalledWith('sprint.manage', { appId: APP_A })
  })

  it('a manager scoped to a DIFFERENT app is refused', async () => {
    asManagerOf(APP_B)
    sprintQueue = [[{ appId: APP_A, name: 'Sprint 1' }]]

    const res = await deleteSprint(SPRINT_ID)

    expect(res).toEqual({ ok: false, error: 'Not allowed' })
    expect(writeSpy).not.toHaveBeenCalled()
  })
})

describe('createSprint', () => {
  // The guard moved BELOW the input parse so the appId from validated input
  // is what gets checked — the caller cannot be trusted to hand over an appId
  // the actor actually reaches, but zod can be trusted to shape it.
  it('a manager scoped to the target app can create a sprint', async () => {
    asManagerOf(APP_A)
    sprintInsertReturningQueue = [[]]

    const res = await createSprint({
      appId: APP_A,
      name: 'Sprint A',
      startDate: '2020-01-01',
      endDate: '2020-01-14',
    })

    expect(res.ok).toBe(true)
    expect(requireCapabilityMock).toHaveBeenCalledWith('sprint.manage', { appId: APP_A })
  })

  it('a manager scoped to a DIFFERENT app is refused before any write', async () => {
    asManagerOf(APP_B)

    const res = await createSprint({
      appId: APP_A,
      name: 'Sprint A',
      startDate: '2020-01-01',
      endDate: '2020-01-14',
    })

    expect(res).toEqual({ ok: false, error: 'Not allowed' })
    expect(writeSpy).not.toHaveBeenCalled()
  })
})

describe('renameSprint', () => {
  it('a manager scoped to the sprint app can rename it', async () => {
    asManagerOf(APP_A)
    sprintQueue = [[{ appId: APP_A }]]

    const res = await renameSprint(SPRINT_ID, 'New name')

    expect(res).toEqual({ ok: true, data: undefined })
    expect(requireCapabilityMock).toHaveBeenCalledWith('sprint.manage', { appId: APP_A })
    expect(writeSpy).toHaveBeenCalledWith(sprints, { name: 'New name' })
  })

  it('a manager scoped to a DIFFERENT app is refused and writes nothing', async () => {
    asManagerOf(APP_B)
    sprintQueue = [[{ appId: APP_A }]]

    const res = await renameSprint(SPRINT_ID, 'New name')

    expect(res).toEqual({ ok: false, error: 'Not allowed' })
    expect(writeSpy).not.toHaveBeenCalled()
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
      appId: APP_A,
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
    sprintQueue = [[{ appId: APP_A, name: 'Sprint 1', status: 'planned' }]]

    const res = await updateSprintStatus(SPRINT_ID, 'active')

    expect(res.ok).toBe(true)
    expect(demoteWhereConditions).toHaveLength(1)
    const sql = demoteWhereSql(demoteWhereConditions[0])
    expect(sql).toContain('deleted_at')
    expect(sql).toContain('is null')
  })
})
