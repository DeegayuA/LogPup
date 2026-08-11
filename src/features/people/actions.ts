'use server'

import { z } from 'zod'
import { and, eq, exists, isNull, sql, type SQL } from 'drizzle-orm'
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
    closeOpenInterval(input),
    db.insert(assignmentHistory).values(buildHistoryEntry(input)),
  ] as const
}

/**
 * Closes whichever interval is currently open for this (userId, appId).
 *
 * `guard` is an extra predicate ANDed into the WHERE — the callers that read
 * the live row in a SEPARATE round-trip before batching pass "…and that row
 * is still there", so a concurrent removal can't leave history claiming a
 * state `assignments` no longer has. Without it the close still ran against a
 * row the mutation itself no longer matched, forking history from live state
 * permanently (nothing reconciles the two back).
 */
function closeOpenInterval(input: { userId: string; appId: string; at: Date; guard?: SQL }) {
  return db
    .update(assignmentHistory)
    .set({ effectiveTo: input.at })
    .where(
      and(
        eq(assignmentHistory.userId, input.userId),
        eq(assignmentHistory.appId, input.appId),
        isNull(assignmentHistory.effectiveTo),
        // drizzle's `and` drops undefined members, so an unguarded close is
        // exactly the predicate it was before.
        input.guard,
      ),
    )
}

/** "the live assignment row is still there", evaluated inside the batch. */
function assignmentStillExists(assignmentId: string): SQL {
  return exists(
    db.select({ one: sql`1` }).from(assignments).where(eq(assignments.id, assignmentId)),
  )
}

/**
 * Opens a new interval as an INSERT…SELECT off `assignments` rather than off
 * values read earlier. Two consequences, both deliberate:
 *
 *  - placed after the mutation in the batch, it snapshots the RESULTING live
 *    row, so a partial update needs no "fill the absent half from the row we
 *    read" step at all;
 *  - if the row is gone (removed by a concurrent session between our read and
 *    this batch) the SELECT yields nothing and no history row is written —
 *    history can never describe an assignment that does not exist.
 *
 * `allocationPct` is overridable for the removal tombstone, which records 0
 * regardless of what the row still says (see buildHistoryEntry).
 */
function openIntervalFromAssignment(input: {
  assignmentId: string
  changeKind: ChangeKind
  changedBy: string
  at: Date
  allocationPct?: SQL
}) {
  return db.insert(assignmentHistory).select(
    db
      .select({
        // EVERY column, in schema order: drizzle's insert…select rejects a
        // partial or reordered field list outright, so the defaults have to
        // be spelled out here rather than left to the table. Each literal is
        // cast explicitly too — an untyped placeholder in a SELECT list gives
        // Postgres nothing to infer a parameter type from.
        id: sql<string>`gen_random_uuid()`.as('id'),
        userId: assignments.userId,
        appId: assignments.appId,
        role: assignments.role,
        allocationPct: input.allocationPct?.as('allocation_pct') ?? assignments.allocationPct,
        effectiveFrom: sql<Date>`${input.at.toISOString()}::timestamptz`.as('effective_from'),
        // Open interval — closing it is a separate statement in a later batch.
        effectiveTo: sql<Date | null>`null::timestamptz`.as('effective_to'),
        changedBy: sql<string>`${input.changedBy}::uuid`.as('changed_by'),
        changeKind: sql<ChangeKind>`${input.changeKind}::allocation_change`.as('change_kind'),
        note: sql<string | null>`null::text`.as('note'),
        createdAt: sql<Date>`now()`.as('created_at'),
      })
      .from(assignments)
      .where(eq(assignments.id, input.assignmentId)),
  )
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
  // `existing` came from a separate round-trip, so by the time this batch runs
  // the row may already have been deleted by another admin (or by this admin
  // in another tab). Every statement below is therefore conditional on the row
  // still being there: the UPDATE by its own WHERE, the close and the open by
  // an explicit guard. neon-http has no interactive transaction to abort from,
  // so "gate each statement" is how the batch stays all-or-nothing in practice.
  const guard = assignmentStillExists(assignmentId)
  const [updated] = await db.batch([
    db
      .update(assignments)
      .set(set)
      .where(eq(assignments.id, assignmentId))
      .returning({ id: assignments.id }),
    closeOpenInterval({ userId: existing.userId, appId: existing.appId, at, guard }),
    // A history row is a snapshot of the RESULTING state, not a diff. Reading
    // it back off `assignments` after the UPDATE is what makes the absent half
    // of a partial update correct without re-applying a zod default — and what
    // makes the whole write vanish if the row did.
    openIntervalFromAssignment({
      assignmentId,
      changeKind: 'updated',
      changedBy: session.user.id,
      at,
    }),
  ])

  // Zero rows updated means the assignment was removed under us. Nothing was
  // written (the guards saw to that), so say so instead of toasting success.
  if (updated.length === 0) return err('Assignment not found')

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
  const guard = assignmentStillExists(assignmentId)
  // Order matters: both history writes read/guard on the live row, so the
  // DELETE goes LAST. Removing first would leave the tombstone unconditional
  // again — and a second removal of an already-removed row would close the
  // first tombstone and open another, rendering "Removed — was 0%".
  const [, , deleted] = await db.batch([
    closeOpenInterval({ userId: existing.userId, appId: existing.appId, at, guard }),
    // Tombstone, not close-only: allocationPct is forced to 0 and the row
    // stays open, so "as of" after this instant reads a positive 0% for this
    // pairing and the timeline keeps who removed them and when. The role is
    // carried over so the entry can say what they were removed from. See the
    // assignment_history comment in src/db/schema.ts.
    openIntervalFromAssignment({
      assignmentId,
      changeKind: 'removed',
      changedBy: session.user.id,
      at,
      allocationPct: sql<number>`0`,
    }),
    db.delete(assignments).where(eq(assignments.id, assignmentId)).returning({
      id: assignments.id,
    }),
  ])

  if (deleted.length === 0) return err('Assignment not found')

  const slug = await slugForApp(existing.appId)
  revalidateAssignmentPaths(slug, existing.userId)
  return ok(undefined)
}
