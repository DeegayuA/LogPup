import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PawPrint, SearchX } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ActivityFilterBar } from '@/features/activity/components/activity-filter-bar'
import { ActivityTrailPager } from '@/features/activity/components/activity-trail-pager'
import {
  ActivityControlsSkeleton,
  ActivityTrailSkeleton,
} from '@/features/activity/components/activity-skeleton'
import { describeActivityFilters } from '@/features/activity/describe'
import {
  ACTIVITY_PAGE_SIZE,
  activityParams,
  decodeActivityCursor,
  encodeActivityCursor,
  type ActivityParamState,
} from '@/features/activity/filters'
import {
  listActivity,
  listActivityActors,
  listActivityApps,
} from '@/features/activity/queries'
import { activityRowSearchText, fuzzyActivityFallback, rankActivityMatches } from '@/features/activity/search'
import { ACTIVITY_ENTITY_TYPES, type ActivityFilters } from '@/features/activity/types'
import { getSession } from '@/lib/session'

export const metadata: Metadata = {
  title: 'Activity',
  description: 'Everything anyone changed, newest first — the complete backtrack.',
}

/**
 * The team's shared memory: what changed, who changed it, and does it need me.
 *
 * Redesigned 2026-08-13 — see
 * docs/superpowers/specs/2026-08-13-activity-redesign-design.md. The query,
 * filter, cursor and two-layer search layers below are UNCHANGED and
 * load-bearing; what changed is the shape of the page:
 *
 *   1. The trail is burst-collapsed and hung off a product-coloured rail, so
 *      one person's eight-edit session is one line instead of a third of the
 *      page (features/activity/components/activity-feed.tsx).
 *   2. Actor, entity type, app and day are one-click filters built from the
 *      rows themselves, all through the one activityParams() builder.
 *   3. The controls no longer wait for the trail. This page used to block on a
 *      single Promise.all covering the feed AND the filter lists, so changing a
 *      filter blanked the control you had just used. Three independent waits
 *      now: the h1 is instant, the description and filter bar stream behind the
 *      two cheap selectDistinct queries, and the feed streams behind its own.
 *   4. Loading and error states exist at all (activity-skeleton.tsx,
 *      error.tsx, loading.tsx), and the empty state offers an action rather
 *      than describing one.
 *
 * 2026-08-20: "Load older" went from a replace-navigation to a client append
 * (activity-trail-pager.tsx + the loadOlderActivity server action) — the URL
 * cursor survives for deep-linking, but walking back no longer throws away
 * the rows already read.
 */

/**
 * Every param is validated before it reaches a query, and every INVALID param
 * degrades to "not filtered" rather than to an error page — a hand-edited URL
 * should show more rows, never a crash. Same principle as /people/[id]'s
 * param handling, looser response: there a bad id means the resource cannot
 * exist (404); here a bad filter is just a filter that matches everything.
 */
const paramsSchema = z.object({
  person: z.uuid().optional().catch(undefined),
  type: z.enum(ACTIVITY_ENTITY_TYPES).optional().catch(undefined),
  app: z.uuid().optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  before: z.string().optional().catch(undefined),
  // .trim() first so a whitespace-only q degrades the same way an absent one
  // does — "not filtered", never a spuriously-empty page.
  q: z.string().trim().min(1).optional().catch(undefined),
})

type ActivityPageParams = z.infer<typeof paramsSchema>

