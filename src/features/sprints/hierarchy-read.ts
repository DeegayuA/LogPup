import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { liveTasks } from '@/db/live'
import { checkParent, MAX_DEPTH, type ParentError, type TaskType } from '@/features/sprints/hierarchy'

// The database half of checkParent: reads the proposed parent, its ancestor
// chain and the moved task's own subtree height. Walked level by level with
// plain selects (at most MAX_DEPTH reads each way) rather than a recursive
// CTE, because a tree is capped at five levels and every read here goes
// through liveTasks — a trashed parent is not a parent.

export const PARENT_ERROR_MESSAGE: Record<ParentError, string> = {
  parent_required: 'A sub-task needs a parent task',
  wrong_parent_type: 'That item cannot sit under the chosen parent',
  other_project: 'The parent must be in the same project',
  cycle: 'A task cannot sit under itself or one of its own sub-items',
  too_deep: `Work items can only nest ${MAX_DEPTH} levels deep`,
}

async function ancestorIds(parentId: string): Promise<string[]> {
  const ids: string[] = []
  let cursor: string | null = parentId
  // One extra step past the cap so a too-deep chain is seen as too deep.
  for (let i = 0; i <= MAX_DEPTH && cursor; i++) {
    const [row]: { parentId: string | null }[] = await db
      .select({ parentId: liveTasks.parentId })
      .from(liveTasks)
      .where(eq(liveTasks.id, cursor))
    cursor = row?.parentId ?? null
    if (cursor) {
      if (ids.includes(cursor)) break // a pre-existing loop; checkParent sees the cycle
      ids.push(cursor)
    }
  }
  return ids
}

async function subtreeHeight(taskId: string): Promise<number> {
  let level = [taskId]
  let height = 1
  while (height <= MAX_DEPTH) {
    const children = await db
      .select({ id: liveTasks.id })
      .from(liveTasks)
      .where(inArray(liveTasks.parentId, level))
    if (children.length === 0) break
    level = children.map((c) => c.id)
    height++
  }
  return height
}

/**
 * Null when `parentId` is an acceptable parent for a task of `type` in
 * `appId`; otherwise the sentence to show. `taskId` is null for a task that
 * does not exist yet (create), which has no subtree and cannot be its own
 * ancestor.
 */
export async function parentProblem(input: {
  taskId: string | null
  appId: string
  type: TaskType
  parentId: string | null
}): Promise<string | null> {
  const { taskId, appId, type, parentId } = input
  const child = { id: taskId ?? '', type, appId }
  if (!parentId) {
    const e = checkParent({ child, parent: null, parentAncestorIds: [] })
    return e ? PARENT_ERROR_MESSAGE[e] : null
  }
  const [parent] = await db
    .select({ id: liveTasks.id, type: liveTasks.type, appId: liveTasks.appId })
    .from(liveTasks)
    .where(eq(liveTasks.id, parentId))
  // One answer for "no such task" and "a task in another project": telling
  // them apart would let any caller probe which task ids exist elsewhere.
  // Worded for the likeliest real cause — the saved parent was deleted.
  if (!parent || parent.appId !== appId) {
    return 'That parent is gone or in another project — choose a new parent or No parent'
  }
  const [ancestors, height] = await Promise.all([
    ancestorIds(parentId),
    taskId ? subtreeHeight(taskId) : Promise.resolve(1),
  ])
  const e = checkParent({ child, parent, parentAncestorIds: ancestors, childSubtreeHeight: height })
  return e ? PARENT_ERROR_MESSAGE[e] : null
}
