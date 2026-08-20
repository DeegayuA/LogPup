import { z } from 'zod'
import { isoDayDiff, isoDayOf } from '@/features/people/iso-day'

/**
 * Everything /admin/audit needs to turn a URL into a question and back again:
 * the param codec, the sort whitelist, the page arithmetic, and the rule that
 * decides which of the two empty states the reader is looking at.
 *
 * PURE, and separate from audit-queries.ts on purpose. This is the half that
 * can be wrong in ways a database would never catch — a sort key that reaches
 * SQL unchecked, a "clear filters" link that quietly keeps one, a page-two
 * link that drops the search. Keeping it here means all of that is unit-tested
 * without a connection.
 *
 * STATE LIVES IN THE URL, nowhere else — same rule as /activity. A filtered
 * audit view is evidence someone pastes into a review; it has to survive a
 * refresh and a share.
 */

/**
 * The ONLY column names that may reach ORDER BY. audit-queries.ts maps these
 * three keys to drizzle columns; nothing else in the system turns a request
 * value into a sort. A whitelist rather than a validated column name because
 * the audit log is the record of who did what — the surface that reads it must
 * not be the one place a request string becomes SQL.
 */
export const AUDIT_SORT_KEYS = ['time', 'actor', 'entity'] as const
export type AuditSortKey = (typeof AUDIT_SORT_KEYS)[number]

export const AUDIT_SORT_DIRECTIONS = ['asc', 'desc'] as const
export type AuditSortDir = (typeof AUDIT_SORT_DIRECTIONS)[number]

export const AUDIT_SORT_LABELS: Record<AuditSortKey, string> = {
  time: 'When',
  actor: 'Who',
  entity: 'What',
}

export const DEFAULT_AUDIT_SORT: AuditSortKey = 'time'

/**
 * Each key's natural first press. Time wants newest first — an audit opens on
 * "what just happened". Names want A–Z. Pressing a key already sorted flips
 * it (see nextAuditDir), so the default is only ever the entry point.
 */
export function defaultAuditDir(sort: AuditSortKey): AuditSortDir {
  return sort === 'time' ? 'desc' : 'asc'
}

/** Clicking the active sort key flips it; clicking another adopts its default. */
export function nextAuditDir(
  current: { sort: AuditSortKey; dir: AuditSortDir },
  next: AuditSortKey,
): AuditSortDir {
  if (current.sort !== next) return defaultAuditDir(next)
  return current.dir === 'asc' ? 'desc' : 'asc'
}

/**
 * One page, and the hard ceiling on how deep a link may point.
 *
 * OFFSET pagination, not the keyset cursor /activity uses, and that is a
 * deliberate difference: a keyset cursor encodes a position in ONE ordering,
 * and this surface lets the reader re-sort by actor or entity. The cap is what
 * keeps offset honest — `page` is clamped to AUDIT_MAX_PAGE, so no URL can ask
 * Postgres to count past 10,000 rows, and the UI always states the bound
 * ("Showing 51–100 of 312") rather than truncating in silence.
 */
export const AUDIT_PAGE_SIZE = 50
export const AUDIT_MAX_PAGE = 200

/** What the /admin/audit URL currently says. '' means "not filtered". */
export type AuditParamState = {
  q: string
  actor: string
  type: string
  verb: string
  from: string
  to: string
  /** Only rows a superadmin signed for their own request. */
  self: boolean
  sort: AuditSortKey
  dir: AuditSortDir
  page: number
}

/**
 * Every param degrades rather than throws, but note where this DIFFERS from
 * /activity: there an unrecognised `type` falls back to "not filtered", here
 * it stays a filter that simply matches nothing.
 *
 * The reason is what each page is for. A feed showing more rows than asked is
 * a harmless nicety; an audit that silently WIDENS a filter is the surface
 * telling a reviewer "no self-approvals by Alex" when it never asked the
 * question. entity_type and verb are text columns holding open vocabularies
 * (see activity/types.ts), so "matches nothing" is also the truthful answer
 * for a value that genuinely never occurred.
 *
 * `actor` is the exception and must remain one: actor_id is a Postgres `uuid`,
 * so a non-UUID reaches bind time as error 22P02 — a crash, not an empty page.
 * It degrades to unfiltered, the same way /activity's does.
 */
