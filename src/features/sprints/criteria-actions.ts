'use server'

/**
 * Acceptance criteria on a task — the "done means…" list QA marks pass/fail.
 *
 * TRUST BOUNDARY. Every action derives the app (and the task's assignee, for
 * task.edit's "own" grant) from the task row read through `liveTasks`, never
 * from anything the client sends. A criterion id alone is enough to reach
 * its task, so a crafted request cannot name another app's criterion and
 * have it checked against an app the caller happens to belong to.
 *
 * NOT SOFT-DELETED. A criterion is a line inside a task, not an entity anyone
 * restores on its own; it is hard-deleted, and cascades away with its task.
 * Reading through `liveTasks` is what hides the criteria of a task sitting in
 * Trash, and the inner join to `liveApps` does the same for a task whose whole
 * project is in Trash — a trashed project is read-only, not half-editable.
 *
 * Verdicts sit behind the same task.edit gate as editing: QA people are
 * project members, and a separate "qa" capability would be a matrix change
 * for one button pair.
 */
import { z } from 'zod'
import { and, asc, eq } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { db } from '@/db'
import { liveApps, liveTasks } from '@/db/live'
import { acceptanceCriteria, users } from '@/db/schema'
import { getSession } from '@/lib/session'
import { requireCapability } from '@/features/auth/actor'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'
import { rankForAppend } from '@/features/sprints/task-rank'
import {
  MAX_CRITERIA_PER_TASK,
  QA_VERDICTS,
  criterionBody,
  planMove,
  sortCriteria,
  verdictDetail,
  type CriterionRow,
  type QaVerdict,
} from '@/features/sprints/criteria'

const id = z.uuid()

type TaskRef = { id: string; appId: string; assigneeId: string | null; title: string }

async function taskById(taskId: string): Promise<TaskRef | undefined> {
  const [task] = await db
    .select({ id: liveTasks.id, appId: liveTasks.appId, assigneeId: liveTasks.assigneeId, title: liveTasks.title })
    .from(liveTasks)
    .innerJoin(liveApps, eq(liveApps.id, liveTasks.appId))
    .where(eq(liveTasks.id, taskId))
    .limit(1)
  return task
}

/** The criterion plus the task it belongs to — inner-joined to `liveTasks`, so
 *  a criterion on a soft-deleted task reads as not found. */
async function criterionById(criterionId: string) {
  const [row] = await db
    .select({
      id: acceptanceCriteria.id,
      body: acceptanceCriteria.body,
      qaVerdict: acceptanceCriteria.qaVerdict,
      taskId: acceptanceCriteria.taskId,
      appId: liveTasks.appId,
      assigneeId: liveTasks.assigneeId,
      title: liveTasks.title,
    })
    .from(acceptanceCriteria)
    .innerJoin(liveTasks, eq(liveTasks.id, acceptanceCriteria.taskId))
    .innerJoin(liveApps, eq(liveApps.id, liveTasks.appId))
    .where(eq(acceptanceCriteria.id, criterionId))
    .limit(1)
  return row
}

const canEditTask = (task: { appId: string; assigneeId: string | null }) =>
  requireCapability('task.edit', { appId: task.appId, ownerId: task.assigneeId })

/** Sign-in is checked BEFORE any read, so an anonymous caller cannot tell
 *  "no such task" apart from "not allowed" (the deleteTask regression). */
async function signedInUser() {
  const session = await getSession()
  return session?.user?.id ? session.user : null
}

export async function listCriteria(taskId: string): Promise<ActionResult<CriterionRow[]>> {
  if (!(await signedInUser())) return err('Sign in required')
  const parsed = id.safeParse(taskId)
  if (!parsed.success) return err('Invalid task')
  try {
    const task = await taskById(parsed.data)
    if (!task) return err('Task not found')
    if (!(await requireCapability('app.view', { appId: task.appId }))) return err('Not allowed')

    const rows = await db
      .select({
        id: acceptanceCriteria.id,
        taskId: acceptanceCriteria.taskId,
        body: acceptanceCriteria.body,
        sortOrder: acceptanceCriteria.sortOrder,
        qaVerdict: acceptanceCriteria.qaVerdict,
        verifiedBy: acceptanceCriteria.verifiedBy,
        verifiedByName: users.name,
        verifiedAt: acceptanceCriteria.verifiedAt,
        createdAt: acceptanceCriteria.createdAt,
      })
      .from(acceptanceCriteria)
      .leftJoin(users, eq(users.id, acceptanceCriteria.verifiedBy))
      .where(eq(acceptanceCriteria.taskId, task.id))
      .orderBy(asc(acceptanceCriteria.sortOrder), asc(acceptanceCriteria.createdAt), asc(acceptanceCriteria.id))

    // The CHECK constraint guarantees the narrowing; the cast only tells TS.
    return ok(rows.map((row) => ({ ...row, qaVerdict: row.qaVerdict as QaVerdict | null })))
  } catch (error) {
    console.error('[criteria] list failed', error)
    return err('Could not load the acceptance criteria')
  }
}

