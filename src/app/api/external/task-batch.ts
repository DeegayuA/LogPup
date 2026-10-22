/**
 * The pure half of POST /api/external/tasks/batch: given the candidate task rows for a group of
 * people, who is on each task and who last completed it, work out each person's own list with
 * the flags set relative to THEM. Kept out of the route so it can be tested without a database.
 */

export interface BatchTaskRowLike {
  id: string
  assigneeId: string | null
  status: string
}

export interface PerUserTask<R> {
  row: R
  isPrimaryAssignee: boolean
  isAssignee: boolean
  completedByMe: boolean
  assigneeCount: number
}

export function tasksPerUser<R extends BatchTaskRowLike>(
  userIds: string[],
  rows: R[],
  assignees: { taskId: string; userId: string }[],
  latestCompleter: Map<string, string>,
): Map<string, PerUserTask<R>[]> {
  // Everyone on each task: the owner column AND task_assignees — either alone is incomplete.
  const onTask = new Map<string, Set<string>>()
  for (const r of rows) onTask.set(r.id, new Set(r.assigneeId ? [r.assigneeId] : []))
  for (const a of assignees) onTask.get(a.taskId)?.add(a.userId)

  const out = new Map<string, PerUserTask<R>[]>(userIds.map((id) => [id, []]))
  for (const r of rows) {
    const people = onTask.get(r.id) ?? new Set<string>()
    // A completion counts only while the task is still done — a reopened task is nobody's.
    const completer = r.status === 'done' ? latestCompleter.get(r.id) : undefined
    for (const uid of userIds) {
      const isAssignee = people.has(uid)
      const completedByMe = completer === uid
      if (!isAssignee && !completedByMe) continue
      out.get(uid)!.push({
        row: r,
        isPrimaryAssignee: r.assigneeId === uid,
        isAssignee,
        completedByMe,
        assigneeCount: Math.max(people.size, 1),
      })
    }
  }
  return out
}