const auditParamsSchema = z.object({
  q: z.string().trim().min(1).max(200).optional().catch(undefined),
  actor: z.uuid().optional().catch(undefined),
  type: z.string().trim().min(1).max(64).optional().catch(undefined),
  verb: z.string().trim().min(1).max(64).optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  self: z.literal('1').optional().catch(undefined),
  sort: z.enum(AUDIT_SORT_KEYS).optional().catch(undefined),
  dir: z.enum(AUDIT_SORT_DIRECTIONS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(AUDIT_MAX_PAGE).catch(1),
})

/** Next's `searchParams` hands back `string | string[] | undefined` per key. */
export type RawSearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** The URL, normalised into the one shape every link builder and query expects. */
export function parseAuditParams(raw: RawSearchParams): AuditParamState {
  const parsed = auditParamsSchema.parse({
    q: first(raw.q),
    actor: first(raw.actor),
    type: first(raw.type),
    verb: first(raw.verb),
    from: first(raw.from),
    to: first(raw.to),
    self: first(raw.self),
    sort: first(raw.sort),
    dir: first(raw.dir),
    page: first(raw.page),
  })
  const sort = parsed.sort ?? DEFAULT_AUDIT_SORT
  // A backwards range is the one filter combination that can only ever return
  // nothing while looking like a real question. Swapping reads the reader's
  // intent instead of handing back a mystery empty page.
  const range = swapIfBackwards(parsed.from, parsed.to)
  return {
    q: parsed.q ?? '',
    actor: parsed.actor ?? '',
    type: parsed.type ?? '',
    verb: parsed.verb ?? '',
    from: range.from,
    to: range.to,
    self: parsed.self === '1',
    sort,
    dir: parsed.dir ?? defaultAuditDir(sort),
    page: parsed.page,
  }
}

function swapIfBackwards(from?: string, to?: string): { from: string; to: string } {
  if (from && to && from > to) return { from: to, to: from }
  return { from: from ?? '', to: to ?? '' }
}

/**
 * The query string, built in ONE place so the filter bar, the sort headers,
 * the pager and the clear-filters link cannot drift apart. The classic bug
 * this prevents is page two, or a re-sort, quietly dropping `q`.
 *
 * Defaults are omitted, so the unfiltered newest-first view has no query
 * string at all and that is the page's canonical URL.
 */
export function auditQueryString(state: AuditParamState): string {
  const params = new URLSearchParams()
  if (state.q) params.set('q', state.q)
  if (state.actor) params.set('actor', state.actor)
  if (state.type) params.set('type', state.type)
  if (state.verb) params.set('verb', state.verb)
  if (state.from) params.set('from', state.from)
  if (state.to) params.set('to', state.to)
  if (state.self) params.set('self', '1')
  if (state.sort !== DEFAULT_AUDIT_SORT) params.set('sort', state.sort)
  if (state.dir !== defaultAuditDir(state.sort)) params.set('dir', state.dir)
  if (state.page > 1) params.set('page', String(state.page))
  return params.toString()
}

export const AUDIT_PATH = '/admin/audit'

/**
 * A link that changes part of the question and keeps the rest.
 *
 * `page` resets to 1 on every patch that does not name a page explicitly:
 * page four of the old filter is not a page of the new one, and landing on an
 * empty page four is the single most common way a filtered table looks broken.
 */
export function auditHref(current: AuditParamState, patch: Partial<AuditParamState>): string {
  const next: AuditParamState = { ...current, ...patch, page: patch.page ?? 1 }
  const qs = auditQueryString(next)
  return qs ? `${AUDIT_PATH}?${qs}` : AUDIT_PATH
}

/** The href for a sort header — same filters, flipped or adopted direction, page one. */
export function auditSortHref(current: AuditParamState, sort: AuditSortKey): string {
  return auditHref(current, { sort, dir: nextAuditDir(current, sort) })
}

/**
 * Is the reader looking at a NARROWED view? Sort and page deliberately do not
 * count: neither hides a row, so neither belongs behind "Clear filters", and a
 * reader who re-sorted then cleared should keep the order they chose.
 */
export function hasAuditFilters(state: AuditParamState): boolean {
  return Boolean(
    state.q || state.actor || state.type || state.verb || state.from || state.to || state.self,
  )
}

/** Everything cleared, sort kept. */
export function clearedAuditState(state: AuditParamState): AuditParamState {
  return { ...state, q: '', actor: '', type: '', verb: '', from: '', to: '', self: false, page: 1 }
}

export function clearAuditFiltersHref(state: AuditParamState): string {
  const qs = auditQueryString(clearedAuditState(state))
  return qs ? `${AUDIT_PATH}?${qs}` : AUDIT_PATH
}

/**
 * WHICH empty state. Three different facts, three different sentences, and
 * each one needs a different action under it — or none:
 *
 * - `past-end` — the filters match plenty, this PAGE is simply past the last
 *   one. A stale bookmark or a hand-edited `?page=` lands here, and telling
 *   that reader "nothing recorded yet" is a flat lie about the workspace.
 *   Checked first, because it is true regardless of the filters.
 * - `no-data`  — a statement about the WORKSPACE: nothing has been recorded.
 *   Nothing to clear, so nothing is offered.
 * - `no-match` — a statement about the FILTERS. The only one with an undo.
 *
 * `unfilteredTotal` is what the page learns by re-asking WITHOUT filters, and
 * it is only ever asked when a filtered read matched nothing at all, so the
 * common path costs nothing. `null` means "not asked": with filters on,
 * blaming the filters is the safe guess, because that is the state the reader
 * can actually do something about.
 */
export function auditEmptyKind(input: {
  anyFilter: boolean
  unfilteredTotal: number | null
  /** Rows matching the CURRENT filters, across every page. */
  matchingTotal?: number
  page?: number
}): 'no-data' | 'no-match' | 'past-end' {
  if ((input.page ?? 1) > 1 && (input.matchingTotal ?? 0) > 0) return 'past-end'
  if (!input.anyFilter) return 'no-data'
  if (input.unfilteredTotal === 0) return 'no-data'
  return 'no-match'
}

export function auditPageCount(total: number, pageSize = AUDIT_PAGE_SIZE): number {
  if (total <= 0) return 1
  return Math.max(1, Math.ceil(total / pageSize))
}

/**
 * "Showing 51–100 of 312" — the house pattern (see PER_SOURCE_LIMIT's footnote
 * in trash-card-logic.ts). Never silently truncated: every bounded read on
 * this page states its bound, including the one imposed by AUDIT_MAX_PAGE.
 */
export function auditRangeLabel(input: {
  page: number
  shown: number
  total: number
  pageSize?: number
}): string {
  const pageSize = input.pageSize ?? AUDIT_PAGE_SIZE
  if (input.total === 0 || input.shown === 0) return 'No entries'
  const start = (input.page - 1) * pageSize + 1
  const end = start + input.shown - 1
  if (input.total <= input.shown && input.page === 1) {
    return `Showing all ${input.total} ${input.total === 1 ? 'entry' : 'entries'}`
  }
  return `Showing ${start}–${end} of ${input.total}`
}

/**
 * The reachable ceiling, stated when a result set runs past it. AUDIT_MAX_PAGE
 * exists so an offset stays bounded; a reader who hits it has to be told the
 * rest is behind a narrower filter, not left believing the trail ends there.
 */
export function auditDepthNotice(total: number): string | null {
  const reachable = AUDIT_MAX_PAGE * AUDIT_PAGE_SIZE
  if (total <= reachable) return null
  return `Only the first ${reachable.toLocaleString('en-US')} entries are reachable by paging. Narrow the date range or search to reach the rest.`
}

/**
 * Day grouping is a claim about chronological adjacency, so it holds only
 * while the rows are IN chronological order. Sorted by actor or entity the
 * rows are a ranked list and a day header over them would be a lie about
 * what the page is showing — the same call /activity makes for search results.
 */
export function shouldGroupAuditByDay(sort: AuditSortKey): boolean {
  return sort === 'time'
}

export type AuditDayGroup<T> = {
  /** `YYYY-MM-DD` in the business timezone. */
  dayIso: string
  relativeLabel: 'Today' | 'Yesterday' | ''
  rows: T[]
}

/**
 * Rows bucketed by business-timezone calendar day, in the order given.
 * Works for either direction — oldest-first pages group just as correctly as
 * newest-first ones, because a bucket is only ever broken by a change of day.
 * Pure: "now" is a parameter so tests never read the wall clock.
 */
export function groupAuditByDay<T extends { createdAt: Date }>(
  rows: readonly T[],
  now: Date,
): AuditDayGroup<T>[] {
  const todayIso = isoDayOf(now)
  const groups: AuditDayGroup<T>[] = []
  for (const row of rows) {
    const dayIso = isoDayOf(row.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.dayIso === dayIso) {
      last.rows.push(row)
      continue
    }
    const age = isoDayDiff(todayIso, dayIso)
    groups.push({
      dayIso,
      relativeLabel: age === 0 ? 'Today' : age === 1 ? 'Yesterday' : '',
      rows: [row],
    })
  }
  return groups
}

// Colombo is UTC+05:30 year-round (no DST — iso-day.ts leans on the same
// fact), so a calendar-day bound converts to an instant with a fixed offset.
// Restated here rather than imported from /activity's page: these two bounds
// are what make a date filter mean the same thing on both surfaces, and a
// page-local copy is exactly how they would drift.
export function colomboDayStart(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00+05:30`)
}

export function colomboDayEnd(isoDay: string): Date {
  return new Date(`${isoDay}T23:59:59.999+05:30`)
}
