import { and, eq, gte, ilike, lt, lte, or, type SQL } from 'drizzle-orm'
import { activityLog } from '@/db/schema'
import type { ActivityFilters } from '@/features/activity/types'

/**
 * Layer 1 of /activity search: SQL narrowing over the WHOLE table.
 * Tokenises `q` on whitespace; every token must match (AND), and a token
 * matches if it appears in ANY of the trail's free-text columns (OR), via
 * case-insensitive `ilike('%token%')`. `%` and `_` are LIKE metacharacters —
 * escaping them (same backslash-escape as features/people/queries.ts) keeps
 * a query containing them literal instead of a wildcard.
 *
 * Deliberately typo-INTOLERANT: "meetign" matches nothing here, however the
 * pattern is built. That's Layer 2's job (features/activity/search.ts), run
 * in pure TS over the rows this layer returns — or, when this layer returns
 * none, over an unfiltered page (see the /activity page's fallback).
 *
 * Empty/whitespace-only input returns undefined — same "unfiltered, not
 * empty" contract as activityConditions below — so a blank search box never
 * turns the trail into an empty page.
 */
export function activitySearchCondition(q: string): SQL | undefined {
  const tokens = q.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return undefined

  const perToken = tokens.map((token) => {
    const pattern = `%${token.replace(/[\\%_]/g, '\\$&')}%`
    return or(
      ilike(activityLog.entityLabel, pattern),
      ilike(activityLog.detail, pattern),
      ilike(activityLog.verb, pattern),
      ilike(activityLog.entityType, pattern),
    )
  })
  return and(...perToken)
}

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
    activitySearchCondition(filters.q ?? ''),
    // Keyset pagination: at-or-older than the cursor's millisecond, with id
    // as the tiebreaker inside it.
    //
    // `lte`, NOT `lt`, and this is the whole subtlety. created_at is
    // timestamptz(6) filled by now(), but a JS Date carries milliseconds, so
    // the cursor round-trips as a FLOORED value: a boundary row stored at
    // 12:00:00.123456 encodes as …123. Under `lt` every row in
    // [.123000, .123456) — genuinely older, and never yet shown — fails the
    // strict comparison and is silently skipped forever, while the
    // `eq`-tiebreaker branch can only ever fire on the rare row whose
    // microseconds are exactly zero. Widening to `lte` keeps that whole
    // millisecond in play; the `lt(id)` tiebreaker (ids being the secondary
    // sort key) is what stops the boundary row repeating.
    cursor
      ? or(
          lt(activityLog.createdAt, cursor.createdAt),
          and(lte(activityLog.createdAt, cursor.createdAt), lt(activityLog.id, cursor.id)),
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

/**
 * One trail page, everywhere a page is fetched: the /activity page's first
 * render and the load-older server action must agree, or the keyset walk
 * skips or repeats rows at every seam.
 */
export const ACTIVITY_PAGE_SIZE = 30

/** What the /activity URL currently says, one string per filter. '' means "not filtered". */
export type ActivityParamState = {
  person: string
  type: string
  app: string
  from: string
  to: string
  q: string
}

/**
 * Builds the `/activity` query string from filter state. Shared by
 * ActivityFilterBar's `apply()` (every filter change) and the page's
 * Load-more link (same filters, plus a cursor) so the two can't drift apart —
 * the classic bug here is pagination silently dropping a filter (`q` most of
 * all, since it's the newest) on page two. One function, both call sites.
 */
export function activityParams(state: ActivityParamState, before?: string): URLSearchParams {
  const params = new URLSearchParams()
  if (state.person) params.set('person', state.person)
  if (state.type) params.set('type', state.type)
  if (state.app) params.set('app', state.app)
  if (state.from) params.set('from', state.from)
  if (state.to) params.set('to', state.to)
  if (state.q) params.set('q', state.q)
  if (before) params.set('before', before)
  return params
}