export async function addCriterion(taskId: string, body: string): Promise<ActionResult<CriterionRow>> {
  const user = await signedInUser()
  if (!user) return err('Sign in required')
  const parsed = z.object({ taskId: id, body: criterionBody }).safeParse({ taskId, body })
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Invalid criterion')
  try {
    const task = await taskById(parsed.data.taskId)
    if (!task) return err('Task not found')
    const actor = await canEditTask(task)
    if (!actor) return err('Not allowed')

    const existing = await db
      .select({ sortOrder: acceptanceCriteria.sortOrder })
      .from(acceptanceCriteria)
      .where(eq(acceptanceCriteria.taskId, task.id))
    // Read-then-insert, so two simultaneous adds at 49 can land at 51. The
    // cap is a sanity bound on list size, not an invariant anything relies on.
    if (existing.length >= MAX_CRITERIA_PER_TASK)
      return err(`A task can have at most ${MAX_CRITERIA_PER_TASK} acceptance criteria`)

    const [created] = await db
      .insert(acceptanceCriteria)
      .values({
        taskId: task.id,
        body: parsed.data.body,
        sortOrder: rankForAppend(existing.map((row) => row.sortOrder)),
      })
      .returning()

    await logActivity({
      actorId: actor.id,
      verb: 'updated',
      entityType: 'task',
      entityId: task.id,
      entityLabel: task.title,
      appId: task.appId,
      detail: `added acceptance criterion: “${parsed.data.body}”`,
    })

    return ok({ ...created, qaVerdict: null, verifiedByName: null })
  } catch (error) {
    console.error('[criteria] add failed', error)
    return err('Could not add the criterion')
  }
}

export async function editCriterion(criterionId: string, body: string): Promise<ActionResult<{ body: string }>> {
  if (!(await signedInUser())) return err('Sign in required')
  const parsed = z.object({ id, body: criterionBody }).safeParse({ id: criterionId, body })
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Invalid criterion')
  try {
    const row = await criterionById(parsed.data.id)
    if (!row) return err('Criterion not found')
    const actor = await canEditTask(row)
    if (!actor) return err('Not allowed')
    // Saving the same text is not a change, and must not wipe a verdict QA
    // already recorded (a blur after an accidental click into the field).
    if (row.body === parsed.data.body) return ok({ body: row.body })

    // Changing the text clears the verdict: a "pass" was given to the OLD
    // statement, and the new one has not been verified by anybody.
    await db
      .update(acceptanceCriteria)
      .set({ body: parsed.data.body, qaVerdict: null, verifiedBy: null, verifiedAt: null })
      .where(eq(acceptanceCriteria.id, row.id))

    await logActivity({
      actorId: actor.id,
      verb: 'updated',
      entityType: 'task',
      entityId: row.taskId,
      entityLabel: row.title,
      appId: row.appId,
      detail: `edited acceptance criterion: “${parsed.data.body}”`,
      metadata: { criterionId: row.id, before: row.body, after: parsed.data.body, clearedVerdict: row.qaVerdict },
    })
    return ok({ body: parsed.data.body })
  } catch (error) {
    console.error('[criteria] edit failed', error)
    return err('Could not save the criterion')
  }
}

export async function deleteCriterion(criterionId: string): Promise<ActionResult> {
  if (!(await signedInUser())) return err('Sign in required')
  const parsed = id.safeParse(criterionId)
  if (!parsed.success) return err('Invalid criterion')
  try {
    const row = await criterionById(parsed.data)
    if (!row) return err('Criterion not found')
    const actor = await canEditTask(row)
    if (!actor) return err('Not allowed')

    await db.delete(acceptanceCriteria).where(eq(acceptanceCriteria.id, row.id))

    await logActivity({
      actorId: actor.id,
      verb: 'updated',
      entityType: 'task',
      entityId: row.taskId,
      entityLabel: row.title,
      appId: row.appId,
      detail: `removed acceptance criterion: “${row.body}”`,
      // The body is the only copy left once the row is gone.
      metadata: { criterionId: row.id, body: row.body, qaVerdict: row.qaVerdict },
    })
    return ok(undefined)
  } catch (error) {
    console.error('[criteria] delete failed', error)
    return err('Could not delete the criterion')
  }
}

