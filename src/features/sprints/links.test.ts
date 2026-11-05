import { beforeEach, describe, expect, it, vi } from 'vitest'
import { workLinks } from '@/db/schema'
import { liveApps, liveBugReports, liveTasks } from '@/db/live'
import {
  LINK_CHOICES,
  describeLink,
  edgeFor,
  escapeLike,
  groupLinksByLabel,
  linkConflict,
  mergeTargets,
} from './links'

// Pure helpers first, then the actions with db/auth/actor mocked. The select
// mock is a per-table QUEUE rather than task-actions.test.ts's per-table
// value: listTaskLinks reads liveTasks twice (the viewing task, then the far
// ends), and the two reads must be able to answer differently.
const { authMock, capabilityMock, logActivityMock, selectQueues, insertMock, deleteMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  capabilityMock: vi.fn(),
  logActivityMock: vi.fn(),
  selectQueues: new Map<unknown, unknown[][]>(),
  insertMock: vi.fn(),
  deleteMock: vi.fn(),
}))
// When on, a read inner-joined to liveApps comes back empty: the task's
// project is in Trash.
const appTrash = vi.hoisted(() => ({ on: false }))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/features/auth/actor', () => ({ requireCapability: capabilityMock }))
vi.mock('@/features/activity/log', () => ({ logActivity: logActivityMock }))
vi.mock('@/db', () => {
  function builder(table: unknown) {
    const queue = selectQueues.get(table) ?? []
    const rows = queue.length > 1 ? queue.shift()! : (queue[0] ?? [])
    const self: Record<string, unknown> = {}
    let gone = false
    for (const method of ['where', 'limit', 'orderBy']) self[method] = () => self
    self.innerJoin = (joined: unknown) => {
      if (joined === liveApps && appTrash.on) gone = true
      return self
    }
    self.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
      Promise.resolve(gone ? [] : rows).then(resolve, reject)
    return self
  }
  return {
    db: {
      select: () => ({ from: (table: unknown) => builder(table) }),
      insert: (table: unknown) => ({
        values: (values: unknown) => ({ returning: () => insertMock(table, values) }),
      }),
      delete: (table: unknown) => ({ where: () => deleteMock(table) }),
    },
  }
})

const { addTaskLink, listTaskLinks, removeTaskLink, searchLinkTargets } = await import('./links-actions')

const TASK = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const BUG = '33333333-3333-4333-8333-333333333333'
const LINK = '44444444-4444-4444-8444-444444444444'

const task = (id = TASK, extra: Record<string, unknown> = {}) =>
  ({ id, appId: 'app-1', assigneeId: null, title: 'Ship it', ...extra })

beforeEach(() => {
  authMock.mockReset().mockResolvedValue({ user: { id: 'u-1', role: 'admin' } })
  capabilityMock.mockReset().mockResolvedValue({ id: 'u-1' })
  logActivityMock.mockReset()
  insertMock.mockReset().mockResolvedValue([{ id: LINK }])
  deleteMock.mockReset().mockResolvedValue(undefined)
  selectQueues.clear()
})

describe('describeLink', () => {
  const row = { id: LINK, fromType: 'task', fromId: TASK, toType: 'bug', toId: BUG, kind: 'blocks' }

  it('reads an outgoing edge with the forward label', () => {
    expect(describeLink(row, { type: 'task', id: TASK })).toEqual({
      direction: 'outgoing', label: 'blocks', other: { type: 'bug', id: BUG },
    })
  })

  it('reads the same row from the other end with the inverse label', () => {
    expect(describeLink(row, { type: 'bug', id: BUG })).toEqual({
      direction: 'incoming', label: 'is blocked by', other: { type: 'task', id: TASK },
    })
  })

  it('keeps "relates to" the same from both sides', () => {
    const relates = { ...row, kind: 'relates' }
    expect(describeLink(relates, { type: 'task', id: TASK })?.label).toBe('relates to')
    expect(describeLink(relates, { type: 'bug', id: BUG })?.label).toBe('relates to')
  })

  it('drops rows it cannot render: unrelated, unknown kind, or a doc end', () => {
    expect(describeLink(row, { type: 'task', id: OTHER })).toBeNull()
    expect(describeLink({ ...row, kind: 'documents' }, { type: 'task', id: TASK })).toBeNull()
    expect(describeLink({ ...row, toType: 'doc' }, { type: 'task', id: TASK })).toBeNull()
  })

  it('does not confuse a task and a bug that share an id', () => {
    const sameId = { ...row, toId: TASK }
    expect(describeLink(sameId, { type: 'bug', id: TASK })?.direction).toBe('incoming')
  })
})

describe('LINK_CHOICES / edgeFor', () => {
  it('offers both directions except for the symmetric relates', () => {
    expect(LINK_CHOICES.map((c) => c.label)).toEqual([
      'blocks', 'is blocked by', 'relates to', 'duplicates', 'is duplicated by', 'fixes', 'is fixed by',
    ])
  })

  it('flips the stored row for an incoming choice', () => {
    const self = { type: 'task', id: TASK }
    const other = { type: 'bug', id: BUG }
    expect(edgeFor(self, other, 'fixes', 'incoming')).toEqual({
      fromType: 'bug', fromId: BUG, toType: 'task', toId: TASK, kind: 'fixes',
    })
  })
})

