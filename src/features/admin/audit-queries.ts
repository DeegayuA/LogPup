import { cache } from 'react'
import { and, asc, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/db'
import { liveApps } from '@/db/live'
import { activityLog, users } from '@/db/schema'
import {
  AUDIT_PAGE_SIZE,
  colomboDayEnd,
  colomboDayStart,
  defaultAuditDir,
  type AuditParamState,
  type AuditSortDir,
  type AuditSortKey,
} from '@/features/admin/audit-filters'
import { can, type Actor } from '@/features/auth/capabilities'

export type AuditEntry = {
  id: string
  actorId: string
  actorName: string
  actorAvatarUrl: string | null
  verb: string
  entityType: string
  entityId: string
  entityLabel: string | null
  appId: string | null
  appName: string | null
  pagePath: string | null
  detail: string | null
  metadata: Record<string, unknown> | null
  createdAt: Date
  selfApproved: boolean
}

export type AuditPage = {
  rows: AuditEntry[]
  /** Rows matching the filters, not rows returned — the "of M" in the UI. */
  total: number
  page: number
  pageSize: number
}

/**
 * The compliance read of activity_log.
 *
 * Distinct from /activity, which is the shared feed. This one surfaces
 * `metadata.selfApproved`, which is how a review finds requests signed by the
 * person who filed them — legitimate for a superadmin, and exactly what an
 * auditor is looking for. That is why the flag is both RETURNED on every row
 * and offered as a filter of its own: a surface that can show self-approvals
 * but cannot isolate them makes the reviewer read every page to find three.
 *
 * SECURITY: every value that comes from the request reaches SQL through a
 * drizzle helper (eq/ilike/gte/lte) and therefore as a bind parameter. The one
 * place a request value could pick SQL rather than fill it is ORDER BY, and
 * that goes through the closed AUDIT_SORT_KEYS whitelist below — a request
 * string is never a column name, and no filter is ever interpolated into
 * sql``. audit-queries.test.ts pins both.
 */
function canReadAudit(actor: Actor): boolean {
  // Unchanged from the original guard. `audit.view` is 'all' for superadmin,
  // admin and auditor and 'scoped' for a manager, and a scoped grant asked
  // without a resource fails closed — which is the intended answer here: the
  // audit trail is the WHOLE workspace's record, and there is no per-app slice
  // of it that would still be an audit.
  return can(actor, 'audit.view') || can(actor, 'audit.view', { appId: null })
}

const EMPTY_PAGE: AuditPage = { rows: [], total: 0, page: 1, pageSize: AUDIT_PAGE_SIZE }

/**
 * Free-text narrowing, done in SQL over the WHOLE table rather than by
 * filtering a page in JS — a search that only sees the 50 rows already
 * fetched is not a search, and on an audit trail it is a wrong answer.
 *
 * Tokenised on whitespace; every token must match (AND), and a token matches
 * if it appears in ANY of the columns a reader can see (OR). `%` and `_` are
 * LIKE metacharacters, so they are backslash-escaped — a query containing them
 * stays literal instead of becoming a wildcard. Same construction as
 * features/activity/filters.ts, widened by the two columns this surface shows
 * and that one does not: the actor's NAME (searching "alex" is the first thing
 * anyone types into an audit) and the app.
 */
export function auditSearchCondition(q: string): SQL | undefined {
  const tokens = q.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return undefined

  const perToken = tokens.map((token) => {
    const pattern = `%${token.replace(/[\\%_]/g, '\\$&')}%`
    return or(
      ilike(users.name, pattern),
      ilike(activityLog.entityLabel, pattern),
      ilike(activityLog.detail, pattern),
      ilike(activityLog.verb, pattern),
      ilike(activityLog.entityType, pattern),
      // Both app names, for the reason listActivityApps documents: ~31 call
      // sites record an appId with no app_name in scope, while a since-deleted
      // app has a name ONLY on the log row. Searching one of them alone misses
      // whichever half of the trail the other covers.
      ilike(liveApps.name, pattern),
      ilike(activityLog.appName, pattern),
    )
  })
  return and(...perToken)
}

/**
 * The WHERE clause, built in one tested place.
 *
 * `type` and `verb` are compared with `eq` against text columns holding open
 * vocabularies, so a value that never occurred simply matches nothing — see
 * audit-filters.ts on why this surface narrows rather than widens on an
 * unrecognised value.
 */
export function auditConditions(state: AuditParamState): SQL | undefined {
  const parts: (SQL | undefined)[] = [
    state.actor ? eq(activityLog.actorId, state.actor) : undefined,
    state.type ? eq(activityLog.entityType, state.type) : undefined,
    state.verb ? eq(activityLog.verb, state.verb) : undefined,
    state.from ? gte(activityLog.createdAt, colomboDayStart(state.from)) : undefined,
    state.to ? lte(activityLog.createdAt, colomboDayEnd(state.to)) : undefined,
    // The literal 'true' here is this module's own constant, never request
    // text. `->>` yields text, so a JSON boolean compares as the string.
    state.self ? sql`${activityLog.metadata}->>'selfApproved' = 'true'` : undefined,
    auditSearchCondition(state.q),
  ]
  const present = parts.filter((p): p is SQL => p !== undefined)
  if (present.length === 0) return undefined
  return and(...present)
}

/**
 * The sort whitelist. THREE entries, and a request value may only ever select
 * one of them — it can never become one.
 *
 * Every ordering ends with created_at desc, id desc. Without a total order the
 * same row can appear on two pages (or on none) as Postgres re-picks a plan
 * between the count and the page, which on an audit trail reads as evidence
 * appearing or vanishing.
 */
export function auditOrderBy(sort: AuditSortKey, dir: AuditSortDir): SQL[] {
  const direction = dir === 'asc' ? asc : desc
  const tiebreak = [desc(activityLog.createdAt), desc(activityLog.id)]
  if (sort === 'actor') return [direction(users.name), ...tiebreak]
  if (sort === 'entity') return [direction(activityLog.entityType), direction(activityLog.entityLabel), ...tiebreak]
  return [direction(activityLog.createdAt), desc(activityLog.id)]
}

/**
 * One page of the audit trail, plus how many rows the filters actually match.
 *
 * OFFSET, not the keyset cursor /activity uses: the reader chooses the sort
 * here, and a cursor encodes a position in one ordering only. The count is a
 * second query rather than a window function so the two can run in parallel,
 * and it carries the SAME joins as the row query because the search touches
 * users.name and the apps subquery — a count over different joins is a
 * different number.
 */
export async function listAuditTrail(
  actor: Actor,
  state: AuditParamState,
  pageSize = AUDIT_PAGE_SIZE,
): Promise<AuditPage> {
  if (!canReadAudit(actor)) return { ...EMPTY_PAGE, pageSize }

  const where = auditConditions(state)
  const offset = (state.page - 1) * pageSize

  const [rows, totals] = await Promise.all([
    db
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
        // Prefer the LIVE name so a renamed app reads under what it is called
        // now, and fall back to the denormalised one so a deleted app still
        // reads under the name it had. Same COALESCE as activity/queries.ts.
        appName: sql<string | null>`coalesce(${liveApps.name}, ${activityLog.appName})`,
        pagePath: activityLog.pagePath,
        detail: activityLog.detail,
        metadata: activityLog.metadata,
        createdAt: activityLog.createdAt,
      })
      .from(activityLog)
      .innerJoin(users, eq(users.id, activityLog.actorId))
      // LEFT, not inner: app_id has no foreign key (a log row must survive its
      // app's deletion), and most rows have no app at all.
      .leftJoin(liveApps, eq(activityLog.appId, liveApps.id))
      .where(where)
      .orderBy(...auditOrderBy(state.sort, state.dir))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ total: count() })
      .from(activityLog)
      .innerJoin(users, eq(users.id, activityLog.actorId))
      .leftJoin(liveApps, eq(activityLog.appId, liveApps.id))
      .where(where),
  ])

  return {
    rows: rows.map(toAuditEntry),
    total: Number(totals[0]?.total ?? 0),
    page: state.page,
    pageSize,
  }
}

