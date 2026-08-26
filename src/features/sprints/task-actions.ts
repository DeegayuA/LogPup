'use server'

import { z } from 'zod'
import { and, eq, inArray, isNull, max, sql, type SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { applyDueDate } from '@/features/sprints/due-date'
import { isTerminal } from '@/features/sprints/board-view'
import { transitionTaskStatus } from '@/features/sprints/task-status'
import { liveApps, liveSprints, liveTasks } from '@/db/live'
import { meetingFollowups, tasks } from '@/db/schema'
import { auth } from '@/lib/auth'
import { requireCapability } from '@/features/auth/actor'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { revalidateAdmin } from '@/lib/revalidate-admin'
import { logActivity } from '@/features/activity/log'
import { canMoveTask } from '@/features/sprints/permissions'
import { rankForAppend } from '@/features/sprints/task-rank'
import { decideFollowupResolutionOnTaskStatusChange } from '@/features/meetings/followups'
import { backlogJoinCondition, sprintOrBacklogCondition } from '@/features/sprints/backlog'
import { isAdminRole } from '@/features/auth/capabilities'
import {
  MAX_TASK_ASSIGNEES,
  getTaskAssignees,
  primaryAssigneeId,
  setTaskAssignees,
  withPrimaryAssignee,
} from '@/features/sprints/task-assignees'

const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const
type TaskStatus = (typeof TASK_STATUSES)[number]

// How a status reads inside an activity detail: "moved X to In progress".
const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

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
  // EVERYONE on the task, first = the accountable one. Additive: `assigneeId`
  // above is untouched and still the column every board reads; when both
  // arrive the array wins. Bounded — one element is one row.
  assigneeIds: z.array(z.uuid()).max(MAX_TASK_ASSIGNEES).optional(),
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
    // See taskInput: additive, and the array wins over `assigneeId`.
    assigneeIds: z.array(z.uuid()).max(MAX_TASK_ASSIGNEES),
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
      // Same field updateTask already writes. Its absence here was the reason
      // rescheduling N overdue cards was N full dialog round-trips: the bulk
      // bar covered every other quick-menu edit except the date.
      dueDate: z.iso.date().nullable(),
    })
    .partial(),
})

async function requireSession() {
  const session = await auth()
  if (!session?.user) return null
  return session
}

// Was a verbatim copy of the same six-line `requireAdmin()` that lived in six
// other files. Every guard now names the capability it needs and the matrix
// answers; the contract is unchanged (Actor on success, null on refusal).

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
  const [task] = await db.select().from(liveTasks).where(eq(liveTasks.id, taskId))
  return task ?? null
}

/**
 * The other half of closing the loop between meeting follow-ups and tasks
 * (see meetings/ai-actions.ts's linkFollowupToTask, which sets
 * meeting_followups.resolved_by_task_id when a task is created from a
 * suggestion that matches an open follow-up). A task moving TO 'done'
 * resolves the follow-up it's linked to; moving back OUT of 'done' reopens
 * it — decideFollowupResolutionOnTaskStatusChange is the pure decision,
 * this is just wiring it to a write.
 *
 * Called from every path that can change a task's status (updateTask,
 * moveTaskOnBoard) AFTER that write has already succeeded, and always
 * wrapped in its own try/catch by the caller: follow-up bookkeeping must
 * NEVER fail the task move it's riding on. A task with no linked follow-up
 * (the overwhelming majority) costs one no-op UPDATE that matches zero rows.
 */
async function syncLinkedFollowups(
  taskId: string,
  fromStatus: TaskStatus,
  toStatus: TaskStatus,
): Promise<void> {
  const decision = decideFollowupResolutionOnTaskStatusChange(fromStatus, toStatus)
  if (decision === 'none') return

  if (decision === 'resolve') {
    await db
      .update(meetingFollowups)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
        resolutionNote: 'Resolved automatically — the linked task was completed',
      })
      .where(and(eq(meetingFollowups.resolvedByTaskId, taskId), eq(meetingFollowups.status, 'open')))
    return
  }

  // reopen: only undo what THIS auto-resolve did, not a manual resolve that
  // happens to share the same linked task — resolutionNote is the marker.
  await db
    .update(meetingFollowups)
    .set({ status: 'open', resolvedAt: null, resolutionNote: null })
    .where(
      and(
        eq(meetingFollowups.resolvedByTaskId, taskId),
        eq(meetingFollowups.status, 'resolved'),
        eq(meetingFollowups.resolutionNote, 'Resolved automatically — the linked task was completed'),
      ),
    )
}

