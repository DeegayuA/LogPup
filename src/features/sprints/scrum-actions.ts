'use server'

import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { liveApps, liveSprints, liveTasks } from '@/db/live'
import { retroItems, sprintFeedback, standupEntries } from '@/db/schema'
import { requireCapability } from '@/features/auth/actor'
import { appViewers } from '@/features/sprints/app-viewers'
import { logActivity } from '@/features/activity/log'
import { createTask } from '@/features/sprints/task-actions'
import { formatTaskKey } from '@/features/sprints/task-key'
import { RETRO_KINDS, isIsoDay, isStandupDayAllowed, retroTaskTitle } from '@/features/sprints/scrum'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { ok, err, type ActionResult } from '@/lib/action-result'

/**
 * Writes for the Scrum tab (PRD Module B): standups, review feedback, retro.
 *
 * THE appId NEVER COMES FROM THE CLIENT, as in task-comments-actions.ts: every
 * action takes a sprint (or row) id and derives the project from the live
 * sprint, so a binned sprint is "not found" and a forged id cannot write into
 * a project the caller cannot see.
 *
 * Gated on task.comment, not app.view: anyone on the project takes part in
 * its ceremonies, stakeholders included, but the read-only auditor seat holds
 * app.view everywhere and must not write. task.comment is also a WRITE
 * capability, so a maintenance freeze refuses these politely here.
 *
 * Feedback and retro rows are HARD deleted: neither table has a deletedAt,
 * and a withdrawn remark has nothing to restore (live.test.ts lists the two
 * functions in DELETE_ALLOWED_FUNCTIONS).
 */

const idSchema = z.uuid()
const bodySchema = z.string().trim().min(1, 'Write something first').max(2000, 'That is too long (2000 characters at most)')
const answerSchema = z
  .string()
  .trim()
  .max(2000, 'An answer is too long (2000 characters at most)')
  .transform((v) => (v.length === 0 ? null : v))

function unexpected(where: string, error: unknown): ActionResult<never> {
  console.error(`[sprints] ${where} failed:`, error)
  return err('Something went wrong, try again')
}

type SprintContext = {
  id: string
  name: string
  appId: string
  appName: string
  appSlug: string
  startDate: string
  endDate: string
  status: 'planned' | 'active' | 'done'
}

async function sprintContext(sprintId: string): Promise<SprintContext | null> {
  const [row] = await db
    .select({
      id: liveSprints.id,
      name: liveSprints.name,
      appId: liveSprints.appId,
      appName: liveApps.name,
      appSlug: liveApps.slug,
      startDate: liveSprints.startDate,
      endDate: liveSprints.endDate,
      status: liveSprints.status,
    })
    .from(liveSprints)
    .innerJoin(liveApps, eq(liveApps.id, liveSprints.appId))
    .where(eq(liveSprints.id, sprintId))
  return row ?? null
}

function excerpt(text: string): string {
  return text.length > 60 ? `${text.slice(0, 59)}…` : text
}

async function logSprint(actorId: string, sprint: SprintContext, verb: string, detail: string) {
  await logActivity({
    actorId,
    verb,
    entityType: 'sprint',
    entityId: sprint.id,
    entityLabel: sprint.name,
    appId: sprint.appId,
    appName: sprint.appName,
    pagePath: `/apps/${sprint.appSlug}`,
    detail,
  })
}

// --- Standup ----------------------------------------------------------------

const standupInput = z.object({
  sprintId: idSchema,
  day: z.string(),
  yesterday: answerSchema,
  today: answerSchema,
  blockers: answerSchema,
})

