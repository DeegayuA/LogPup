import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activityLog, notifications, tasks, users } from '@/db/schema'
import {
  noteMaintenanceArmed,
  resetMaintenanceSnapshot,
} from '@/features/maintenance/freeze-snapshot'
import { gateBatch, gateWrite } from './write-gate'

/**
 * The freeze at the database boundary.
 *
 * The capability guard is tested through the actions it refuses; this is the
 * other half — the layer that catches the fourteen files which write without
 * ever calling that guard. It is mocked at the decision, not at the plumbing:
 * what is under test is whether the builder actually waits for the answer.
 */
const assertWritable = vi.fn<() => Promise<void>>()
vi.mock('@/features/maintenance/write-freeze', () => ({
  assertWritable: () => assertWritable(),
}))

/** A stand-in for a drizzle query builder: chainable, and finally thenable. */
function fakeBuilder(result: unknown = ['row']) {
  const builder: Record<string, unknown> = {}
  const self = () => builder
  builder.values = self
  builder.set = self
  builder.where = self
  builder.returning = self
  builder.onConflictDoNothing = self
  builder.then = (onFulfilled?: (value: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return builder
}

beforeEach(() => {
  vi.clearAllMocks()
  assertWritable.mockResolvedValue(undefined)
  resetMaintenanceSnapshot()
})

describe('when nothing is armed', () => {
  it('hands the builder straight back, untouched', () => {
    noteMaintenanceArmed(false)
    const builder = fakeBuilder()
    expect(gateWrite(tasks, builder)).toBe(builder)
  })

  it('never asks the question, so an ordinary write costs nothing', async () => {
    noteMaintenanceArmed(false)
    await gateWrite(tasks, fakeBuilder())
    await gateBatch([fakeBuilder()])
    expect(assertWritable).not.toHaveBeenCalled()
  })
})

// A process that has never read the row must go and find out rather than
// concluding the workspace is open. See freeze-snapshot.ts.
describe('when this process has not looked yet', () => {
  it('checks anyway', async () => {
    await gateWrite(tasks, fakeBuilder())
    expect(assertWritable).toHaveBeenCalledTimes(1)
  })
})

describe('while a window is armed', () => {
  beforeEach(() => noteMaintenanceArmed(true))

  it('checks the freeze before the write, and only when it is awaited', async () => {
    const gated = gateWrite(tasks, fakeBuilder())
    // Constructing the query asks nothing — the check belongs to the await.
    expect(assertWritable).not.toHaveBeenCalled()
    await gated
    expect(assertWritable).toHaveBeenCalledTimes(1)
  })

  it('stays gated through a whole chain of builder calls', async () => {
    const gated = gateWrite(tasks, fakeBuilder()) as ReturnType<typeof fakeBuilder>
    const chained = (gated.values as () => ReturnType<typeof fakeBuilder>)()
    await (chained.where as () => ReturnType<typeof fakeBuilder>)()
    expect(assertWritable).toHaveBeenCalledTimes(1)
  })

  it('refuses the write when the freeze says no', async () => {
    assertWritable.mockRejectedValue(new Error('LogPup is in maintenance'))
    await expect(gateWrite(tasks, fakeBuilder())).rejects.toThrow('LogPup is in maintenance')
  })

  it('still resolves to the real result when the freeze says yes', async () => {
    await expect(gateWrite(tasks, fakeBuilder(['written']))).resolves.toEqual(['written'])
  })

  // Every one of these is a table without which the window could not be ended
  // or explained. Signing in is a write; freezing it would strand the admin
  // who has to end the window outside the app.
  it.each([
    ['users', users],
    ['activity_log', activityLog],
    ['notifications', notifications],
  ])('lets %s through, because the freeze depends on it', async (_name, table) => {
    const builder = fakeBuilder()
    expect(gateWrite(table, builder)).toBe(builder)
    await gateWrite(table, builder)
    expect(assertWritable).not.toHaveBeenCalled()
  })
})

describe('db.batch, which runs its statements itself', () => {
  beforeEach(() => noteMaintenanceArmed(true))

  it('is checked when it holds even one freezable statement', async () => {
    await gateBatch([gateWrite(users, fakeBuilder()), gateWrite(tasks, fakeBuilder())])
    expect(assertWritable).toHaveBeenCalledTimes(1)
  })

  // The passkey login token is written in a batch. A freeze that stopped it
  // would stop an admin signing in to end the window.
  it('passes through when every statement is exempt', async () => {
    await gateBatch([gateWrite(users, fakeBuilder()), gateWrite(notifications, fakeBuilder())])
    expect(assertWritable).not.toHaveBeenCalled()
  })

  it('refuses the whole batch when the freeze says no', async () => {
    assertWritable.mockRejectedValue(new Error('frozen'))
    await expect(gateBatch([gateWrite(tasks, fakeBuilder())])).rejects.toThrow('frozen')
  })
})
