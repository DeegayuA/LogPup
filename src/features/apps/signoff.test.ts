import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Actor } from '@/features/auth/capabilities'

// Same mocked-action idiom as src/features/admin/trash-actions.test.ts:
// vi.hoisted + vi.mock the one collaborator, then import the module under
// test. `createChangeRequest` is a real 'use server' action (db writes,
// zod parsing) — none of that runs here; only that routeForSignoff calls it
// with the right shape and relays what it returns.
const { createChangeRequestMock } = vi.hoisted(() => ({
  createChangeRequestMock: vi.fn(),
}))

vi.mock('@/features/admin/change-request-actions', () => ({
  createChangeRequest: createChangeRequestMock,
}))

const { routeForSignoff } = await import('./signoff')

const actor = (role: Actor['role'], overrides: Partial<Actor> = {}): Actor => ({
  id: 'actor-1',
  role,
  scopeAppIds: new Set(['app-1']),
  ...overrides,
})

const baseReq = {
  action: 'app.edit' as const,
  entityId: 'app-1',
  entityLabel: 'Project X',
  appId: 'app-1',
  operation: 'edit' as const,
  before: { name: 'Project X' },
  after: { name: 'Project X renamed' },
  reason: 'renaming per client request',
}

beforeEach(() => {
  createChangeRequestMock.mockReset()
})

describe('routeForSignoff', () => {
  it('auto_save: returns null and files nothing — caller proceeds as today', async () => {
    const result = await routeForSignoff(actor('manager'), {
      ...baseReq,
      gate: { changePolicy: 'auto_save', leadId: 'lead-1' },
    })
    expect(result).toBeNull()
    expect(createChangeRequestMock).not.toHaveBeenCalled()
  })

  it('lead_approval + PM (scoped, not the lead): files through createChangeRequest, returns its id', async () => {
    createChangeRequestMock.mockResolvedValue({ ok: true, data: { id: 'req-9' } })
    const result = await routeForSignoff(actor('manager'), {
      ...baseReq,
      gate: { changePolicy: 'lead_approval', leadId: 'lead-1' },
    })
    expect(result).toEqual({ id: 'req-9' })
    expect(createChangeRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'app',
        entityId: 'app-1',
        entityLabel: 'Project X',
        operation: 'edit',
        appId: 'app-1',
        reason: 'renaming per client request',
        payload: { before: baseReq.before, after: baseReq.after },
      }),
    )
  })

  it('lead_approval + actor is the named lead: never queues their own change', async () => {
    const result = await routeForSignoff(actor('manager', { id: 'lead-1' }), {
      ...baseReq,
      gate: { changePolicy: 'lead_approval', leadId: 'lead-1' },
    })
    expect(result).toBeNull()
    expect(createChangeRequestMock).not.toHaveBeenCalled()
  })

  it('lead_approval + admin: bypasses — admin holds "all", never "scoped"', async () => {
    const result = await routeForSignoff(actor('admin'), {
      ...baseReq,
      gate: { changePolicy: 'lead_approval', leadId: 'lead-1' },
    })
    expect(result).toBeNull()
    expect(createChangeRequestMock).not.toHaveBeenCalled()
  })

  it('lead_approval + no tech lead named: degrades to auto-save', async () => {
    const result = await routeForSignoff(actor('manager'), {
      ...baseReq,
      gate: { changePolicy: 'lead_approval', leadId: null },
    })
    expect(result).toBeNull()
    expect(createChangeRequestMock).not.toHaveBeenCalled()
  })

  it('filing fails despite needsSignoff saying yes: throws rather than letting the caller read null as "proceed"', async () => {
    createChangeRequestMock.mockResolvedValue({ ok: false, error: 'boom' })
    await expect(
      routeForSignoff(actor('manager'), {
        ...baseReq,
        gate: { changePolicy: 'lead_approval', leadId: 'lead-1' },
      }),
    ).rejects.toThrow(/boom/)
  })
})
