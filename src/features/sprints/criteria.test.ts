import { beforeEach, describe, expect, it, vi } from 'vitest'
import { acceptanceCriteria } from '@/db/schema'
import { liveApps, liveTasks } from '@/db/live'
import {
  applyMovePlan,
  criterionBody,
  formatCriteriaSummary,
  planMove,
  sortCriteria,
  summarizeCriteria,
  verdictDetail,
} from './criteria'

// ---------------------------------------------------------------------------
// Pure logic
// ---------------------------------------------------------------------------

const at = (ms: number) => new Date(ms)
const row = (id: string, sortOrder: number, createdAt = 0) => ({ id, sortOrder, createdAt: at(createdAt) })

describe('summarizeCriteria', () => {
  it('counts each verdict and the untested remainder', () => {
    const s = summarizeCriteria([{ qaVerdict: 'pass' }, { qaVerdict: 'pass' }, { qaVerdict: 'fail' }, { qaVerdict: null }])
    expect(s).toEqual({ total: 4, passed: 2, failed: 1, untested: 1, allPassed: false })
  })

  it('is allPassed only when every criterion passed', () => {
    expect(summarizeCriteria([{ qaVerdict: 'pass' }, { qaVerdict: 'pass' }]).allPassed).toBe(true)
  })

  // An empty checklist has not been "verified" — it has not been written.
  it('is not allPassed for an empty list', () => {
    expect(summarizeCriteria([])).toEqual({ total: 0, passed: 0, failed: 0, untested: 0, allPassed: false })
  })
})

describe('formatCriteriaSummary', () => {
  it('omits the failed clause when nothing failed', () => {
    expect(formatCriteriaSummary(summarizeCriteria([{ qaVerdict: 'pass' }, { qaVerdict: null }]))).toBe('1 of 2 passed')
  })
  it('appends failures', () => {
    const s = summarizeCriteria([{ qaVerdict: 'pass' }, { qaVerdict: 'fail' }, { qaVerdict: null }])
    expect(formatCriteriaSummary(s)).toBe('1 of 3 passed · 1 failed')
  })
  it('says so when empty', () => {
    expect(formatCriteriaSummary(summarizeCriteria([]))).toBe('None yet')
  })
})

describe('criterionBody', () => {
  it('trims and rejects blank or over-long text', () => {
    expect(criterionBody.parse('  Reset link expires  ')).toBe('Reset link expires')
    expect(criterionBody.safeParse('   ').success).toBe(false)
    expect(criterionBody.safeParse('x'.repeat(501)).success).toBe(false)
    expect(criterionBody.safeParse('x'.repeat(500)).success).toBe(true)
  })
})

describe('sortCriteria', () => {
  it('orders by rank, then creation time, then id', () => {
    const sorted = sortCriteria([row('c', 0, 5), row('b', 0, 1), row('a', 0, 1), row('z', -1, 9)])
    expect(sorted.map((r) => r.id)).toEqual(['z', 'a', 'b', 'c'])
  })
})

describe('planMove', () => {
  const list = [row('a', 1024), row('b', 2048), row('c', 3072)]

  it('returns null at either end and for an unknown id', () => {
    expect(planMove(list, 'a', 'up')).toBeNull()
    expect(planMove(list, 'c', 'down')).toBeNull()
    expect(planMove(list, 'nope', 'up')).toBeNull()
  })

  it('moves up into the gap above its upper neighbour', () => {
    const plan = planMove(list, 'c', 'up')
    expect(plan).toEqual({ kind: 'rank', sortOrder: 1536 })
    const moved = sortCriteria(applyMovePlan(list, 'c', plan!))
    expect(moved.map((r) => r.id)).toEqual(['a', 'c', 'b'])
  })

  it('moves down past its lower neighbour', () => {
    const plan = planMove(list, 'a', 'down')
    const moved = sortCriteria(applyMovePlan(list, 'a', plan!))
    expect(moved.map((r) => r.id)).toEqual(['b', 'a', 'c'])
  })

  // Regression guard for the reason planMove is not a rank swap: rows tied at
  // the DB default would swap into the same tie and never move.
  it('rebalances a tied list and still moves the row', () => {
    const tied = [row('a', 0, 1), row('b', 0, 2), row('c', 0, 3)]
    const plan = planMove(tied, 'c', 'up')
    expect(plan?.kind).toBe('rebalance')
    const moved = sortCriteria(applyMovePlan(tied, 'c', plan!))
    expect(moved.map((r) => r.id)).toEqual(['a', 'c', 'b'])
  })
})

