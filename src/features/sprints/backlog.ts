import { QueryBuilder } from 'drizzle-orm/pg-core'
import { eq, isNull, type SQL } from 'drizzle-orm'
import { liveSprints, liveTasks } from '@/db/live'

// Connection-free, like src/db/live.ts: QueryBuilder builds SQL without a
// client, so importing this module never touches the lazy db Proxy.
const qb = new QueryBuilder()

/**
 * THE backlog rule, expressed once as a plain-object predicate: a task
 * belongs to the backlog when it has no sprint, or the sprint it's in is
 * soft-deleted. A soft-deleted task is never "in" anything, backlog
 * included — real callers only ever see live tasks (this file's SQL builder
 * below starts from liveTasks), but the predicate checks it directly too so
 * a caller handed a raw task object gets the same answer.
 *
 * `sprint` is the row `task.sprintId` points to, or null/undefined for
 * "no sprint" *and* for "sprint not found/not loaded" — either way a task
 * whose sprint isn't a live one counts as backlog.
 */
export function isBacklogRow(
  task: { sprintId: string | null; deletedAt: Date | string | null },
  sprint: { deletedAt: Date | string | null } | null | undefined,
): boolean {
  if (task.deletedAt != null) return false
  if (task.sprintId === null) return true
  return sprint == null || sprint.deletedAt != null
}

// --- composable select builder ---------------------------------------------
//
// The SQL-level version of the same rule: liveTasks leftJoin liveSprints ON
// sprintId, WHERE liveSprints.id IS NULL (a task's sprint match disappears
// from the left join exactly when it has no sprint, or its sprint is
// trashed — liveSprints already excludes those rows). Exported as composable
// pieces rather than one fixed query: every real call site needs different
// columns/aggregates/extra filters (getBoard also joins `users` and picks
// specific columns; task-actions.ts's nextRankFor is a MAX() aggregate under
// an extra status filter), so callers do
//
//   .from(liveTasks)
//   .leftJoin(liveSprints, backlogJoinCondition)
//   .where(and(...their own filters, sprintOrBacklogCondition(sprintId)))
//
// which keeps exactly one place (this file) that knows what "backlog" means
// at the SQL level, the same way live.ts is the one place that knows what
// "live" means.

/** ON condition for `leftJoin(liveSprints, backlogJoinCondition)`. */
export const backlogJoinCondition: SQL = eq(liveTasks.sprintId, liveSprints.id)

/** WHERE fragment: true when the left-joined sprint didn't match a live one. */
export const backlogCondition: SQL = isNull(liveSprints.id)

/**
 * The predicate to AND into a task query's WHERE: an exact sprint match when
 * `sprintId` names one, or `backlogCondition` when it's null (the "app
 * backlog" board column / rank lookup). The eq() branch doesn't strictly
 * need the join, but every caller adds `backlogJoinCondition` unconditionally
 * so one join shape covers both branches.
 */
export function sprintOrBacklogCondition(sprintId: string | null): SQL {
  return sprintId === null ? backlogCondition : eq(liveTasks.sprintId, sprintId)
}

/**
 * The backlog shape itself, built with the connection-free QueryBuilder
 * (proves the join/where above render to valid, client-free SQL — see
 * backlog.test.ts). Not wired to the real `db`: a caller that wants to
 * actually run it composes `backlogJoinCondition`/`sprintOrBacklogCondition`
 * against the real `db` instead (see getBoard/nextRankFor), since both need
 * columns and filters this generic shape doesn't have.
 */
export function backlogTasksQuery() {
  return qb
    .select()
    .from(liveTasks)
    .leftJoin(liveSprints, backlogJoinCondition)
    .where(backlogCondition)
}
