import { describe, expect, it } from 'vitest'
import { tasksPerUser } from './task-batch'

const row = (id: string, over: Partial<{ assigneeId: string | null; status: string }> = {}) => ({
  id, assigneeId: null as string | null, status: 'todo', ...over,
})

describe('tasksPerUser', () => {
  it('gives each person the tasks they own, are on, or completed — with the flags set for THEM', () => {
    const rows = [row('t1', { assigneeId: 'u1' }), row('t2'), row('t3', { assigneeId: 'u2', status: 'done' })]
    const assignees = [{ taskId: 't2', userId: 'u2' }, { taskId: 't1', userId: 'u1' }]
    const completers = new Map([['t3', 'u1']])
    const out = tasksPerUser(['u1', 'u2'], rows, assignees, completers)

    expect(out.get('u1')?.map((x) => [x.row.id, x.isPrimaryAssignee, x.isAssignee, x.completedByMe])).toEqual([
      ['t1', true, true, false],
      ['t3', false, false, true], // finished somebody else's task
    ])
    expect(out.get('u2')?.map((x) => [x.row.id, x.isPrimaryAssignee, x.isAssignee, x.completedByMe])).toEqual([
      ['t2', false, true, false],
      ['t3', true, true, false],
    ])
  })

  it('counts everyone on a task, the owner included once', () => {
    const rows = [row('t1', { assigneeId: 'u1' })]
    const assignees = [{ taskId: 't1', userId: 'u1' }, { taskId: 't1', userId: 'u2' }]
    const out = tasksPerUser(['u1'], rows, assignees, new Map())
    expect(out.get('u1')?.[0].assigneeCount).toBe(2)
  })

  // The owner column and task_assignees can disagree (see tasks/route.ts) — either counts.
  it('counts the owner column even when task_assignees has no row for them', () => {
    const out = tasksPerUser(['u1'], [row('t1', { assigneeId: 'u1' })], [], new Map())
    expect(out.get('u1')?.[0]).toMatchObject({ isAssignee: true, assigneeCount: 1 })
  })

  it('a completion only counts while the task is still done', () => {
    const out = tasksPerUser(['u1'], [row('t1', { status: 'in_progress' })], [], new Map([['t1', 'u1']]))
    expect(out.get('u1')).toEqual([])
  })

  it('every requested user is present, with an empty list when nothing matched', () => {
    const out = tasksPerUser(['u1', 'u9'], [], [], new Map())
    expect(out.get('u9')).toEqual([])
  })
})
