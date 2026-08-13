/**
 * The /apps index's entire browse state — status filter, text query, tech-tag
 * facet and sort order — expressed as URL search params, plus the pure
 * filter/sort that turns those params into the grid you see.
 *
 * WHY THE URL AND NOT `useState`
 * The previous browser kept both filters in component state. That meant a
 * reload, a back button, a ⌘-click into an app and back, or pasting "look at
 * this, it's on fire" into chat all silently dropped what you were looking at.
 * Search params survive every one of those for free, and they let the page
 * stay a server component — the grid is rendered on the server for the exact
 * URL requested, so there is no client-side filtering bundle at all.
 *
 * NORMALISATION IS ONE-WAY AND TOTAL: `parseBrowseParams` never throws and
 * never returns something the rest of the module can't handle. A hand-edited
 * `?sort=banana` degrades to the default rather than erroring, because a
 * malformed URL is a 200-with-defaults situation, not a 500.
 */

import type { AppHealth, AppStatus, AppTaskCounts } from '@/features/apps/app-health'
import { completionPct } from '@/features/apps/app-health'

export const APP_SORTS = ['risk', 'activity', 'progress', 'name'] as const
export type AppSort = (typeof APP_SORTS)[number]

export const SORT_LABEL: Record<AppSort, string> = {
  risk: 'Risk',
  activity: 'Recent',
  progress: 'Progress',
  name: 'Name',
}

/**
 * 'live' (active + paused) is the DEFAULT rather than "all": a workspace
 * accumulates dead projects forever, and interleaving them into the everyday
 * grid makes the whole page read as noisier than the work actually is.
 * Archived apps are still one click away, and the header strip always counts
 * the entire workspace, so nothing is hidden — only de-prioritised.
 */
export const APP_STATUS_FILTERS = ['live', 'active', 'paused', 'archived'] as const
export type AppStatusFilter = (typeof APP_STATUS_FILTERS)[number]

export const STATUS_FILTER_LABEL: Record<AppStatusFilter, string> = {
  live: 'Live',
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
}

export const DEFAULT_SORT: AppSort = 'risk'
export const DEFAULT_STATUS: AppStatusFilter = 'live'

/**
 * Health levels that can be filtered TO. Deliberately only the two that mean
 * "a human should look at this" — nobody has ever wanted to see a list of
 * exactly the healthy projects, and `dormant` is already reachable through the
 * Archived status chip.
 */
export const APP_RISK_FILTERS = ['at-risk', 'watch'] as const
export type AppRiskFilter = (typeof APP_RISK_FILTERS)[number]

export const RISK_FILTER_LABEL: Record<AppRiskFilter, string> = {
  'at-risk': 'At risk only',
  watch: 'Needs a look',
}

export type BrowseParams = {
  q: string
  status: AppStatusFilter
  sort: AppSort
  /** Exact tech tag to narrow to, or null. Matched case-insensitively. */
  tag: string | null
  /**
   * Narrow to apps at a given health level, or null for all of them.
   *
   * This exists because the header strip's "At risk: 3" tile used to link to
   * `?sort=risk&status=live` — both of which are the DEFAULTS, so on the page
   * you actually land on, that link was a no-op that advertised itself with a
   * "Sort by risk →" hint. A number you can't act on is worse than a number
   * with no affordance at all, so the tile now narrows the grid to the three
   * apps it is counting.
   */
  risk: AppRiskFilter | null
}

export const DEFAULT_BROWSE_PARAMS: BrowseParams = {
  q: '',
  status: DEFAULT_STATUS,
  sort: DEFAULT_SORT,
  tag: null,
  risk: null,
}

/** Next hands repeated params through as arrays; take the first and move on. */
function firstValue(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return raw[0] ?? ''
  return raw ?? ''
}

export function parseBrowseParams(
  raw: Record<string, string | string[] | undefined>,
): BrowseParams {
  const status = firstValue(raw.status) as AppStatusFilter
  const sort = firstValue(raw.sort) as AppSort
  const tag = firstValue(raw.tag).trim()
  const risk = firstValue(raw.risk) as AppRiskFilter
  return {
    q: firstValue(raw.q).trim(),
    status: APP_STATUS_FILTERS.includes(status) ? status : DEFAULT_STATUS,
    sort: APP_SORTS.includes(sort) ? sort : DEFAULT_SORT,
    tag: tag || null,
    risk: APP_RISK_FILTERS.includes(risk) ? risk : null,
  }
}

export function isDefaultBrowse(params: BrowseParams): boolean {
  return (
    params.q === '' &&
    params.tag === null &&
    params.risk === null &&
    params.status === DEFAULT_STATUS &&
    params.sort === DEFAULT_SORT
  )
}

/**
 * Builds `/apps?…` for `params` with `patch` applied. Defaults are OMITTED
 * from the output so the everyday URL stays a bare `/apps` — a link that
 * spells out `?q=&status=live&sort=risk` looks broken even when it isn't, and
 * it makes "am I filtered right now?" impossible to answer by glancing at the
 * address bar.
 */
export function browseHref(
  base: string,
  params: BrowseParams,
  patch: Partial<BrowseParams> = {},
): string {
  const next: BrowseParams = { ...params, ...patch }
  const search = new URLSearchParams()
  if (next.q) search.set('q', next.q)
  if (next.status !== DEFAULT_STATUS) search.set('status', next.status)
  if (next.sort !== DEFAULT_SORT) search.set('sort', next.sort)
  if (next.tag) search.set('tag', next.tag)
  if (next.risk) search.set('risk', next.risk)
  const query = search.toString()
  return query ? `${base}?${query}` : base
}

