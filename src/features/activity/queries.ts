import { cache } from 'react'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { activityLog, users } from '@/db/schema'
import { activityConditions } from '@/features/activity/filters'
import type { ActivityFilters, ActivityRow } from '@/features/activity/types'

/**
 * One page of the trail, newest first. `limit + 1` rows are fetched so the
 * caller knows whether a next page exists without a second count query; the
 * extra row is sliced off before returning.
 */
export async function listActivity(options: {
  limit: number
  filters?: ActivityFilters
  cursor?: { createdAt: Date; id: string }
}): Promise<{ rows: ActivityRow[]; hasMore: boolean }> {
  const rows = await db
    .select({
      id: activityLog.id,
      actorId: activityLog.actorId,
      actorName: users.name,
      actorAvatarUrl: users.avatarUrl,
      verb: activityLog.verb,
      entityType: activityLog.entityType,
      entityId: activityLog.entityId,
      entityLabel: activityLog.entityLabel,
      appId: activityLog.appId,
      appName: activityLog.appName,
      pagePath: activityLog.pagePath,
      detail: activityLog.detail,
      metadata: activityLog.metadata,
      createdAt: activityLog.createdAt,
    })
    .from(activityLog)
    .innerJoin(users, eq(activityLog.actorId, users.id))
    .where(activityConditions(options.filters ?? {}, options.cursor))
    .orderBy(desc(activityLog.createdAt), desc(activityLog.id))
    .limit(options.limit + 1)

  const hasMore = rows.length > options.limit
  return { rows: hasMore ? rows.slice(0, options.limit) : rows, hasMore }
}

/** The dashboard's Recent-activity card: latest N, no filters, no cursor. */
export const listRecentActivity = cache(async function listRecentActivity(limit = 10): Promise<ActivityRow[]> {
  const { rows } = await listActivity({ limit })
  return rows
})
