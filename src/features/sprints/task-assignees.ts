import type { BatchItem } from 'drizzle-orm/batch'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { liveTasks } from '@/db/live'
import { taskAssignees, tasks, users } from '@/db/schema'

/**
 * MORE THAN ONE PERSON ON A TASK.
 *
 * Two columns answer two different questions and this module is the seam
 * between them:
 *
 *  - `tasks.assignee_id` is UNCHANGED and still means THE ACCOUNTABLE PERSON.
 *    Every reader that already exists — the board, task-workload, app-health,
 *    the dashboard tiles, "my tasks" — keeps reading it and keeps working.
 *  - `task_assignees` is THE FULL SET, and it ALWAYS CONTAINS that person.
 *    Migration 0064 backfills every existing `assignee_id` into it so the
 *    invariant is true for rows that predate the table.
 *
 * So: "whose is it" is the column, "everyone on it" is the join. Dropping the
 * column instead would have meant rewriting every one of those readers in the
 * same commit as a schema change, on a database whose migrations are applied
 * by hand — which is the version of this change that takes the app down.
 *
 * The consequence for this file is the rule the whole API is built around:
 * ORDER MATTERS. The first id of a set is the accountable person, and every
 * helper below preserves that position rather than sorting, deduping or
 * filtering it away.
 *
 * NOTHING HERE WORKS UNTIL MIGRATION 0064 IS APPLIED. `task_assignees` does
 * not exist yet on any database, so both DB functions below throw until the
 * migration lands. That is why nothing on a list or board read path calls
 * them: a read of a missing relation on a hot path would break every page for
 * everyone sharing the dev database. The write path only touches the table
 * when a caller actually passes an assignee set.
 */

/** A person on a task, in the shape a chip row needs. */
export type TaskAssignee = { id: string; name: string }

/**
 * Ceiling on one task's assignee set, enforced by the zod inputs that accept
 * one. Not a product opinion about teamwork — a bound on an array that
 * arrives from a client and turns into one INSERT row per element.
 */
export const MAX_TASK_ASSIGNEES = 12

/**
 * The incoming set, cleaned without being reordered.
 *
 * Dedup keeps the FIRST mention, never the last: `[a, b, a]` is a person named
 * twice, and resolving that to `[b, a]` would silently hand accountability to
 * somebody else. Blanks and nullish entries are dropped rather than written —
 * an empty string is not a user id, and letting one through would reach the
 * database as a 22P02 thrown out of a server action.
 */
export function normalizeAssigneeIds(userIds: Iterable<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of userIds) {
    if (typeof raw !== 'string') continue
    const id = raw.trim()
    if (id === '' || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/**
 * THE FIRST IS PRIMARY. This is the one rule that ties the join table back to
 * `tasks.assignee_id`, and it is a function rather than an inlined `[0]` so
 * every caller agrees on it — including the empty case, where the answer is
 * `null` and means UNASSIGNED. Removing the last assignee is legal.
 */
/**
 * Reorders a set so `userId` is FIRST — the accountable slot — without
 * dropping anyone else. `null` means nobody, which empties the set.
 *
 * This is what a board drag means when the board is grouped by assignee:
 * dropping a card into someone's column says "this is now their task", not
 * "remove everybody else from it". A task with three people on it that gets
 * dragged into one person's column keeps its three people; only the
 * accountable one changes.
 */
export function withPrimaryAssignee(
  current: Iterable<string | null | undefined>,
  userId: string | null,
): string[] {
  if (userId === null) return []
  const rest = normalizeAssigneeIds(current).filter((id) => id !== userId)
  return normalizeAssigneeIds([userId, ...rest])
}

export function primaryAssigneeId(userIds: Iterable<string | null | undefined>): string | null {
  const [first] = normalizeAssigneeIds(userIds)
  return first ?? null
}

/** Just enough of a row for the ordering rule to be decidable. */
export type AssigneeOrderRow = { userId: string; addedAt?: Date | string | null }

/**
 * Chip order: WHEN SOMEBODY JOINED, tie-broken by id.
 *
 * Ordering by name would reshuffle the row every time a person is added, and
 * would put whoever is alphabetically luckiest in the first slot; ordering by
 * `added_at` keeps the person who was there first where they were. The id
 * tiebreak is not decoration — a set written in one statement shares a single
 * `now()`, and without a deterministic second key those rows would come back
 * in whatever order the planner felt like, which is a chip row that moves
 * between two renders of the same unchanged task.
 *
 * Non-mutating: callers pass query results they may still be grouping.
 */
export function orderAssignees<T extends AssigneeOrderRow>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const at = a.addedAt === undefined || a.addedAt === null ? Infinity : new Date(a.addedAt).getTime()
    const bt = b.addedAt === undefined || b.addedAt === null ? Infinity : new Date(b.addedAt).getTime()
    if (at !== bt) return at - bt
    if (a.userId === b.userId) return 0
    return a.userId < b.userId ? -1 : 1
  })
}

