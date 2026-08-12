'use server'

import { z } from 'zod'
import { and, eq, inArray, isNull, max, sql, type SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { apps, sprints, tasks } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { canMoveTask } from '@/features/sprints/permissions'
import { rankForAppend } from '@/features/sprints/task-rank'

const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const
type TaskStatus = (typeof TASK_STATUSES)[number]

/**
 * A rank is a `double precision` column, so the only thing that must never
 * reach the DB is a value Postgres can't store: NaN and ±Infinity both come
 * back as a driver error, and an uncaught driver error thrown out of a server
 * action is exactly what convention 1 forbids. `z.number()` alone accepts
 * both, hence the explicit finite check.
 */
const rank = z.number().refine(Number.isFinite, 'Invalid position')

const taskInput = z.object({
  appId: z.uuid(),
  sprintId: z.uuid().nullable(),
  title: z.string().min(1).max(140),
  description: z.string().max(2000).optional(),
  assigneeId: z.uuid().nullable(),
  priority: z.number().int().min(0).max(3).default(0),
  status: z.enum(TASK_STATUSES).default('todo'),
  // Optional so every existing caller (board "add task", quick-add) keeps
  // working unchanged — omitting it leaves the task with no due date, same
  // as before this field existed on the input.
  dueDate: z.iso.date().nullable().optional(),
})

// Deliberately no `.default()` on any field, mirroring apps/update-input.ts:
// a missing key must stay missing after parsing so a partial update only
// touches the fields the caller actually sent.
const taskUpdateInput = z
  .object({
    sprintId: z.uuid().nullable(),
    title: z.string().min(1).max(140),
    description: z.string().max(2000),
    assigneeId: z.uuid().nullable(),
    priority: z.number().int().min(0).max(3),
    status: z.enum(TASK_STATUSES),
    // Now readable AND writable. It was previously write-only: the composer
    // and the ⌘K quick-add could set a due date that no surface could ever
    // show or change again.
    dueDate: z.iso.date().nullable(),
  })
  .partial()

/**
 * Cap on a single rebalance. A column that big is already past the point
 * where a human is reading it, and the cap is what stops a hand-crafted
 * request from turning one drag into an unbounded UPDATE.
 */
const MAX_REBALANCE_ROWS = 300

const boardMoveInput = z.object({
  taskId: z.uuid(),
  sortOrder: rank,
  // The board's grouping decides which of these a drop between columns
  // means: status columns send `status`, assignee columns send `assigneeId`,
  // priority columns send `priority`. A same-column reorder sends none of
  // them and only moves the rank.
  status: z.enum(TASK_STATUSES).optional(),
  assigneeId: z.uuid().nullable().optional(),
  priority: z.number().int().min(0).max(3).optional(),
  /**
   * Fresh ranks for the whole destination column, sent only when the client's
   * `planInsert` found no splittable gap (see task-rank.ts). Every id is
   * re-checked against the moved task's own app below — the client does not
   * get to name arbitrary rows to rewrite.
   */
  // The message is spelled out because this one is REACHABLE by an ordinary
  // user, not just by a crafted request: a column whose ranks all tie (the
  // state every task created before migration 0020 is in) needs a full
  // re-spread on the first drag, so a 300+ card column hits the cap while
  // doing something completely reasonable. zod's own "Too big: expected
  // array to have <=300 items" would be shown verbatim in the board's error
  // banner.
  rebalance: z
    .array(z.object({ id: z.uuid(), sortOrder: rank }))
    .max(MAX_REBALANCE_ROWS, 'That column is too long to reorder in one move')
    .optional(),
})

const bulkUpdateInput = z.object({
  // Same reasoning as `rebalance` above: selecting more than a hundred cards
  // is something a person can actually do, so the ceiling explains itself
  // rather than surfacing zod's internal wording.
  taskIds: z.array(z.uuid()).min(1).max(100, 'Select 100 tasks or fewer to change at once'),
  patch: z
    .object({
      status: z.enum(TASK_STATUSES),
      assigneeId: z.uuid().nullable(),
      priority: z.number().int().min(0).max(3),
      sprintId: z.uuid().nullable(),
    })
    .partial(),
})

async function requireSession() {
  const session = await auth()
  if (!session?.user) return null
  return session
}

async function requireAdmin() {
  const session = await auth()
  if (session?.user?.role !== 'admin') return null
  return session
}

/**
 * Walks an error's `.cause` chain looking for a Postgres foreign-key
 * violation (bogus appId/sprintId/assigneeId). Same shape as
 * `isUniqueViolation` in people/actions.ts — the neon-http driver / drizzle
 * wrap the underlying NeonDbError, so the `code`/`message` we want may be a
 * few levels down.
 */
/**
 * The end of every catch in this file.
 *
 * Convention: a server action NEVER throws — it returns `err()`. Re-throwing
 * "unexpected" driver errors looks conservative but is the one outcome the
 * callers cannot render: the promise rejects, the optimistic card sits there
 * looking saved, and the person is told nothing. The error still reaches the
 * server log; what changes is that the browser gets a sentence instead of a
 * rejected promise.
 */
function unexpected(context: string, error: unknown): ActionResult<never> {
  console.error(`[sprints] ${context}`, error)
  return err('Something went wrong — try again')
}

function isForeignKeyViolation(error: unknown): boolean {
  let current: unknown = error
  const seen = new Set<unknown>()
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const e = current as { code?: unknown; message?: unknown; cause?: unknown }
    if (e.code === '23503') return true
    if (typeof e.message === 'string' && e.message.includes('foreign key')) return true
    current = e.cause
  }
  return false
}

