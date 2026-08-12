import { describe, expect, it } from 'vitest'
import { backlogTasksQuery, isBacklogRow } from './backlog'

describe('isBacklogRow', () => {
  it('task with sprintId null is in the backlog', () => {
    expect(isBacklogRow({ sprintId: null, deletedAt: null }, null)).toBe(true)
  })

  it('task of a live sprint is NOT in the backlog', () => {
    const task = { sprintId: 'sprint-1', deletedAt: null }
    const liveSprint = { deletedAt: null }
    expect(isBacklogRow(task, liveSprint)).toBe(false)
  })

  it('task of a trashed sprint is in the backlog', () => {
    const task = { sprintId: 'sprint-1', deletedAt: null }
    const trashedSprint = { deletedAt: new Date('2026-01-01T00:00:00Z') }
    expect(isBacklogRow(task, trashedSprint)).toBe(true)
  })

  it('a trashed task is never in the backlog, regardless of sprint', () => {
    const trashedTask = { sprintId: null, deletedAt: new Date('2026-01-01T00:00:00Z') }
    expect(isBacklogRow(trashedTask, null)).toBe(false)

    const trashedTaskWithLiveSprint = { sprintId: 'sprint-1', deletedAt: new Date('2026-01-01T00:00:00Z') }
    expect(isBacklogRow(trashedTaskWithLiveSprint, { deletedAt: null })).toBe(false)

    const trashedTaskWithTrashedSprint = { sprintId: 'sprint-1', deletedAt: new Date('2026-01-01T00:00:00Z') }
    expect(
      isBacklogRow(trashedTaskWithTrashedSprint, { deletedAt: new Date('2026-01-01T00:00:00Z') }),
    ).toBe(false)
  })

  it('treats a task pointing at a sprint that could not be loaded as backlog', () => {
    expect(isBacklogRow({ sprintId: 'sprint-1', deletedAt: null }, undefined)).toBe(true)
  })
})

describe('backlogTasksQuery', () => {
  it('builds valid, connection-free SQL: leftJoin liveSprints, WHERE ... IS NULL', () => {
    const { sql, params } = backlogTasksQuery().toSQL()
    const lower = sql.toLowerCase()
    expect(lower).toContain('left join')
    expect(lower).toContain('is null')
    expect(params).toEqual([])
  })
})
