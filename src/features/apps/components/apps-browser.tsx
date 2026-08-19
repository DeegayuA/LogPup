import Link from 'next/link'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { AppCard } from '@/features/apps/components/app-card'
import {
  APP_SORTS,
  APP_STATUS_FILTERS,
  DEFAULT_BROWSE_PARAMS,
  RISK_FILTER_LABEL,
  SORT_LABEL,
  STATUS_FILTER_LABEL,
  browseHref,
  filterApps,
  isDefaultBrowse,
  sortApps,
  statusCounts,
  tagFacets,
  type BrowseParams,
} from '@/features/apps/browse'
import type { AppPortfolioEntry } from '@/features/apps/queries'

const BASE = '/apps'
const MAX_TAG_FACETS = 8

/**
 * The "no results" line has to name the filter that emptied the grid, because
 * a generic "widen the filters" next to an at-risk view reads as a failure
 * when it is actually the best possible answer ("nothing is on fire").
 */
function emptyHint(params: BrowseParams): string {
  if (params.risk) {
    return 'Nothing is flagged right now — every app has a sprint, a team and no overdue work.'
  }
  if (params.status === 'archived') {
    return 'Nothing has been archived yet — which is a good sign.'
  }
  return 'Widen the filters, or try ⌘K to search tasks and meetings too.'
}

/**
 * The grid, its controls, and its empty states — all server-rendered.
 *
 * THERE IS NO CLIENT COMPONENT HERE, ON PURPOSE. Every control is a <Link> or
 * a plain GET <form>, so the whole browse experience works with JavaScript
 * still loading (or off), the back button behaves, and the page ships zero
 * bytes of filtering logic to the browser. The cost is that the text search
 * needs an Enter/click instead of filtering per keystroke; that was judged the
 * right trade because the filter now has to survive reloads and shared links,
 * which per-keystroke `useState` filtering never did.
 *
 * Hidden inputs carry the other params through a search submit, and only
 * non-default ones are emitted so a plain search lands on `/apps?q=…` rather
 * than a URL spelling out every default.
 */
