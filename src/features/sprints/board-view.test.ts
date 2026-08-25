import { describe, it, expect } from 'vitest'
import {
  EMPTY_FILTERS,
  OPEN_STATUSES,
  TASK_STATUSES,
  TERMINAL_STATUSES,
  UNASSIGNED_GROUP,
  activeFilterCount,
  boardSummary,
  boardViewPatch,
  dropIndexIn,
  groupIdForTask,
  groupTasks,
  isDueToday,
  isOverdue,
  isTerminal,
  matchesFilters,
  parseBoardView,
  patchForGroup,
  type BoardTask,
} from './board-view'

const TODAY = '2026-08-12'

function task(over: Partial<BoardTask> & { id: string }): BoardTask {
  return {
    title: 'Task',
    status: 'todo',
    priority: 0,
    sortOrder: 0,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    dueDate: null,
    assignee: null,
    ...over,
  }
}

const person = (id: string, name: string) => ({ id, name, avatarUrl: null })

describe('parseBoardView', () => {
  const params = (init: string) => new URLSearchParams(init)

  it('defaults to status grouping with no filters', () =>
    expect(parseBoardView(params(''))).toEqual({ groupBy: 'status', filters: EMPTY_FILTERS }))

  it('reads every knob', () =>
    expect(
      parseBoardView(params('group=assignee&q=login&who=u1,u2&prio=3,1&overdue=1')),
    ).toEqual({
      groupBy: 'assignee',
      filters: {
        query: 'login',
        assignees: ['u1', 'u2'],
        priorities: [1, 3],
        overdueOnly: true,
      },
    }))

  it('falls back to status on an unknown grouping', () =>
    expect(parseBoardView(params('group=phase')).groupBy).toBe('status'))

  it('drops out-of-range priority codes rather than filtering to nothing', () =>
    expect(parseBoardView(params('prio=99,2,-1,x')).filters.priorities).toEqual([2]))

  it('de-duplicates priorities', () =>
    expect(parseBoardView(params('prio=2,2,2')).filters.priorities).toEqual([2]))

  it('trims the query and ignores empty list entries', () => {
    const view = parseBoardView(params('q=%20%20login%20%20&who=u1,,%20,u2'))
    expect(view.filters.query).toBe('login')
    expect(view.filters.assignees).toEqual(['u1', 'u2'])
  })

  it('treats overdue values other than 1 as off', () =>
    expect(parseBoardView(params('overdue=true')).filters.overdueOnly).toBe(false))
})

describe('boardViewPatch', () => {
  it('clears every key for the default view', () =>
    expect(boardViewPatch({ groupBy: 'status', filters: EMPTY_FILTERS })).toEqual({
      group: null,
      q: null,
      who: null,
      prio: null,
      overdue: null,
    }))

  it('round-trips through parseBoardView', () => {
    const view = {
      groupBy: 'priority' as const,
      filters: { query: 'auth', assignees: ['u1'], priorities: [0, 3], overdueOnly: true },
    }
    const patch = boardViewPatch(view)
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(patch)) if (value !== null) params.set(key, value)
    expect(parseBoardView(params)).toEqual(view)
  })
})

describe('activeFilterCount', () => {
  it('is zero when nothing is set', () => expect(activeFilterCount(EMPTY_FILTERS)).toBe(0))
  it('counts a phrase once however long it is', () =>
    expect(activeFilterCount({ ...EMPTY_FILTERS, query: 'a very long phrase' })).toBe(1))
  it('counts each chip and the overdue toggle', () =>
    expect(
      activeFilterCount({ query: 'x', assignees: ['a', 'b'], priorities: [3], overdueOnly: true }),
    ).toBe(5))
})

