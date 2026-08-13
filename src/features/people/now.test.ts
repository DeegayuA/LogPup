import { describe, it, expect } from 'vitest'
import {
  actionSentence,
  isOverdue,
  nowHeadline,
  overdueCount,
  recentSummary,
  sortNowTasks,
  type NowTask,
  type RecentAction,
} from './now'

const TODAY = '2026-08-13'

function task(partial: Partial<NowTask> & { id: string; title: string }): NowTask {
  return {
    appName: null,
    appSlug: null,
    sprintName: null,
    dueDate: null,
    priority: 0,
    ...partial,
  }
}

function action(partial: Partial<RecentAction> & { id: string }): RecentAction {
  return {
    verb: 'created',
    entityType: 'task',
    entityLabel: 'Something',
    appName: null,
    detail: null,
    pagePath: null,
    at: new Date('2026-08-12T09:00:00.000Z'),
    ...partial,
  }
}

describe('isOverdue', () => {
  it('is true only for a due date strictly before today', () => {
    expect(isOverdue(task({ id: '1', title: 'a', dueDate: '2026-08-12' }), TODAY)).toBe(true)
    expect(isOverdue(task({ id: '2', title: 'b', dueDate: TODAY }), TODAY)).toBe(false)
    expect(isOverdue(task({ id: '3', title: 'c', dueDate: '2026-08-14' }), TODAY)).toBe(false)
  })

  it('treats an undated task as not overdue', () => {
    // Unscheduled is not late — the distinction the whole sort rests on.
    expect(isOverdue(task({ id: '4', title: 'd' }), TODAY)).toBe(false)
  })
})

describe('sortNowTasks', () => {
  it('puts overdue first, then soonest due', () => {
    const sorted = sortNowTasks(
      [
        task({ id: 'later', title: 'later', dueDate: '2026-08-20' }),
        task({ id: 'late', title: 'late', dueDate: '2026-08-01' }),
        task({ id: 'today', title: 'today', dueDate: TODAY }),
      ],
      TODAY,
    )
    expect(sorted.map((t) => t.id)).toEqual(['late', 'today', 'later'])
  })

  it('sorts an undated task after every dated one, however high its priority', () => {
    // The trap: priority-first ordering buries the thing that is actually late.
    const sorted = sortNowTasks(
      [
        task({ id: 'undated', title: 'undated', priority: 3 }),
        task({ id: 'dated', title: 'dated', dueDate: '2026-08-20', priority: 0 }),
      ],
      TODAY,
    )
    expect(sorted.map((t) => t.id)).toEqual(['dated', 'undated'])
  })

  it('breaks a due-date tie on priority, then on title', () => {
    const sorted = sortNowTasks(
      [
        task({ id: 'b', title: 'b', dueDate: '2026-08-20', priority: 1 }),
        task({ id: 'a', title: 'a', dueDate: '2026-08-20', priority: 1 }),
        task({ id: 'high', title: 'z', dueDate: '2026-08-20', priority: 3 }),
      ],
      TODAY,
    )
    expect(sorted.map((t) => t.id)).toEqual(['high', 'a', 'b'])
  })

  it('does not mutate the input', () => {
    const input = [
      task({ id: '1', title: 'a', dueDate: '2026-08-20' }),
      task({ id: '2', title: 'b', dueDate: '2026-08-01' }),
    ]
    sortNowTasks(input, TODAY)
    expect(input.map((t) => t.id)).toEqual(['1', '2'])
  })
})

describe('nowHeadline', () => {
  it('is null when nothing is in progress', () => {
    // The caller owns the empty state; a headline that says nothing is worse
    // than no headline.
    expect(nowHeadline([], TODAY)).toBeNull()
  })

  it('names up to two, most urgent first', () => {
    expect(
      nowHeadline(
        [
          task({ id: '1', title: 'Later thing', dueDate: '2026-08-20' }),
          task({ id: '2', title: 'Late thing', dueDate: '2026-08-01' }),
        ],
        TODAY,
      ),
    ).toBe('Late thing, Later thing')
  })

  it('summarises the rest rather than listing them', () => {
    expect(
      nowHeadline(
        [
          task({ id: '1', title: 'One', dueDate: '2026-08-01' }),
          task({ id: '2', title: 'Two', dueDate: '2026-08-02' }),
          task({ id: '3', title: 'Three', dueDate: '2026-08-03' }),
          task({ id: '4', title: 'Four', dueDate: '2026-08-04' }),
        ],
        TODAY,
      ),
    ).toBe('One, Two +2 more')
  })
})

describe('overdueCount', () => {
  it('counts only the late ones', () => {
    expect(
      overdueCount(
        [
          task({ id: '1', title: 'a', dueDate: '2026-08-01' }),
          task({ id: '2', title: 'b', dueDate: '2026-08-02' }),
          task({ id: '3', title: 'c', dueDate: '2026-08-30' }),
          task({ id: '4', title: 'd' }),
        ],
        TODAY,
      ),
    ).toBe(2)
  })
})

describe('actionSentence', () => {
  it('reads as something already done', () => {
    expect(actionSentence(action({ id: '1', verb: 'moved', entityLabel: 'Fix login' }))).toBe(
      'Moved Fix login',
    )
  })

  it("appends the log's own detail fragment rather than re-deriving it", () => {
    expect(
      actionSentence(
        action({ id: '1', verb: 'moved', entityLabel: 'Fix login', detail: 'to In progress' }),
      ),
    ).toBe('Moved Fix login — to In progress')
  })

  it('passes an unknown verb through instead of guessing at it', () => {
    expect(actionSentence(action({ id: '1', verb: 'escalated', entityLabel: 'Outage' }))).toBe(
      'Escalated Outage',
    )
  })
})

describe('recentSummary', () => {
  it('is null with no history', () => {
    expect(recentSummary([])).toBeNull()
  })

  it('counts per kind, dominant kind first', () => {
    expect(
      recentSummary([
        action({ id: '1', entityType: 'task' }),
        action({ id: '2', entityType: 'meeting' }),
        action({ id: '3', entityType: 'task' }),
        action({ id: '4', entityType: 'task' }),
      ]),
    ).toBe('3 tasks, 1 meeting')
  })

  it('does not pluralise a single item', () => {
    expect(recentSummary([action({ id: '1', entityType: 'sprint' })])).toBe('1 sprint')
  })
})
