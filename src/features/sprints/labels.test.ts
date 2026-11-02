import { beforeEach, describe, expect, it, vi } from 'vitest'
import { appComponents, taskComponents, taskLabelLinks, taskLabels } from '@/db/schema'
import { liveApps, liveTasks } from '@/db/live'
import {
  diffTagSet,
  hasTagNamed,
  labelChipClasses,
  nextLabelSlot,
  normaliseTagName,
  tagChangeDetail,
  tagNameSchema,
  toggleId,
} from './labels'

describe('normaliseTagName / tagNameSchema', () => {
  it('trims and collapses inner whitespace', () => {
    expect(normaliseTagName('  Front \t  end ')).toBe('Front end')
  })
  it('rejects blank and over-long names, accepts 40', () => {
    expect(tagNameSchema.safeParse('   ').success).toBe(false)
    expect(tagNameSchema.safeParse('x'.repeat(41)).success).toBe(false)
    expect(tagNameSchema.safeParse('x'.repeat(40)).success).toBe(true)
  })
  it('compares names case- and space-insensitively, like lower(name)', () => {
    expect(hasTagNamed([{ name: 'Bug' }], '  bUG ')).toBe(true)
    expect(hasTagNamed([{ name: 'Bug' }], 'Bugs')).toBe(false)
  })
})

describe('nextLabelSlot', () => {
  it('round-robins over the eight slots, 0-based', () => {
    expect(nextLabelSlot(0)).toBe(0)
    expect(nextLabelSlot(7)).toBe(7)
    expect(nextLabelSlot(8)).toBe(0)
    expect(nextLabelSlot(19)).toBe(3)
  })
  it('treats nonsense counts as an empty project', () => {
    expect(nextLabelSlot(-3)).toBe(0)
    expect(nextLabelSlot(Number.NaN)).toBe(0)
  })
})

describe('diffTagSet', () => {
  it('returns only what changes', () => {
    expect(diffTagSet(['a', 'b'], ['b', 'c'])).toEqual({ add: ['c'], remove: ['a'] })
  })
  it('is a no-op for the same set in another order, and ignores duplicates', () => {
    expect(diffTagSet(['a', 'b'], ['b', 'a', 'a'])).toEqual({ add: [], remove: [] })
  })
})

describe('labelChipClasses', () => {
  it('maps slot 0-7 onto event-1..8 and anything else to neutral', () => {
    expect(labelChipClasses(0)).toContain('bg-event-1/12')
    expect(labelChipClasses(7)).toContain('bg-event-8/12')
    expect(labelChipClasses(8)).not.toContain('event')
    expect(labelChipClasses(null)).not.toContain('event')
  })
})

describe('tagChangeDetail / toggleId', () => {
  it('names adds and removes, capped at four', () => {
    expect(tagChangeDetail('labels', ['Bug'], ['UI'])).toBe('labels: +Bug, −UI')
    expect(tagChangeDetail('components', ['a', 'b', 'c', 'd', 'e'], [])).toBe(
      'components: +a, +b, +c, +d and 1 more',
    )
  })
  it('toggles while keeping pick order', () => {
    expect(toggleId(['a', 'b'], 'c')).toEqual(['a', 'b', 'c'])
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b'])
  })
})

// ---- actions, with db / session / actor mocked (task-actions.test.ts idiom) ----

const {
  sessionMock,
  capabilityMock,
  logActivityMock,
  selectRows,
  insertSpy,
  insertResult,
  deleteSpy,
  batchSpy,
} = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  capabilityMock: vi.fn(),
  logActivityMock: vi.fn(),
  selectRows: new Map<unknown, unknown[]>(),
  insertSpy: vi.fn(),
  insertResult: { value: [] as unknown[] | Error },
  deleteSpy: vi.fn(),
  batchSpy: vi.fn(),
}))