async function taskById(taskId: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId))
  return task ?? null
}

async function revalidateApps(appIds: readonly string[]) {
  const unique = [...new Set(appIds)]
  if (unique.length === 0) return
  // ONE query for the whole set, not one per app: this is called from
  // bulkUpdateTasks, whose selection is allowed to span apps, and a slug
  // lookup inside that loop is the textbook N+1 this codebase avoids
  // elsewhere by batching the read.
  const rows = await db.select({ slug: apps.slug }).from(apps).where(inArray(apps.id, unique))
  for (const row of rows) revalidatePath('/apps/' + row.slug)
}

async function revalidateApp(appId: string) {
  await revalidateApps([appId])
}

/**
 * Whether `sprintId` is a sprint of `appId`.
 *
 * A task's sprint MUST belong to the task's own app. Nothing in the database
 * says so — `tasks.sprint_id` and `tasks.app_id` are two independent foreign
 * keys — so a request naming any real sprint id passes the FK check and lands
 * a task in another app's sprint, where `getBoard(appId, sprintId)` (which
 * filters on BOTH) can never show it again: the task silently disappears from
 * every board in the product. zod cannot see this; it is a cross-row
 * invariant, so it is checked here, once, for every writer that accepts a
 * sprint id (create, single update, bulk update).
 */
async function sprintIsInApp(sprintId: string, appId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: sprints.id })
    .from(sprints)
    .where(and(eq(sprints.id, sprintId), eq(sprints.appId, appId)))
  return row !== undefined
}

/**
 * The rank a brand-new task should get: one gap past whatever is already at
 * the bottom of the column it is being created in.
 *
 * This exists because the column default is 0 and, before it, EVERY task
 * ever created tied at 0 — so a freshly-seeded board had no defined order at
 * all and cards visibly swapped places between renders. Scoped to
 * (app, sprint, status) because that is what a "column" is on the default
 * board; a task created under another grouping still lands last in its
 * status column, which is the honest place for it.
 */
async function nextRankFor(
  appId: string,
  sprintId: string | null,
  status: TaskStatus,
): Promise<number> {
  // `max()` in SQL, not every row streamed back to be reduced in JS. The
  // aggregate is what the (app_id, sprint_id, sort_order) index from
  // migration 0020 exists to answer, and it keeps a create O(1) in payload
  // instead of O(column size) — a 400-task backlog would otherwise ship 400
  // numbers over the wire to compute one.
  const [row] = await db
    .select({ highest: max(tasks.sortOrder) })
    .from(tasks)
    .where(
      and(
        eq(tasks.appId, appId),
        sprintId === null ? isNull(tasks.sprintId) : eq(tasks.sprintId, sprintId),
        eq(tasks.status, status),
      ),
    )
  // `max()` over no rows is SQL NULL — an empty column, which rankForAppend
  // already means "start at the first gap" by taking an empty list.
  const highest = row?.highest
  return rankForAppend(highest === null || highest === undefined ? [] : [Number(highest)])
}

