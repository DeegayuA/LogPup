import { eq } from 'drizzle-orm'
import { cache } from 'react'
import { db } from '@/db'
import { liveApps } from '@/db/live'
import { assignments } from '@/db/schema'

/**
 * The apps this person is assigned to — what "my projects" means on the
 * dashboard for a seat whose grant is `all`.
 *
 * NOT `actor.scopeAppIds`. loadActor leaves that EMPTY for superadmin, admin
 * and auditor on purpose — their grants never consult scope — and zones.ts
 * documents the inversion that filtering on it would cause. This answers a
 * different question, "where do you work", from the same assignments rows a
 * member's scope is built from.
 *
 * Request-cached: the page asks once and hands the set to every zone.
 */
export const getMyAppIds = cache(async function getMyAppIds(
  userId: string,
): Promise<ReadonlySet<string>> {
  const rows = await db
    .select({ appId: assignments.appId })
    .from(assignments)
    // Through the live view: an assignment to a trashed app is not a project
    // anybody can be shown, and counting it would leave "my projects" empty
    // while the switch still offered something to widen from.
    .innerJoin(liveApps, eq(liveApps.id, assignments.appId))
    .where(eq(assignments.userId, userId))
  return new Set(rows.map((row) => row.appId))
})