describe('verdictDetail', () => {
  it('reads as an activity fragment', () => {
    expect(verdictDetail('pass', 'User can reset')).toBe('marked criterion as passed: “User can reset”')
    expect(verdictDetail('fail', 'x')).toContain('failed')
    expect(verdictDetail(null, 'x')).toContain('cleared')
  })
  it('truncates long bodies', () => {
    expect(verdictDetail('pass', 'y'.repeat(200)).length).toBeLessThan(120)
  })
})

// ---------------------------------------------------------------------------
// Server actions, with the DB, session, capability guard and activity log
// mocked. Selects are answered from a per-table queue (same idea as
// task-actions.test.ts's table-keyed map, but a queue because moveCriterion
// reads acceptance_criteria twice).
// ---------------------------------------------------------------------------

const { sessionMock, capabilityMock, logActivityMock, selectQueue, writes } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  capabilityMock: vi.fn(),
  logActivityMock: vi.fn(),
  selectQueue: new Map<unknown, unknown[][]>(),
  writes: [] as { op: string; table?: unknown; values?: unknown }[],
}))
const appTrash = vi.hoisted(() => ({ on: false }))

vi.mock('@/lib/session', () => ({ getSession: sessionMock }))
vi.mock('@/features/auth/actor', () => ({ requireCapability: capabilityMock }))
vi.mock('@/features/activity/log', () => ({ logActivity: logActivityMock }))
vi.mock('@/db', () => {
  const thenable = <T,>(value: T) => ({
    then: (resolve: (v: T) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(value).then(resolve, reject),
  })
  function builder(table: unknown) {
    const rows = () => selectQueue.get(table)?.shift() ?? []
    const self: Record<string, unknown> = {}
    let gone = false
    for (const m of ['where', 'limit', 'leftJoin', 'orderBy']) self[m] = () => self
    // A read inner-joined to liveApps comes back empty while the project is
    // "in Trash" (appTrash.on).
    self.innerJoin = (joined: unknown) => {
      if (joined === liveApps && appTrash.on) gone = true
      return self
    }
    self.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(gone ? [] : rows()).then(resolve, reject)
    return self
  }
  return {
    db: {
      select: () => ({ from: (table: unknown) => builder(table) }),
      insert: (table: unknown) => ({
        values: (values: Record<string, unknown>) => {
          writes.push({ op: 'insert', table, values })
          return {
            returning: async () => [{ id: 'new-1', createdAt: new Date(0), verifiedBy: null, verifiedAt: null, ...values }],
          }
        },
      }),
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: () => {
            writes.push({ op: 'update', table, values })
            return thenable(undefined)
          },
        }),
      }),
      delete: (table: unknown) => ({
        where: () => {
          writes.push({ op: 'delete', table })
          return thenable(undefined)
        },
      }),
      batch: async (statements: unknown[]) => {
        writes.push({ op: 'batch', values: statements.length })
      },
    },
  }
})

const { addCriterion, editCriterion, deleteCriterion, listCriteria, moveCriterion, setVerdict } = await import(
  './criteria-actions'
)

const TASK = '11111111-1111-4111-8111-111111111111'
const CRIT = '22222222-2222-4222-8222-222222222222'
const CRIT2 = '33333333-3333-4333-8333-333333333333'

