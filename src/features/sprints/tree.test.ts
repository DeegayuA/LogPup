import { describe, expect, it } from 'vitest'
import { buildWorkTree, type TreeRow } from './tree'

const row = (over: Partial<TreeRow> & Pick<TreeRow, 'id'>): TreeRow => ({
  number: 1,
  title: over.id,
  type: 'task',
  status: 'todo',
  parentId: null,
  storyPoints: null,
  ...over,
})

describe('buildWorkTree', () => {
  it('nests children under their parent', () => {
    const tree = buildWorkTree([
      row({ id: 'epic', type: 'epic', number: 1 }),
      row({ id: 'story', type: 'story', number: 2, parentId: 'epic' }),
      row({ id: 'task', type: 'task', number: 3, parentId: 'story' }),
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe('epic')
    expect(tree[0].children[0].id).toBe('story')
    expect(tree[0].children[0].children[0].id).toBe('task')
  })

  it('treats a task whose parent is missing (trashed) as a root', () => {
    const tree = buildWorkTree([row({ id: 'orphan', parentId: 'gone' })])
    expect(tree.map((n) => n.id)).toEqual(['orphan'])
  })

  it('puts bigger types first, then lower numbers', () => {
    const tree = buildWorkTree([
      row({ id: 't9', type: 'task', number: 9 }),
      row({ id: 'e5', type: 'epic', number: 5 }),
      row({ id: 't2', type: 'task', number: 2 }),
      row({ id: 's7', type: 'story', number: 7 }),
    ])
    expect(tree.map((n) => n.id)).toEqual(['e5', 's7', 't2', 't9'])
  })

  it('rolls up points and done counts over every descendant', () => {
    const [epic] = buildWorkTree([
      row({ id: 'epic', type: 'epic', storyPoints: null }),
      row({ id: 's1', type: 'story', parentId: 'epic', storyPoints: 3, status: 'done' }),
      row({ id: 's2', type: 'story', parentId: 'epic', storyPoints: 5 }),
      row({ id: 't1', type: 'task', parentId: 's2', storyPoints: 2, status: 'done' }),
    ])
    expect(epic.rollup).toEqual({ items: 3, done: 2, points: 10 })
    expect(epic.children.find((c) => c.id === 's2')?.rollup).toEqual({ items: 1, done: 1, points: 2 })
  })

  it('a leaf has an empty rollup', () => {
    const [leaf] = buildWorkTree([row({ id: 'x', storyPoints: 4 })])
    expect(leaf.rollup).toEqual({ items: 0, done: 0, points: 0 })
  })

  it('survives a loop in the data without recursing forever', () => {
    const tree = buildWorkTree([
      row({ id: 'a', parentId: 'b' }),
      row({ id: 'b', parentId: 'a' }),
    ])
    // Neither is reachable from a real root. The loop is cut at one edge, so
    // both still appear exactly once instead of vanishing or repeating.
    const ids: string[] = []
    const walk = (nodes: typeof tree) => nodes.forEach((n) => { ids.push(n.id); walk(n.children) })
    walk(tree)
    expect(ids.sort()).toEqual(['a', 'b'])
  })
})
