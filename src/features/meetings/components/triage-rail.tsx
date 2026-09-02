'use client'

import { useCallback, useState, type MouseEvent } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { CircleCheckIcon, InfoIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatTile } from '@/components/ui/stat-tile'
import { cn } from '@/lib/utils'
import { SkeletonBlock } from '@/features/meetings/components/meeting-chips'
import { isAwaitingViewerRsvp } from '@/features/meetings/components/meeting-glance'
import { useGlanceMapOptional } from '@/features/meetings/components/use-glance-map'
import { parseListFilter, type ListFilter } from '@/features/meetings/list-filter'
import type { MeetingSummary } from '@/features/meetings/queries'

/**
 * Zone 2 of the docket: the tiles ARE the filters.
 *
 * The old header strip showed these numbers as inert display divs while a
 * functionally identical chip row four zones lower did the filtering — three
 * unconnected count systems for the same facts. Here each tile is one real
 * link that writes `?f=` (so it middle-clicks, copies and focuses like a
 * link), the counts come from the one batched glance store the rows also
 * read, and "Waiting on you" is computed synchronously from the attendee
 * lists the page already holds — it never waits on the batch.
 */

const GLANCE_TILES: {
  filter: Exclude<ListFilter, 'waiting'>
  label: string
  tone: 'attention' | 'destructive' | 'default'
}[] = [
  { filter: 'overdue', label: 'Overdue actions', tone: 'destructive' },
  { filter: 'followups', label: 'Open follow-ups', tone: 'attention' },
  { filter: 'questions', label: 'Questions unanswered', tone: 'default' },
]

