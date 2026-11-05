'use server'

import { z } from 'zod'
import { and, asc, eq, inArray } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { liveApps, liveTasks } from '@/db/live'
import { appComponents, taskComponents, taskLabelLinks, taskLabels } from '@/db/schema'
import { getSession } from '@/lib/session'
import { requireCapability } from '@/features/auth/actor'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'
import {
  MAX_TAGS_PER_TASK,
  diffTagSet,
  hasTagNamed,
  nextLabelSlot,
  tagChangeDetail,
  tagNameSchema,
} from '@/features/sprints/labels'

/**
 * Labels and components on a task (PRD Module A).
 *
 * THE PROJECT IS ALWAYS THE TASK'S. Every action takes a task id and reads the
 * task's app from `liveTasks` — never an appId from the client. The link
 * tables only know (task, label); nothing in the database stops a link from
 * pointing a task at another project's label, so the "this id is one of the
 * task's project's" read below is the whole boundary, not a nicety.
 *
 * Sets are REPLACED, not patched: the client sends the full selection it now
 * shows, and the server writes the difference as one db.batch (neon-http has
 * no interactive transactions; a batch is one round trip and atomic).
 */

export type TaskTag = { id: string; name: string }
export type TaskLabel = TaskTag & { colorSlot: number | null }
export type TaskTags = {
  labels: TaskLabel[]
  components: TaskTag[]
  selectedLabelIds: string[]
  selectedComponentIds: string[]
}

const idSchema = z.uuid()
const idListSchema = z
  .array(z.uuid())
  .max(MAX_TAGS_PER_TASK, `A task can carry at most ${MAX_TAGS_PER_TASK}`)

/** See task-actions.ts `unexpected`: an action never throws, it returns err(). */
function unexpected(context: string, error: unknown): ActionResult<never> {
  console.error(`[sprints/labels] ${context}`, error)
  return err('Something went wrong — try again')
}

/** Cause-chain walk for 23505 — same shape as admin/trash-actions.ts. */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error
  const seen = new Set<unknown>()
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const e = current as { code?: unknown; message?: unknown; cause?: unknown }
    if (e.code === '23505') return true
    if (typeof e.message === 'string' && e.message.includes('duplicate key')) return true
    current = e.cause
  }
  return false
}

type GuardedTask = { id: string; appId: string; assigneeId: string | null; title: string; actorId: string }

/**
 * Session → task → capability, in that order. The session check sits ABOVE
 * the read for the reason in task-actions.ts deleteTask: otherwise an
 * anonymous caller can tell "Task not found" from "Not allowed" for free.
 */
async function guardTask(
  rawTaskId: unknown,
  mode: 'view' | 'edit',
): Promise<ActionResult<GuardedTask>> {
  const session = await getSession()
  if (!session?.user?.id) return err('Sign in required')
  const parsedId = idSchema.safeParse(rawTaskId)
  if (!parsedId.success) return err('Task not found')

  const [task] = await db
    .select({
      id: liveTasks.id,
      appId: liveTasks.appId,
      assigneeId: liveTasks.assigneeId,
      title: liveTasks.title,
    })
    .from(liveTasks)
    // A task in a trashed project is as gone as a trashed task: its tags are
    // neither readable nor writable until the project is restored.
    .innerJoin(liveApps, eq(liveApps.id, liveTasks.appId))
    .where(eq(liveTasks.id, parsedId.data))
    .limit(1)
  if (!task) return err('Task not found')

  // Resource always passed: a scoped grant asked without { appId } fails
  // closed (see logpup-development), which is how PMs once lost every right.
  const actor =
    mode === 'view'
      ? await requireCapability('app.view', { appId: task.appId })
      : await requireCapability('task.edit', { appId: task.appId, ownerId: task.assigneeId })
  if (!actor) return err('Not allowed')
  return ok({ ...task, actorId: actor.id })
}

async function revalidateTaskApp(appId: string): Promise<void> {
  // Best-effort: the write already landed, and a failed slug read must not
  // report a saved change as failed.
  try {
    const [app] = await db
      .select({ slug: liveApps.slug })
      .from(liveApps)
      .where(eq(liveApps.id, appId))
      .limit(1)
    if (app) revalidatePath('/apps/' + app.slug)
  } catch (error) {
    console.error('[sprints/labels] revalidate failed', error)
  }
}