// ---------------------------------------------------------------------------
// Filtering + sorting
// ---------------------------------------------------------------------------

/** The shape the grid needs; `AppPortfolioEntry` satisfies it structurally. */
export type BrowsableApp = {
  name: string
  slug: string
  description: string | null
  status: AppStatus
  techTags: string[]
  members: readonly { name: string }[]
  leadName?: string | null
  pmName?: string | null
  health: AppHealth
  stats: {
    tasks: AppTaskCounts
    lastActivityAt: Date | null
  }
}

export function statusMatches(status: AppStatus, filter: AppStatusFilter): boolean {
  if (filter === 'live') return status !== 'archived'
  return status === filter
}

/**
 * Free-text match across everything a person might actually type: the app's
 * name and slug, its description, its tech tags, its PM and lead, and the
 * names of the people on it. The old browser searched name/slug/tags only, so
 * "who is Priya working on" and "the one about invoices" both came back empty
 * even though the answer was on screen.
 */
export function queryMatches(app: BrowsableApp, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  const haystack = [
    app.name,
    app.slug,
    app.description ?? '',
    app.leadName ?? '',
    app.pmName ?? '',
    ...app.techTags,
    ...app.members.map((member) => member.name),
  ]
  return haystack.some((value) => value.toLowerCase().includes(needle))
}

export function tagMatches(app: BrowsableApp, tag: string | null): boolean {
  if (!tag) return true
  const needle = tag.toLowerCase()
  return app.techTags.some((value) => value.toLowerCase() === needle)
}

/**
 * `watch` deliberately INCLUDES `at-risk`: "show me what needs a look" that
 * hides the worst offenders would be a trap. `at-risk` stays exact.
 */
export function riskMatches(app: BrowsableApp, risk: AppRiskFilter | null): boolean {
  if (!risk) return true
  if (risk === 'watch') return app.health.level === 'watch' || app.health.level === 'at-risk'
  return app.health.level === risk
}

export function filterApps<T extends BrowsableApp>(
  apps: readonly T[],
  params: BrowseParams,
): T[] {
  return apps.filter(
    (app) =>
      statusMatches(app.status, params.status) &&
      queryMatches(app, params.q) &&
      tagMatches(app, params.tag) &&
      riskMatches(app, params.risk),
  )
}

function activityMs(app: BrowsableApp): number {
  return app.stats.lastActivityAt ? app.stats.lastActivityAt.getTime() : -1
}

/**
 * Sorting is total and stable-by-name: every comparator falls through to
 * `localeCompare` so two apps with identical scores never swap places between
 * renders (which, on a server-rendered grid, would look like the page
 * reshuffling itself for no reason).
 *
 * Archived apps sink to the bottom of every order. When you have explicitly
 * filtered TO archived they are all that's left, so the rule costs nothing
 * there and keeps the 'live' and mixed views focused on live work.
 */
export function sortApps<T extends BrowsableApp>(apps: readonly T[], sort: AppSort): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name)
  return [...apps].sort((a, b) => {
    const archivedDelta =
      Number(a.status === 'archived') - Number(b.status === 'archived')
    if (archivedDelta !== 0) return archivedDelta

    if (sort === 'risk') {
      if (b.health.score !== a.health.score) return b.health.score - a.health.score
      if (b.stats.tasks.overdue !== a.stats.tasks.overdue) {
        return b.stats.tasks.overdue - a.stats.tasks.overdue
      }
      return byName(a, b)
    }
    if (sort === 'activity') {
      const delta = activityMs(b) - activityMs(a)
      return delta !== 0 ? delta : byName(a, b)
    }
    if (sort === 'progress') {
      const delta = completionPct(b.stats.tasks) - completionPct(a.stats.tasks)
      if (delta !== 0) return delta
      if (b.stats.tasks.total !== a.stats.tasks.total) {
        return b.stats.tasks.total - a.stats.tasks.total
      }
      return byName(a, b)
    }
    return byName(a, b)
  })
}

/** Counts for the status chips — always over the whole workspace, so the
 *  numbers on the chips don't change as you click between them. */
export function statusCounts(
  apps: readonly BrowsableApp[],
): Record<AppStatusFilter, number> {
  const counts: Record<AppStatusFilter, number> = {
    live: 0,
    active: 0,
    paused: 0,
    archived: 0,
  }
  for (const app of apps) {
    if (app.status !== 'archived') counts.live += 1
    counts[app.status] += 1
  }
  return counts
}

/**
 * Tech tags worth offering as facets, most-used first then alphabetical.
 * Tags used by exactly one app are dropped: a facet that always narrows to a
 * single card is a worse version of clicking that card.
 */
export function tagFacets(
  apps: readonly BrowsableApp[],
  limit: number,
): { tag: string; count: number }[] {
  const counts = new Map<string, { tag: string; count: number }>()
  for (const app of apps) {
    for (const raw of app.techTags) {
      const tag = raw.trim()
      if (!tag) continue
      const key = tag.toLowerCase()
      const existing = counts.get(key)
      if (existing) existing.count += 1
      else counts.set(key, { tag, count: 1 })
    }
  }
  return [...counts.values()]
    .filter((entry) => entry.count > 1)
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit)
}