export function AppsBrowser({
  apps,
  params,
  today,
}: {
  apps: AppPortfolioEntry[]
  params: BrowseParams
  today: string
}) {
  const counts = statusCounts(apps)
  const facets = tagFacets(apps, MAX_TAG_FACETS)
  const visible = sortApps(filterApps(apps, params), params.sort)
  const filtered = !isDefaultBrowse(params)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <form method="get" action={BASE} className="flex min-w-52 flex-1 items-center gap-2">
            {params.status !== DEFAULT_BROWSE_PARAMS.status ? (
              <input type="hidden" name="status" value={params.status} />
            ) : null}
            {params.sort !== DEFAULT_BROWSE_PARAMS.sort ? (
              <input type="hidden" name="sort" value={params.sort} />
            ) : null}
            {params.tag ? <input type="hidden" name="tag" value={params.tag} /> : null}
            {/* Every non-default param needs a hidden twin here or submitting
                the search silently discards it — a filter that survives a
                reload but not a search is worse than one that never persists,
                because it only breaks once you have started trusting it. */}
            {params.risk ? <input type="hidden" name="risk" value={params.risk} /> : null}
            <div className="relative min-w-40 flex-1">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                name="q"
                defaultValue={params.q}
                placeholder="Search apps, tags, people…"
                aria-label="Search apps"
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="outline" size="sm">
              Search
            </Button>
          </form>

          <div
            className="flex items-center gap-0.5 overflow-x-auto rounded-lg border bg-muted/50 p-0.5"
            role="group"
            aria-label="Filter by status"
          >
            {APP_STATUS_FILTERS.map((filter) => {
              const selected = params.status === filter
              return (
                <Link
                  key={filter}
                  href={browseHref(BASE, params, { status: filter })}
                  aria-current={selected ? 'true' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium outline-none',
                    'transition-colors duration-150 motion-reduce:transition-none',
                    'focus-visible:ring-2 focus-visible:ring-ring',
                    selected
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {STATUS_FILTER_LABEL[filter]}
                  <span className="font-mono tabular-nums text-muted-foreground/70">
                    {counts[filter]}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Shown ONLY while active. The header strip's "At risk" tile is the
            way in; without a visible, removable chip the grid would be silently
            narrowed by a URL param with nothing on the page admitting it. */}
        {params.risk ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={browseHref(BASE, params, { risk: null })}
              className={cn(
                'flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/8 px-2.5 py-1 text-xs font-medium text-warning outline-none',
                'transition-colors duration-150 motion-reduce:transition-none',
                'hover:bg-warning/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              )}
            >
              {RISK_FILTER_LABEL[params.risk]}
              <X aria-hidden className="size-3" />
              <span className="sr-only">— remove this filter</span>
            </Link>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5" role="group" aria-label="Sort apps">
            <span className="text-xs text-muted-foreground">Sort</span>
            {APP_SORTS.map((sort) => {
              const selected = params.sort === sort
              return (
                <Link
                  key={sort}
                  href={browseHref(BASE, params, { sort })}
                  aria-current={selected ? 'true' : undefined}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs outline-none',
                    'transition-colors duration-150 motion-reduce:transition-none',
                    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:border-ring/40 hover:text-foreground',
                  )}
                >
                  {SORT_LABEL[sort]}
                </Link>
              )
            })}
          </div>

          {facets.length > 0 ? (
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Filter by tech tag"
            >
              <span className="text-xs text-muted-foreground">Tech</span>
              {facets.map(({ tag, count }) => {
                const selected = params.tag?.toLowerCase() === tag.toLowerCase()
                return (
                  <Link
                    key={tag}
                    href={browseHref(BASE, params, { tag: selected ? null : tag })}
                    aria-current={selected ? 'true' : undefined}
                    className={cn(
                      'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs outline-none',
                      'transition-colors duration-150 motion-reduce:transition-none',
                      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:border-ring/40 hover:text-foreground',
                    )}
                  >
                    {tag}
                    <span className="font-mono tabular-nums opacity-70">{count}</span>
                    {selected ? <X aria-hidden className="size-3" /> : null}
                  </Link>
                )
              })}
            </div>
          ) : null}
        </div>

        {/* An honest "you are looking at a subset" line — the counts on the
            chips describe the workspace, this describes the grid below. */}
        <p className="text-xs text-muted-foreground" role="status">
          Showing <span className="font-mono tabular-nums">{visible.length}</span> of{' '}
          <span className="font-mono tabular-nums">{apps.length}</span> apps
          {params.q ? ` matching “${params.q}”` : ''}
          {params.tag ? ` tagged ${params.tag}` : ''}
          {params.risk ? ` · ${RISK_FILTER_LABEL[params.risk].toLowerCase()}` : ''}
          {filtered ? (
            <>
              {' · '}
              <Link
                href={BASE}
                className="rounded-sm underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                Clear filters
              </Link>
            </>
          ) : null}
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <Search aria-hidden className="size-6 text-muted-foreground/60" />
          <div className="flex flex-col gap-1">
            <p className="font-heading font-semibold">No apps match this view.</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {emptyHint(params)}
            </p>
          </div>
          {filtered ? (
            <Button variant="outline" size="sm" render={<Link href={BASE} />}>
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : (
        /* Three columns at `lg`, not at `md`: the sidebar (w-56) appears at the
           same breakpoint the third column used to, so at 768px exactly the
           card's content box fell from 317px to 121px in one pixel and every
           band on it — sprint name, tag run, owner line — collapsed to an
           ellipsis. Moving the third column to lg keeps the narrowest card the
           grid ever renders at ~206px of content, which is what app-card.tsx's
           single-line bands are sized against. loading.tsx mirrors this line;
           the two disagreeing is a horizontal jump on every cold load. */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((app) => (
            <AppCard key={app.id} app={app} today={today} />
          ))}
        </div>
      )}
    </div>
  )
}