const task = { id: TASK, appId: 'app-1', assigneeId: 'member-1', title: 'Password reset' }
const crit = (overrides: Record<string, unknown> = {}) => ({
  id: CRIT,
  body: 'User can request password reset',
  qaVerdict: null,
  taskId: TASK,
  appId: 'app-1',
  assigneeId: 'member-1',
  title: 'Password reset',
  ...overrides,
})
const queue = (table: unknown, ...results: unknown[][]) => selectQueue.set(table, results)

beforeEach(() => {
  sessionMock.mockReset().mockResolvedValue({ user: { id: 'qa-1', name: 'Quinn QA' } })
  capabilityMock.mockReset().mockResolvedValue({ id: 'qa-1' })
  logActivityMock.mockReset()
  selectQueue.clear()
  writes.length = 0
})

describe('criteria actions', () => {
  it('refuses an anonymous caller before any read', async () => {
    sessionMock.mockResolvedValue(null)
    queue(liveTasks, [task])
    expect(await listCriteria(TASK)).toEqual({ ok: false, error: 'Sign in required' })
    expect(selectQueue.get(liveTasks)).toHaveLength(1)
  })

  it('gates the list on app.view with the appId from the task row', async () => {
    queue(liveTasks, [task])
    queue(acceptanceCriteria, [{ id: CRIT, qaVerdict: 'pass', verifiedByName: 'Quinn QA' }])
    const res = await listCriteria(TASK)
    expect(res.ok).toBe(true)
    expect(capabilityMock).toHaveBeenCalledWith('app.view', { appId: 'app-1' })
  })

  it('reports a soft-deleted or missing task as not found', async () => {
    queue(liveTasks, [])
    expect(await listCriteria(TASK)).toEqual({ ok: false, error: 'Task not found' })
  })

  it('treats a task in a trashed project as not found, and its criteria as unwritable', async () => {
    appTrash.on = true
    try {
      queue(liveTasks, [task])
      expect(await listCriteria(TASK)).toEqual({ ok: false, error: 'Task not found' })
      queue(acceptanceCriteria, [crit()])
      expect((await editCriterion(CRIT, 'new words')).ok).toBe(false)
      expect(writes).toHaveLength(0)
    } finally {
      appTrash.on = false
    }
  })

  it('appends a new criterion after the last rank, gated on task.edit with the assignee', async () => {
    queue(liveTasks, [task])
    queue(acceptanceCriteria, [{ sortOrder: 1024 }, { sortOrder: 4096 }])
    const res = await addCriterion(TASK, '  Reset link expires  ')
    expect(res.ok).toBe(true)
    expect(capabilityMock).toHaveBeenCalledWith('task.edit', { appId: 'app-1', ownerId: 'member-1' })
    expect(writes[0]).toMatchObject({ op: 'insert', values: { body: 'Reset link expires', sortOrder: 5120, taskId: TASK } })
    expect(logActivityMock).toHaveBeenCalledWith(expect.objectContaining({ verb: 'updated', entityType: 'task', entityId: TASK }))
  })

  it('caps a task at 50 criteria', async () => {
    queue(liveTasks, [task])
    queue(acceptanceCriteria, Array.from({ length: 50 }, (_, i) => ({ sortOrder: i })))
    const res = await addCriterion(TASK, 'One more')
    expect(res.ok).toBe(false)
    expect(writes).toHaveLength(0)
  })

  it('rejects a blank body and a non-uuid id without touching the DB', async () => {
    expect((await addCriterion(TASK, '   ')).ok).toBe(false)
    expect((await addCriterion('not-a-uuid', 'x')).ok).toBe(false)
    expect(writes).toHaveLength(0)
  })

  it('refuses a caller without task.edit and writes nothing', async () => {
    capabilityMock.mockResolvedValue(null)
    queue(acceptanceCriteria, [crit()])
    expect(await setVerdict(CRIT, 'pass')).toEqual({ ok: false, error: 'Not allowed' })
    expect(writes).toHaveLength(0)
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('editing the text clears the verdict', async () => {
    queue(acceptanceCriteria, [crit({ qaVerdict: 'pass' })])
    const res = await editCriterion(CRIT, 'User can request a reset by email')
    expect(res.ok).toBe(true)
    expect(writes[0]).toMatchObject({
      op: 'update',
      values: { body: 'User can request a reset by email', qaVerdict: null, verifiedBy: null, verifiedAt: null },
    })
  })

  it('saving unchanged text keeps the verdict and writes nothing', async () => {
    queue(acceptanceCriteria, [crit({ qaVerdict: 'pass' })])
    expect((await editCriterion(CRIT, ' User can request password reset ')).ok).toBe(true)
    expect(writes).toHaveLength(0)
  })

  it('records a verdict with the actor and time, and null clears both', async () => {
    queue(acceptanceCriteria, [crit()], [crit({ qaVerdict: 'pass' })])
    const passed = await setVerdict(CRIT, 'pass')
    expect(passed.ok && passed.data).toMatchObject({ qaVerdict: 'pass', verifiedBy: 'qa-1', verifiedByName: 'Quinn QA' })
    expect(writes[0].values).toMatchObject({ qaVerdict: 'pass', verifiedBy: 'qa-1' })
    expect((writes[0].values as { verifiedAt: unknown }).verifiedAt).toBeInstanceOf(Date)
    expect(logActivityMock).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.stringContaining('marked criterion as passed') }))

    const cleared = await setVerdict(CRIT, null)
    expect(cleared.ok).toBe(true)
    expect(writes[1].values).toEqual({ qaVerdict: null, verifiedBy: null, verifiedAt: null })
  })

  it('rejects an unknown verdict', async () => {
    expect((await setVerdict(CRIT, 'maybe' as never)).ok).toBe(false)
  })

  it('deletes and logs the body that no longer exists anywhere else', async () => {
    queue(acceptanceCriteria, [crit()])
    expect((await deleteCriterion(CRIT)).ok).toBe(true)
    expect(writes[0]).toMatchObject({ op: 'delete', table: acceptanceCriteria })
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ body: 'User can request password reset' }) }),
    )
  })

  it('moves with a single rank write when there is a gap', async () => {
    queue(acceptanceCriteria, [crit({ id: CRIT2 })], [
      { id: CRIT, sortOrder: 1024, createdAt: new Date(0) },
      { id: CRIT2, sortOrder: 2048, createdAt: new Date(1) },
    ])
    const res = await moveCriterion(CRIT2, 'up')
    expect(res).toEqual({ ok: true, data: [{ id: CRIT2, sortOrder: 0 }] })
    expect(writes).toEqual([expect.objectContaining({ op: 'update', values: { sortOrder: 0 } })])
  })

  it('batches a rebalance when the ranks tie', async () => {
    // Three rows, so moving the last one up lands BETWEEN two tied ranks
    // (with two, it lands at the open head and needs no rebalance).
    const CRIT3 = '44444444-4444-4444-8444-444444444444'
    queue(acceptanceCriteria, [crit({ id: CRIT3 })], [
      { id: CRIT, sortOrder: 0, createdAt: new Date(0) },
      { id: CRIT2, sortOrder: 0, createdAt: new Date(1) },
      { id: CRIT3, sortOrder: 0, createdAt: new Date(2) },
    ])
    const res = await moveCriterion(CRIT3, 'up')
    expect(res).toEqual({
      ok: true,
      data: [
        { id: CRIT, sortOrder: 1024 },
        { id: CRIT3, sortOrder: 2048 },
        { id: CRIT2, sortOrder: 3072 },
      ],
    })
    // The mock records each built UPDATE, then the one batch that runs them.
    expect(writes.at(-1)).toEqual({ op: 'batch', values: 3 })
  })

  it('treats a move past the end as a no-op success', async () => {
    queue(acceptanceCriteria, [crit()], [{ id: CRIT, sortOrder: 1024, createdAt: new Date(0) }])
    expect((await moveCriterion(CRIT, 'up')).ok).toBe(true)
    expect(writes).toHaveLength(0)
  })
})
