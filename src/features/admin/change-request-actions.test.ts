import { beforeEach, describe, expect, it, vi } from 'vitest'
import { liveApps } from '@/db/live'
import { apps, changeRequests } from '@/db/schema'
import type { Actor, UserRole } from '@/features/auth/capabilities'

// Same mocked-action idiom as trash-actions.test.ts / apps/actions.test.ts:
// a fake `db` keyed by table reference with a per-table FIFO of queued SELECT
// answers (a table can be read more than once per action — e.g. an app
// request's leadIdFor lookup, then currentRowFor's), plus spies on write
// calls. loadActor and createNotifications are mocked directly rather than
// exercised through the real auth chain — this file is about filing/approve/
// reject routing and notification resilience, not the permission matrix
// (change-request-routing.test.ts already owns that).
const { authMock, createNotificationsMock, selectQueue, insertReturning, updateSpy, insertSpy } = vi.hoisted(() => ({
  authMock: vi.fn(),
  createNotificationsMock: vi.fn().mockResolvedValue([]),
  selectQueue: new Map<unknown, unknown[][]>(),
  insertReturning: [] as unknown[][],
  updateSpy: vi.fn(),
  insertSpy: vi.fn(),
}))

function queueSelect(table: unknown, rows: unknown[]) {
  const q = selectQueue.get(table) ?? []
  q.push(rows)
  selectQueue.set(table, q)
}

vi.mock('@/features/auth/actor', () => ({ loadActor: authMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/features/notifications/notify', () => ({ createNotifications: createNotificationsMock }))

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          const rows = selectQueue.get(table)?.shift() ?? []
          return {
            then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
              Promise.resolve(rows).then(resolve, reject),
          }
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        insertSpy(table, values)
        return {
          then: (resolve: (v: unknown) => unknown) => Promise.resolve(undefined).then(resolve),
          returning: async () => insertReturning.shift() ?? [{ id: 'cr-new' }],
        }
      },
    }),
    update: (table: unknown) => ({
      set: (values: unknown) => ({
        where: () => {
          updateSpy(table, values)
          return { then: (resolve: (v: unknown) => unknown) => Promise.resolve(undefined).then(resolve) }
        },
      }),
    }),
    batch: async (queries: unknown[]) => Promise.all(queries),
  },
}))

const { createChangeRequest, approveChangeRequest, rejectChangeRequest } =
  await import('./change-request-actions')

const APP_ID = '11111111-1111-4111-8111-111111111111'
const CR_ID = '22222222-2222-4222-8222-222222222222'

const actor = (id: string, role: UserRole, scoped: string[] = []): Actor => ({
  id, role, scopeAppIds: new Set(scoped),
})

beforeEach(() => {
  selectQueue.clear()
  insertReturning.length = 0
  updateSpy.mockClear()
  insertSpy.mockClear()
  createNotificationsMock.mockClear()
  createNotificationsMock.mockResolvedValue([])
  authMock.mockReset()
})

