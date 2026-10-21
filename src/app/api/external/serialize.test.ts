import { describe, expect, it } from 'vitest'
import { parseTaskListParams, serializeTask, type ExternalTaskRow } from './serialize'

const row = (over: Partial<ExternalTaskRow> = {}): ExternalTaskRow => ({
  id: 't1',
  title: 'Fix the gauge',
  description: null,
  status: 'todo',
  priority: 1,
  dueDate: '2026-10-22',
  dueKind: 'target',
  dueCommitmentNote: null,
  originalDueDate: null,
  completedAt: null,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  appId: 'a1',
  appName: 'Solar',
  appSlug: 'solar',
  sprintId: null,
  sprintName: null,
  sprintEndDate: null,
  isPrimaryAssignee: false,
  isAssignee: false,
  assigneeName: null,
  assigneeCount: 1,
  ...over,
})

describe('serializeTask', () => {
  it('says whether the person is on the task, separately from being its owner', () => {
    expect(serializeTask(row({ isAssignee: true }), 'https://x').isAssignee).toBe(true)
    expect(serializeTask(row({ isAssignee: false }), 'https://x').isAssignee).toBe(false)
  })

  // A project task belongs to somebody else; the receiving app names them on the row.
  it('names the primary assignee, or null when nobody owns it', () => {
    expect(serializeTask(row({ assigneeName: 'Kasun' }), 'https://x').assignee).toEqual({ name: 'Kasun' })
    expect(serializeTask(row({ assigneeName: null }), 'https://x').assignee).toBeNull()
  })

  it('keeps calendar dates as strings', () => {
    expect(serializeTask(row(), 'https://x').dueDate).toBe('2026-10-22')
  })
})

describe('parseTaskListParams', () => {
  const p = (q: string) => parseTaskListParams(new URLSearchParams(q))

  it('defaults to open tasks assigned to the person, so existing callers are unchanged', () => {
    expect(p('email=a@b.c')).toEqual({ email: 'a@b.c', openOnly: true, scope: 'assigned', limit: 50 })
  })

  it('normalises the email', () => {
    expect(p('email=%20Some@Gmail.COM%20').email).toBe('some@gmail.com')
  })

  it('reads status=all and scope=projects', () => {
    const r = p('email=a@b.c&status=all&scope=projects')
    expect(r.openOnly).toBe(false)
    expect(r.scope).toBe('projects')
  })

  // Anything that is not exactly 'projects' must not widen what is read.
  it('treats an unknown scope as assigned', () => {
    expect(p('email=a@b.c&scope=everything').scope).toBe('assigned')
  })

  it('clamps the limit to 1..200', () => {
    expect(p('limit=0').limit).toBe(50)
    expect(p('limit=-5').limit).toBe(1)
    expect(p('limit=9999').limit).toBe(200)
    expect(p('limit=120').limit).toBe(120)
  })
})
