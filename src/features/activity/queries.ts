import { cache } from 'react'
import { asc, desc, eq, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { activityLog, apps, users } from '@/db/schema'
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

/**
 * The people and apps that actually APPEAR in the trail — the /activity
 * filter lists.
 *
 * Deliberately derived from activity_log rather than from listActiveUsers /
 * listAssignableApps. Those describe who and what is live NOW, but the trail
 * is a record of the past: a teammate since deactivated, or an app since
 * archived or deleted, still owns rows here — and those are exactly the rows
 * someone reaches for the filter to find. Offering options that cannot match
 * while hiding the ones that can is the wrong way round.
 *
 * The app list reads the DENORMALIZED app_name off the log rows, so an app
 * that no longer exists still filters under the name it had. Actors join
 * `users` because actorId is a real foreign key (accounts are deactivated,
 * never deleted), which keeps renames correct.
 */
export const listActivityActors = cache(async function listActivityActors(): Promise<
  { id: string; name: string }[]
> {
  return db
    .selectDistinct({ id: activityLog.actorId, name: users.name })
    .from(activityLog)
    .innerJoin(users, eq(activityLog.actorId, users.id))
    .orderBy(asc(users.name))
})

export const listActivityApps = cache(async function listActivityApps(): Promise<
  { id: string; name: string }[]
> {
  // COALESCE, because the two sources fail in opposite directions: some call
  // sites record an appId with no appName (no name was in scope at the write
  // — see the task actions), while a since-deleted app has a name only on
  // the log row. Preferring the LIVE name also means a renamed app filters
  // under what it is called now.
  const name = sql<string | null>`coalesce(${apps.name}, ${activityLog.appName})`
  const rows = await db
    .selectDistinct({ id: activityLog.appId, name })
    .from(activityLog)
    .leftJoin(apps, eq(activityLog.appId, apps.id))
    .where(isNotNull(activityLog.appId))
    .orderBy(asc(name))
  // isNotNull narrows the ROWS, not the column's TypeScript type — and an id
  // with no name anywhere is unlabelable, so both are checked here.
  return rows.flatMap((row) => (row.id && row.name ? [{ id: row.id, name: row.name }] : []))
})

/** The dashboard's Recent-activity card: latest N, no filters, no cursor. */
export const listRecentActivity = cache(async function listRecentActivity(limit = 10): Promise<ActivityRow[]> {
  const { rows } = await listActivity({ limit })
  return rows
})
