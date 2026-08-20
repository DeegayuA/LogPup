'use server'

import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { activityLog, changeRequests } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { loadActor } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'
import { mayReview } from '@/features/admin/change-request-routing'
import {
  buildApplyStatement,
  detectConflict,
  isSupportedEntityType,
  type SupportedEntityType,
} from '@/features/admin/change-request-appliers'

function unexpected(context: string, error: unknown): ActionResult<never> {
  console.error(`[change-requests] ${context}`, error)
  return err('Something went wrong — try again')
}

const createInput = z.object({
  entityType: z.string(),
  entityId: z.string().uuid(),
  entityLabel: z.string().trim().min(1).max(200),
  operation: z.enum(['edit', 'delete', 'restore']),
  appId: z.string().uuid().nullable().optional(),
  reason: z.string().trim().min(1).max(500),
  payload: z.object({
    before: z.record(z.string(), z.unknown()),
    after: z.record(z.string(), z.unknown()),
  }),
})

/**
 * The path an editor takes instead of mutating.
 *
 * Every delete, and every edit outside their scope or window, lands here. The
 * matrix refuses them the direct action, so this is not a convenience — it is
 * the only route, and a test asserts the matrix leaves them no other.
 */
export async function createChangeRequest(
  raw: z.input<typeof createInput>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createInput.safeParse(raw)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const input = parsed.data

  const actor = await loadActor()
  if (!actor || !can(actor, 'request.create', { ownerId: actor.id })) return err('Not allowed')

  // Refused at FILING time, not at approval: an unsupported type would leave
  // the requester with a row nobody can ever action.
  if (!isSupportedEntityType(input.entityType)) {
    return err(`Changes to ${input.entityType} cannot be requested yet`)
  }

  try {
    const [row] = await db
      .insert(changeRequests)
      .values({
        requesterId: actor.id,
        entityType: input.entityType,
        entityId: input.entityId,
        entityLabel: input.entityLabel,
        operation: input.operation,
        payload: input.payload,
        reason: input.reason,
        appId: input.appId ?? null,
      })
      .returning({ id: changeRequests.id })

    revalidatePath('/admin', 'layout')
    return ok({ id: row.id })
  } catch (error) {
    return unexpected('createChangeRequest', error)
  }
}

const reviewInput = z.object({
  id: z.string().uuid(),
  note: z.string().trim().max(500).optional(),
})

/**
 * Approving applies the diff and records the signature TOGETHER.
 *
 * One db.batch, because neon-http has no transaction(). `logActivity` is
 * deliberately not used here: it swallows its own errors and issues its own
 * insert, so an approval whose audit row failed would be an approval nobody
 * can trace. The insert is inlined and fails with the write.
 */
export async function approveChangeRequest(
  raw: z.input<typeof reviewInput>,
): Promise<ActionResult<void>> {
  const parsed = reviewInput.safeParse(raw)
  if (!parsed.success) return err('Check the request and try again')

  const actor = await loadActor()
  if (!actor) return err('Not allowed')

  try {
    const [request] = await db
      .select()
      .from(changeRequests)
      .where(eq(changeRequests.id, parsed.data.id))
    if (!request) return err('That request no longer exists')

    if (!mayReview(actor, request)) return err('Not allowed')
    if (!isSupportedEntityType(request.entityType)) return err('This request cannot be applied')

    const entityType = request.entityType as SupportedEntityType
    const { before, after } = request.payload

    const current = await currentRowFor(entityType, request.entityId)
    const conflict = detectConflict(before, current)
    if (conflict) {
      // Loudly, not silently: the alternative is clobbering whatever somebody
      // else changed while this sat in the queue.
      return err(`Cannot approve — ${conflict} changed since this was requested`)
    }

    const selfApproved = request.requesterId === actor.id

    await db.batch([
            // `current` threaded through so a task's deadline fields route via
      // applyDueDate rather than the generic spread — see taskSet's comment.
      buildApplyStatement(entityType, request.entityId, after, current),
      db
        .update(changeRequests)
        .set({
          status: 'approved',
          reviewerId: actor.id,
          reviewedAt: new Date(),
          reviewNote: parsed.data.note ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(changeRequests.id, request.id), eq(changeRequests.status, 'pending'))),
      db.insert(activityLog).values({
        actorId: actor.id,
        verb: 'approved',
        entityType: 'change_request',
        entityId: request.id,
        entityLabel: request.entityLabel,
        appId: request.appId,
        metadata: {
          requesterId: request.requesterId,
          operation: request.operation,
          targetType: request.entityType,
          targetId: request.entityId,
          selfApproved,
        },
      }),
    ])

    revalidatePath('/admin', 'layout')
    return ok(undefined)
  } catch (error) {
    return unexpected('approveChangeRequest', error)
  }
}

/** Rejecting records the decision and MUST NOT touch the target. */
export async function rejectChangeRequest(
  raw: z.input<typeof reviewInput>,
): Promise<ActionResult<void>> {
  const parsed = reviewInput.safeParse(raw)
  if (!parsed.success) return err('Check the request and try again')

  const actor = await loadActor()
  if (!actor) return err('Not allowed')

  try {
    const [request] = await db
      .select()
      .from(changeRequests)
      .where(eq(changeRequests.id, parsed.data.id))
    if (!request) return err('That request no longer exists')
    if (!mayReview(actor, request)) return err('Not allowed')

    await db.batch([
      db
        .update(changeRequests)
        .set({
          status: 'rejected',
          reviewerId: actor.id,
          reviewedAt: new Date(),
          reviewNote: parsed.data.note ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(changeRequests.id, request.id), eq(changeRequests.status, 'pending'))),
      db.insert(activityLog).values({
        actorId: actor.id,
        verb: 'rejected',
        entityType: 'change_request',
        entityId: request.id,
        entityLabel: request.entityLabel,
        appId: request.appId,
        metadata: { requesterId: request.requesterId, operation: request.operation },
      }),
    ])

    revalidatePath('/admin', 'layout')
    return ok(undefined)
  } catch (error) {
    return unexpected('rejectChangeRequest', error)
  }
}

/** The requester closing their own. Never a deletion — the row is the trail. */
export async function withdrawChangeRequest(raw: { id: string }): Promise<ActionResult<void>> {
  const actor = await loadActor()
  if (!actor) return err('Not allowed')

  try {
    const [request] = await db
      .select({ id: changeRequests.id, requesterId: changeRequests.requesterId, status: changeRequests.status })
      .from(changeRequests)
      .where(eq(changeRequests.id, raw.id))
    if (!request) return err('That request no longer exists')
    if (!can(actor, 'request.withdraw', { ownerId: request.requesterId })) return err('Not allowed')
    if (request.status !== 'pending') return err('That request has already been reviewed')

    await db
      .update(changeRequests)
      .set({ status: 'withdrawn', updatedAt: new Date() })
      .where(and(eq(changeRequests.id, request.id), eq(changeRequests.status, 'pending')))

    revalidatePath('/admin', 'layout')
    return ok(undefined)
  } catch (error) {
    return unexpected('withdrawChangeRequest', error)
  }
}

async function currentRowFor(
  entityType: SupportedEntityType,
  id: string,
): Promise<Record<string, unknown> | null> {
  const { dailyWorklogs, meetings, sprints, tasks } = await import('@/db/schema')
  const table = { task: tasks, sprint: sprints, meeting: meetings, worklog: dailyWorklogs }[entityType]
  const [row] = await db.select().from(table).where(eq(table.id, id))
  return row ?? null
}