async function revalidateApps(appIds: readonly string[]) {
  const unique = [...new Set(appIds)]
  if (unique.length === 0) return
  // ONE query for the whole set, not one per app: this is called from
  // bulkUpdateTasks, whose selection is allowed to span apps, and a slug
  // lookup inside that loop is the textbook N+1 this codebase avoids
  // elsewhere by batching the read.
  const rows = await db
    .select({ slug: liveApps.slug })
    .from(liveApps)
    .where(inArray(liveApps.id, unique))
  for (const row of rows) revalidatePath('/apps/' + row.slug)
  // deleteTask routes through here (via revalidateApp) and a soft delete lands
  // a new row in the admin Trash card — see revalidateAdmin's own comment. It
  // is done for every task write rather than only the delete: /admin is
  // auth-gated and dynamic, so the extra invalidation costs nothing, and a
  // future delete-shaped path here inherits it for free.
  revalidateAdmin()
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
    .select({ id: liveSprints.id })
    .from(liveSprints)
    .where(and(eq(liveSprints.id, sprintId), eq(liveSprints.appId, appId)))
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
    .select({ highest: max(liveTasks.sortOrder) })
    .from(liveTasks)
    // Backlog rule (no sprint, or the sprint is trashed) lives in
    // backlog.ts, shared with getBoard's own query in sprints/queries.ts.
    .leftJoin(liveSprints, backlogJoinCondition)
    .where(
      and(
        eq(liveTasks.appId, appId),
        sprintOrBacklogCondition(sprintId),
        eq(liveTasks.status, status),
      ),
    )
  // `max()` over no rows is SQL NULL — an empty column, which rankForAppend
  // already means "start at the first gap" by taking an empty list.
  const highest = row?.highest
  return rankForAppend(highest === null || highest === undefined ? [] : [Number(highest)])
}

