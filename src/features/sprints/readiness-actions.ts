'use server'

/**
 * Backlog refinement writes (PRD Module B): mark ready, product approval,
 * risk — plus the read the task dialog's Definition of Ready panel needs.
 *
 * TRUST BOUNDARY, as criteria-actions.ts: the app and the assignee come from
 * the task row read through `liveTasks` (inner-joined to `liveApps`, so a
 * trashed project is read-only), never from the client.
 *
 * Ready and risk sit behind task.edit — the people who refine a story are the
 * people who may edit it. Product approval sits behind sprint.manage: it is
 * the PM/lead's sign-off, and letting the assignee approve their own story
 * would make the box meaningless.
 */
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { liveApps, liveTasks } from '@/db/live'
import { tasks } from '@/db/schema'
import { getSession } from '@/lib/session'
import { requireCapability } from '@/features/auth/actor'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'
import { definitionOfReady, RISK_LEVELS, type DorCheck, type RiskLevel } from '@/features/sprints/readiness'
import { getReadinessFacts } from '@/features/sprints/readiness-queries'

const id = z.uuid()

async function taskRef(taskId: string) {
  const [task] = await db
    .select({
      id: liveTasks.id,
      appId: liveTasks.appId,
      assigneeId: liveTasks.assigneeId,
      title: liveTasks.title,
      readyAt: liveTasks.readyAt,
      productApprovedAt: liveTasks.productApprovedAt,
      risk: liveTasks.risk,
    })
    .from(liveTasks)
    .innerJoin(liveApps, eq(liveApps.id, liveTasks.appId))
    .where(eq(liveTasks.id, taskId))
    .limit(1)
  return task
}

function unexpected(context: string, error: unknown): ActionResult<never> {
  console.error(`[readiness] ${context}`, error)
  return err('Something went wrong — try again')
}

export type TaskReadiness = {
  checks: DorCheck[]
  readyAt: Date | null
  productApprovedAt: Date | null
  risk: RiskLevel | null
  canEdit: boolean
  canApprove: boolean
}

/** The dialog's Definition of Ready panel. Anyone who can see the app may read it. */
async function loadTaskReadinessImpl(taskId: string): Promise<ActionResult<TaskReadiness>> {
  const session = await getSession()
  if (!session?.user) return err('Sign in required')
  if (!id.safeParse(taskId).success) return err('Task not found')
  const task = await taskRef(taskId)
  if (!task) return err('Task not found')
  if (!(await requireCapability('app.view', { appId: task.appId }))) return err('Task not found')

  try {
    const [facts, canEdit, canApprove] = await Promise.all([
      getReadinessFacts([taskId]),
      requireCapability('task.edit', { appId: task.appId, ownerId: task.assigneeId }),
      requireCapability('sprint.manage', { appId: task.appId }),
    ])
    const f = facts.get(taskId)
    return ok({
      checks: f ? definitionOfReady(f) : [],
      readyAt: task.readyAt,
      productApprovedAt: task.productApprovedAt,
      risk: task.risk,
      canEdit: Boolean(canEdit),
      canApprove: Boolean(canApprove),
    })
  } catch (error) {
    return unexpected('loadTaskReadiness', error)
  }
}

async function setTaskReadyImpl(taskId: string, ready: boolean): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.user) return err('Sign in required')
  if (!id.safeParse(taskId).success) return err('Task not found')
  const task = await taskRef(taskId)
  if (!task) return err('Task not found')
  const actor = await requireCapability('task.edit', { appId: task.appId, ownerId: task.assigneeId })
  if (!actor) return err('Not allowed')

  try {
    await db
      .update(tasks)
      .set(ready ? { readyAt: new Date(), readyBy: actor.id } : { readyAt: null, readyBy: null })
      .where(eq(tasks.id, taskId))
  } catch (error) {
    return unexpected('setTaskReady', error)
  }
  await logActivity({
    actorId: actor.id,
    verb: 'updated',
    entityType: 'task',
    entityId: taskId,
    entityLabel: task.title,
    appId: task.appId,
    detail: ready ? 'marked it ready' : 'marked it not ready',
    metadata: { ready: { from: task.readyAt !== null, to: ready } },
  })
  return ok(undefined)
}

async function setProductApprovalImpl(taskId: string, approved: boolean): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.user) return err('Sign in required')
  if (!id.safeParse(taskId).success) return err('Task not found')
  const task = await taskRef(taskId)
  if (!task) return err('Task not found')
  const actor = await requireCapability('sprint.manage', { appId: task.appId })
  if (!actor) return err('Only the project manager or lead can approve')

  try {
    await db
      .update(tasks)
      .set(approved ? { productApprovedAt: new Date(), productApprovedBy: actor.id } : { productApprovedAt: null, productApprovedBy: null })
      .where(eq(tasks.id, taskId))
  } catch (error) {
    return unexpected('setProductApproval', error)
  }
  await logActivity({
    actorId: actor.id,
    verb: approved ? 'approved' : 'updated',
    entityType: 'task',
    entityId: taskId,
    entityLabel: task.title,
    appId: task.appId,
    detail: approved ? 'gave product approval' : 'withdrew product approval',
    metadata: { productApproved: { from: task.productApprovedAt !== null, to: approved } },
  })
  return ok(undefined)
}

async function setTaskRiskImpl(taskId: string, risk: RiskLevel | null): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.user) return err('Sign in required')
  if (!id.safeParse(taskId).success) return err('Task not found')
  if (risk !== null && !RISK_LEVELS.includes(risk)) return err('Invalid risk')
  const task = await taskRef(taskId)
  if (!task) return err('Task not found')
  const actor = await requireCapability('task.edit', { appId: task.appId, ownerId: task.assigneeId })
  if (!actor) return err('Not allowed')

  try {
    await db.update(tasks).set({ risk }).where(eq(tasks.id, taskId))
  } catch (error) {
    return unexpected('setTaskRisk', error)
  }
  await logActivity({
    actorId: actor.id,
    verb: 'updated',
    entityType: 'task',
    entityId: taskId,
    entityLabel: task.title,
    appId: task.appId,
    detail: risk ? `set risk to ${risk}` : 'cleared the risk',
    metadata: { risk: { from: task.risk, to: risk } },
  })
  return ok(undefined)
}

/**
 * The exported doors. Each wraps its whole body, so a failed read or
 * capability lookup (not only the write) returns err() instead of rejecting —
 * a rejected server action leaves the dialog spinning with no message.
 * Booleans are checked here because a server action's arguments arrive from
 * the network: "false" is truthy and would flip the flag the wrong way.
 */
async function guarded<T>(context: string, run: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await run()
  } catch (error) {
    return unexpected(context, error)
  }
}

export async function loadTaskReadiness(taskId: string): Promise<ActionResult<TaskReadiness>> {
  return guarded('loadTaskReadiness', () => loadTaskReadinessImpl(taskId))
}

export async function setTaskReady(taskId: string, ready: boolean): Promise<ActionResult> {
  if (typeof ready !== 'boolean') return err('Invalid value')
  return guarded('setTaskReady', () => setTaskReadyImpl(taskId, ready))
}

export async function setProductApproval(taskId: string, approved: boolean): Promise<ActionResult> {
  if (typeof approved !== 'boolean') return err('Invalid value')
  return guarded('setProductApproval', () => setProductApprovalImpl(taskId, approved))
}

export async function setTaskRisk(taskId: string, risk: RiskLevel | null): Promise<ActionResult> {
  return guarded('setTaskRisk', () => setTaskRiskImpl(taskId, risk))
}
