/**
 * The ask derivation, shared by the two surfaces that ask the same questions.
 *
 * WHY THIS EXISTS. `planner.ts` answers "who should be in THIS meeting, and
 * what do I ask them" — one meeting, its projects, its attendees. R6
 * COVER-TOGETHER (`coverage.ts`) answers "which meetings could have been one
 * meeting" — a workspace-wide sweep, no meeting at all. Different questions,
 * but they are derived from the same rows and must say the same thing about
 * them. Two copies of "3 tasks past due on Alpha" is how the planner and the
 * load board end up disagreeing about somebody's week in two different
 * wordings, neither of which a reader can check against the other.
 *
 * WHAT IS SHARED IS THE DERIVATION, NOT THE SHAPE. The planner groups asks by
 * PERSON (a candidate's reason phrase and their agenda lines); R6 groups them
 * by REQUIRED SET (who a decision cannot happen without). Those groupings have
 * no common structure worth forcing, so what lives here is the layer beneath
 * both: which rows qualify, how they are counted, and the exact sentence each
 * count produces.
 *
 * PURE. No `@/db`, no `new Date()`. `todayIso` is a plain yyyy-mm-dd in
 * Asia/Colombo, resolved once by the caller — two derivations that each asked
 * the clock could straddle midnight and disagree about whether the same task
 * is late.
 */

import type { CheckinGap } from '@/features/sprints/checkins'

/** The columns every rule below reads off a task. `PlanTaskRow` satisfies it
 *  structurally, so the planner passes its own rows in unchanged. */
export type AskTaskRow = {
  appId: string
  sprintId: string | null
  assigneeId: string | null
  status: 'todo' | 'in_progress' | 'done'
  dueDate: string | null
}

export function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`
}

/**
 * The same overdue rule as getAppCounts and notes.ts's isOverdue: not done,
 * has a due date, and that date is strictly before today.
 *
 * Due TODAY is not overdue — the number here has to survive being checked
 * against the app page, which is one click away.
 */
export function isPastDue(task: AskTaskRow, todayIso: string): boolean {
  if (task.status === 'done') return false
  if (!task.dueDate) return false
  return task.dueDate < todayIso
}

export type OverdueRow = { userId: string; appId: string; count: number }

/**
 * Overdue work counted per (assignee, project).
 *
 * Counted per pair rather than emitted per task: "7 tasks past due on Alpha"
 * is one question at a meeting; seven lines is a backlog reading.
 *
 * Keyed by a nested map rather than a joined string — joining two uuids means
 * splitting them again later, and a split is one more place for the pair to
 * come back swapped or truncated.
 *
 * `includeApp` is how the caller scopes it: the planner passes "is this one of
 * this meeting's projects", the workspace sweep passes "does this project
 * exist". Sorted by (userId, appId) so the output is total.
 */
export function overdueRowsByUserApp(
  tasks: readonly AskTaskRow[],
  todayIso: string,
  includeApp: (appId: string) => boolean,
): OverdueRow[] {
  const byUserApp = new Map<string, Map<string, number>>()
  for (const task of tasks) {
    if (!task.assigneeId) continue
    if (!includeApp(task.appId)) continue
    if (!isPastDue(task, todayIso)) continue
    const perApp = byUserApp.get(task.assigneeId) ?? new Map<string, number>()
    perApp.set(task.appId, (perApp.get(task.appId) ?? 0) + 1)
    byUserApp.set(task.assigneeId, perApp)
  }
  return [...byUserApp.entries()]
    .flatMap(([userId, perApp]) =>
      [...perApp.entries()].map(([appId, count]) => ({ userId, appId, count })),
    )
    .sort((a, b) => a.userId.localeCompare(b.userId) || a.appId.localeCompare(b.appId))
}

export function overdueAskText(count: number, appName: string): string {
  return `${plural(count, 'task')} past due on ${appName}`
}

/**
 * Work that started, went past its date, and still has not finished.
 *
 * The honest stand-in for "blocked": task_status is ('todo','in_progress',
 * 'done') — there IS no blocked state in this schema, and inventing one from a
 * title keyword would put a word on screen no row can back.
 */
export function stalledCount(tasks: readonly AskTaskRow[], todayIso: string): number {
  return tasks.filter((task) => task.status === 'in_progress' && isPastDue(task, todayIso)).length
}

export function stalledAskText(count: number, sprintName: string): string {
  return `${plural(count, 'task')} in ${sprintName} started, past due, and still in progress`
}

/**
 * A check-in that disagrees with the board, in words.
 *
 * 'unknown' is NOT 'none' and must never read the same (see checkins.ts): the
 * board having nothing to compare against is a different fact from the board
 * agreeing, and a sentence that blurs them turns "nobody knows" into "all
 * fine".
 */
export function checkinAskText(
  percent: number,
  sprintName: string,
  gap: CheckinGap,
  /** Null exactly when `gap` is 'unknown' — there was no board to read a
   *  percentage off. Typed nullable rather than defaulted to 0, because a
   *  zero here would render "the board says 0%", which is a claim about the
   *  work rather than an admission that nothing could be compared. */
  boardPercent: number | null,
): string {
  return gap === 'unknown'
    ? `Said ${percent}% on ${sprintName} — no tasks on that board to compare against`
    : `Said ${percent}% on ${sprintName}, the board says ${boardPercent}%`
}

export function checkinAskContext(gap: CheckinGap): string | null {
  if (gap === 'ahead') return 'Reported ahead of the board'
  if (gap === 'behind') return 'Reported behind the board'
  return null
}