/** What one `setTaskAssignees` call has to write, and nothing more. */
export type AssigneeChange = {
  /** Ids to INSERT, in their position in the new set. */
  add: string[]
  /** Ids to DELETE. */
  remove: string[]
  /** What `tasks.assignee_id` must become — `null` is unassigned. */
  primary: string | null
  /** True when the membership AND the accountable person already match. */
  unchanged: boolean
}

/**
 * The minimal write: what to insert, what to delete, who is accountable.
 *
 * WRITING THE SAME SET TWICE IS A NO-OP. The dialog re-sends every field on
 * every save, so the common case here is "these are the same three people" —
 * and answering that with a delete-everything/insert-everything churn would
 * reset every `added_at` (destroying the chip order the column exists to
 * keep), fire cascade work for no reason, and make the activity trail read as
 * if the team had changed when it had not.
 *
 * A REORDER IS NOT A MEMBERSHIP CHANGE. Handing the lead to somebody already
 * on the task moves `primary` and leaves `add`/`remove` empty: the join rows
 * are already correct, only the column is wrong.
 */
export function diffAssignees(
  current: readonly string[],
  next: Iterable<string | null | undefined>,
  currentPrimary: string | null,
): AssigneeChange {
  const wanted = normalizeAssigneeIds(next)
  const have = new Set(current)
  const keep = new Set(wanted)
  const add = wanted.filter((id) => !have.has(id))
  const remove = current.filter((id) => !keep.has(id))
  const primary = wanted.length > 0 ? wanted[0] : null
  return {
    add,
    remove,
    primary,
    unchanged: add.length === 0 && remove.length === 0 && primary === currentPrimary,
  }
}

/**
 * Replace the set of people on a task, and keep `tasks.assignee_id` pointing
 * at the first of them.
 *
 * ONE ROUND TRIP FOR THE WRITES. neon-http has no interactive transaction, so
 * `db.batch` is the transaction available: the delete, the insert and the
 * column update either all land or none do. Doing them as three awaits would
 * make "the join says two people, the column says a third" a reachable state.
 *
 * The reads are deliberately outside it — they decide what to write, and
 * ordering them against the writes buys nothing on a driver that cannot hold
 * a snapshot across statements anyway.
 *
 * The task is read through `liveTasks`, so a TRASHED task has no assignee set
 * to replace: reassigning something that is sitting in the bin would put a
 * person's name on work nobody can see, and would resurrect it on their chip
 * row the moment it were restored.
 *
 * Throws on a missing/trashed task or an unknown user (a foreign key
 * violation); both callers already sit inside a try/catch that turns that
 * into "Invalid app, sprint, or assignee".
 */