export async function createTask(input: unknown): Promise<ActionResult<{ taskId: string }>> {
  // Any authenticated member may create a task — no role check beyond a session.
  const session = await requireSession()
  if (!session) return err('Sign in required')
  const parsed = taskInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const { appId, sprintId, title, description, assigneeId, priority, status, dueDate } = parsed.data
  const { assigneeIds } = parsed.data
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
        // The array wins when both are sent, and its FIRST id is the one that
        // lands here — `assignee_id` is still "the accountable person".
        assigneeId: assigneeIds ? primaryAssigneeId(assigneeIds) : assigneeId,
        priority,
        // Through transitionTaskStatus for the same reason the due date goes
        // through applyDueDate: a task created AS 'done' — the ⌘K "log the
        // thing I just finished" path — is an entry into done and must carry
        // its completed_at. `null` is the honest current status here; there is
        // no row yet to have had one.
        ...transitionTaskStatus(null, status, new Date()),
        sortOrder,
        // Through applyDueDate rather than writing dueDate straight: a task
        // created WITH a date is a first null -> non-null transition and must
        // stamp original_due_date like any other. Writing the column directly
        // here is how the invariant would quietly become "true except for
        // tasks that were born with a deadline".
        ...applyDueDate(
          { dueDate: null, dueKind: 'target', originalDueDate: null, dueChangedCount: 0 },
          { dueDate: dueDate ?? null },
        ),
      })
      .returning({ id: tasks.id })
    // Inside the try on purpose: an unknown user id is the same FK violation
    // the insert above would have raised, and it reads the same to the caller.
    if (assigneeIds) await setTaskAssignees(created.id, assigneeIds, session.user.id)
  } catch (error) {
    if (isForeignKeyViolation(error)) return err('Invalid app, sprint, or assignee')
    return unexpected('createTask', error)
  }

  await logActivity({
    actorId: session.user.id,
    verb: 'created',
    entityType: 'task',
    entityId: created.id,
    entityLabel: title,
    appId,
  })

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

  const isAdmin = isAdminRole(session.user.role)
  const isAssignee = existing.assigneeId !== null && existing.assigneeId === session.user.id
  if (!isAdmin && !isAssignee) return err('Not allowed')

  const parsed = taskUpdateInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const set: Record<string, unknown> = {}
  for (const key of Object.keys(parsed.data) as (keyof typeof parsed.data)[]) {
    if (key === 'description') {
      set.description = parsed.data.description || null
    } else if (key !== 'assigneeIds') {
      set[key] = parsed.data[key]
    }
  }
  // The array wins over the scalar `assigneeId` when both are sent, and its
  // first id is what lands in the column. Applied after the loop, not inside
  // it, so the rule can never depend on which key zod emits first.
  const assigneeIds = parsed.data.assigneeIds
  if (assigneeIds !== undefined) set.assigneeId = primaryAssigneeId(assigneeIds)
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

  // Only when the caller actually named a date. `set` carries every field the
  // dialog submitted, so testing for the KEY rather than a truthy value is what
  // separates "cleared the date" (null, a real change) from "did not mention
  // it" (absent, must not reset anything).
  if ('dueDate' in set) {
    try {
      Object.assign(
        set,
        applyDueDate(
          {
            dueDate: existing.dueDate,
            dueKind: existing.dueKind,
            originalDueDate: existing.originalDueDate,
            dueChangedCount: existing.dueChangedCount,
          },
          { dueDate: (set.dueDate as string | null) ?? null },
        ),
      )
    } catch (error) {
      // DueDateError carries a sentence written for the person, not a stack.
      return err(error instanceof Error ? error.message : 'That deadline is not valid')
    }
  }

  // The status the caller sent never reaches the UPDATE on its own: it is
  // replaced by the helper's patch, which also decides completed_at. The
  // dialog re-sends `status` on every save, so most trips through here are
  // done -> done or todo -> todo, where the patch deliberately omits
  // completed_at and the column is left exactly as it was.
  if (parsed.data.status !== undefined) {
    Object.assign(set, transitionTaskStatus(existing.status, parsed.data.status, new Date()))
  }

  try {
    await db.update(tasks).set(set).where(eq(tasks.id, taskId))
    // After the column, so the set's first id and `assignee_id` agree; the
    // join write is a no-op when the same people are re-sent.
    if (assigneeIds !== undefined) await setTaskAssignees(taskId, assigneeIds, session.user.id)
  } catch (error) {
    if (isForeignKeyViolation(error)) return err('Invalid sprint or assignee')
    return unexpected('updateTask', error)
  }

  // One row per save, with the most meaningful verb the patch supports:
  // a status change outranks an assignee change outranks a plain edit.
  const nextStatus = parsed.data.status
  const nextAssignee = parsed.data.assigneeId
  let verb = 'updated'
  let detail: string | null = null
  let metadata: Record<string, unknown> | null = null
  if (nextStatus !== undefined && nextStatus !== existing.status) {
    verb = isTerminal(nextStatus) ? 'completed' : isTerminal(existing.status) ? 'reopened' : 'moved'
    if (verb === 'moved') detail = `to ${STATUS_LABELS[nextStatus]}`
    metadata = { status: { from: existing.status, to: nextStatus } }
  } else if (nextAssignee !== undefined && nextAssignee !== existing.assigneeId) {
    verb = nextAssignee === null ? 'unassigned' : 'assigned'
    metadata = { assigneeId: { from: existing.assigneeId, to: nextAssignee } }
  }
  await logActivity({
    actorId: session.user.id,
    verb,
    entityType: 'task',
    entityId: taskId,
    entityLabel: parsed.data.title ?? existing.title,
    appId: existing.appId,
    detail,
    metadata,
  })

  // Best-effort, deliberately outside the try/catch above: the task move
  // already succeeded, and a follow-up bookkeeping failure must never turn
  // a successful save into a reported failure.
  if (nextStatus !== undefined && nextStatus !== existing.status) {
    try {
      await syncLinkedFollowups(taskId, existing.status, nextStatus)
    } catch (error) {
      console.error(`[sprints] follow-up sync failed for task ${taskId}:`, error)
    }
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
  // A drop into the 'Done' column is a completion, and it is the path most
  // completions actually take — so it goes through the same door as the
  // dialog's save rather than assigning `status` directly.
  if (status !== undefined) {
    Object.assign(set, transitionTaskStatus(existing.status, status, new Date()))
  }
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

  // ONE row per drag — the rebalance above is plumbing for this same move,
  // not a separate act. Which field the drop changed decides the verb.
  let verb = 'moved'
  let detail: string | null = null
  let metadata: Record<string, unknown> | null = null
  if (status !== undefined && status !== existing.status) {
    verb = isTerminal(status) ? 'completed' : isTerminal(existing.status) ? 'reopened' : 'moved'
    if (verb === 'moved') detail = `to ${STATUS_LABELS[status]}`
    metadata = { status: { from: existing.status, to: status } }
  } else if (assigneeId !== undefined && assigneeId !== existing.assigneeId) {
    verb = assigneeId === null ? 'unassigned' : 'assigned'
    metadata = { assigneeId: { from: existing.assigneeId, to: assigneeId } }
  } else if (priority !== undefined && priority !== existing.priority) {
    detail = `to priority ${priority}`
    metadata = { priority: { from: existing.priority, to: priority } }
  }
  await logActivity({
    actorId: session.user.id,
    verb,
    entityType: 'task',
    entityId: taskId,
    entityLabel: existing.title,
    appId: existing.appId,
    detail,
    metadata,
  })

  // A drop into an assignee column has to reach task_assignees too, or the
  // join stops containing the accountable person — the one invariant the whole
  // multi-assignee model rests on. `tasks.assignee_id` was already written
  // above; this makes the set agree with it.
  //
  // The set is REORDERED, not replaced: dragging a card into someone's column
  // says "this is now their task", not "take everyone else off it". A task
  // with three people on it keeps all three; only the accountable one moves.
  // Dropping on Unassigned is the exception and empties the set, because that
  // is what unassigned means.
  //
  // Best-effort and logged, deliberately not fatal: the drag has already
  // committed and the board has already moved the card. Failing the action
  // here would show the user an error for a move that did happen, and the
  // next assignee edit repairs the set anyway.
  if (assigneeId !== undefined && assigneeId !== existing.assigneeId) {
    try {
      const current = (await getTaskAssignees([taskId])).get(taskId) ?? []
      await setTaskAssignees(
        taskId,
        withPrimaryAssignee(
          current.map((person) => person.id),
          assigneeId,
        ),
        session.user.id,
      )
    } catch (error) {
      console.error(`[sprints] assignee set sync failed for task ${taskId}:`, error)
    }
  }

  // Same best-effort follow-up sync as updateTask — a drag that changes
  // column is exactly the other way a task's status changes, and a linked
  // follow-up has to react to it identically either way.
  if (status !== undefined && status !== existing.status) {
    try {
      await syncLinkedFollowups(taskId, existing.status, status)
    } catch (error) {
      console.error(`[sprints] follow-up sync failed for task ${taskId}:`, error)
    }
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
    // title rides along for the activity row's label — a batch still names
    // one real task rather than reading "updated task 5 tasks".
    .select({
      id: liveTasks.id,
      appId: liveTasks.appId,
      assigneeId: liveTasks.assigneeId,
      title: liveTasks.title,
      // Needed by transitionTaskStatus below: the completed_at a bulk status
      // change writes depends on where each row is coming FROM, which one
      // patch for the whole selection cannot know.
      status: liveTasks.status,
    })
    .from(liveTasks)
    .where(inArray(liveTasks.id, taskIds))
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
      .select({ appId: liveSprints.appId })
      .from(liveSprints)
      .where(eq(liveSprints.id, patch.sprintId))
    if (!sprint) return err('Sprint not found')
    allowed = permitted.filter((row) => row.appId === sprint.appId)
    if (allowed.length === 0) return err('That sprint belongs to a different app')
  }

  // A BULK STATUS CHANGE IS N TRANSITIONS, NOT ONE. Two cards sent to 'Done'
  // where one was already done must end with two DIFFERENT completed_at
  // values — the old stamp left standing, the new one written — and a single
  // `set completed_at = $now` over the whole selection cannot say that; it
  // would rewrite the completion time of every card that was already finished.
  // So the rows are grouped by their CURRENT status, each group gets the patch
  // transitionTaskStatus decided for it, and the (at most three) statements go
  // out as one batch. A patch with no status stays a single statement.
  const now = new Date()
  const groups = new Map<string, { set: Record<string, unknown>; ids: string[] }>()
  for (const row of allowed) {
    const key = patch.status === undefined ? 'no-status-change' : row.status
    const existingGroup = groups.get(key)
    if (existingGroup) {
      existingGroup.ids.push(row.id)
      continue
    }
    groups.set(key, {
      set:
        patch.status === undefined
          ? { ...patch }
          : { ...patch, ...transitionTaskStatus(row.status, patch.status, now) },
      ids: [row.id],
    })
  }

  try {
    // `allowed` is non-empty by the guards above, so there is always a first.
    const [first, ...rest] = [...groups.values()].map((group) =>
      db.update(tasks).set(group.set).where(inArray(tasks.id, group.ids)),
    )
    // db.batch needs a statically non-empty tuple; neon-http has no
    // transaction to wrap these in either way.
    await (rest.length === 0 ? first : db.batch([first, ...rest]))
  } catch (error) {
    if (isForeignKeyViolation(error)) return err('Invalid sprint or assignee')
    return unexpected('bulkUpdateTasks', error)
  }

  // ONE summary row for the whole batch, not one per task — the trail reads
  // "updated 6 tasks", anchored on the first task, with the full id list in
  // metadata. appId only when the selection stayed within a single app.
  const touchedAppIds = [...new Set(allowed.map((row) => row.appId))]
  await logActivity({
    actorId: session.user.id,
    verb: 'updated',
    entityType: 'task',
    entityId: allowed[0].id,
    // A real task title, with the batch size in `detail`. The label used to
    // be "5 tasks", which the feed renders after the entity type — "updated
    // task 5 tasks".
    entityLabel: allowed[0].title,
    detail: allowed.length > 1 ? `and ${allowed.length - 1} more` : null,
    appId: touchedAppIds.length === 1 ? touchedAppIds[0] : null,
    metadata: { patch, taskIds: allowed.map((row) => row.id) },
  })

  // A multi-select can legitimately span apps (it cannot today, but the
  // action must not assume the UI's shape) — one batched slug lookup, not
  // one per app.
  await revalidateApps(allowed.map((row) => row.appId))

  return ok({ updated: allowed.length, skipped: rows.length - allowed.length })
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const actor = await requireCapability('task.delete')
  if (!actor) return err('Admins only')
  if (!z.uuid().safeParse(taskId).success) return err('Task not found')

  const existing = await taskById(taskId)
  if (!existing) return err('Task not found')

  let marked: { id: string }[]
  try {
    marked = await db
      .update(tasks)
      .set({ deletedAt: new Date(), deletedBy: actor.id })
      .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
      .returning({ id: tasks.id })
  } catch (error) {
    return unexpected('deleteTask', error)
  }
  if (marked.length === 0) return err('Task not found')

  // ONE row, deliberately. The merge that brought soft deletes in landed this
  // logActivity twice (main's copy plus the branch's re-worded copy), which
  // put two identical "deleted task" entries in the feed for every delete.
  // `existing` was read before the update, so the row can still be named.
  await logActivity({
    actorId: actor.id,
    verb: 'deleted',
    entityType: 'task',
    entityId: taskId,
    entityLabel: existing.title,
    appId: existing.appId,
  })

  await revalidateApp(existing.appId)
  return ok(undefined)
}
