import { describe, expect, it } from 'vitest'

import { transitionTaskStatus } from './task-status'

// A named instant rather than `new Date()`: the whole reason `now` is a
// parameter is so the expected value can be written down.
const NOW = new Date('2026-08-21T09:30:00.000Z')

describe('entering done', () => {
  it('stamps the completion time on todo -> done', () => {
    expect(transitionTaskStatus('todo', 'done', NOW)).toEqual({
      status: 'done',
      completedAt: NOW,
    })
  })

  it('stamps on in_progress -> done too — the ordinary board drag', () => {
    expect(transitionTaskStatus('in_progress', 'done', NOW)).toEqual({
      status: 'done',
      completedAt: NOW,
    })
  })

  it('stamps on an insert that is born done', () => {
    // createTask with status 'done' — logging something already finished.
    // There is no previous status, and that is not a reason to skip the stamp.
    expect(transitionTaskStatus(null, 'done', NOW)).toEqual({
      status: 'done',
      completedAt: NOW,
    })
  })
})

describe('leaving done', () => {
  it('clears the completion time on done -> todo', () => {
    expect(transitionTaskStatus('done', 'todo', NOW)).toEqual({
      status: 'todo',
      completedAt: null,
    })
  })

  it('clears on done -> in_progress', () => {
    expect(transitionTaskStatus('done', 'in_progress', NOW)).toEqual({
      status: 'in_progress',
      completedAt: null,
    })
  })

  it('clears with an explicit null, not by omitting the column', () => {
    // The distinction the type exists for: omitting would leave the old stamp
    // on a task that is visibly back in progress.
    const patch = transitionTaskStatus('done', 'todo', NOW)
    expect('completedAt' in patch).toBe(true)
    expect(patch.completedAt).toBeNull()
  })
})

describe('transitions that must not touch the column', () => {
  it('leaves the ORIGINAL stamp alone on done -> done', () => {
    // The task dialog re-sends every field on every save. If an unchanged
    // 'done' rewrote completed_at, a typo fix three weeks later would report
    // as the completion time.
    const patch = transitionTaskStatus('done', 'done', NOW)
    expect(patch).toEqual({ status: 'done' })
    expect('completedAt' in patch).toBe(false)
  })

  it('touches nothing on todo -> in_progress', () => {
    const patch = transitionTaskStatus('todo', 'in_progress', NOW)
    expect(patch).toEqual({ status: 'in_progress' })
    expect('completedAt' in patch).toBe(false)
  })

  it('touches nothing on todo -> todo or in_progress -> in_progress', () => {
    expect(transitionTaskStatus('todo', 'todo', NOW)).toEqual({ status: 'todo' })
    expect(transitionTaskStatus('in_progress', 'in_progress', NOW)).toEqual({
      status: 'in_progress',
    })
  })

  it('leaves the column alone for an insert that is not done', () => {
    // The DB default is NULL; mentioning the column would only restate it.
    expect(transitionTaskStatus(null, 'todo', NOW)).toEqual({ status: 'todo' })
    expect(transitionTaskStatus(null, 'in_progress', NOW)).toEqual({ status: 'in_progress' })
  })
})

describe('the patch is the only thing the caller spreads', () => {
  it('covers all nine transitions plus the two inserts, with no other keys', () => {
    // Guards the shape rather than the values: a patch that grew a third key
    // would be written by callers that spread it and read by nobody.
    const statuses = ['todo', 'in_progress', 'done'] as const
    for (const current of [...statuses, null]) {
      for (const next of statuses) {
        const patch = transitionTaskStatus(current, next, NOW)
        expect(Object.keys(patch).sort()).toEqual(
          next === 'done'
            ? current === 'done'
              ? ['status']
              : ['completedAt', 'status']
            : current === 'done'
              ? ['completedAt', 'status']
              : ['status'],
        )
        expect(patch.status).toBe(next)
      }
    }
  })
})