// Colombo is UTC+05:30 year-round (no DST — see iso-day.ts, which leans on
// the same fact), so a calendar-day bound converts to an instant with a
// fixed offset: the day starts at 00:00+05:30 and ends just before the next.
function colomboDayStart(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00+05:30`)
}
function colomboDayEnd(isoDay: string): Date {
  return new Date(`${isoDay}T23:59:59.999+05:30`)
}

/** The URL's filter state, in the shape every link builder here expects. */
function paramState(params: ActivityPageParams): ActivityParamState {
  return {
    person: params.person ?? '',
    type: params.type ?? '',
    app: params.app ?? '',
    from: params.from ?? '',
    to: params.to ?? '',
    q: params.q ?? '',
  }
}

export default async function ActivityPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await props.searchParams
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const params = paramsSchema.parse({
    person: first(raw.person),
    type: first(raw.type),
    app: first(raw.app),
    from: first(raw.from),
    to: first(raw.to),
    before: first(raw.before),
    q: first(raw.q),
  })
  const state = paramState(params)

  return (
    <div className="relative flex flex-1 flex-col gap-6 p-6 md:p-8">
      {/* Decorative only. The orbs are wider than the viewport by design, so
          they need clipping — but the clip belongs on THIS wrapper, not on the
          page root. `overflow-hidden` on the root makes it the nearest scroll
          container for everything inside, which silently stops `position:
          sticky` working for its descendants: the activity trail's day markers
          and the progress matrix's frozen person column both stick to a
          container that never scrolls. Same paint, without taking sticky
          positioning away from the whole page. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="pointer-events-none absolute -top-40 right-1/4 -z-10 h-[450px] w-[600px] rounded-full bg-primary/8 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-1/2 -left-40 -z-10 h-[400px] w-[500px] rounded-full bg-chart-1/5 blur-3xl"
        aria-hidden
      />
      </div>

      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          LogPup 🐾 Activity
        </h1>
        {/* The page has to say which slice it is showing: every row below is
            conditional on the filters, and a reader often arrives on a shared
            link without having set them. Behind its own boundary because
            naming the person and the app needs the two filter-list queries —
            though the common unfiltered case resolves without either. */}
        <Suspense
          fallback={<div className="h-5 w-80 max-w-full animate-pulse rounded bg-muted motion-reduce:animate-none" />}
        >
          <ActivityDescription params={params} />
        </Suspense>
      </header>

      <Suspense fallback={<ActivityControlsSkeleton />}>
        <ActivityControls state={state} />
      </Suspense>

      <Suspense fallback={<ActivityTrailSkeleton />}>
        <ActivityTrailSection params={params} state={state} />
      </Suspense>
    </div>
  )
}

/**
 * "meeting changes by Prabuddha in LogPup since Aug 1, newest first."
 *
 * Resolves ids to names against the same lists that populate the filter bar.
 * Both queries are React-`cache()`d, so this component and ActivityControls
 * below share one round trip each rather than doubling them.
 */
async function ActivityDescription({ params }: { params: ActivityPageParams }) {
  const base = {
    entityType: params.type,
    from: params.from,
    to: params.to,
    q: params.q,
  }
  // No id to resolve: answer without touching the database at all, which is
  // the overwhelmingly common case (an unfiltered trail, or one narrowed only
  // by type/date/search).
  const description =
    params.person || params.app
      ? await (async () => {
          const [people, apps] = await Promise.all([listActivityActors(), listActivityApps()])
          return describeActivityFilters({
            ...base,
            // An id matching no row (a hand-edited URL) simply goes unnamed,
            // the same degrade-to-quiet the Zod schema uses.
            personName: people.find((person) => person.id === params.person)?.name,
            appName: apps.find((app) => app.id === params.app)?.name,
          })
        })()
      : describeActivityFilters(base)

  return <p className="text-sm text-muted-foreground">{description}</p>
}

/**
 * The filter bar and its option lists.
 *
 * Deliberately NOT in the same wait as the trail. These are two cheap
 * `selectDistinct` queries; the trail is a paged scan that may run a second
 * fallback query behind it. Sharing one boundary meant every filter change
 * blanked the control the user had just touched.
 *
 * The session read is `getSession` — request-deduplicated, already paid for
 * by the (app) layout — and it is what makes the bar's one-click "My changes"
 * chip possible at all.
 */
async function ActivityControls({ state }: { state: ActivityParamState }) {
  // From the trail, not from the live roster — see the queries' note: a
  // deactivated teammate or an archived app still owns rows here, and
  // those are the rows a filter is most often reached for.
  const [people, apps, session] = await Promise.all([
    listActivityActors(),
    listActivityApps(),
    getSession(),
  ])
  return (
    <ActivityFilterBar
      people={people}
      apps={apps}
      current={state}
      sessionUserId={session?.user?.id ?? null}
    />
  )
}

async function ActivityTrailSection({
  params,
  state,
}: {
  params: ActivityPageParams
  state: ActivityParamState
}) {
  const filters: ActivityFilters = {
    actorId: params.person,
    entityType: params.type,
    appId: params.app,
    from: params.from ? colomboDayStart(params.from) : undefined,
    to: params.to ? colomboDayEnd(params.to) : undefined,
    q: params.q,
  }
  const cursor = decodeActivityCursor(params.before) ?? undefined

  const { rows, hasMore } = await listActivity({ limit: ACTIVITY_PAGE_SIZE, filters, cursor })

  // LAYER 2 of /activity search (see features/activity/search.ts): SQL
  // ilike (Layer 1, just above) is typo-INTOLERANT — "meetign" matches
  // nothing however good the pattern is.
  //
  // - Layer 1 found rows: re-rank them by relevance instead of leaving them
  //   in chronological order.
  // - Layer 1 found NONE and there's a query to blame: re-query WITHOUT `q`
  //   (same other filters + cursor, same bounded page size — never the
  //   whole table) and fall back to fuzzy matching over that bounded set.
  //   Rendered under an explicit heading below, so a fuzzy result never
  //   reads as an exact one.
  let displayRows = rows
  let fallbackActive = false
  if (params.q) {
    if (rows.length > 0) {
      displayRows = rankActivityMatches(rows, params.q, activityRowSearchText)
    } else {
      const { rows: unfilteredRows } = await listActivity({
        limit: ACTIVITY_PAGE_SIZE,
        filters: { ...filters, q: undefined },
        cursor,
      })
      displayRows = fuzzyActivityFallback(unfilteredRows, params.q, activityRowSearchText)
      fallbackActive = displayRows.length > 0
    }
  }

  const now = new Date()

  // The pager's starting cursor: same filters (q included), keyed off the
  // PRIMARY (SQL-ordered) page's last row — never the re-ranked/fallback
  // view, which has no keyset order to continue from. `hasMore` came off that
  // same primary query, so it's already false whenever the fallback is in
  // play.
  const lastRow = rows[rows.length - 1]
  const initialCursor = hasMore && lastRow ? encodeActivityCursor(lastRow) : null

  const anyFilter = Boolean(
    params.person || params.type || params.app || params.from || params.to || params.q,
  )

  if (displayRows.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border p-6">
        <EmptyState
          icon={PawPrint}
          title={anyFilter ? 'Nothing matches these filters.' : 'Nothing tracked yet.'}
          description={
            anyFilter
              ? 'Nothing in the trail answers all of those at once. Widen the date range, or start over.'
              : 'From now on, every change anyone makes — tasks, sprints, meetings, people — lands here with who, where and when.'
          }
          // An empty state has to OFFER the next action, not describe it. The
          // old copy said "clear them all" and gave the reader nothing to
          // click.
          action={
            anyFilter ? (
              <Button variant="outline" size="sm" render={<Link href="/activity" />}>
                Clear all filters
              </Button>
            ) : (
              <Button variant="outline" size="sm" render={<Link href="/apps" />}>
                Go to apps
              </Button>
            )
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* The fuzzy fallback is QUARANTINED behind its own heading: these rows
          did not match, and must never be able to read as if they had. The
          scope is named too — the fallback searched the most recent page, not
          the whole table, so "nothing else exists" is not what this says. */}
      {fallbackActive ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2"
        >
          <SearchX aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              No exact matches for &ldquo;{params.q}&rdquo;.
            </span>{' '}
            Showing close matches from the most recent page instead, best first.
          </p>
        </div>
      ) : null}

      {/* Chronological day-grouping only makes sense for the unfiltered
          trail's reading order; a search's rows are ordered by relevance
          (rankActivityMatches / fuzzyActivityFallback) and stay flat so that
          order is visible rather than re-shuffled by day. Burst collapsing is
          suppressed with it, for the same reason.

          The pager is KEYED by the canonical querystring: a filter change or
          back-button navigation must remount it with a fresh seed, or pages
          accumulated under the old filters would leak into the new view. Our
          own history.replaceState cursor updates don't re-render this server
          tree, so appends never remount themselves. */}
      <ActivityTrailPager
        key={activityParams(state, params.before).toString()}
        initialRows={displayRows}
        initialHasMore={hasMore}
        initialCursor={initialCursor}
        state={state}
        grouped={!params.q}
        now={now}
      />
    </div>
  )
}
