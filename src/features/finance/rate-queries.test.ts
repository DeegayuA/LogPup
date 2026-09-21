import { beforeEach, describe, expect, it, vi } from 'vitest'

// The gate is the FIRST statement of every body, before any row is touched —
// so an ungated actor must produce zero calls into `db.select`, not merely a
// discarded result. `selectMock` records every call so the assertion can
// prove the read never happened, rather than happened-and-was-thrown-away.
const { requireCapabilityMock, selectMock } = vi.hoisted(() => ({
  requireCapabilityMock: vi.fn(),
  selectMock: vi.fn(),
}))

vi.mock('@/features/auth/actor', () => ({ requireCapability: requireCapabilityMock }))
vi.mock('@/db', () => {
  function chain(): Record<string, unknown> {
    const self: Record<string, unknown> = {}
    for (const m of ['from', 'leftJoin', 'innerJoin', 'orderBy']) self[m] = () => self
    self.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
      Promise.resolve([]).then(resolve, reject)
    return self
  }
  return {
    db: {
      select: (...args: unknown[]) => {
        selectMock(...args)
        return chain()
      },
    },
  }
})

const { listRoleRates, listPersonRates, listProjectValues } = await import('./rate-queries')

beforeEach(() => {
  requireCapabilityMock.mockReset()
  selectMock.mockReset()
})

describe('the finance.view gate runs before any read', () => {
  it.each([
    ['listRoleRates', listRoleRates],
    ['listPersonRates', listPersonRates],
    ['listProjectValues', listProjectValues],
  ] as const)('%s denies an ungated actor and never touches db.select', async (_name, fn) => {
    requireCapabilityMock.mockResolvedValue(null)

    const result = await fn()

    expect(result).toEqual({ state: 'denied' })
    // The gate-before-read contract, proven directly: not "the rows came back
    // empty" (which a WHERE clause could also produce) but "no query ran".
    expect(selectMock).not.toHaveBeenCalled()
  })

  it.each([
    ['listRoleRates', listRoleRates],
    ['listPersonRates', listPersonRates],
    ['listProjectValues', listProjectValues],
  ] as const)('%s reads once a gated actor is confirmed', async (_name, fn) => {
    requireCapabilityMock.mockResolvedValue({ id: 'admin-1', role: 'admin', scopeAppIds: new Set() })

    const result = await fn()

    expect(result).toEqual({ state: 'ok', rows: [] })
    expect(selectMock).toHaveBeenCalledTimes(1)
  })
})