/** Write (or rewrite) the caller's own standup for one day of the sprint. */
export async function saveStandup(input: unknown): Promise<ActionResult> {
  const parsed = standupInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { sprintId, day, yesterday, today, blockers } = parsed.data
  try {
    const sprint = await sprintContext(sprintId)
    if (!sprint) return err('Sprint not found')
    const actor = await requireCapability('task.comment', { appId: sprint.appId })
    if (!actor) return err('Not allowed')
    if (sprint.status === 'done') return err('This sprint is finished, so its standups can no longer change')
    if (!isStandupDayAllowed(day, sprint, toIsoDateInTimeZone(new Date(), LK_TIMEZONE))) {
      return err('You can only fill in a standup for today or an earlier day of this sprint')
    }

    // ON CONFLICT on standup_entries_one_per_day_idx: one statement, so two
    // saves racing from two tabs cannot both insert.
    const now = new Date()
    await db
      .insert(standupEntries)
      .values({ sprintId, userId: actor.id, day, yesterday, today, blockers })
      .onConflictDoUpdate({
        target: [standupEntries.sprintId, standupEntries.userId, standupEntries.day],
        set: { yesterday, today, blockers, updatedAt: now },
      })
    revalidatePath('/apps/' + sprint.appSlug)
    return ok(undefined)
  } catch (error) {
    return unexpected('saveStandup', error)
  }
}

const standupKey = z.object({ sprintId: idSchema, day: z.string() })

/**
 * Remove the caller's OWN standup for one day — never anyone else's, so the
 * delete is keyed on the actor, not on a row id the client could choose.
 * Allowed even on a finished sprint: these are the person's own words, and
 * clearing test or mistaken entries should not need the database.
 */
export async function deleteStandup(input: unknown): Promise<ActionResult> {
  const parsed = standupKey.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { sprintId, day } = parsed.data
  if (!isIsoDay(day)) return err('Invalid day')
  try {
    const sprint = await sprintContext(sprintId)
    if (!sprint) return err('Sprint not found')
    const actor = await requireCapability('task.comment', { appId: sprint.appId })
    if (!actor) return err('Not allowed')
    const removed = await db
      .delete(standupEntries)
      .where(
        and(
          eq(standupEntries.sprintId, sprintId),
          eq(standupEntries.userId, actor.id),
          eq(standupEntries.day, day),
        ),
      )
      .returning({ id: standupEntries.id })
    if (removed.length === 0) return err('No standup of yours on that day')
    revalidatePath('/apps/' + sprint.appSlug)
    return ok(undefined)
  } catch (error) {
    return unexpected('deleteStandup', error)
  }
}

// --- Review feedback ----------------------------------------------------------

const feedbackInput = z.object({
  sprintId: idSchema,
  taskId: idSchema.nullable().optional(),
  body: bodySchema,
})

export async function addFeedback(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = feedbackInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { sprintId, taskId, body } = parsed.data
  try {
    const sprint = await sprintContext(sprintId)
    if (!sprint) return err('Sprint not found')
    const actor = await requireCapability('task.comment', { appId: sprint.appId })
    if (!actor) return err('Not allowed')
    if (taskId) {
      const [task] = await db
        .select({ id: liveTasks.id })
        .from(liveTasks)
        .where(and(eq(liveTasks.id, taskId), eq(liveTasks.appId, sprint.appId)))
      if (!task) return err('That work item is not in this project')
    }
    const [created] = await db
      .insert(sprintFeedback)
      .values({ sprintId, taskId: taskId ?? null, authorId: actor.id, body })
      .returning({ id: sprintFeedback.id })
    await logSprint(actor.id, sprint, 'commented', `Review feedback: ${excerpt(body)}`)
    revalidatePath('/apps/' + sprint.appSlug)
    return ok({ id: created.id })
  } catch (error) {
    return unexpected('addFeedback', error)
  }
}

/**
 * The author, or anyone who may manage sprints. The manager check runs only
 * when the caller is not the author, so withdrawing your own words never
 * pays for the scope read.
 */
async function authorOrManager(appId: string, authorIds: readonly (string | null)[]) {
  const viewer = await requireCapability('task.comment', { appId })
  if (viewer && authorIds.includes(viewer.id)) return viewer
  return requireCapability('sprint.manage', { appId })
}