describe('createChangeRequest — app entity allowlist', () => {
  const file = (after: Record<string, unknown>) =>
    createChangeRequest({
      entityType: 'app',
      entityId: APP_ID,
      entityLabel: 'LogPup',
      operation: 'edit' as const,
      appId: APP_ID,
      reason: 'Renaming to match the repo',
      payload: { before: {}, after },
    })

  it('refuses a payload naming pmId', async () => {
    authMock.mockResolvedValue(actor('pm-1', 'manager', [APP_ID]))
    const res = await file({ pmId: 'someone-else' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('pmId')
    // Refused before any write — filing never reaches the insert.
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('refuses a payload naming leadId', async () => {
    authMock.mockResolvedValue(actor('pm-1', 'manager', [APP_ID]))
    const res = await file({ leadId: 'someone-else' })
    expect(res.ok).toBe(false)
  })

  it('refuses a payload naming changePolicy — the column is not live yet', async () => {
    authMock.mockResolvedValue(actor('pm-1', 'manager', [APP_ID]))
    const res = await file({ changePolicy: 'lead_approval' })
    expect(res.ok).toBe(false)
  })

  it('accepts name and description, files, and notifies the lead', async () => {
    authMock.mockResolvedValue(actor('pm-1', 'manager', [APP_ID]))
    insertReturning.push([{ id: CR_ID }])
    // notifyFiled's one extra select, for the app's leadId.
    queueSelect(liveApps, [{ leadId: 'lead-1' }])

    const res = await file({ name: 'New name', description: 'New description' })

    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data.id).toBe(CR_ID)
    expect(createNotificationsMock).toHaveBeenCalledTimes(1)
    const [rows] = createNotificationsMock.mock.calls[0]
    expect(rows[0].userId).toBe('lead-1')
  })

  it('files without notifying when the app has no lead', async () => {
    authMock.mockResolvedValue(actor('pm-1', 'manager', [APP_ID]))
    insertReturning.push([{ id: CR_ID }])
    queueSelect(liveApps, [{ leadId: null }])

    const res = await file({ status: 'active' })

    expect(res.ok).toBe(true)
    expect(createNotificationsMock).not.toHaveBeenCalled()
  })
})

describe('approveChangeRequest — notification is best-effort', () => {
  const pendingAppRequest = {
    id: CR_ID,
    requesterId: 'pm-1',
    entityType: 'app',
    status: 'pending',
    appId: APP_ID,
    entityId: APP_ID,
    entityLabel: 'LogPup',
    operation: 'edit',
    payload: { before: { name: 'Old name' }, after: { name: 'New name' } },
  }

  function primeApprove() {
    queueSelect(changeRequests, [pendingAppRequest]) // the lookup by id
    queueSelect(liveApps, [{ leadId: 'lead-1' }]) // leadIdFor, for mayReview
    queueSelect(liveApps, [{ name: 'Old name' }]) // currentRowFor('app', ...)
  }

  it('sends a notification to the requester on approval', async () => {
    authMock.mockResolvedValue(actor('lead-1', 'manager', [APP_ID]))
    primeApprove()

    const res = await approveChangeRequest({ id: CR_ID })

    expect(res.ok).toBe(true)
    expect(createNotificationsMock).toHaveBeenCalledTimes(1)
    const [rows] = createNotificationsMock.mock.calls[0]
    expect(rows[0].userId).toBe('pm-1')
    expect(rows[0].kind).toBe('change_request.approved')
  })

  it('still reports the approval as ok when the notification rejects', async () => {
    authMock.mockResolvedValue(actor('lead-1', 'manager', [APP_ID]))
    primeApprove()
    createNotificationsMock.mockRejectedValueOnce(new Error('notify down'))

    const res = await approveChangeRequest({ id: CR_ID })

    // The write (apps update + changeRequests status + activityLog, all in
    // one db.batch) already landed before notifyDecision runs — a rejected
    // promise there must never flip this to err().
    expect(res.ok).toBe(true)
    expect(updateSpy).toHaveBeenCalledWith(apps, { name: 'New name' })
  })

  it('refuses a co-PM who is not the app lead — never reaches the batch', async () => {
    queueSelect(changeRequests, [pendingAppRequest])
    queueSelect(liveApps, [{ leadId: 'lead-1' }]) // leadIdFor: someone else is the lead
    authMock.mockResolvedValue(actor('co-pm', 'manager', [APP_ID]))

    const res = await approveChangeRequest({ id: CR_ID })

    expect(res.ok).toBe(false)
    expect(updateSpy).not.toHaveBeenCalled()
    expect(createNotificationsMock).not.toHaveBeenCalled()
  })
})

describe('rejectChangeRequest — notification is best-effort', () => {
  const pendingRequest = {
    id: CR_ID,
    requesterId: 'pm-1',
    entityType: 'task',
    status: 'pending',
    appId: APP_ID,
    entityLabel: 'Ship the thing',
    operation: 'edit',
  }

  it('sends a notification to the requester on rejection', async () => {
    authMock.mockResolvedValue(actor('a1', 'admin'))
    queueSelect(changeRequests, [pendingRequest])

    const res = await rejectChangeRequest({ id: CR_ID, note: 'Not this sprint' })

    expect(res.ok).toBe(true)
    expect(createNotificationsMock).toHaveBeenCalledTimes(1)
    const [rows] = createNotificationsMock.mock.calls[0]
    expect(rows[0].userId).toBe('pm-1')
    expect(rows[0].kind).toBe('change_request.rejected')
    expect(rows[0].params.note).toBe('Not this sprint')
  })

  it('still reports the rejection as ok when the notification rejects', async () => {
    authMock.mockResolvedValue(actor('a1', 'admin'))
    queueSelect(changeRequests, [pendingRequest])
    createNotificationsMock.mockRejectedValueOnce(new Error('notify down'))

    const res = await rejectChangeRequest({ id: CR_ID })
    expect(res.ok).toBe(true)
  })
})
