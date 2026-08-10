'use server'

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { apps, tasks } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { canMoveTask } from '@/features/sprints/permissions'

const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const
type TaskStatus = (typeof TASK_STATUSES)[number]

const taskInput = z.object({
  appId: z.uuid(),
  sprintId: z.uuid().nullable(),
  title: z.string().min(1).max(140),
  description: z.string().max(2000).optional(),
  assigneeId: z.uuid().nullable(),
  priority: z.number().int().min(0).max(3).default(0),
  status: z.enum(TASK_STATUSES).default('todo'),
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
  })
  .partial()

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

async function taskById(taskId: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId))
  return task ?? null
}

async function slugForApp(appId: string): Promise<string | null> {
  const [app] = await db.select({ slug: apps.slug }).from(apps).where(eq(apps.id, appId))
  return app?.slug ?? null
}

async function revalidateApp(appId: string) {
  const slug = await slugForApp(appId)
  if (slug) revalidatePath('/apps/' + slug)
}

export async function createTask(input: unknown): Promise<ActionResult<{ taskId: string }>> {
  // Any authenticated member may create a task — no role check beyond a session.
  if (!(await requireSession())) return err('Sign in required')
  const parsed = taskInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const { appId, sprintId, title, description, assigneeId, priority, status } = parsed.data
  const [created] = await db
    .insert(tasks)
    .values({
      appId,
      sprintId,
      title,
      description: description || null,
      assigneeId,
      priority,
      status,
    })
    .returning({ id: tasks.id })

  await revalidateApp(appId)
  return ok({ taskId: created.id })
}

export async function updateTask(taskId: string, input: unknown): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return err('Sign in required')

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

  await db.update(tasks).set(set).where(eq(tasks.id, taskId))

  await revalidateApp(existing.appId)
  return ok(undefined)
}

export async function moveTask(
  taskId: string,
  status: TaskStatus,
  sortOrder: number,
): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return err('Sign in required')
  if (!TASK_STATUSES.includes(status)) return err('Invalid status')

  const existing = await taskById(taskId)
  if (!existing) return err('Task not found')

  if (!canMoveTask(session.user.role, session.user.id, existing.assigneeId)) {
    return err('You can only move your own tasks')
  }

  await db.update(tasks).set({ status, sortOrder }).where(eq(tasks.id, taskId))

  await revalidateApp(existing.appId)
  return ok(undefined)
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return err('Admins only')

  const existing = await taskById(taskId)
  if (!existing) return err('Task not found')

  await db.delete(tasks).where(eq(tasks.id, taskId))

  await revalidateApp(existing.appId)
  return ok(undefined)
}