describe('isOverdue / isDueToday', () => {
  it('flags a past due date', () =>
    expect(isOverdue({ dueDate: '2026-08-11', status: 'todo' }, TODAY)).toBe(true))
  it('does not flag today', () =>
    expect(isOverdue({ dueDate: TODAY, status: 'todo' }, TODAY)).toBe(false))
  it('does not flag a finished task, however late', () =>
    expect(isOverdue({ dueDate: '2020-01-01', status: 'done' }, TODAY)).toBe(false))
  it('does not flag a task with no due date', () =>
    expect(isOverdue({ dueDate: null, status: 'todo' }, TODAY)).toBe(false))
  it('separates due-today from overdue', () => {
    expect(isDueToday({ dueDate: TODAY, status: 'todo' }, TODAY)).toBe(true)
    expect(isDueToday({ dueDate: '2026-08-11', status: 'todo' }, TODAY)).toBe(false)
  })
})

describe('matchesFilters', () => {
  const t = task({ id: 't1', title: 'Fix login', priority: 2, assignee: person('u1', 'Ada') })

  it('passes everything with no filters', () =>
    expect(matchesFilters(t, EMPTY_FILTERS, TODAY)).toBe(true))

  it('matches the title case-insensitively', () =>
    expect(matchesFilters(t, { ...EMPTY_FILTERS, query: 'LOGIN' }, TODAY)).toBe(true))

  it('matches the description too', () =>
    expect(
      matchesFilters(
        { ...t, description: 'the Stripe webhook one' },
        { ...EMPTY_FILTERS, query: 'stripe' },
        TODAY,
      ),
    ).toBe(true))

  it('rejects a non-matching phrase', () =>
    expect(matchesFilters(t, { ...EMPTY_FILTERS, query: 'signup' }, TODAY)).toBe(false))

  it('filters by assignee', () => {
    expect(matchesFilters(t, { ...EMPTY_FILTERS, assignees: ['u1'] }, TODAY)).toBe(true)
    expect(matchesFilters(t, { ...EMPTY_FILTERS, assignees: ['u2'] }, TODAY)).toBe(false)
  })

  it('treats unassigned as a selectable assignee', () => {
    const orphan = task({ id: 't2' })
    expect(matchesFilters(orphan, { ...EMPTY_FILTERS, assignees: [UNASSIGNED_GROUP] }, TODAY)).toBe(
      true,
    )
    expect(matchesFilters(t, { ...EMPTY_FILTERS, assignees: [UNASSIGNED_GROUP] }, TODAY)).toBe(false)
  })

  it('filters by priority', () => {
    expect(matchesFilters(t, { ...EMPTY_FILTERS, priorities: [2] }, TODAY)).toBe(true)
    expect(matchesFilters(t, { ...EMPTY_FILTERS, priorities: [0, 3] }, TODAY)).toBe(false)
  })

  it('filters to overdue only', () => {
    const late = task({ id: 't3', dueDate: '2026-01-01' })
    expect(matchesFilters(late, { ...EMPTY_FILTERS, overdueOnly: true }, TODAY)).toBe(true)
    expect(matchesFilters(t, { ...EMPTY_FILTERS, overdueOnly: true }, TODAY)).toBe(false)
  })

  it('ANDs every active filter', () => {
    const late = task({ id: 't4', title: 'Fix login', priority: 3, dueDate: '2026-01-01' })
    expect(
      matchesFilters(
        late,
        { query: 'login', assignees: [UNASSIGNED_GROUP], priorities: [3], overdueOnly: true },
        TODAY,
      ),
    ).toBe(true)
    expect(
      matchesFilters(
        late,
        { query: 'login', assignees: [UNASSIGNED_GROUP], priorities: [1], overdueOnly: true },
        TODAY,
      ),
    ).toBe(false)
  })
})

