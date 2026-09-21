import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { liveApps } from '@/db/live'
import { changeRequests, users } from '@/db/schema'
import { mayReview } from '@/features/admin/change-request-routing'
import { can, type Actor } from '@/features/auth/capabilities'

export type InboxRequest = {
  id: string
  requesterId: string
  requesterName: string
  entityType: string
  entityId: string
  entityLabel: string
  operation: string
  reason: string
  appId: string | null
  status: string
  createdAt: string
  /** True when the requester is the reviewer — legitimate only for a superadmin. */
  isSelf: boolean
}

const select = {
  id: changeRequests.id,
  requesterId: changeRequests.requesterId,
  requesterName: users.name,
  entityType: changeRequests.entityType,
  entityId: changeRequests.entityId,
  entityLabel: changeRequests.entityLabel,
  operation: changeRequests.operation,
  reason: changeRequests.reason,
  appId: changeRequests.appId,
  status: changeRequests.status,
  createdAt: changeRequests.createdAt,
  payload: changeRequests.payload,
}

/**
 * Requests this actor may actually sign.
 *
 * Filtered through `mayReview`, the same pure rule the approve action uses, so
 * the inbox can never show a row whose approve button would be refused — and a
 * worklog correction only ever appears for the row's owner.
 *
 * `leadId` comes along for free via the `leftJoin` below (no extra query) so
 * an app-entity request's lead branch in `mayReview` has something to check —
 * `changeRequests` itself has no `leadId` column, that fact lives on `apps`.
 * Joined through `liveApps`, not the raw table — an inbox row must not surface
 * the lead of an app that was itself trashed (db/live.test.ts's static scan
 * enforces this for every soft-deleted table, `apps` included).
 */
export async function getApprovalsInbox(actor: Actor): Promise<InboxRequest[]> {
  const rows = await db
    .select({ ...select, leadId: liveApps.leadId })
    .from(changeRequests)
    .innerJoin(users, eq(users.id, changeRequests.requesterId))
    .leftJoin(liveApps, eq(liveApps.id, changeRequests.appId))
    .where(eq(changeRequests.status, 'pending'))
    .orderBy(changeRequests.createdAt)

  return rows
    .filter((r) =>
      mayReview(actor, {
        requesterId: r.requesterId,
        appId: r.appId,
        entityType: r.entityType,
        status: r.status,
        ownerId: (r.payload as { before?: { userId?: string } })?.before?.userId,
        leadId: r.leadId,
      }),
    )
    .map(toInbox(actor))
}

/** The requester's own view: what they proposed and where it stands. */
export async function getMyRequests(actor: Actor, limit = 25): Promise<InboxRequest[]> {
  if (!can(actor, 'request.create', { ownerId: actor.id })) return []
  const rows = await db
    .select(select)
    .from(changeRequests)
    .innerJoin(users, eq(users.id, changeRequests.requesterId))
    .where(eq(changeRequests.requesterId, actor.id))
    .orderBy(desc(changeRequests.createdAt))
    .limit(limit)
  return rows.map(toInbox(actor))
}

const toInbox = (actor: Actor) => (r: {
  id: string; requesterId: string; requesterName: string; entityType: string
  entityId: string; entityLabel: string; operation: string; reason: string
  appId: string | null; status: string; createdAt: Date
}): InboxRequest => ({
  id: r.id,
  requesterId: r.requesterId,
  requesterName: r.requesterName,
  entityType: r.entityType,
  entityId: r.entityId,
  entityLabel: r.entityLabel,
  operation: r.operation,
  reason: r.reason,
  appId: r.appId,
  status: r.status,
  createdAt: r.createdAt.toISOString().slice(0, 10),
  isSelf: r.requesterId === actor.id,
})