export function TriageRail({
  upcoming,
  past,
  currentUserId,
}: {
  /**
   * The WHOLE windowed list, both halves — tile counts are computed over
   * everything on the page, never the day slice, so a `?day` filter cannot
   * make "Overdue actions" quietly under-report (the undercount that sank
   * the old quick-filter chips).
   */
  upcoming: MeetingSummary[]
  past: MeetingSummary[]
  currentUserId: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const glanceMap = useGlanceMapOptional()
  // No provider mounted is a degraded surface, not a crash: the three
  // glance tiles show em-dashes, and with no `retry` to offer, no notice.
  const status = glanceMap?.status ?? 'error'
  const active = parseListFilter(searchParams.get('f'))

  // Announce recovery: pressing Retry is otherwise silent in both directions
  // for a screen reader — tiles fill with no announcement on success. Synced
  // during render (React's reacting-to-changed-props guidance).
  const [seenStatus, setSeenStatus] = useState(status)
  const [recovered, setRecovered] = useState(false)
  if (status !== seenStatus) {
    setSeenStatus(status)
    if (seenStatus === 'error' && status === 'ready') setRecovered(true)
    if (status === 'error') setRecovered(false)
  }

  /**
   * Same History-API/render-time-derivation idiom as meetings-views.tsx's
   * writeUrl, and for the same reason: the browser already holds every
   * meeting, so routing on a filter press would re-run the page's queries to
   * redraw data it has. replaceState, not pushState — toggling four filters
   * should not bury where you came from under four history entries.
   */
  const writeFilter = useCallback(
    (next: ListFilter | null) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('view', 'list')
      if (next) params.set('f', next)
      else params.delete('f')
      const query = params.toString()
      window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname)
    },
    [pathname, searchParams],
  )

  /** The href each tile would navigate to — kept truthful so open-in-new-tab
   *  and copy-link land on the filtered list, not on a stale page. */
  function filterHref(next: ListFilter | null): string {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', 'list')
    if (next) params.set('f', next)
    else params.delete('f')
    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }

  function handleTilePress(event: MouseEvent<HTMLAnchorElement>, filter: ListFilter) {
    // Modified clicks keep their browser meaning (new tab, new window); only
    // the plain left click becomes an in-page filter toggle.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }
    event.preventDefault()
    writeFilter(active === filter ? null : filter)
  }

  const waiting = upcoming.filter((meeting) =>
    isAwaitingViewerRsvp(meeting, currentUserId),
  ).length

  // Item totals, not meeting totals: a tile labelled "Overdue actions 5"
  // must mean five overdue actions, even when pressing it reveals the three
  // meetings that hold them.
  let overdue = 0
  let followups = 0
  let questions = 0
  if (glanceMap) {
    for (const meeting of [...upcoming, ...past]) {
      const glance = glanceMap.glances[meeting.id]
      if (!glance) continue
      overdue += glance.overdueActions
      followups += glance.openFollowups
      questions += glance.questions
    }
  }
  const glanceCount: Record<Exclude<ListFilter, 'waiting'>, number> = {
    overdue,
    followups,
    questions,
  }

  // The designed success state — but only when no filter is active: a
  // collapsed rail with `?f` still set would leave the active tile (the one
  // control that clears it) nowhere on screen.
  const allClear =
    status === 'ready' &&
    active === null &&
    waiting === 0 &&
    overdue === 0 &&
    followups === 0 &&
    questions === 0

  if (allClear) {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-success">
        <CircleCheckIcon className="size-4 shrink-0" aria-hidden />
        All clear — nothing is waiting on you
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <nav aria-label="Triage filters" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <TileLink
          label="Waiting on you"
          value={waiting}
          tone={waiting > 0 ? 'attention' : 'default'}
          active={active === 'waiting'}
          href={filterHref(active === 'waiting' ? null : 'waiting')}
          onPress={(event) => handleTilePress(event, 'waiting')}
        />
        {GLANCE_TILES.map(({ filter, label, tone }) => {
          if (status === 'pending') {
            return (
              <StatTile
                key={filter}
                label={label}
                // h-[1lh] borrows the value line's own line-height, so the
                // tile is final-size before the batch answers and nothing
                // shifts when the number lands.
                value={<SkeletonBlock className="h-[1lh] w-10" />}
                meta="Counting…"
              />
            )
          }
          if (status === 'error') {
            // Filtering on data that failed to load would filter on nothing —
            // the tiles go inert. EXCEPT the active one, which stays a link
            // so "press to clear" is never taken away by a failed batch.
            if (active === filter) {
              return (
                <TileLink
                  key={filter}
                  label={label}
                  value="—"
                  tone="default"
                  active
                  href={filterHref(null)}
                  onPress={(event) => handleTilePress(event, filter)}
                />
              )
            }
            return <StatTile key={filter} label={label} value="—" meta={' '} />
          }
          const count = glanceCount[filter]
          return (
            <TileLink
              key={filter}
              label={label}
              value={count}
              tone={count > 0 ? tone : 'default'}
              active={active === filter}
              href={filterHref(active === filter ? null : filter)}
              onPress={(event) => handleTilePress(event, filter)}
            />
          )
        })}
      </nav>
      {status === 'error' && glanceMap ? (
        // ONE worded notice for the whole batch — the rows deliberately show
        // no per-row error chips, so this line owns the failure. role=status
        // because it appears asynchronously with no focus move: without a
        // live region a screen reader is never told the counts failed
        // (WCAG 4.1.3).
        <p role="status" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <InfoIcon className="size-4 shrink-0" aria-hidden />
          Counts unavailable —
          <Button type="button" variant="outline" size="xs" onClick={glanceMap.retry}>
            Retry
          </Button>
        </p>
      ) : null}
      {recovered ? (
        <span className="sr-only" role="status">
          Counts updated
        </span>
      ) : null}
    </div>
  )
}

/**
 * A StatTile inside a real anchor. The kit tile's own `href` renders a Link
 * that forwards neither `onClick` nor `aria-current`, and this rail needs
 * both: the click must become a History-API write (routing would refetch the
 * page to filter data the browser holds) and the active state must live on
 * the interactive element for assistive tech. Wrapping keeps the kit tile
 * byte-for-byte and puts the link semantics where they belong.
 */
function TileLink({
  label,
  value,
  tone,
  active,
  href,
  onPress,
}: {
  label: string
  value: number | string
  tone: 'attention' | 'destructive' | 'default'
  active: boolean
  href: string
  onPress: (event: MouseEvent<HTMLAnchorElement>) => void
}) {
  return (
    <a
      href={href}
      aria-current={active ? 'true' : undefined}
      onClick={onPress}
      className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <StatTile
        label={label}
        value={value}
        tone={tone}
        // "Filtering" in words, not just a ring: the active state may not
        // hang on colour alone, and it doubles as the hint that a second
        // press clears it. A non-breaking space otherwise, so every tile in
        // the rail carries the meta line and the rail's height cannot jump
        // when a filter toggles or the pending "Counting…" resolves.
        meta={active ? 'Filtering — press to clear' : ' '}
        className={cn(
          'h-full transition-[background-color,border-color] duration-(--dur-quick) ease-(--ease-enter) hover:border-border hover:bg-muted/40 motion-reduce:transition-none',
          active && 'border-primary ring-1 ring-primary',
        )}
      />
    </a>
  )
}
