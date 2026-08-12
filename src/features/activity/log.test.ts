import { beforeEach, describe, expect, it, vi } from 'vitest'

// logActivity's one contract: it NEVER throws. A trail row is bookkeeping;
// the action that calls it has already done the user's work, and a logging
// failure must not turn that success into an error toast. These tests hit
// both sides — the happy path writes the right shape, the failure path
// swallows and reports.
const { insertSpy, valuesSpy } = vi.hoisted(() => ({
  insertSpy: vi.fn(),
  valuesSpy: vi.fn(),
}))

vi.mock('@/db', () => ({
  db: {
    insert: (...args: unknown[]) => {
      insertSpy(...args)
      return { values: valuesSpy }
    },
  },
}))

const { logActivity } = await import('./log')

const INPUT = {
  actorId: '11111111-1111-4111-8111-111111111111',
  verb: 'moved',
  entityType: 'task' as const,
  entityId: '22222222-2222-4222-8222-222222222222',
  entityLabel: 'Fix login',
  appId: '33333333-3333-4333-8333-333333333333',
  appName: 'logpup',
  pagePath: '/apps/logpup',
  detail: 'to In progress',
  metadata: { status: { from: 'todo', to: 'in_progress' } },
}

beforeEach(() => {
  insertSpy.mockReset()
  valuesSpy.mockReset()
  valuesSpy.mockResolvedValue(undefined)
})

describe('logActivity', () => {
  it('writes the full row shape', async () => {
    await logActivity(INPUT)
    expect(valuesSpy).toHaveBeenCalledWith({
      actorId: INPUT.actorId,
      verb: 'moved',
      entityType: 'task',
      entityId: INPUT.entityId,
      entityLabel: 'Fix login',
      appId: INPUT.appId,
      appName: 'logpup',
      pagePath: '/apps/logpup',
      detail: 'to In progress',
      metadata: INPUT.metadata,
    })
  })

  it('defaults every optional field to null, not undefined', async () => {
    const { actorId, verb, entityType, entityId, entityLabel } = INPUT
    await logActivity({ actorId, verb, entityType, entityId, entityLabel })
    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ appId: null, appName: null, pagePath: null, detail: null, metadata: null }),
    )
  })

  it('swallows a database failure and reports it to the console', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    valuesSpy.mockRejectedValue(new Error('connection refused'))
    await expect(logActivity(INPUT)).resolves.toBeUndefined()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('swallows a synchronous insert failure too', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    insertSpy.mockImplementation(() => {
      throw new Error('bad table')
    })
    await expect(logActivity(INPUT)).resolves.toBeUndefined()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
