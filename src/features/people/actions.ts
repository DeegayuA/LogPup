'use server'

import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { apps, assignmentHistory, assignments } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { summarizeAllocations } from '@/features/people/allocation'
import { buildHistoryEntry, type ChangeKind } from '@/features/people/allocation-history'

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

function revalidateAssignmentPaths(slug: string | null, userId: string) {
  if (slug) revalidatePath('/apps/' + slug)
  revalidatePath('/people')
  // The person's timeline/trend and the team-wide "as of" surface both read
  // the history this change just appended to.
  revalidatePath('/people/' + userId)
  revalidatePath('/people/history')
  revalidatePath('/')
}

/**
 * The two statements every allocation change appends to `assignment_history`:
 * close the interval currently open for this (userId, appId), then open a new
 * one describing the resulting state.
 *
 * Both take the SAME `at` instant, which is what makes the intervals abut
 * exactly — `[previous.effectiveFrom, at)` then `[at, …)`. selectRowsAsOf
 * uses a half-open comparison, so at exactly `at` the new row wins and never
 * both. Deriving the two timestamps separately (two `new Date()`s, or SQL
 * `now()` on one side and JS on the other) would leave a gap or an overlap at
 * the boundary and quietly corrupt every "as of" total that lands in it.
 *
 * Returned rather than executed so the caller can put them in the same
 * db.batch as the mutation to `assignments` itself: neon-http has no
 * transactions, but a batch is one transaction, so the live state and its
 * audit row commit together or not at all.
 */
function historyStatements(input: {
  userId: string
  appId: string
  role: string
  allocationPct: number
  changeKind: ChangeKind
  changedBy: string
  at: Date
}) {
  return [
    db
      .update(assignmentHistory)
      .set({ effectiveTo: input.at })
      .where(
        and(
          eq(assignmentHistory.userId, input.userId),
          eq(assignmentHistory.appId, input.appId),
          isNull(assignmentHistory.effectiveTo),
        ),
      ),
    db.insert(assignmentHistory).values(buildHistoryEntry(input)),
  ] as const
}

export async function assignUser(input: unknown): Promise<ActionResult<{ warning?: string }>> {
  const session = await requireAdmin()
  if (!session?.user?.id) return err('Admins only')
  const parsed = assignInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const at = new Date()
  try {
    // The unique index can reject the insert; batching means the history
    // rows roll back with it rather than recording an assignment that never
    // happened. It also closes the tombstone left by a previous removal, so
    // re-assigning someone reopens their interval cleanly.
    await db.batch([
      db.insert(assignments).values(parsed.data),
      ...historyStatements({
        ...parsed.data,
        changeKind: 'assigned',
        changedBy: session.user.id,
        at,
      }),
    ])
  } catch (error) {
    if (isUniqueViolation(error)) return err('Already assigned to this app')
    throw error
  }

  const slug = await slugForApp(parsed.data.appId)
  revalidateAssignmentPaths(slug, parsed.data.userId)
  return ok(await warningForUser(parsed.data.userId))
}

export async function updateAssignment(
  assignmentId: string,
  input: unknown,
): Promise<ActionResult<{ warning?: string }>> {
  const session = await requireAdmin()
  if (!session?.user?.id) return err('Admins only')
  const parsed = assignmentUpdateInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const set: Record<string, unknown> = {}
  for (const key of Object.keys(parsed.data) as (keyof typeof parsed.data)[]) {
    set[key] = parsed.data[key]
  }
  if (Object.keys(set).length === 0) return err('Nothing to update')

  const [existing] = await db.select().from(assignments).where(eq(assignments.id, assignmentId))
  if (!existing) return err('Assignment not found')

  const at = new Date()
  await db.batch([
    db.update(assignments).set(set).where(eq(assignments.id, assignmentId)),
    // A history row is a snapshot of the RESULTING state, not a diff, so the
    // absent half of a partial update has to be filled from the existing row
    // — reading `parsed.data.role ?? existing.role` here rather than
    // re-applying a zod default, same no-wipe discipline as `set` above.
    ...historyStatements({
      userId: existing.userId,
      appId: existing.appId,
      role: parsed.data.role ?? existing.role,
      allocationPct: parsed.data.allocationPct ?? existing.allocationPct,
      changeKind: 'updated',
      changedBy: session.user.id,
      at,
    }),
  ])

  const slug = await slugForApp(existing.appId)
  revalidateAssignmentPaths(slug, existing.userId)
  return ok(await warningForUser(existing.userId))
}

export async function removeAssignment(assignmentId: string): Promise<ActionResult> {
  const session = await requireAdmin()
  if (!session?.user?.id) return err('Admins only')

  const [existing] = await db.select().from(assignments).where(eq(assignments.id, assignmentId))
  if (!existing) return err('Assignment not found')

  const at = new Date()
  await db.batch([
    db.delete(assignments).where(eq(assignments.id, assignmentId)),
    // Tombstone, not close-only: buildHistoryEntry forces allocationPct to 0
    // and the row stays open, so "as of" after this instant reads a positive
    // 0% for this pairing and the timeline keeps who removed them and when.
    // The role is carried over so the entry can say what they were removed
    // from. See the assignment_history comment in src/db/schema.ts.
    ...historyStatements({
      userId: existing.userId,
      appId: existing.appId,
      role: existing.role,
      allocationPct: 0,
      changeKind: 'removed',
      changedBy: session.user.id,
      at,
    }),
  ])

  const slug = await slugForApp(existing.appId)
  revalidateAssignmentPaths(slug, existing.userId)
  return ok(undefined)
}
