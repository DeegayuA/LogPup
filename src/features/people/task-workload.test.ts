import { describe, it, expect } from 'vitest'
import {
  bucketOpenTasks,
  compareOpenTasks,
  dueState,
  summarizeOpenTasks,
  type PersonTaskRow,
} from './task-workload'

const TODAY = '2026-08-12'

function task(over: Partial<PersonTaskRow> = {}): PersonTaskRow {
  return {
    id: 't1',
    title: 'Ship the thing',
    status: 'todo',
    priority: 0,
    dueDate: null,
    createdAt: new Date('2026-08-01T09:00:00.000Z'),
    appName: 'Alpha',
    appSlug: 'alpha',
    sprintName: null,
    ...over,
  }
}

describe('dueState', () => {
  it('calls yesterday overdue and today due-today', () => {
    expect(dueState('2026-08-11', TODAY)).toBe('overdue')
    expect(dueState('2026-08-12', TODAY)).toBe('today')
  })

  it('treats the whole next week as soon, and the day after as later', () => {
    expect(dueState('2026-08-13', TODAY)).toBe('soon')
    expect(dueState('2026-08-19', TODAY)).toBe('soon')
    expect(dueState('2026-08-20', TODAY)).toBe('later')
  })

  it('has no due state at all without a date', () => {
    expect(dueState(null, TODAY)).toBe('none')
  })

  it('compares as calendar days, not as parsed instants', () => {
    // The regression this guards: `new Date('2026-08-12')` is midnight UTC,
    // which is still the 11th anywhere west of Greenwich — a task due today
    // would have rendered as overdue for those readers.
    expect(dueState(TODAY, TODAY)).toBe('today')
  })
})

describe('compareOpenTasks', () => {
  it('puts the sooner deadline first', () => {
    const soon = task({ id: 'a', dueDate: '2026-08-13' })
    const later = task({ id: 'b', dueDate: '2026-08-20' })
    expect([later, soon].sort(compareOpenTasks).map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('sorts undated work after dated work', () => {
    const dated = task({ id: 'a', dueDate: '2026-09-01' })
    const undated = task({ id: 'b', dueDate: null })
    expect([undated, dated].sort(compareOpenTasks).map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('breaks a due-date tie on priority, highest first', () => {
    const low = task({ id: 'a', dueDate: '2026-08-13', priority: 1 })
    const high = task({ id: 'b', dueDate: '2026-08-13', priority: 3 })
    expect([low, high].sort(compareOpenTasks).map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('breaks a priority tie on age, oldest first', () => {
    const fresh = task({ id: 'a', createdAt: new Date('2026-08-10T00:00:00.000Z') })
    const stale = task({ id: 'b', createdAt: new Date('2026-07-01T00:00:00.000Z') })
    expect([fresh, stale].sort(compareOpenTasks).map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('is stable for two tasks filed in the same instant', () => {
    const one = task({ id: 'a' })
    const two = task({ id: 'b' })
    expect([two, one].sort(compareOpenTasks).map((t) => t.id)).toEqual(['a', 'b'])
  })
})

describe('bucketOpenTasks', () => {
  it('groups by lateness in a fixed order and drops empty groups', () => {
    const buckets = bucketOpenTasks(
      [
        task({ id: 'later', dueDate: '2026-09-30' }),
        task({ id: 'late', dueDate: '2026-08-01' }),
        task({ id: 'today', dueDate: TODAY }),
      ],
      TODAY,
    )
    expect(buckets.map((b) => b.state)).toEqual(['overdue', 'today', 'later'])
    expect(buckets[0].tasks.map((t) => t.id)).toEqual(['late'])
  })

  it('never shows a done task even if one is handed to it', () => {
    const buckets = bucketOpenTasks(
      [task({ id: 'done', status: 'done', dueDate: '2026-08-01' })],
      TODAY,
    )
    expect(buckets).toEqual([])
  })

  it('sorts within a group', () => {
    const buckets = bucketOpenTasks(
      [
        task({ id: 'b', dueDate: '2026-08-10' }),
        task({ id: 'a', dueDate: '2026-08-02' }),
      ],
      TODAY,
    )
    expect(buckets[0].tasks.map((t) => t.id)).toEqual(['a', 'b'])
  })
})

describe('summarizeOpenTasks', () => {
  it('counts open, overdue and due-soon separately', () => {
    const load = summarizeOpenTasks(
      [
        task({ id: '1', dueDate: '2026-08-01' }),
        task({ id: '2', dueDate: '2026-08-05' }),
        task({ id: '3', dueDate: TODAY }),
        task({ id: '4', dueDate: '2026-08-15' }),
        task({ id: '5', dueDate: null }),
        task({ id: '6', status: 'done', dueDate: '2026-08-01' }),
      ],
      TODAY,
    )
    expect(load.open).toBe(5)
    expect(load.overdue).toBe(2)
    // Overdue work is NOT folded into "this week".
    expect(load.dueSoon).toBe(2)
  })

  it('reports how far past due the worst task is', () => {
    const load = summarizeOpenTasks(
      [task({ id: '1', dueDate: '2026-08-11' }), task({ id: '2', dueDate: '2026-08-02' })],
      TODAY,
    )
    expect(load.oldestOverdueDays).toBe(10)
  })

  it('reports no overdue age when nothing is late', () => {
    expect(summarizeOpenTasks([task({ dueDate: '2026-09-01' })], TODAY).oldestOverdueDays).toBe(
      null,
    )
  })

  it('counts distinct apps, not rows', () => {
    const load = summarizeOpenTasks(
      [
        task({ id: '1', appSlug: 'alpha' }),
        task({ id: '2', appSlug: 'alpha' }),
        task({ id: '3', appSlug: 'beta' }),
      ],
      TODAY,
    )
    expect(load.apps).toBe(2)
  })

  it('is all zeroes for a person with nothing open', () => {
    expect(summarizeOpenTasks([], TODAY)).toEqual({
      open: 0,
      overdue: 0,
      dueSoon: 0,
      oldestOverdueDays: null,
      apps: 0,
    })
  })
})