vi.mock('@/lib/session', () => ({ getSession: sessionMock }))
vi.mock('@/features/auth/actor', () => ({ requireCapability: capabilityMock }))
vi.mock('@/features/activity/log', () => ({ logActivity: logActivityMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// When on, a read inner-joined to liveApps comes back empty: the task's
// project is in Trash.
const appTrash = vi.hoisted(() => ({ on: false }))

vi.mock('@/db', () => {
  function builder(table: unknown) {
    const self: Record<string, unknown> = {}
    let gone = false
    for (const method of ['where', 'limit', 'orderBy']) self[method] = () => self
    self.innerJoin = (joined: unknown) => {
      if (joined === liveApps && appTrash.on) gone = true
      return self
    }
    self.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(gone ? [] : (selectRows.get(table) ?? [])).then(resolve, reject)
    return self
  }
  return {
    db: {
      select: () => ({ from: (table: unknown) => builder(table) }),
      insert: (table: unknown) => ({
        values: (values: unknown) => {
          insertSpy(table, values)
          return {
            onConflictDoNothing: () => ({ kind: 'insert', table, values }),
            returning: async () => {
              if (insertResult.value instanceof Error) throw insertResult.value
              return insertResult.value
            },
          }
        },
      }),
      delete: (table: unknown) => ({
        where: () => {
          deleteSpy(table)
          return { kind: 'delete', table }
        },
      }),
      batch: async (statements: unknown[]) => {
        batchSpy(statements)
        return []
      },
    },
  }
})

const { listTaskTags, createLabel, createComponent, setTaskLabels, setTaskComponents } = await import(
  './labels-actions'
)

const TASK = '11111111-1111-4111-8111-111111111111'
const L1 = '22222222-2222-4222-8222-222222222222'
const L2 = '33333333-3333-4333-8333-333333333333'
const L3 = '44444444-4444-4444-8444-444444444444'

function signedIn() {
  sessionMock.mockResolvedValue({ user: { id: 'user-1' } })
  capabilityMock.mockResolvedValue({ id: 'user-1', role: 'member', scopeAppIds: new Set() })
  selectRows.set(liveTasks, [{ id: TASK, appId: 'app-1', assigneeId: 'user-1', title: 'Ship it' }])
}

beforeEach(() => {
  sessionMock.mockReset()
  capabilityMock.mockReset()
  logActivityMock.mockReset()
  insertSpy.mockReset()
  deleteSpy.mockReset()
  batchSpy.mockReset()
  selectRows.clear()
  insertResult.value = []
})

describe('guards', () => {
  it('refuses an anonymous caller before reading the task', async () => {
    sessionMock.mockResolvedValue(null)
    expect(await listTaskTags(TASK)).toEqual({ ok: false, error: 'Sign in required' })
    expect(capabilityMock).not.toHaveBeenCalled()
  })

  it('asks app.view for reads and task.edit for writes, with the TASK’s app', async () => {
    signedIn()
    await listTaskTags(TASK)
    expect(capabilityMock).toHaveBeenLastCalledWith('app.view', { appId: 'app-1' })
    await setTaskLabels(TASK, [])
    expect(capabilityMock).toHaveBeenLastCalledWith('task.edit', { appId: 'app-1', ownerId: 'user-1' })
  })

  it('returns Not allowed and writes nothing when the capability is refused', async () => {
    signedIn()
    capabilityMock.mockResolvedValue(null)
    expect(await createLabel(TASK, 'Bug')).toEqual({ ok: false, error: 'Not allowed' })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('rejects a malformed task id as not found', async () => {
    signedIn()
    expect(await listTaskTags('nope')).toEqual({ ok: false, error: 'Task not found' })
  })

  it('treats a task in a trashed project as not found', async () => {
    signedIn()
    appTrash.on = true
    try {
      expect(await listTaskTags(TASK)).toEqual({ ok: false, error: 'Task not found' })
    } finally {
      appTrash.on = false
    }
  })
})

describe('listTaskTags', () => {
  it('returns the project’s tags and drops links that point outside it', async () => {
    signedIn()
    selectRows.set(taskLabels, [{ id: L1, name: 'Bug', colorSlot: 0 }])
    selectRows.set(appComponents, [{ id: L2, name: 'Auth' }])
    selectRows.set(taskLabelLinks, [{ id: L1 }, { id: L3 }])
    selectRows.set(taskComponents, [{ id: L2 }])
    const res = await listTaskTags(TASK)
    expect(res).toEqual({
      ok: true,
      data: {
        labels: [{ id: L1, name: 'Bug', colorSlot: 0 }],
        components: [{ id: L2, name: 'Auth' }],
        selectedLabelIds: [L1],
        selectedComponentIds: [L2],
      },
    })
  })
})

describe('createLabel / createComponent', () => {
  it('assigns the next round-robin slot in the task’s project', async () => {
    signedIn()
    selectRows.set(taskLabels, [{ name: 'a' }, { name: 'b' }, { name: 'c' }])
    insertResult.value = [{ id: L1, name: 'Bug', colorSlot: 3 }]
    const res = await createLabel(TASK, '  Bug ')
    expect(res).toEqual({ ok: true, data: { id: L1, name: 'Bug', colorSlot: 3 } })
    expect(insertSpy).toHaveBeenCalledWith(taskLabels, { appId: 'app-1', name: 'Bug', colorSlot: 3 })
  })

  it('refuses a case-insensitive duplicate on the pre-check', async () => {
    signedIn()
    selectRows.set(taskLabels, [{ name: 'bug' }])
    expect(await createLabel(TASK, 'BUG')).toEqual({ ok: false, error: 'A label called BUG already exists' })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('turns a racing 23505 into the same friendly error', async () => {
    signedIn()
    insertResult.value = Object.assign(new Error('wrapped'), { cause: { code: '23505' } })
    expect(await createComponent(TASK, 'Auth')).toEqual({
      ok: false,
      error: 'A component called Auth already exists',
    })
  })

  it('validates the name', async () => {
    signedIn()
    const res = await createComponent(TASK, '   ')
    expect(res.ok).toBe(false)
    expect(insertSpy).not.toHaveBeenCalled()
  })
})

describe('setTaskLabels / setTaskComponents', () => {
  it('writes only the difference as one batch and logs it', async () => {
    signedIn()
    // taskLabels answers the ownership read; taskLabelLinks the current set.
    selectRows.set(taskLabels, [
      { id: L2, name: 'UI' },
      { id: L3, name: 'Perf' },
    ])
    selectRows.set(taskLabelLinks, [
      { id: L1, name: 'Bug' },
      { id: L2, name: 'UI' },
    ])
    const res = await setTaskLabels(TASK, [L2, L3])
    expect(res).toEqual({ ok: true, data: { labelIds: [L2, L3] } })
    expect(batchSpy).toHaveBeenCalledTimes(1)
    expect(batchSpy.mock.calls[0][0]).toHaveLength(2)
    expect(insertSpy).toHaveBeenCalledWith(taskLabelLinks, [{ taskId: TASK, labelId: L3 }])
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'updated', entityType: 'task', detail: 'labels: +Perf, −Bug' }),
    )
  })

  it('refuses an id from another project', async () => {
    signedIn()
    selectRows.set(taskLabels, [{ id: L1, name: 'Bug' }]) // L2 not found in app-1
    expect(await setTaskLabels(TASK, [L1, L2])).toEqual({
      ok: false,
      error: 'One of those labels is not in this project',
    })
    expect(batchSpy).not.toHaveBeenCalled()
  })

  it('caps the set at 20', async () => {
    signedIn()
    const ids = Array.from({ length: 21 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
    const res = await setTaskComponents(TASK, ids)
    expect(res.ok).toBe(false)
    expect(batchSpy).not.toHaveBeenCalled()
  })

  it('does nothing and logs nothing when the set is unchanged', async () => {
    signedIn()
    selectRows.set(appComponents, [{ id: L1, name: 'Auth' }])
    selectRows.set(taskComponents, [{ id: L1, name: 'Auth' }])
    expect(await setTaskComponents(TASK, [L1])).toEqual({ ok: true, data: { componentIds: [L1] } })
    expect(batchSpy).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('clearing every component deletes without an ownership read', async () => {
    signedIn()
    selectRows.set(taskComponents, [{ id: L1, name: 'Auth' }])
    expect(await setTaskComponents(TASK, [])).toEqual({ ok: true, data: { componentIds: [] } })
    expect(deleteSpy).toHaveBeenCalledWith(taskComponents)
    expect(insertSpy).not.toHaveBeenCalled()
  })
})