export async function createTask(input: unknown): Promise<ActionResult<{ taskId: string }>> {
  // Any authenticated member may create a task — no role check beyond a session.
  if (!(await requireSession())) return err('Sign in required')
  const parsed = taskInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const { appId, sprintId, title, description, assigneeId, priority, status, dueDate } = parsed.data
  if (sprintId !== null && !(await sprintIsInApp(sprintId, appId))) {
    return err('That sprint belongs to a different app')
  }

  let created: { id: string } | undefined
  try {
    const sortOrder = await nextRankFor(appId, sprintId, status)
    ;[created] = await db
      .insert(tasks)
      .values({
        appId,
        sprintId,
        title,
        description: description || null,
        assigneeId,
        priority,
        status,
        sortOrder,
        dueDate: dueDate ?? null,
      })
      .returning({ id: tasks.id })
  } catch (error) {
    if (isForeignKeyViolation(error)) return err('Invalid app, sprint, or assignee')
    return unexpected('createTask', error)
  }

  await revalidateApp(appId)
  return ok({ taskId: created.id })
}

export async function updateTask(taskId: string, input: unknown): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return err('Sign in required')
  // Shape-check the id BEFORE it reaches the DB: a non-UUID string makes
  // Postgres raise 22P02, which would throw straight out of this action.
  if (!z.uuid().safeParse(taskId).success) return err('Task not found')

  const existing = await taskById(taskId)
  if (!existing) return err('Task not found')

  const isAdmin = session.user.role === 'admin'
  const isAssignee = existing.assigneeId !== null && existing.assigneeId === session.user.id
  if (!isAdmin && !isAssignee) return err('Not allowed')

  const parsed = taskUpdateInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const set: Record<string, unknown> = {}
  for (const key of Object.keys(parsed.data) as (keyof typeof parsed.data)[]) {
    if (key === 'description') {
      set.description = parsed.data.description || null
    } else {
      set[key] = parsed.data[key]
    }
  }
  if (Object.keys(set).length === 0) return err('Nothing to update')

  // Only when the sprint actually CHANGES: the dialog sends every field on
  // every save, and re-reading the sprint a task is already in would be a
  // wasted round trip on the common path.
  if (
    typeof set.sprintId === 'string' &&
    set.sprintId !== existing.sprintId &&
    !(await sprintIsInApp(set.sprintId, existing.appId))
  ) {
    return err('That sprint belongs to a different app')
  }

  try {
    await db.update(tasks).set(set).where(eq(tasks.id, taskId))
  } catch (error) {
    if (isForeignKeyViolation(error)) return err('Invalid sprint or assignee')
    return unexpected('updateTask', error)
  }

  await revalidateApp(existing.appId)
  return ok(undefined)
}

/**
 * One drag on the board: a new rank, optionally a new column.
 *
 * Which field the column change lands on depends on what the board is
 * grouped by, which is why this takes an optional status/assignee/priority
 * rather than a status alone. The permission is the same in every case —
 * `canMoveTask`, the one predicate both this action and the card's
 * `draggable` flag read, so a card that looks locked really is.
 *
 * `rebalance` is the rare path (see task-rank.ts): when the destination gap
 * can't hold another rank, the client sends fresh ranks for the whole
 * column and they go out as ONE `UPDATE … CASE` scoped to this task's app.
 * Sending N separate updates would be N HTTP round trips on neon-http, and
 * neon-http has no transactions, so a partial application is possible either
 * way — one statement at least makes it atomic in practice.
 */
