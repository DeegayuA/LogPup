import { and, eq, gte, lt, lte, or, type SQL } from 'drizzle-orm'
import { activityLog } from '@/db/schema'
import type { ActivityFilters } from '@/features/activity/types'

/**
 * The WHERE clause for a trail read, built in one tested place. queries.ts is
 * a thin wrapper around this — the composition rules (which params produce
 * which conditions, how the keyset cursor works) are what's worth testing,
 * and they don't need a database to be tested.
 */
export function activityConditions(
  filters: ActivityFilters,
  cursor?: { createdAt: Date; id: string },
): SQL | undefined {
  const parts: (SQL | undefined)[] = [
    filters.actorId ? eq(activityLog.actorId, filters.actorId) : undefined,
    filters.entityType ? eq(activityLog.entityType, filters.entityType) : undefined,
    filters.appId ? eq(activityLog.appId, filters.appId) : undefined,
    filters.from ? gte(activityLog.createdAt, filters.from) : undefined,
    filters.to ? lte(activityLog.createdAt, filters.to) : undefined,
    // Keyset pagination: strictly older than the cursor row, with id as the
    // tiebreaker for rows sharing a timestamp (bulk writes in one action).
    cursor
      ? or(
          lt(activityLog.createdAt, cursor.createdAt),
          and(eq(activityLog.createdAt, cursor.createdAt), lt(activityLog.id, cursor.id)),
        )
      : undefined,
  ]
  const present = parts.filter((p): p is SQL => p !== undefined)
  if (present.length === 0) return undefined
  return and(...present)
}

/**
 * Cursor codec for the "Load more" link. `${iso}|${uuid}` — the iso timestamp
 * contains no `|`, so the first `|` splits unambiguously. Returns null for
 * anything malformed: a hand-edited URL degrades to page one, never a crash.
 */
export function encodeActivityCursor(row: { createdAt: Date; id: string }): string {
  return `${row.createdAt.toISOString()}|${row.id}`
}

// BOTH halves are validated, and the id half is validated as a UUID rather
// than merely as "non-empty". activity_log.id is a Postgres `uuid` column, so
// a cursor id of "garbage" is not a comparison that returns no rows — it is
// error 22P02 raised at bind time, thrown out of the page's Promise.all and
// rendered as the framework's crash screen. That is precisely the outcome the
// contract above promises never happens.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function decodeActivityCursor(
  raw: string | undefined,
): { createdAt: Date; id: string } | null {
  if (!raw) return null
  const split = raw.indexOf('|')
  if (split === -1) return null
  const createdAt = new Date(raw.slice(0, split))
  const id = raw.slice(split + 1)
  if (Number.isNaN(createdAt.getTime()) || !UUID.test(id)) return null
  return { createdAt, id }
}
