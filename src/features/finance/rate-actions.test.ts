import { beforeEach, describe, expect, it, vi } from 'vitest'
import { personRates, rateCards, users } from '@/db/schema'

/**
 * The amount-leak guard rate-actions.ts has never had a test file for
 * (before this one, the directory held only cost.test.ts). See the spec's
 * "privacy finding": all five `logActivity` payloads were read line by line
 * and none carries `hourly`/`contractValue`/`subscriptionMonthly` — WHY that
 * matters is that `activity.view` reaches every seat but stakeholder
 * (capabilities.ts:201), far wider than `finance.view` (admin/superadmin
 * only, capabilities.ts:230). This test exists to fail the day someone
 * helpfully adds the figure to a payload, since nothing else here would
 * catch it — the field types allow it, only the file's own discipline
 * doesn't.
 */

const { requireCapabilityMock, logActivityMock, selectRows } = vi.hoisted(() => ({
  requireCapabilityMock: vi.fn(),
  logActivityMock: vi.fn(),
  selectRows: new Map<unknown, unknown[]>(),
}))

vi.mock('@/features/auth/actor', () => ({ requireCapability: requireCapabilityMock }))
vi.mock('@/features/activity/log', () => ({ logActivity: logActivityMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/db', () => {
  function selectBuilder(table: unknown) {
    const rows = () => selectRows.get(table) ?? []
    const self: Record<string, unknown> = {}
    for (const m of ['where', 'limit', 'orderBy']) self[m] = () => self
    self.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
      Promise.resolve(rows()).then(resolve, reject)
    return self
  }
  // insert/update chains: awaitable on their own (setProjectValue's
  // insert…onConflictDoUpdate and closeRoleRate/closePersonRate's update
  // never call .returning()), and .returning() resolves to a fixed row for
  // the two actions that do (setRoleRate, setPersonRate).
  function writeChain(): Record<string, unknown> {
    const self: Record<string, unknown> = {}
    for (const m of ['values', 'set', 'where', 'onConflictDoUpdate']) self[m] = () => self
    self.returning = () => Promise.resolve([{ id: 'new-row-id' }])
    self.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
      Promise.resolve(undefined).then(resolve, reject)
    return self
  }
  return {
    db: {
      select: () => ({ from: (table: unknown) => selectBuilder(table) }),
      insert: () => writeChain(),
      update: () => writeChain(),
    },
  }
})

const { setRoleRate, closeRoleRate, setPersonRate, closePersonRate, setProjectValue } = await import(
  './rate-actions'
)

const actor = { id: 'admin-1', role: 'admin' as const }
const USER_ID = '11111111-1111-4111-8111-111111111111'
const APP_ID = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  requireCapabilityMock.mockReset()
  requireCapabilityMock.mockResolvedValue(actor)
  logActivityMock.mockReset()
  selectRows.clear()
})

/**
 * Stringifies the WHOLE captured logActivity argument — entityLabel, detail
 * and metadata together, exactly as the spec's Task 1 requires — and asserts
 * the amount just passed into the action does not appear anywhere in it. Not
 * "absent from a named field": a future edit that smuggles the figure into a
 * label or a detail string instead of a metadata key must fail this too.
 */
function assertPayloadHasNoAmount(...forbidden: string[]) {
  expect(logActivityMock).toHaveBeenCalledTimes(1)
  const serialized = JSON.stringify(logActivityMock.mock.calls[0][0])
  for (const value of forbidden) expect(serialized).not.toContain(value)
}

describe('activity-log amount leak guard (rate-actions.ts)', () => {
  it('setRoleRate logs no trace of the hourly figure', async () => {
    selectRows.set(rateCards, []) // no overlapping interval
    const result = await setRoleRate({
      role: 'Engineer',
      hourly: 1234.56,
      currency: 'LKR',
      effectiveFrom: '2026-01-01',
    })
    expect(result.ok).toBe(true)
    assertPayloadHasNoAmount('1234.56', '1234')
    expect(JSON.stringify(logActivityMock.mock.calls[0][0])).not.toMatch(/\bhourly\b/i)
  })

  it('closeRoleRate logs no amount-shaped field', async () => {
    selectRows.set(rateCards, [{ id: 'rc-1', effectiveFrom: '2026-01-01' }])
    const result = await closeRoleRate({ role: 'Engineer', effectiveTo: '2026-06-01' })
    expect(result.ok).toBe(true)
    expect(JSON.stringify(logActivityMock.mock.calls[0][0])).not.toMatch(/\bhourly\b/i)
  })

  it('setPersonRate logs no trace of the hourly figure — the salary-shaped one', async () => {
    selectRows.set(users, [{ name: 'Alex' }])
    selectRows.set(personRates, [])
    const result = await setPersonRate({
      userId: USER_ID,
      hourly: 987654.32,
      currency: 'LKR',
      effectiveFrom: '2026-01-01',
    })
    expect(result.ok).toBe(true)
    assertPayloadHasNoAmount('987654.32', '987654')
    expect(JSON.stringify(logActivityMock.mock.calls[0][0])).not.toMatch(/\bhourly\b/i)
  })

  it('closePersonRate logs no amount-shaped field', async () => {
    selectRows.set(personRates, [{ id: 'pr-1', effectiveFrom: '2026-01-01' }])
    selectRows.set(users, [{ name: 'Alex' }])
    const result = await closePersonRate({ userId: USER_ID, effectiveTo: '2026-06-01' })
    expect(result.ok).toBe(true)
    expect(JSON.stringify(logActivityMock.mock.calls[0][0])).not.toMatch(/\bhourly\b/i)
  })

  it('setProjectValue logs no trace of contractValue or subscriptionMonthly', async () => {
    const result = await setProjectValue({
      appId: APP_ID,
      contractValue: 987654.32,
      subscriptionMonthly: 4321.99,
      subscriptionFrom: '2026-01-01',
      subscriptionTo: null,
      currency: 'LKR',
    })
    expect(result.ok).toBe(true)
    assertPayloadHasNoAmount('987654.32', '987654', '4321.99', '4321')
    // \b, not a bare substring match: the action's own `hasContractValue`/
    // `hasSubscription` booleans are deliberate and fine (they say WHETHER a
    // value is on file, never WHAT it is) — an unanchored match would flag
    // "hasContractValue" as if it were the field this guard exists to catch.
    expect(JSON.stringify(logActivityMock.mock.calls[0][0])).not.toMatch(
      /\bcontractValue\b|\bsubscriptionMonthly\b/i,
    )
  })
})
