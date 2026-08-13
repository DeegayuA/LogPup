import type { Metadata } from 'next'
import Link from 'next/link'
import { PawPrint, Search } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { ActivityFeed } from '@/features/activity/components/activity-feed'
import { ActivityFilterBar } from '@/features/activity/components/activity-filter-bar'
import {
  activityParams,
  decodeActivityCursor,
  encodeActivityCursor,
} from '@/features/activity/filters'
import {
  listActivity,
  listActivityActors,
  listActivityApps,
} from '@/features/activity/queries'
import { activityRowSearchText, fuzzyActivityFallback, rankActivityMatches } from '@/features/activity/search'
import { ACTIVITY_ENTITY_TYPES, type ActivityFilters } from '@/features/activity/types'

export const metadata: Metadata = {
  title: 'Activity',
  description: 'Everything anyone changed, newest first — the complete backtrack.',
}

const PAGE_SIZE = 30

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

// Colombo is UTC+05:30 year-round (no DST — see iso-day.ts, which leans on
// the same fact), so a calendar-day bound converts to an instant with a
// fixed offset: the day starts at 00:00+05:30 and ends just before the next.
function colomboDayStart(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00+05:30`)
}
function colomboDayEnd(isoDay: string): Date {
  return new Date(`${isoDay}T23:59:59.999+05:30`)
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

  const filters: ActivityFilters = {
    actorId: params.person,
    entityType: params.type,
    appId: params.app,
    from: params.from ? colomboDayStart(params.from) : undefined,
    to: params.to ? colomboDayEnd(params.to) : undefined,
    q: params.q,
  }
  const cursor = decodeActivityCursor(params.before) ?? undefined

  const [{ rows, hasMore }, people, apps] = await Promise.all([
    listActivity({ limit: PAGE_SIZE, filters, cursor }),
    // From the trail, not from the live roster — see the queries' note: a
    // deactivated teammate or an archived app still owns rows here, and
    // those are the rows a filter is most often reached for.
    listActivityActors(),
    listActivityApps(),
  ])

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
        limit: PAGE_SIZE,
        filters: { ...filters, q: undefined },
        cursor,
      })
      displayRows = fuzzyActivityFallback(unfilteredRows, params.q, activityRowSearchText)
      fallbackActive = displayRows.length > 0
    }
  }

  const now = new Date()

  // The Load-more link: same filters (q included), cursor at the PRIMARY
  // (SQL-ordered) page's last row — never the re-ranked/fallback view, which
  // has no keyset order to continue from. `hasMore` came off that same
  // primary query, so it's already false whenever the fallback is in play.
  const lastRow = rows[rows.length - 1]
  const loadMoreParams = activityParams(
    {
      person: params.person ?? '',
      type: params.type ?? '',
      app: params.app ?? '',
      from: params.from ?? '',
      to: params.to ?? '',
      q: params.q ?? '',
    },
    lastRow ? encodeActivityCursor(lastRow) : undefined,
  )

  const anyFilter = Boolean(
    params.person || params.type || params.app || params.from || params.to || params.q,
  )

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground">
          Who did what, where, and when — everything, newest first.
        </p>
      </header>

      <ActivityFilterBar
        people={people}
        apps={apps}
        current={{
          person: params.person ?? '',
          type: params.type ?? '',
          app: params.app ?? '',
          from: params.from ?? '',
          to: params.to ?? '',
          q: params.q ?? '',
        }}
      />

      {displayRows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-12 text-center">
          <PawPrint aria-hidden className="size-8 text-muted-foreground/60" />
          <p className="font-heading font-semibold">
            {anyFilter ? 'Nothing matches these filters.' : 'Nothing tracked yet.'}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {anyFilter
              ? 'Loosen a filter or clear them all to see the full trail.'
              : 'From now on, every change anyone makes — tasks, sprints, meetings, people — lands here with who, where and when.'}
          </p>
        </div>
      ) : (
        <>
          {fallbackActive ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Search aria-hidden className="size-3.5 shrink-0" />
              No exact matches — showing close matches for &ldquo;{params.q}&rdquo;.
            </p>
          ) : null}
          {/* Chronological day-grouping only makes sense for the unfiltered
              trail's reading order; a search's rows are ordered by
              relevance (rankActivityMatches / fuzzyActivityFallback) and
              stay flat so that order is visible rather than re-shuffled by
              day. */}
          <ActivityFeed rows={displayRows} now={now} grouped={!params.q} />
          {hasMore ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`/activity?${loadMoreParams.toString()}`} />}
              >
                Load older
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