describe('linkConflict', () => {
  const edge = { fromType: 'task', fromId: TASK, toType: 'task', toId: OTHER, kind: 'blocks' }
  const reverse = { id: LINK, fromType: 'task', fromId: OTHER, toType: 'task', toId: TASK }

  it('refuses the exact same edge', () => {
    expect(linkConflict(edge, [{ id: LINK, ...edge }])).toBe('Those are already linked')
  })

  it('refuses a reverse blocks (a deadlock) and a reverse relates (a repeat)', () => {
    expect(linkConflict(edge, [{ ...reverse, kind: 'blocks' }])).toMatch(/cannot block each other/)
    expect(linkConflict({ ...edge, kind: 'relates' }, [{ ...reverse, kind: 'relates' }])).toBe('Those are already linked')
  })

  it('allows a different kind between the same pair, and a reverse fixes', () => {
    expect(linkConflict(edge, [{ ...reverse, kind: 'relates' }])).toBeNull()
    expect(linkConflict({ ...edge, kind: 'fixes' }, [{ ...reverse, kind: 'fixes' }])).toBeNull()
  })

  it('refuses a self link', () => {
    expect(linkConflict({ ...edge, toId: TASK }, [])).toMatch(/itself/)
  })
})

describe('escapeLike / mergeTargets / groupLinksByLabel', () => {
  it('escapes LIKE wildcards and the escape character', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\')
  })

  it('puts exact key hits first, then alternates tasks and bugs, capped', () => {
    type Hit = { type: 'task' | 'bug'; id: string; exact: boolean }
    const t = (id: string, exact = false): Hit => ({ type: 'task', id, exact })
    const b = (id: string): Hit => ({ type: 'bug', id, exact: false })
    const merged = mergeTargets([t('t1'), t('t2'), t('t3', true)], [b('b1'), b('b2')], 4)
    expect(merged.map((m) => m.id)).toEqual(['t3', 't1', 'b1', 't2'])
  })

  it('groups in choice order and omits empty groups', () => {
    const groups = groupLinksByLabel([{ label: 'fixes' }, { label: 'is blocked by' }, { label: 'fixes' }])
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([['is blocked by', 1], ['fixes', 2]])
  })
})

describe('listTaskLinks', () => {
  it('rejects a malformed id before any read', async () => {
    expect(await listTaskLinks('nope')).toEqual({ ok: false, error: 'Task not found' })
  })

  it('treats a task in a trashed project as not found', async () => {
    selectQueues.set(liveTasks, [[task()]])
    appTrash.on = true
    try {
      expect(await listTaskLinks(TASK)).toEqual({ ok: false, error: 'Task not found' })
    } finally {
      appTrash.on = false
    }
  })

  it('refuses a caller without app.view on the task\'s project', async () => {
    selectQueues.set(liveTasks, [[task()]])
    capabilityMock.mockResolvedValue(null)
    expect(await listTaskLinks(TASK)).toEqual({ ok: false, error: 'Not allowed' })
    expect(capabilityMock).toHaveBeenCalledWith('app.view', { appId: 'app-1' })
  })

  it('resolves both directions and drops ends that are trashed or missing', async () => {
    selectQueues.set(liveTasks, [
      [task()],
      [{ id: OTHER, title: 'Other', status: 'todo', number: 12, sprintId: null, type: 'task' }],
    ])
    selectQueues.set(workLinks, [[
      { id: 'l1', fromType: 'task', fromId: TASK, toType: 'task', toId: OTHER, kind: 'blocks' },
      { id: 'l2', fromType: 'bug', fromId: BUG, toType: 'task', toId: TASK, kind: 'fixes' },
      // Far end trashed: liveBugReports returns nothing for it.
      { id: 'l3', fromType: 'task', fromId: TASK, toType: 'bug', toId: OTHER, kind: 'relates' },
    ]])
    selectQueues.set(liveBugReports, [[{ id: BUG, title: 'Crash', status: 'open' }]])
    selectQueues.set(liveApps, [[{ key: 'LOG', number: 3 }]])

    const res = await listTaskLinks(TASK)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data.map((l) => [l.linkId, l.label, l.other.key])).toEqual([
      ['l1', 'blocks', 'LOG-12'],
      ['l2', 'is fixed by', null],
    ])
  })
})