export async function deleteFeedback(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return err('Feedback not found')
  try {
    const [row] = await db
      .select({ sprintId: sprintFeedback.sprintId, authorId: sprintFeedback.authorId, body: sprintFeedback.body })
      .from(sprintFeedback)
      .where(eq(sprintFeedback.id, id))
    if (!row) return err('Feedback not found')
    const sprint = await sprintContext(row.sprintId)
    if (!sprint) return err('Feedback not found')
    const actor = await authorOrManager(sprint.appId, [row.authorId])
    if (!actor) return err('Not allowed')
    await db.delete(sprintFeedback).where(eq(sprintFeedback.id, id))
    await logSprint(actor.id, sprint, 'deleted', `Review feedback: ${excerpt(row.body)}`)
    revalidatePath('/apps/' + sprint.appSlug)
    return ok(undefined)
  } catch (error) {
    return unexpected('deleteFeedback', error)
  }
}

// --- Retro ------------------------------------------------------------------

const retroInput = z.object({
  sprintId: idSchema,
  kind: z.enum(RETRO_KINDS),
  body: bodySchema,
  ownerId: idSchema.nullable().optional(),
})

/** An owner must be somebody who can open the project, or the task they get is one they cannot see. */
async function ownerProblem(appId: string, ownerId: string | null | undefined): Promise<string | null> {
  if (!ownerId) return null
  const pool = await appViewers(appId)
  return pool.some((p) => p.id === ownerId) ? null : 'That person cannot open this project'
}

export async function addRetroItem(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = retroInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { sprintId, kind, body, ownerId } = parsed.data
  try {
    const sprint = await sprintContext(sprintId)
    if (!sprint) return err('Sprint not found')
    const actor = await requireCapability('task.comment', { appId: sprint.appId })
    if (!actor) return err('Not allowed')
    // Only an action item has an owner; on the other two columns it would be
    // stored and never shown.
    const owner = kind === 'action' ? (ownerId ?? null) : null
    const problem = await ownerProblem(sprint.appId, owner)
    if (problem) return err(problem)
    const [created] = await db
      .insert(retroItems)
      .values({ sprintId, kind, body, authorId: actor.id, ownerId: owner })
      .returning({ id: retroItems.id })
    await logSprint(actor.id, sprint, 'commented', `Retro: ${excerpt(body)}`)
    revalidatePath('/apps/' + sprint.appSlug)
    return ok({ id: created.id })
  } catch (error) {
    return unexpected('addRetroItem', error)
  }
}

async function retroRow(id: string) {
  const [row] = await db
    .select({
      id: retroItems.id,
      sprintId: retroItems.sprintId,
      kind: retroItems.kind,
      body: retroItems.body,
      authorId: retroItems.authorId,
      ownerId: retroItems.ownerId,
      taskId: retroItems.taskId,
    })
    .from(retroItems)
    .where(eq(retroItems.id, id))
  return row ?? null
}

export async function deleteRetroItem(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return err('Item not found')
  try {
    const row = await retroRow(id)
    if (!row) return err('Item not found')
    const sprint = await sprintContext(row.sprintId)
    if (!sprint) return err('Item not found')
    const actor = await authorOrManager(sprint.appId, [row.authorId])
    if (!actor) return err('Not allowed')
    await db.delete(retroItems).where(eq(retroItems.id, id))
    await logSprint(actor.id, sprint, 'deleted', `Retro: ${excerpt(row.body)}`)
    revalidatePath('/apps/' + sprint.appSlug)
    return ok(undefined)
  } catch (error) {
    return unexpected('deleteRetroItem', error)
  }
}