describe('patchForGroup / groupIdForTask', () => {
  it('reads a status column', () =>
    expect(patchForGroup('status', 'in_progress')).toEqual({ status: 'in_progress' }))
  it('rejects a status column id that is not a status', () =>
    expect(patchForGroup('status', 'blocked')).toBeNull())
  it('reads an assignee column', () =>
    expect(patchForGroup('assignee', 'u7')).toEqual({ assigneeId: 'u7' }))
  it('reads the unassigned column as a clear', () =>
    expect(patchForGroup('assignee', UNASSIGNED_GROUP)).toEqual({ assigneeId: null }))
  it('reads a priority column', () =>
    expect(patchForGroup('priority', '3')).toEqual({ priority: 3 }))
  it('rejects a priority column id outside 0-3', () =>
    expect(patchForGroup('priority', '9')).toBeNull())

  it('inverts patchForGroup for every grouping', () => {
    const t = task({ id: 't1', status: 'done', priority: 2, assignee: person('u1', 'Ada') })
    expect(groupIdForTask('status', t)).toBe('done')
    expect(groupIdForTask('priority', t)).toBe('2')
    expect(groupIdForTask('assignee', t)).toBe('u1')
    expect(groupIdForTask('assignee', task({ id: 't2' }))).toBe(UNASSIGNED_GROUP)
  })
})

