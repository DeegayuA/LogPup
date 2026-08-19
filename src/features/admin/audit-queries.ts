import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { activityLog, users } from '@/db/schema'
import { can, type Actor } from '@/features/auth/capabilities'

export type AuditEntry = {
  id: string
  actorName: string
  verb: string
  entityType: string
  entityLabel: string | null
  at: string
  selfApproved: boolean
}

/**
 * The compliance read of activity_log.
 *
 * Distinct from /activity, which is the shared feed. This one surfaces
 * `metadata.selfApproved`, which is how a review finds requests signed by the
 * person who filed them — legitimate for a superadmin, and exactly what an
 * auditor is looking for.
 */
export async function listAuditTrail(actor: Actor, limit = 100): Promise<AuditEntry[]> {
  if (!can(actor, 'audit.view') && !can(actor, 'audit.view', { appId: null })) return []

  const rows = await db
    .select({
      id: activityLog.id,
      actorName: users.name,
      verb: activityLog.verb,
      entityType: activityLog.entityType,
      entityLabel: activityLog.entityLabel,
      createdAt: activityLog.createdAt,
      metadata: activityLog.metadata,
    })
    .from(activityLog)
    .innerJoin(users, eq(users.id, activityLog.actorId))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    actorName: r.actorName,
    verb: r.verb,
    entityType: r.entityType,
    entityLabel: r.entityLabel,
    at: r.createdAt.toISOString().slice(0, 16).replace('T', ' '),
    selfApproved: (r.metadata as { selfApproved?: boolean } | null)?.selfApproved === true,
  }))
}
