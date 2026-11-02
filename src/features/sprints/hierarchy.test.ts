import { describe, expect, it } from 'vitest'
import { taskType } from '@/db/schema'
import { ALLOWED_PARENT, CHILD_TYPE, MAX_DEPTH, TASK_TYPES, checkParent } from './hierarchy'

describe('CHILD_TYPE (what "+ Add" creates)', () => {
  it('walks Epic -> Story -> Task -> Sub-task', () => {
    expect(CHILD_TYPE.epic).toBe('story')
    expect(CHILD_TYPE.story).toBe('task')
    expect(CHILD_TYPE.task).toBe('subtask')
    expect(CHILD_TYPE.subtask).toBeNull()
  })            

  it('only ever proposes a child the parent rules accept', () => {
    for (const parent of TASK_TYPES) {
      const child = CHILD_TYPE[parent]
      if (child) expect(ALLOWED_PARENT[child]).toContain(parent)
    }
  })
})                                                         

const APP = 'app-1'
const node = (id: string, type: (typeof TASK_TYPES)[number], appId = APP) => ({ id, type, appId })

describe('ALLOWED_PARENT', () => {
  it('TASK_TYPES is exactly the task_type enum', () => {
    expect([...TASK_TYPES]).toEqual([...taskType.enumValues])
  })

  it('has a rule for every task type', () => {
    expect(Object.keys(ALLOWED_PARENT).sort()).toEqual([...TASK_TYPES].sort())
  })

  it('follows Epic -> Feature -> Story -> Task -> Sub-task', () => {
    expect(ALLOWED_PARENT.epic).toEqual([])
    expect(ALLOWED_PARENT.feature).toContain('epic')
    expect(ALLOWED_PARENT.story).toEqual(expect.arrayContaining(['epic', 'feature']))
    expect(ALLOWED_PARENT.task).toEqual(expect.arrayContaining(['epic', 'feature', 'story']))
    expect(ALLOWED_PARENT.subtask).toContain('task')
    expect(ALLOWED_PARENT.subtask).not.toContain('epic')
  })
})

describe('checkParent', () => {
  it('allows no parent for a type that does not need one', () => {
    expect(checkParent({ child: node('c', 'task'), parent: null, parentAncestorIds: [] })).toBeNull()
    expect(checkParent({ child: node('c', 'epic'), parent: null, parentAncestorIds: [] })).toBeNull()
  })

  it('requires a parent for a sub-task', () => {
    expect(checkParent({ child: node('c', 'subtask'), parent: null, parentAncestorIds: [] }))
      .toBe('parent_required')
  })

  it('allows a legal pairing', () => {
    expect(checkParent({ child: node('c', 'story'), parent: node('p', 'epic'), parentAncestorIds: [] }))
      .toBeNull()
    expect(checkParent({ child: node('c', 'subtask'), parent: node('p', 'task'), parentAncestorIds: ['e'] }))
      .toBeNull()
  })

  it('refuses an illegal pairing', () => {
    expect(checkParent({ child: node('c', 'epic'), parent: node('p', 'story'), parentAncestorIds: [] }))
      .toBe('wrong_parent_type')
    expect(checkParent({ child: node('c', 'feature'), parent: node('p', 'task'), parentAncestorIds: [] }))
      .toBe('wrong_parent_type')
  })

  it('refuses a parent in another project', () => {
    expect(checkParent({
      child: node('c', 'task'), parent: node('p', 'story', 'app-2'), parentAncestorIds: [],
    })).toBe('other_project')
  })

  it('refuses itself as its own parent', () => {
    expect(checkParent({ child: node('c', 'task'), parent: node('c', 'story'), parentAncestorIds: [] }))
      .toBe('cycle')
  })

  it('refuses a parent that already sits under the child', () => {
    expect(checkParent({
      child: node('c', 'story'), parent: node('p', 'feature'), parentAncestorIds: ['x', 'c'],
    })).toBe('cycle')
  })

  it(`refuses nesting deeper than ${MAX_DEPTH} levels`, () => {
    // The parent sits at depth 5 (four ancestors above it), so the child would be 6th.
    expect(checkParent({
      child: node('c', 'subtask'), parent: node('p', 'task'), parentAncestorIds: ['a', 'b', 'd', 'e'],
    })).toBe('too_deep')
    // Depth 5 itself is fine.
    expect(checkParent({
      child: node('c', 'subtask'), parent: node('p', 'task'), parentAncestorIds: ['a', 'b', 'd'],
    })).toBeNull()
  })

  it('counts the levels already under the child being moved', () => {
    // Parent at depth 2; a child with two levels beneath it would reach depth 5 — fine.
    expect(checkParent({
      child: node('c', 'story'), parent: node('p', 'feature'), parentAncestorIds: ['e'], childSubtreeHeight: 3,
    })).toBeNull()
    // One more level would reach depth 6.
    expect(checkParent({
      child: node('c', 'story'), parent: node('p', 'feature'), parentAncestorIds: ['e'], childSubtreeHeight: 4,
    })).toBe('too_deep')
  })

  it('reports another project before reading ancestors', () => {
    expect(checkParent({
      child: node('c', 'task'), parent: node('p', 'story', 'app-2'), parentAncestorIds: ['c'],
    })).toBe('other_project')
  })
})
