'use server'

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { apps, assignments } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { summarizeAllocations } from '@/features/people/allocation'

const assignInput = z.object({
  userId: z.uuid(),
  appId: z.uuid(),
  role: z.string().min(2).max(40),
  allocationPct: z.number().int().min(5).max(100),
})

// Deliberately no `.default()` on any field: a missing key here must stay
// missing after parsing so a partial update only touches the fields the
// caller actually sent (same no-wipe discipline as apps/update-input.ts).
const assignmentUpdateInput = z
  .object({
    role: z.string().min(2).max(40),
    allocationPct: z.number().int().min(5).max(100),
  })
  .partial()

async function requireAdmin() {
  const session = await auth()
  if (session?.user?.role !== 'admin') return null
  return session
}

/**
 * Walks an error's `.cause` chain looking for a Postgres unique-violation.
 * The neon-http driver / drizzle wrap the underlying NeonDbError, so the
 * `code`/`message` we want may be a few levels down.
 */
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

async function slugForApp(appId: string): Promise<string | null> {
  const [app] = await db.select({ slug: apps.slug }).from(apps).where(eq(apps.id, appId))
  return app?.slug ?? null
}

async function warningForUser(userId: string): Promise<{ warning?: string }> {
  const rows = await db
    .select({ userId: assignments.userId, allocationPct: assignments.allocationPct })
    .from(assignments)
    .where(eq(assignments.userId, userId))
  const [summary] = summarizeAllocations(rows)
  if (summary && summary.totalPct > 100) {
    return { warning: `Now at ${summary.totalPct}% allocation` }
  }
  return {}
}

function revalidateAssignmentPaths(slug: string | null) {
  if (slug) revalidatePath('/apps/' + slug)
  revalidatePath('/people')
  revalidatePath('/')
}

export async function assignUser(input: unknown): Promise<ActionResult<{ warning?: string }>> {
  if (!(await requireAdmin())) return err('Admins only')
  const parsed = assignInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  try {
    await db.insert(assignments).values(parsed.data)
  } catch (error) {
    if (isUniqueViolation(error)) return err('Already assigned to this app')
    throw error
  }

  const slug = await slugForApp(parsed.data.appId)
  revalidateAssignmentPaths(slug)
  return ok(await warningForUser(parsed.data.userId))
}

export async function updateAssignment(
  assignmentId: string,
  input: unknown,
): Promise<ActionResult<{ warning?: string }>> {
  if (!(await requireAdmin())) return err('Admins only')
  const parsed = assignmentUpdateInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const set: Record<string, unknown> = {}
  for (const key of Object.keys(parsed.data) as (keyof typeof parsed.data)[]) {
    set[key] = parsed.data[key]
  }
  if (Object.keys(set).length === 0) return err('Nothing to update')

  const [existing] = await db.select().from(assignments).where(eq(assignments.id, assignmentId))
  if (!existing) return err('Assignment not found')

  await db.update(assignments).set(set).where(eq(assignments.id, assignmentId))

  const slug = await slugForApp(existing.appId)
  revalidateAssignmentPaths(slug)
  return ok(await warningForUser(existing.userId))
}

export async function removeAssignment(assignmentId: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return err('Admins only')

  const [existing] = await db.select().from(assignments).where(eq(assignments.id, assignmentId))
  if (!existing) return err('Assignment not found')

  await db.delete(assignments).where(eq(assignments.id, assignmentId))

  const slug = await slugForApp(existing.appId)
  revalidateAssignmentPaths(slug)
  return ok(undefined)
}
