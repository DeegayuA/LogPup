// Which work item may sit under which: Epic -> Feature -> Story -> Task ->
// Sub-task (PRD Module A), with bugs and the side types (improvement, tech
// debt, spike) hanging off any planning level.
//
// Enforced here, not in the database: the DB only guarantees what no caller
// may break (parent in the same table, not itself, ON DELETE SET NULL). The
// pairing rules are product policy and are expected to loosen per project.
//
// Cycles and depth need the parent's ancestor chain, which the caller reads
// first. Two concurrent re-parents can still race past this check; the
// accepted cost is a rare odd tree an editor can undo, not corrupted data.

export const TASK_TYPES = [
  'epic', 'feature', 'story', 'task', 'subtask', 'bug', 'improvement', 'tech_debt', 'spike',
] as const
export type TaskType = (typeof TASK_TYPES)[number]

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  epic: 'Epic',
  feature: 'Feature',
  story: 'Story',
  task: 'Task',
  subtask: 'Sub-task',
  bug: 'Bug',
  improvement: 'Improvement',
  tech_debt: 'Tech debt',
  spike: 'Spike',
}

const PLANNING: readonly TaskType[] = ['epic', 'feature', 'story']

export const ALLOWED_PARENT: Readonly<Record<TaskType, readonly TaskType[]>> = {
  epic: [],
  feature: ['epic'],
  story: ['epic', 'feature'],
  task: PLANNING,
  subtask: ['story', 'task', 'bug', 'improvement', 'tech_debt', 'spike'],
  bug: PLANNING,
  improvement: PLANNING,
  tech_debt: PLANNING,
  spike: PLANNING,
}

export const TASK_TYPE_PLURAL: Record<TaskType, string> = {
  epic: 'Epics',
  feature: 'Features',
  story: 'Stories',
  task: 'Tasks',
  subtask: 'Sub-tasks',
  bug: 'Bugs',
  improvement: 'Improvements',
  tech_debt: 'Tech debt items',
  spike: 'Spikes',
}

/**
 * What "+ Add" on a parent creates, so nobody has to pick a type or a parent
 * by hand: open the epic, add a story; open the story, add a task. Null means
 * the item takes no children (a sub-task is the bottom of the tree).
 * Every value is in ALLOWED_PARENT's list for its key — a test holds that.
 */
export const CHILD_TYPE: Readonly<Record<TaskType, TaskType | null>> = {
  epic: 'story',
  feature: 'story',
  story: 'task',
  task: 'subtask',
  subtask: null,
  bug: 'subtask',
  improvement: 'subtask',
  tech_debt: 'subtask',
  spike: 'subtask',
}

const PARENT_REQUIRED: ReadonlySet<TaskType> = new Set(['subtask'])

export const MAX_DEPTH = 5

export type ParentError = 'parent_required' | 'wrong_parent_type' | 'other_project' | 'cycle' | 'too_deep'

type Node = { id: string; type: TaskType; appId: string }

export function checkParent(input: {
  child: Node
  parent: Node | null
  /** The parent's ancestors, nearest first, not including the parent itself. */
  parentAncestorIds: string[]
  /** Levels in the child's own subtree, the child included (1 = no children). */
  childSubtreeHeight?: number
}): ParentError | null {
  const { child, parent, parentAncestorIds, childSubtreeHeight = 1 } = input
  if (!parent) return PARENT_REQUIRED.has(child.type) ? 'parent_required' : null
  if (parent.id === child.id) return 'cycle'
  // Before the ancestor-based checks: a caller that sees a parent from another
  // project can refuse without reading that project's ancestors at all.
  if (parent.appId !== child.appId) return 'other_project'
  if (parentAncestorIds.includes(child.id)) return 'cycle'
  if (!ALLOWED_PARENT[child.type].includes(parent.type)) return 'wrong_parent_type'
  // The parent sits at depth ancestors+1; the child's whole subtree hangs below it.
  if (parentAncestorIds.length + 1 + childSubtreeHeight > MAX_DEPTH) return 'too_deep'
  return null
}