export async function setRetroItemDone(id: string, done: boolean): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return err('Item not found')
  if (typeof done !== 'boolean') return err('Item not found')
  try {
    const row = await retroRow(id)
    if (!row) return err('Item not found')
    const sprint = await sprintContext(row.sprintId)
    if (!sprint) return err('Item not found')
    const actor = await authorOrManager(sprint.appId, [row.authorId, row.ownerId])
    if (!actor) return err('Not allowed')
    await db.update(retroItems).set({ doneAt: done ? new Date() : null }).where(eq(retroItems.id, id))
    await logSprint(actor.id, sprint, 'updated', `${done ? 'Finished' : 'Reopened'} retro action: ${excerpt(row.body)}`)
    revalidatePath('/apps/' + sprint.appSlug)
    return ok(undefined)
  } catch (error) {
    return unexpected('setRetroItemDone', error)
  }
}

/** Who owns an action item. The author, the current owner, or a sprint manager may change it. */
export async function setRetroItemOwner(id: string, ownerId: string | null): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return err('Item not found')
  if (ownerId !== null && !idSchema.safeParse(ownerId).success) return err('Person not found')
  try {
    const row = await retroRow(id)
    if (!row) return err('Item not found')
    if (row.kind !== 'action') return err('Only an action item has an owner')
    const sprint = await sprintContext(row.sprintId)
    if (!sprint) return err('Item not found')
    const actor = await authorOrManager(sprint.appId, [row.authorId, row.ownerId])
    if (!actor) return err('Not allowed')
    const problem = await ownerProblem(sprint.appId, ownerId)
    if (problem) return err(problem)
    await db.update(retroItems).set({ ownerId }).where(eq(retroItems.id, id))
    await logSprint(actor.id, sprint, 'updated', `Retro action owner changed: ${excerpt(row.body)}`)
    revalidatePath('/apps/' + sprint.appSlug)
    return ok(undefined)
  } catch (error) {
    return unexpected('setRetroItemOwner', error)
  }
}

/**
 * Turn an action item into a backlog task, through createTask so the task gets
 * the same number, rank and activity row as one made on the board.
 *
 * Not atomic (neon-http has no interactive transactions): if the link write
 * fails after the task exists, the task stays and the item stays unlinked;
 * a second click would make a second task. The UI disables the button while
 * the request is in flight, and the link write is guarded on task_id IS NULL
 * so two racing clicks cannot both claim the item.
 */
export async function retroActionToTask(id: string): Promise<ActionResult<{ taskId: string; taskKey: string | null }>> {
  if (!idSchema.safeParse(id).success) return err('Item not found')
  try {
    const row = await retroRow(id)
    if (!row) return err('Item not found')
    if (row.kind !== 'action') return err('Only an action item can become a task')
    if (row.taskId) return err('This action is already a task')
    const sprint = await sprintContext(row.sprintId)
    if (!sprint) return err('Item not found')
    const actor = await requireCapability('task.create', { appId: sprint.appId })
    if (!actor) return err('Not allowed')

    const created = await createTask({
      appId: sprint.appId,
      sprintId: null,
      title: retroTaskTitle(row.body),
      description: row.body.length > 140 ? row.body : undefined,
      assigneeId: row.ownerId ?? null,
    })
    if (!created.ok) return created

    const linked = await db
      .update(retroItems)
      .set({ taskId: created.data.taskId })
      .where(and(eq(retroItems.id, id), isNull(retroItems.taskId)))
      .returning({ id: retroItems.id })
    if (linked.length === 0) return err('This action was turned into a task by someone else just now')

    const [task] = await db
      .select({ number: liveTasks.number, appKey: liveApps.key, appNumber: liveApps.number })
      .from(liveTasks)
      .innerJoin(liveApps, eq(liveApps.id, liveTasks.appId))
      .where(eq(liveTasks.id, created.data.taskId))
    const taskKey =
      task && task.number !== null ? formatTaskKey({ key: task.appKey, number: task.appNumber }, task.number) : null

    await logSprint(actor.id, sprint, 'updated', `Retro action became ${taskKey ?? 'a task'}: ${excerpt(row.body)}`)
    revalidatePath('/apps/' + sprint.appSlug)
    return ok({ taskId: created.data.taskId, taskKey })
  } catch (error) {
    return unexpected('retroActionToTask', error)
  }
}
