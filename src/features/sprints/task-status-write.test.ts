import { describe, it, expect } from 'vitest'
import { statusActivity } from './task-status-write'

/**
 * `statusActivity` is the verb ladder that `updateTask` and `moveTaskOnBoard` each carried a
 * byte-identical copy of, and that the Attendance bridge is now a third caller of. The verbs
 * are not cosmetic: the activity feed and every throughput reader tell "completed" from
 * "moved", and a reopened task logged as "completed" reads as a second completion forever.
 *
 * The write path itself (completed_at, follow-up sync, the notification) needs a database and
 * is covered by the endpoint's own checks; this pins the pure decision.
 */
describe('statusActivity', () => {
  it('entering done is a completion, with no redundant detail', () => {
    const a = statusActivity('todo', 'done')
    expect(a.verb).toBe('completed')
    expect(a.detail).toBeNull()
    expect(a.metadata).toEqual({ status: { from: 'todo', to: 'done' } })
  })

  it('leaving done is a reopen, not a move', () => {
    expect(statusActivity('done', 'todo').verb).toBe('reopened')
    expect(statusActivity('done', 'in_progress').verb).toBe('reopened')
  })

  it('between open states it is a move, and says which column', () => {
    const a = statusActivity('todo', 'in_progress')
    expect(a.verb).toBe('moved')
    expect(a.detail).toBe('to In progress')

    expect(statusActivity('in_progress', 'todo').detail).toBe('to To do')
  })

  // A reopen that logged 'completed' would make the throughput readers count one task twice.
  it('never reports a reopen as a completion', () => {
    expect(statusActivity('done', 'in_progress').verb).not.toBe('completed')
  })

  it('always records both ends of the transition', () => {
    for (const [from, to] of [
      ['todo', 'in_progress'],
      ['in_progress', 'done'],
      ['done', 'todo'],
    ] as const) {
      expect(statusActivity(from, to).metadata).toEqual({ status: { from, to } })
    }
  })
})
