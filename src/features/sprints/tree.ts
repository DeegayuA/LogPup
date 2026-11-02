// The Backlog tab's tree: a project's work items nested by parent, with
// rollups. Pure (rows in, tree out) so the shape rules are testable without a
// database, and so the page pays for ONE flat read rather than one per level.
//
// Rollup counts descendants, not the node itself: "3 of 5 done · 13 pts" on
// an epic is about the work under it — an epic's own estimate (if anyone sets
// one) is a forecast of that same work, and adding the two would count it
// twice.

import type { TaskStatus } from '@/features/sprints/board-view'
import { TASK_TYPES, type TaskType } from '@/features/sprints/hierarchy'

export type TreeRow = {
  id: string
  number: number | null
  title: string
  type: TaskType
  status: TaskStatus
  parentId: string | null
  storyPoints: number | null
}

export type Rollup = { items: number; done: number; points: number }

export type TreeNode<R extends TreeRow = TreeRow> = Omit<R, 'children' | 'rollup'> & {
  children: TreeNode<R>[]
  rollup: Rollup
}

// Bigger containers first (epic, feature, story...), the declaration order of
// the task_type enum, then by number: oldest first within a type.
const TYPE_ORDER = new Map<TaskType, number>(TASK_TYPES.map((t, i) => [t, i]))

function compare(a: TreeRow, b: TreeRow): number {
  return (
    (TYPE_ORDER.get(a.type) ?? 99) - (TYPE_ORDER.get(b.type) ?? 99) ||
    (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER) ||
    // Total order, so two renders of the same rows never swap neighbours.
    a.id.localeCompare(b.id)
  )
}

export function buildWorkTree<R extends TreeRow>(rows: readonly R[]): TreeNode<R>[] {
  const nodes = new Map<string, TreeNode<R>>()
  for (const r of rows) {
    nodes.set(r.id, { ...r, children: [], rollup: { items: 0, done: 0, points: 0 } })
  }

  const roots: TreeNode<R>[] = []
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    // A parent outside the set (trashed, or in no read) makes this a root:
    // hiding it would lose the work, and the board already shows it anyway.
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  // Loop guard: rows only reachable through a cycle never hang off a root.
  // The database forbids self-parenting but not a two-step loop, so surface
  // them as roots rather than drop them or recurse forever.
  const reached = new Set<string>()
  const mark = (n: TreeNode<R>) => {
    if (reached.has(n.id)) return
    reached.add(n.id)
    n.children.forEach(mark)
  }
  roots.forEach(mark)
  for (const node of nodes.values()) {
    if (!reached.has(node.id)) {
      roots.push(node)
      node.children = node.children.filter((c) => !reached.has(c.id))
      mark(node)
    }
  }

  const finish = (n: TreeNode<R>, seen: Set<string>): Rollup => {
    seen.add(n.id)
    n.children = n.children.filter((c) => !seen.has(c.id)).sort(compare)
    const total: Rollup = { items: 0, done: 0, points: 0 }
    for (const c of n.children) {
      const sub = finish(c, seen)
      total.items += 1 + sub.items
      total.done += (c.status === 'done' ? 1 : 0) + sub.done
      total.points += (c.storyPoints ?? 0) + sub.points
    }
    n.rollup = total
    return total
  }
  const seen = new Set<string>()
  roots.sort(compare)
  for (const r of roots) finish(r, seen)
  return roots
}
