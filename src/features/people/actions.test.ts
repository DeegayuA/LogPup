import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assignments, users } from '@/db/schema'
import { liveApps } from '@/db/live'

// requireCapability is mocked directly, not the session (bulk-actions.test.ts's
// shape): what's worth pinning is WHICH resource each of the three app.assign
// guards passes. app.assign is 'scoped' for manager, and `can` fails closed on
// a scoped grant asked with no resource — so a bug here reads as "an admin can
// assign, a PM who runs the project cannot," which a session-role mock alone
// would never catch.
const { requireCapabilityMock, batchMock, logActivityMock, selectRows } = vi.hoisted(() => ({
  requireCapabilityMock: vi.fn(),
  batchMock: vi.fn(),
  logActivityMock: vi.fn(),
  selectRows: new Map<unknown, unknown[]>(),
}))

vi.mock('@/features/auth/actor', () => ({ requireCapability: requireCapabilityMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/features/activity/log', () => ({ logActivity: logActivityMock }))
// updateAssignment/removeAssignment now guard with a plain `auth()` session
// check ABOVE their read (same shape as task-actions' deleteTask) — it only
// asks "is anyone signed in", never who, so a resolved session is the
// default and requireCapabilityMock stays the one mock deciding who may act.
// Unmocked, importing the real module pulls in next-auth's `next/server`
// import, which this test environment can't resolve, and fails the whole
// suite before a single test runs.
vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue({ user: { id: 'session-user' } }) }))
vi.mock('@/db', () => {
  function selectBuilder(table: unknown) {
    const rows = () => selectRows.get(table) ?? []
    const self: Record<string, unknown> = {}
    for (const m of ['where', 'limit', 'orderBy']) self[m] = () => self
    self.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
      Promise.resolve(rows()).then(resolve, reject)
    return self
  }
  // insert/update/delete only get BUILT here — db.batch (mocked below, per
  // test) is what actually "runs" them — so this chain just needs to accept
  // every method the actions call without throwing.
  function chain(): Record<string, unknown> {
    const self: Record<string, unknown> = {}
    for (const m of ['values', 'set', 'where', 'returning', 'select', 'from']) self[m] = () => self
    return self
  }
  return {
    db: {
      select: () => ({ from: (table: unknown) => selectBuilder(table) }),
      insert: () => chain(),
      update: () => chain(),
      delete: () => chain(),
      batch: batchMock,
    },
  }
})

const { assignUser, updateAssignment, removeAssignment } = await import('./actions')

const APP_A = '11111111-1111-4111-8111-111111111111'
const APP_B = '22222222-2222-4222-8222-222222222222'
const USER_ID = '33333333-3333-4333-8333-333333333333'
const ASSIGNMENT_ID = '44444444-4444-4444-8444-444444444444'

const manager = { id: 'mgr-1', role: 'manager' } as const

/** A manager whose scope covers exactly `appId` — mirrors what `can()` would
 * decide for a real scoped grant, without re-testing `can()` itself. */
const asManagerOf = (appId: string) =>
  requireCapabilityMock.mockImplementation(
    async (_action: string, resource?: { appId?: string }) =>
      resource?.appId === appId ? manager : null,
  )

beforeEach(() => {
  requireCapabilityMock.mockReset()
  batchMock.mockReset()
  logActivityMock.mockReset()
  selectRows.clear()
  selectRows.set(liveApps, [{ slug: 'ledger', name: 'Ledger' }])
  selectRows.set(users, [{ name: 'Alex' }])
})

describe('assignUser', () => {
  const input = { userId: USER_ID, appId: APP_A, role: 'Engineer', allocationPct: 50 }

  it('lets a manager scoped to the app add a person', async () => {
    asManagerOf(APP_A)
    batchMock.mockResolvedValue([[{ id: ASSIGNMENT_ID }]])
    selectRows.set(assignments, [{ userId: USER_ID, allocationPct: 50 }])

    const res = await assignUser(input)

    expect(res.ok).toBe(true)
    expect(requireCapabilityMock).toHaveBeenCalledWith('app.assign', { appId: APP_A })
  })

  it('refuses a manager scoped to a different app and writes nothing', async () => {
    asManagerOf(APP_B)

    const res = await assignUser(input)

    expect(res).toEqual({ ok: false, error: 'Not allowed' })
    expect(requireCapabilityMock).toHaveBeenCalledWith('app.assign', { appId: APP_A })
    expect(batchMock).not.toHaveBeenCalled()
  })
})

describe('updateAssignment', () => {
  beforeEach(() => {
    selectRows.set(assignments, [
      { id: ASSIGNMENT_ID, userId: USER_ID, appId: APP_A, role: 'Engineer', allocationPct: 50 },
    ])
  })

  it("checks app.assign against the existing assignment's app, not with no resource", async () => {
    asManagerOf(APP_A)
    batchMock.mockResolvedValue([[{ id: ASSIGNMENT_ID }]])

    const res = await updateAssignment(ASSIGNMENT_ID, { allocationPct: 75 })

    expect(res.ok).toBe(true)
    expect(requireCapabilityMock).toHaveBeenCalledWith('app.assign', { appId: APP_A })
  })

  it("refuses a manager who does not run this assignment's app", async () => {
    asManagerOf(APP_B)

    const res = await updateAssignment(ASSIGNMENT_ID, { allocationPct: 75 })

    expect(res).toEqual({ ok: false, error: 'Not allowed' })
    expect(batchMock).not.toHaveBeenCalled()
  })
})

describe('removeAssignment', () => {
  beforeEach(() => {
    selectRows.set(assignments, [
      { id: ASSIGNMENT_ID, userId: USER_ID, appId: APP_A, role: 'Engineer', allocationPct: 50 },
    ])
  })

  it("checks app.assign against the existing assignment's app", async () => {
    asManagerOf(APP_A)
    batchMock.mockResolvedValue([undefined, undefined, [{ id: ASSIGNMENT_ID }]])

    const res = await removeAssignment(ASSIGNMENT_ID)

    expect(res.ok).toBe(true)
    expect(requireCapabilityMock).toHaveBeenCalledWith('app.assign', { appId: APP_A })
  })

  it("refuses a manager who does not run this assignment's app", async () => {
    asManagerOf(APP_B)

    const res = await removeAssignment(ASSIGNMENT_ID)

    expect(res).toEqual({ ok: false, error: 'Not allowed' })
    expect(batchMock).not.toHaveBeenCalled()
  })
})