export async function setTaskAssignees(
  taskId: string,
  userIds: Iterable<string | null | undefined>,
  actorId: string | null,
): Promise<AssigneeChange> {
  const [rows, [task]] = await Promise.all([
    db
      .select({ userId: taskAssignees.userId, addedAt: taskAssignees.addedAt })
      .from(taskAssignees)
      .where(eq(taskAssignees.taskId, taskId)),
    db.select({ assigneeId: liveTasks.assigneeId }).from(liveTasks).where(eq(liveTasks.id, taskId)),
  ])
  if (!task) throw new Error(`setTaskAssignees: no live task ${taskId}`)

  const current = orderAssignees(rows).map((row) => row.userId)
  const change = diffAssignees(current, userIds, task.assigneeId)
  if (change.unchanged) return change

  const statements: BatchItem<'pg'>[] = []
  if (change.remove.length > 0) {
    // A REAL delete, deliberately, and registered as such in the check-4
    // allowlist in src/db/live.test.ts: `task_assignees` carries no content
    // and no deletedAt — being off a task IS the absence of the row, exactly
    // as for meeting_attendees. Who removed whom is activity_log's job.
    statements.push(
      db
        .delete(taskAssignees)
        .where(and(eq(taskAssignees.taskId, taskId), inArray(taskAssignees.userId, change.remove))),
    )
  }
  if (change.add.length > 0) {
    // `added_at` is staggered by position instead of leaning on the column
    // default: everything in one statement shares a single `now()`, and with
    // identical timestamps the id tiebreak in orderAssignees would decide the
    // chip order alphabetically by UUID — i.e. at random — for the very set
    // the caller just took the trouble to order.
    const base = Date.now()
    statements.push(
      db
        .insert(taskAssignees)
        .values(
          change.add.map((userId, index) => ({
            taskId,
            userId,
            addedBy: actorId,
            addedAt: new Date(base + index),
          })),
        )
        // Two people accepting the same suggestion at once would otherwise
        // race into a primary-key violation thrown out of a server action.
        .onConflictDoNothing(),
    )
  }
  if (change.primary !== task.assigneeId) {
    statements.push(db.update(tasks).set({ assigneeId: change.primary }).where(eq(tasks.id, taskId)))
  }

  // db.batch needs a statically non-empty tuple, and a one-statement batch is
  // a round trip spent on ceremony — same shape as bulkUpdateTasks.
  const [first, ...rest] = statements
  if (first) await (rest.length === 0 ? first : db.batch([first, ...rest]))
  return change
}

/**
 * Everyone on each of these tasks, in chip order.
 *
 * BATCHED, and not as an optimisation: a board renders every card in one
 * pass, so a per-task version of this is the N+1 that turns one page into
 * eighty queries. It takes the ids the caller already has and answers all of
 * them in one statement.
 *
 * A task with nobody on it is absent from the map rather than present with an
 * empty array — callers read `map.get(id) ?? []` either way, and materialising
 * a row per empty task would make the map bigger than the answer.
 */
export async function getTaskAssignees(
  taskIds: readonly string[],
): Promise<Map<string, TaskAssignee[]>> {
  const byTask = new Map<string, TaskAssignee[]>()
  // Same cleaning an incoming assignee set gets, for the same two reasons:
  // a repeated id would widen the IN list for nothing, and a blank one is not
  // a uuid the driver can bind.
  const ids = normalizeAssigneeIds(taskIds)
  // An empty `inArray` is not a query worth sending, and drizzle would have
  // to invent a `false` predicate to express it.
  if (ids.length === 0) return byTask

  const rows = await db
    .select({
      taskId: taskAssignees.taskId,
      userId: taskAssignees.userId,
      addedAt: taskAssignees.addedAt,
      name: users.name,
    })
    .from(taskAssignees)
    // INNER join: a row whose user no longer exists cannot be rendered as a
    // chip, and `users` has no soft delete for it to be hiding behind.
    .innerJoin(users, eq(users.id, taskAssignees.userId))
    .where(inArray(taskAssignees.taskId, ids))
    .orderBy(asc(taskAssignees.addedAt), asc(taskAssignees.userId))

  const grouped = new Map<string, typeof rows>()
  for (const row of rows) {
    const bucket = grouped.get(row.taskId)
    if (bucket) bucket.push(row)
    else grouped.set(row.taskId, [row])
  }
  for (const [id, bucket] of grouped) {
    // The ORDER BY above already did this. Re-applying the shared comparator
    // is what keeps the rule in one place: the chip order is orderAssignees',
    // and a future caller that hands over rows from somewhere else gets it.
    byTask.set(
      id,
      orderAssignees(bucket).map((row) => ({ id: row.userId, name: row.name })),
    )
  }
  return byTask
}