describe('groupTasks', () => {
  const team = [
    { userId: 'u1', name: 'Ada' },
    { userId: 'u2', name: 'Grace' },
  ]

  it('emits status columns in workflow order, empties included', () => {
    const groups = groupTasks([task({ id: 't1', status: 'done' })], 'status', { team })
    expect(groups.map((g) => g.id)).toEqual(['todo', 'in_progress', 'done'])
    expect(groups.map((g) => g.tasks.length)).toEqual([0, 0, 1])
  })

  it('emits priority columns high to none', () =>
    expect(groupTasks([], 'priority', { team }).map((g) => g.id)).toEqual(['3', '2', '1', '0']))

  it('emits a column for every teammate plus unassigned', () =>
    expect(groupTasks([], 'assignee', { team }).map((g) => g.id)).toEqual([
      'u1',
      'u2',
      UNASSIGNED_GROUP,
    ]))

  it('keeps a removed teammate visible rather than losing their work', () => {
    const groups = groupTasks(
      [task({ id: 't1', assignee: person('gone', 'Alan') })],
      'assignee',
      { team },
    )
    const orphan = groups.find((g) => g.id === 'gone')
    expect(orphan?.title).toBe('Alan')
    expect(orphan?.tasks).toHaveLength(1)
  })

  it('never drops a task whose group does not exist', () => {
    // A priority written straight into the DB outside 0-3.
    const groups = groupTasks([task({ id: 't1', priority: 9 })], 'priority', { team })
    expect(groups.flatMap((g) => g.tasks)).toHaveLength(1)
  })

  it('preserves input order within a column', () => {
    const groups = groupTasks(
      [task({ id: 'a' }), task({ id: 'b' }), task({ id: 'c' })],
      'status',
      { team },
    )
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('boardSummary', () => {
  it('reports zeros and 0% for an empty board, not NaN', () =>
    expect(boardSummary([], TODAY)).toEqual({
      total: 0,
      done: 0,
      inProgress: 0,
      todo: 0,
      overdue: 0,
      unassigned: 0,
      donePct: 0,
    }))

  it('counts each bucket', () => {
    const summary = boardSummary(
      [
        task({ id: '1', status: 'done', assignee: person('u1', 'Ada') }),
        task({ id: '2', status: 'in_progress', dueDate: '2026-01-01' }),
        task({ id: '3', status: 'todo' }),
        task({ id: '4', status: 'todo', dueDate: '2026-01-01', assignee: person('u1', 'Ada') }),
      ],
      TODAY,
    )
    expect(summary).toEqual({
      total: 4,
      done: 1,
      inProgress: 1,
      todo: 2,
      overdue: 2,
      unassigned: 2,
      donePct: 25,
    })
  })

  it('floors the percentage so 99% never rounds up to a finished sprint', () => {
    const tasks = Array.from({ length: 3 }, (_, i) =>
      task({ id: String(i), status: i === 0 ? 'todo' : 'done' }),
    )
    expect(boardSummary(tasks, TODAY).donePct).toBe(66)
  })
})

describe('dropIndexIn', () => {
  const column = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]

  it('appends when the drop landed on the column rather than on a card', () =>
    expect(dropIndexIn(column, 'a', null)).toBe(3))

  it('appends when the card dropped on is not in this column', () =>
    expect(dropIndexIn(column, 'a', 'zz')).toBe(3))

  it('treats a drop back onto itself as an append rather than indexing off itself', () =>
    expect(dropIndexIn(column, 'b', 'b')).toBe(3))

  it('inserts BEFORE a card that is above the dragged one', () =>
    // 'd' dropped on 'b' -> without = [a, b, c], 'b' is index 1, moving up
    expect(dropIndexIn(column, 'd', 'b')).toBe(1))

  it('inserts AFTER a card that is below the dragged one', () =>
    // 'a' dropped on 'c' -> without = [b, c, d], 'c' is index 1, moving down
    expect(dropIndexIn(column, 'a', 'c')).toBe(2))

  it('reaches the very bottom of a column, which a before-only rule cannot', () =>
    expect(dropIndexIn(column, 'a', 'd')).toBe(3))

  it('reaches the very top of a column', () => expect(dropIndexIn(column, 'd', 'a')).toBe(0))

  it('inserts before the target when the card comes from another column', () =>
    // 'x' is not in this column at all, so there is no direction to infer
    expect(dropIndexIn(column, 'x', 'c')).toBe(2))

  it('appends into an empty column', () => expect(dropIndexIn([], 'x', null)).toBe(0))

  /*
   * The reason this function takes the whole column instead of the visible
   * slice. 'a' and 'd' are showing, 'b' and 'c' are filtered out; dragging
   * 'a' onto 'd' must land at index 3 of the REAL column (after c), not at
   * index 1 of the two cards on screen — an index of 1 would rank the card
   * above two tasks the user cannot see.
   */
  it('positions against hidden cards, not just the visible ones', () => {
    expect(dropIndexIn(column, 'a', 'd')).toBe(3)
    expect(dropIndexIn([{ id: 'a' }, { id: 'd' }], 'a', 'd')).toBe(1)
  })
})

describe('terminal status seam', () => {
  it('treats done as terminal and nothing else, today', () => {
    expect(isTerminal('done')).toBe(true)
    expect(isTerminal('todo')).toBe(false)
    expect(isTerminal('in_progress')).toBe(false)
  })

  it('derives OPEN_STATUSES as exactly the non-terminal statuses', () => {
    // Not a hardcoded ['todo','in_progress']: the point of the seam is that
    // this list follows TERMINAL_STATUSES automatically when the enum widens.
    expect([...OPEN_STATUSES]).toEqual(['todo', 'in_progress'])
    expect(OPEN_STATUSES.every((s) => !isTerminal(s))).toBe(true)
  })

  it('partitions TASK_STATUSES with no overlap and no gap', () => {
    // The invariant the whole workstream rests on. If a future status is added
    // to TASK_STATUSES and to neither set, this fails and names the omission.
    const open = new Set<string>(OPEN_STATUSES)
    const terminal = new Set<string>(TERMINAL_STATUSES)
    for (const status of TASK_STATUSES) {
      expect(open.has(status) !== terminal.has(status)).toBe(true)
    }
    expect(open.size + terminal.size).toBe(TASK_STATUSES.length)
  })

  it('is behaviourally identical to the literal it replaces', () => {
    // Pins WS0's contract: this commit changes no behaviour. Delete this test
    // in WS2, when it stops being true on purpose.
    for (const status of TASK_STATUSES) {
      expect(isTerminal(status)).toBe(status === 'done')
    }
  })
})