describe('searchLinkTargets', () => {
  it('answers an empty query with nothing, without reading', async () => {
    expect(await searchLinkTargets(TASK, '   ')).toEqual({ ok: true, data: [] })
    expect(capabilityMock).not.toHaveBeenCalled()
  })

  it('refuses a query over 100 characters', async () => {
    expect((await searchLinkTargets(TASK, 'x'.repeat(101))).ok).toBe(false)
  })

  it('marks a key hit in this project as exact and lists it first', async () => {
    selectQueues.set(liveTasks, [
      [task()],
      [
        { id: 'a', title: 'LOG-1 follow-up', status: 'todo', number: 40, sprintId: null, type: 'task' },
        { id: OTHER, title: 'Other', status: 'done', number: 7, sprintId: 's1', type: 'bug' },
      ],
    ])
    selectQueues.set(liveBugReports, [[]])
    selectQueues.set(liveApps, [[{ key: 'LOG', number: 3 }]])
    const res = await searchLinkTargets(TASK, 'log-7')
    expect(res.ok && res.data.map((t) => [t.id, t.exact])).toEqual([[OTHER, true], ['a', false]])
  })
})

describe('addTaskLink', () => {
  const input = { kind: 'blocks', toType: 'task', toId: OTHER }

  it('requires a session', async () => {
    authMock.mockResolvedValue(null)
    expect(await addTaskLink(TASK, input)).toEqual({ ok: false, error: 'Sign in required' })
  })

  it('checks task.edit against the task row\'s own project and assignee', async () => {
    selectQueues.set(liveTasks, [[task(TASK, { assigneeId: 'u-9' })]])
    capabilityMock.mockResolvedValue(null)
    expect(await addTaskLink(TASK, input)).toEqual({ ok: false, error: 'Not allowed' })
    expect(capabilityMock).toHaveBeenCalledWith('task.edit', { appId: 'app-1', ownerId: 'u-9' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('refuses a self link and an unknown kind', async () => {
    selectQueues.set(liveTasks, [[task()]])
    expect(await addTaskLink(TASK, { ...input, toId: TASK })).toEqual({ ok: false, error: 'A task cannot be linked to itself' })
    expect((await addTaskLink(TASK, { ...input, kind: 'documents' })).ok).toBe(false)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('refuses a far end outside the project (or trashed)', async () => {
    selectQueues.set(liveTasks, [[task()], []])
    expect(await addTaskLink(TASK, input)).toEqual({ ok: false, error: 'That item is not in this project' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('refuses a link that already exists, before inserting', async () => {
    selectQueues.set(liveTasks, [[task()], [{ id: OTHER, title: 'Other' }]])
    selectQueues.set(workLinks, [[{ id: LINK, fromType: 'task', fromId: TASK, toType: 'task', toId: OTHER, kind: 'blocks' }]])
    expect(await addTaskLink(TASK, input)).toEqual({ ok: false, error: 'Those are already linked' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('turns a racing unique violation into the same sentence', async () => {
    selectQueues.set(liveTasks, [[task()], [{ id: OTHER, title: 'Other' }]])
    selectQueues.set(workLinks, [[]])
    insertMock.mockRejectedValue(Object.assign(new Error('insert failed'), { cause: { code: '23505' } }))
    expect(await addTaskLink(TASK, input)).toEqual({ ok: false, error: 'Those are already linked' })
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('stores the edge under the task\'s appId and logs it', async () => {
    selectQueues.set(liveTasks, [[task()], [{ id: BUG, title: 'Crash' }]])
    selectQueues.set(liveBugReports, [[{ id: BUG, title: 'Crash' }]])
    selectQueues.set(workLinks, [[]])
    const res = await addTaskLink(TASK, { kind: 'fixes', toType: 'bug', toId: BUG })
    expect(res).toEqual({ ok: true, data: { linkId: LINK } })
    expect(insertMock).toHaveBeenCalledWith(workLinks, {
      fromType: 'task', fromId: TASK, toType: 'bug', toId: BUG, kind: 'fixes', appId: 'app-1', createdBy: 'u-1',
    })
    expect(logActivityMock).toHaveBeenCalledWith(expect.objectContaining({ verb: 'linked', entityType: 'task', entityId: TASK }))
  })
})

describe('removeTaskLink', () => {
  const link = { id: LINK, fromType: 'task', fromId: TASK, toType: 'bug', toId: BUG, kind: 'fixes' }

  it('reports a missing link', async () => {
    selectQueues.set(workLinks, [[]])
    expect(await removeTaskLink(LINK)).toEqual({ ok: false, error: 'Link not found' })
  })

  it('refuses a caller who cannot edit any task end, and deletes nothing', async () => {
    selectQueues.set(workLinks, [[link]])
    selectQueues.set(liveTasks, [[task()]])
    capabilityMock.mockResolvedValue(null)
    expect(await removeTaskLink(LINK)).toEqual({ ok: false, error: 'Not allowed' })
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('deletes the row and logs it when allowed', async () => {
    selectQueues.set(workLinks, [[link]])
    selectQueues.set(liveTasks, [[task()]])
    expect(await removeTaskLink(LINK)).toEqual({ ok: true, data: undefined })
    expect(deleteMock).toHaveBeenCalledWith(workLinks)
    expect(logActivityMock).toHaveBeenCalledWith(expect.objectContaining({ verb: 'unlinked', entityId: TASK }))
  })
})
