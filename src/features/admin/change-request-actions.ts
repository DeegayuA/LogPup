'use server'

import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { liveApps } from '@/db/live'
import { activityLog, changeRequests } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { loadActor } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'
import { createNotifications } from '@/features/notifications/notify'
import { mayReview } from '@/features/admin/change-request-routing'
import {
  APP_REQUESTABLE_FIELDS,
  buildApplyStatement,
  currentRowFor,
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

  // An app request may only ask for the fields APP_REQUESTABLE_FIELDS
  // covers — pmId/leadId (need the appRoleHistory pair a single applied
  // statement cannot write) and changePolicy (column not live yet) are
  // refused HERE, at filing, rather than discovered by a reviewer at approve.
  if (input.entityType === 'app') {
    const badKey = Object.keys(input.payload.after).find(
      (key) => !(APP_REQUESTABLE_FIELDS as readonly string[]).includes(key),
    )
    if (badKey) return err(`Cannot request a change to ${badKey}`)
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

    // Best-effort, after the row exists: the request is filed either way, so
    // a notification failure must never be reported as the filing failing.
    if (input.entityType === 'app') {
      await notifyFiled(row.id, input.entityId, actor.id)
    }

    return ok({ id: row.id })
  } catch (error) {
    return unexpected('createChangeRequest', error)
  }
}

/**
 * The app's current lead, for `mayReview`'s app branch. `changeRequests` has
 * no `leadId` column of its own — it lives on `apps` — so approve/reject
 * (unlike `getApprovalsInbox`, which already joins `apps` for its listing)
 * take one extra select, and only for an app-entity request.
 */
async function leadIdFor(appId: string | null): Promise<string | null> {
  if (!appId) return null
  const [app] = await db.select({ leadId: liveApps.leadId }).from(liveApps).where(eq(liveApps.id, appId))
  return app?.leadId ?? null
}

/** Tells the app's lead a request is waiting on them. Silent when there is none. */
async function notifyFiled(requestId: string, appId: string, requesterId: string): Promise<void> {
  try {
    const [app] = await db.select({ leadId: liveApps.leadId }).from(liveApps).where(eq(liveApps.id, appId))
    if (!app?.leadId) return
    await createNotifications([
      {
        userId: app.leadId,
        actorId: requesterId,
        type: 'system',
        kind: 'change_request.filed',
        title: 'A change is waiting on your sign-off',
        link: '/admin/approvals',
        entity: { type: 'change_request', id: requestId },
        params: { requestId, requesterId },
      },
    ])
  } catch (error) {
    console.warn(`[change-requests] notify failed for ${requestId}`, error)
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

    const leadId = request.entityType === 'app' ? await leadIdFor(request.appId) : null
    if (!mayReview(actor, { ...request, leadId })) return err('Not allowed')
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

    // After the batch, never inside it — best-effort, must never fail the
    // decision that already landed. The batch's own activityLog insert is
    // the record of the approval; a lost notification is not a lost approval.
    await notifyDecision(request.id, request.requesterId, actor.id, 'approved', parsed.data.note)

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
    const leadId = request.entityType === 'app' ? await leadIdFor(request.appId) : null
    if (!mayReview(actor, { ...request, leadId })) return err('Not allowed')

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

    await notifyDecision(request.id, request.requesterId, actor.id, 'rejected', parsed.data.note)

    revalidatePath('/admin', 'layout')
    return ok(undefined)
  } catch (error) {
    return unexpected('rejectChangeRequest', error)
  }
}

/**
 * Tells the requester how their request was decided. Called after the write
 * batch in both approveChangeRequest and rejectChangeRequest, never inside
 * it — createNotifications already swallows its own errors (see notify.ts's
 * docblock), but the try/catch here is the contract this function promises
 * its callers: a notify failure is logged, never thrown, never the reason an
 * approval or rejection reports itself as failed.
 */
async function notifyDecision(
  requestId: string,
  requesterId: string,
  reviewerId: string,
  decision: 'approved' | 'rejected',
  note: string | undefined,
): Promise<void> {
  try {
    await createNotifications([
      {
        userId: requesterId,
        actorId: reviewerId,
        type: 'system',
        kind: `change_request.${decision}`,
        title: decision === 'approved' ? 'Your request was approved' : 'Your request was rejected',
        body: note ?? null,
        link: '/admin/approvals',
        entity: { type: 'change_request', id: requestId },
        params: { requestId, reviewerId, note: note ?? null },
      },
    ])
  } catch (error) {
    console.warn(`[change-requests] notify failed for ${requestId}`, error)
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