export async function moveTaskOnBoard(input: unknown): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return err('Sign in required')

  const parsed = boardMoveInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { taskId, sortOrder, status, assigneeId, priority, rebalance } = parsed.data

  const existing = await taskById(taskId)
  if (!existing) return err('Task not found')

  if (!canMoveTask(session.user.role, session.user.id, existing.assigneeId)) {
    return err('You can only move your own tasks')
  }

  const set: Record<string, unknown> = { sortOrder }
  if (status !== undefined) set.status = status
  if (assigneeId !== undefined) set.assigneeId = assigneeId
  if (priority !== undefined) set.priority = priority

  // The rebalance goes FIRST, deliberately. The moved card's new rank was
  // computed against the RE-SPREAD column, so writing it before the siblings
  // and then failing on them would leave the card ranked as if a re-spread
  // had happened when it hadn't — a silently wrong order. This way a failed
  // rebalance changes nothing at all.
  //
  // Everything except the moved task: its rank is written below, and
  // including it here would be a second UPDATE of the same row.
  const others = (rebalance ?? []).filter((entry) => entry.id !== taskId)
  if (others.length > 0) {
    const branches: SQL[] = [sql`(case`]
    for (const entry of others) {
      branches.push(
        sql`when ${tasks.id} = ${entry.id}::uuid then ${entry.sortOrder}::double precision`,
      )
    }
    branches.push(sql`else ${tasks.sortOrder} end)`)
    try {
      await db
        .update(tasks)
        .set({ sortOrder: sql.join(branches, sql.raw(' ')) })
        // The app scope is the security boundary: the ids come from the
        // client, so without it a crafted request could renumber tasks in
        // an app this user cannot see.
        .where(
          and(
            eq(tasks.appId, existing.appId),
            inArray(
              tasks.id,
              others.map((entry) => entry.id),
            ),
          ),
        )
    } catch {
      // One hand-written statement in an otherwise query-builder file, so it
      // gets its own honest failure rather than being allowed to throw out
      // of a server action.
      return err('Could not reorder that column — try again')
    }
  }

  try {
    await db.update(tasks).set(set).where(eq(tasks.id, taskId))
  } catch (error) {
    if (isForeignKeyViolation(error)) return err('Invalid assignee')
    return unexpected('moveTaskOnBoard', error)
  }

  await revalidateApp(existing.appId)
  return ok(undefined)
}

/**
 * Applies one patch to a multi-selected set of cards.
 *
 * Permission is per task, not per request: an admin moves everything, a
 * member moves only what is assigned to them. Rather than refusing the whole
 * batch because one card wasn't theirs, this applies what it can and reports
 * the count it skipped, so the UI can say "6 moved, 2 you don't own" instead
 * of failing silently or lying.
 */
export async function bulkUpdateTasks(
  input: unknown,
): Promise<ActionResult<{ updated: number; skipped: number }>> {
  const session = await requireSession()
  if (!session) return err('Sign in required')

  const parsed = bulkUpdateInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { taskIds, patch } = parsed.data

  if (Object.keys(patch).length === 0) return err('Nothing to update')

  const rows = await db
    .select({ id: tasks.id, appId: tasks.appId, assigneeId: tasks.assigneeId })
    .from(tasks)
    .where(inArray(tasks.id, taskIds))
  if (rows.length === 0) return err('No tasks found')

  const permitted = rows.filter((row) =>
    canMoveTask(session.user.role, session.user.id, row.assigneeId),
  )
  if (permitted.length === 0) return err('You can only change your own tasks')

  // Moving a selection into a sprint is only meaningful for tasks of that
  // sprint's OWN app — see sprintIsInApp. The selection is allowed to span
  // apps, so this is a filter rather than a rejection: the tasks that can
  // legitimately take the sprint do, the rest are reported as skipped
  // instead of being quietly filed under an app they don't belong to.
  let allowed = permitted
  if (typeof patch.sprintId === 'string') {
    const [sprint] = await db
      .select({ appId: sprints.appId })
      .from(sprints)
      .where(eq(sprints.id, patch.sprintId))
    if (!sprint) return err('Sprint not found')
    allowed = permitted.filter((row) => row.appId === sprint.appId)
    if (allowed.length === 0) return err('That sprint belongs to a different app')
  }

  try {
    await db.update(tasks).set(patch).where(
      inArray(
        tasks.id,
        allowed.map((row) => row.id),
      ),
    )
  } catch (error) {
    if (isForeignKeyViolation(error)) return err('Invalid sprint or assignee')
    return unexpected('bulkUpdateTasks', error)
  }

  // A multi-select can legitimately span apps (it cannot today, but the
  // action must not assume the UI's shape) — one batched slug lookup, not
  // one per app.
  await revalidateApps(allowed.map((row) => row.appId))

  return ok({ updated: allowed.length, skipped: rows.length - allowed.length })
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return err('Admins only')
  if (!z.uuid().safeParse(taskId).success) return err('Task not found')

  const existing = await taskById(taskId)
  if (!existing) return err('Task not found')

  try {
    await db.delete(tasks).where(eq(tasks.id, taskId))
  } catch (error) {
    return unexpected('deleteTask', error)
  }

  await revalidateApp(existing.appId)
  return ok(undefined)
}