/** Returns the fresh ranks it wrote so the client can reconcile its
 *  optimistic order with exactly what the server stored. */
export async function moveCriterion(
  criterionId: string,
  direction: 'up' | 'down',
): Promise<ActionResult<{ id: string; sortOrder: number }[]>> {
  if (!(await signedInUser())) return err('Sign in required')
  const parsed = z.object({ id, direction: z.enum(['up', 'down']) }).safeParse({ id: criterionId, direction })
  if (!parsed.success) return err('Invalid move')
  try {
    const row = await criterionById(parsed.data.id)
    if (!row) return err('Criterion not found')
    if (!(await canEditTask(row))) return err('Not allowed')

    // The whole list is bounded by MAX_CRITERIA_PER_TASK, so reading it to
    // find the neighbours is cheap — and reading it server-side means the
    // client never names which rows to rewrite.
    const siblings = await db
      .select({ id: acceptanceCriteria.id, sortOrder: acceptanceCriteria.sortOrder, createdAt: acceptanceCriteria.createdAt })
      .from(acceptanceCriteria)
      .where(eq(acceptanceCriteria.taskId, row.taskId))

    const plan = planMove(siblings, row.id, parsed.data.direction)
    // Already at that end: not an error — the button raced a stale list.
    if (!plan) return ok(sortCriteria(siblings).map(({ id: rowId, sortOrder }) => ({ id: rowId, sortOrder })))

    if (plan.kind === 'rank') {
      await db.update(acceptanceCriteria).set({ sortOrder: plan.sortOrder }).where(eq(acceptanceCriteria.id, row.id))
      return ok([{ id: row.id, sortOrder: plan.sortOrder }])
    }

    // neon-http has no interactive transactions; a batch is the atomic unit.
    // Each statement re-checks taskId so a rank can only land on this list.
    const statements: BatchItem<'pg'>[] = plan.writes.map((write) =>
      db
        .update(acceptanceCriteria)
        .set({ sortOrder: write.sortOrder })
        .where(and(eq(acceptanceCriteria.id, write.id), eq(acceptanceCriteria.taskId, row.taskId))),
    )
    await db.batch(statements as [BatchItem<'pg'>, ...BatchItem<'pg'>[]])
    // Reorders are not logged: the activity trail is for what changed about
    // the work, and "criterion 3 moved above criterion 2" is not that.
    return ok(plan.writes)
  } catch (error) {
    console.error('[criteria] move failed', error)
    return err('Could not move the criterion')
  }
}

export async function setVerdict(
  criterionId: string,
  verdict: QaVerdict | null,
): Promise<ActionResult<{ qaVerdict: QaVerdict | null; verifiedBy: string | null; verifiedByName: string | null; verifiedAt: Date | null }>> {
  const user = await signedInUser()
  if (!user) return err('Sign in required')
  const parsed = z.object({ id, verdict: z.enum(QA_VERDICTS).nullable() }).safeParse({ id: criterionId, verdict })
  if (!parsed.success) return err('Invalid verdict')
  try {
    const row = await criterionById(parsed.data.id)
    if (!row) return err('Criterion not found')
    const actor = await canEditTask(row)
    if (!actor) return err('Not allowed')

    const next = parsed.data.verdict
    const verifiedAt = next === null ? null : new Date()
    const verifiedBy = next === null ? null : actor.id
    await db
      .update(acceptanceCriteria)
      .set({ qaVerdict: next, verifiedBy, verifiedAt })
      .where(eq(acceptanceCriteria.id, row.id))

    await logActivity({
      actorId: actor.id,
      verb: 'updated',
      entityType: 'task',
      entityId: row.taskId,
      entityLabel: row.title,
      appId: row.appId,
      detail: verdictDetail(next, row.body),
      metadata: { criterionId: row.id, before: row.qaVerdict, after: next },
    })

    return ok({ qaVerdict: next, verifiedBy, verifiedByName: next === null ? null : (user.name ?? null), verifiedAt })
  } catch (error) {
    console.error('[criteria] verdict failed', error)
    return err('Could not record the verdict')
  }
}