type AuditRowShape = Omit<AuditEntry, 'selfApproved'> & { metadata: Record<string, unknown> | null }

function toAuditEntry(row: AuditRowShape): AuditEntry {
  return {
    ...row,
    selfApproved: (row.metadata as { selfApproved?: boolean } | null)?.selfApproved === true,
  }
}

/**
 * How many rows exist AT ALL. Asked only when a filtered read came back empty,
 * so the page can tell "nothing has been recorded yet" apart from "nothing
 * matches what you asked" — two different sentences, and only the second one
 * has a clear-filters button under it.
 */
export async function countAuditTrail(actor: Actor): Promise<number> {
  if (!canReadAudit(actor)) return 0
  const rows = await db.select({ total: count() }).from(activityLog)
  return Number(rows[0]?.total ?? 0)
}

export type AuditFacets = {
  actors: { id: string; name: string }[]
  verbs: string[]
  types: string[]
}

/**
 * The filter bar's option lists — derived from the TRAIL, never from the live
 * roster or from the ACTIVITY_VERBS constant.
 *
 * Same reasoning as listActivityActors: a deactivated teammate still owns rows
 * here and is exactly who a review reaches for the filter to find. Verbs and
 * entity types come from the log for the mirror-image reason — both columns
 * are text with open vocabularies (activity/types.ts), so the constant lists
 * what code MEANS to write while the log holds what was actually written.
 * Offering options that cannot match, while hiding the ones that can, is the
 * wrong way round.
 */
export const listAuditFacets = cache(async function listAuditFacets(
  actor: Actor,
): Promise<AuditFacets> {
  if (!canReadAudit(actor)) return { actors: [], verbs: [], types: [] }

  const [actors, vocab] = await Promise.all([
    db
      .selectDistinct({ id: activityLog.actorId, name: users.name })
      .from(activityLog)
      .innerJoin(users, eq(users.id, activityLog.actorId))
      .orderBy(asc(users.name)),
    // One pass for both columns: the distinct (verb, entity_type) pairs number
    // in the dozens, so splitting them here is cheaper than a second query.
    db
      .selectDistinct({ verb: activityLog.verb, entityType: activityLog.entityType })
      .from(activityLog)
      .orderBy(asc(activityLog.verb), asc(activityLog.entityType)),
  ])

  return {
    actors,
    verbs: [...new Set(vocab.map((row) => row.verb))].sort(),
    types: [...new Set(vocab.map((row) => row.entityType))].sort(),
  }
})

/**
 * Retained for callers that only want "the latest N, newest first" without a
 * URL behind them. Kept as a thin wrapper over listAuditTrail so there is one
 * query, one guard and one row shape on this table's compliance read.
 */
export async function listRecentAudit(actor: Actor, limit = AUDIT_PAGE_SIZE): Promise<AuditEntry[]> {
  const { rows } = await listAuditTrail(
    actor,
    {
      q: '', actor: '', type: '', verb: '', from: '', to: '', self: false,
      sort: 'time', dir: defaultAuditDir('time'), page: 1,
    },
    limit,
  )
  return rows
}