function runBatch(statements: BatchItem<'pg'>[]) {
  // db.batch wants a statically non-empty tuple; callers only get here with
  // at least one statement.
  return db.batch(statements as [BatchItem<'pg'>, ...BatchItem<'pg'>[]])
}

export async function listTaskTags(taskId: string): Promise<ActionResult<TaskTags>> {
  const guard = await guardTask(taskId, 'view')
  if (!guard.ok) return guard
  const task = guard.data

  try {
    const [labels, components, labelLinks, componentLinks] = await Promise.all([
      db
        .select({ id: taskLabels.id, name: taskLabels.name, colorSlot: taskLabels.colorSlot })
        .from(taskLabels)
        .where(eq(taskLabels.appId, task.appId))
        .orderBy(asc(taskLabels.name)),
      db
        .select({ id: appComponents.id, name: appComponents.name })
        .from(appComponents)
        .where(eq(appComponents.appId, task.appId))
        .orderBy(asc(appComponents.name)),
      db
        .select({ id: taskLabelLinks.labelId })
        .from(taskLabelLinks)
        .where(eq(taskLabelLinks.taskId, task.id)),
      db
        .select({ id: taskComponents.componentId })
        .from(taskComponents)
        .where(eq(taskComponents.taskId, task.id)),
    ])
    // Intersected with the project's own set: a stray cross-project link (the
    // schema cannot forbid one) must not render as a chip with no name.
    const labelIds = new Set(labels.map((l) => l.id))
    const componentIds = new Set(components.map((c) => c.id))
    return ok({
      labels,
      components,
      selectedLabelIds: labelLinks.map((l) => l.id).filter((id) => labelIds.has(id)),
      selectedComponentIds: componentLinks.map((c) => c.id).filter((id) => componentIds.has(id)),
    })
  } catch (error) {
    return unexpected('listTaskTags', error)
  }
}

export async function createLabel(taskId: string, name: string): Promise<ActionResult<TaskLabel>> {
  const guard = await guardTask(taskId, 'edit')
  if (!guard.ok) return guard
  const parsed = tagNameSchema.safeParse(name)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const cleanName = parsed.data
  const duplicate = `A label called ${cleanName} already exists`

  try {
    // One read answers both questions: is the name taken, and how many exist
    // (the round-robin slot).
    const existing = await db
      .select({ name: taskLabels.name })
      .from(taskLabels)
      .where(eq(taskLabels.appId, guard.data.appId))
    if (hasTagNamed(existing, cleanName)) return err(duplicate)

    const [created] = await db
      .insert(taskLabels)
      .values({ appId: guard.data.appId, name: cleanName, colorSlot: nextLabelSlot(existing.length) })
      .returning({ id: taskLabels.id, name: taskLabels.name, colorSlot: taskLabels.colorSlot })
    return ok(created)
  } catch (error) {
    // The pre-check above loses a race with a concurrent create; the unique
    // index on (app_id, lower(name)) is the real guarantee.
    if (isUniqueViolation(error)) return err(duplicate)
    return unexpected('createLabel', error)
  }
}

export async function createComponent(taskId: string, name: string): Promise<ActionResult<TaskTag>> {
  const guard = await guardTask(taskId, 'edit')
  if (!guard.ok) return guard
  const parsed = tagNameSchema.safeParse(name)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const cleanName = parsed.data
  const duplicate = `A component called ${cleanName} already exists`

  try {
    const existing = await db
      .select({ name: appComponents.name })
      .from(appComponents)
      .where(eq(appComponents.appId, guard.data.appId))
    if (hasTagNamed(existing, cleanName)) return err(duplicate)

    const [created] = await db
      .insert(appComponents)
      .values({ appId: guard.data.appId, name: cleanName })
      .returning({ id: appComponents.id, name: appComponents.name })
    return ok(created)
  } catch (error) {
    if (isUniqueViolation(error)) return err(duplicate)
    return unexpected('createComponent', error)
  }
}

export async function setTaskLabels(
  taskId: string,
  labelIds: string[],
): Promise<ActionResult<{ labelIds: string[] }>> {
  const guard = await guardTask(taskId, 'edit')
  if (!guard.ok) return guard
  const parsed = idListSchema.safeParse(labelIds)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const task = guard.data
  const next = [...new Set(parsed.data)]

  try {
    const [owned, current] = await Promise.all([
      next.length === 0
        ? Promise.resolve([] as { id: string; name: string }[])
        : db
            .select({ id: taskLabels.id, name: taskLabels.name })
            .from(taskLabels)
            .where(and(eq(taskLabels.appId, task.appId), inArray(taskLabels.id, next))),
      db
        .select({ id: taskLabelLinks.labelId, name: taskLabels.name })
        .from(taskLabelLinks)
        .innerJoin(taskLabels, eq(taskLabels.id, taskLabelLinks.labelId))
        .where(eq(taskLabelLinks.taskId, task.id)),
    ])
    if (owned.length !== next.length) return err('One of those labels is not in this project')

    const { add, remove } = diffTagSet(
      current.map((row) => row.id),
      next,
    )
    if (add.length === 0 && remove.length === 0) return ok({ labelIds: next })

    const statements: BatchItem<'pg'>[] = []
    if (remove.length > 0) {
      statements.push(
        db
          .delete(taskLabelLinks)
          .where(and(eq(taskLabelLinks.taskId, task.id), inArray(taskLabelLinks.labelId, remove))),
      )
    }
    if (add.length > 0) {
      statements.push(
        db
          .insert(taskLabelLinks)
          .values(add.map((labelId) => ({ taskId: task.id, labelId })))
          // A double-click racing itself re-inserts the same pair; the PK
          // makes that a no-op instead of an error toast.
          .onConflictDoNothing(),
      )
    }
    await runBatch(statements)

    const nameOf = new Map([...owned, ...current].map((row) => [row.id, row.name]))
    await logActivity({
      actorId: task.actorId,
      verb: 'updated',
      entityType: 'task',
      entityId: task.id,
      entityLabel: task.title,
      appId: task.appId,
      detail: tagChangeDetail(
        'labels',
        add.map((id) => nameOf.get(id) ?? 'label'),
        remove.map((id) => nameOf.get(id) ?? 'label'),
      ),
      metadata: { labels: { added: add, removed: remove } },
    })
  } catch (error) {
    return unexpected('setTaskLabels', error)
  }

  await revalidateTaskApp(task.appId)
  return ok({ labelIds: next })
}

export async function setTaskComponents(
  taskId: string,
  componentIds: string[],
): Promise<ActionResult<{ componentIds: string[] }>> {
  const guard = await guardTask(taskId, 'edit')
  if (!guard.ok) return guard
  const parsed = idListSchema.safeParse(componentIds)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const task = guard.data
  const next = [...new Set(parsed.data)]

  try {
    const [owned, current] = await Promise.all([
      next.length === 0
        ? Promise.resolve([] as { id: string; name: string }[])
        : db
            .select({ id: appComponents.id, name: appComponents.name })
            .from(appComponents)
            .where(and(eq(appComponents.appId, task.appId), inArray(appComponents.id, next))),
      db
        .select({ id: taskComponents.componentId, name: appComponents.name })
        .from(taskComponents)
        .innerJoin(appComponents, eq(appComponents.id, taskComponents.componentId))
        .where(eq(taskComponents.taskId, task.id)),
    ])
    if (owned.length !== next.length) return err('One of those components is not in this project')

    const { add, remove } = diffTagSet(
      current.map((row) => row.id),
      next,
    )
    if (add.length === 0 && remove.length === 0) return ok({ componentIds: next })

    const statements: BatchItem<'pg'>[] = []
    if (remove.length > 0) {
      statements.push(
        db
          .delete(taskComponents)
          .where(and(eq(taskComponents.taskId, task.id), inArray(taskComponents.componentId, remove))),
      )
    }
    if (add.length > 0) {
      statements.push(
        db
          .insert(taskComponents)
          .values(add.map((componentId) => ({ taskId: task.id, componentId })))
          .onConflictDoNothing(),
      )
    }
    await runBatch(statements)

    const nameOf = new Map([...owned, ...current].map((row) => [row.id, row.name]))
    await logActivity({
      actorId: task.actorId,
      verb: 'updated',
      entityType: 'task',
      entityId: task.id,
      entityLabel: task.title,
      appId: task.appId,
      detail: tagChangeDetail(
        'components',
        add.map((id) => nameOf.get(id) ?? 'component'),
        remove.map((id) => nameOf.get(id) ?? 'component'),
      ),
      metadata: { components: { added: add, removed: remove } },
    })
  } catch (error) {
    return unexpected('setTaskComponents', error)
  }

  await revalidateTaskApp(task.appId)
  return ok({ componentIds: next })
}
