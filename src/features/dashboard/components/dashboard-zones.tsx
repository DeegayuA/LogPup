import Link from 'next/link'
import { AtSign } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatTile } from '@/components/ui/stat-tile'
import { cn } from '@/lib/utils'
import {
  getPersonFollowups,
  getPersonMeetings,
  getPersonWorkload,
  getUserCapacities,
  listAssignableApps,
} from '@/features/people/queries'
import { getActiveSprints, getNextUpcomingSprint } from '@/features/sprints/queries'
import { listApps } from '@/features/apps/queries'
import { summarizePortfolio } from '@/features/apps/app-health'
import { browseHref, parseBrowseParams } from '@/features/apps/browse'
import { PortfolioSummaryStrip } from '@/features/apps/components/portfolio-summary'
import { listNotifications, unreadNotificationCount } from '@/features/notifications/queries'
import { listRecentActivity } from '@/features/activity/queries'
import { listPendingUsers } from '@/features/admin/queries'
import { PendingApprovalsCard } from '@/features/admin/components/pending-approvals-card'
import { CapacityHeat } from '@/features/dashboard/components/capacity-heat'
import { ActiveSprints } from '@/features/dashboard/components/active-sprints'
import { NotificationsCard } from '@/features/dashboard/components/notifications-card'
import { RecentActivityCard } from '@/features/dashboard/components/recent-activity-card'
import { buildMyDayStats } from '@/features/dashboard/my-day-stats'
import type { PersonStat, StatTone } from '@/features/people/person-stats'
import { PersonTasksCard } from '@/features/people/components/person-tasks-card'
import { PersonFollowupsCard } from '@/features/people/components/person-followups-card'
import { PersonMeetingsCard } from '@/features/people/components/person-meetings-card'

/**
 * STREAMING UI — the dashboard as three independent zones instead of one wait.
 *
 * The page used to be a single `Promise.all` of eleven reads followed by one
 * render. Running them together was right; making the whole page wait for the
 * slowest one was not. The portfolio scan (`listApps` is five aggregates over
 * every app) and the capacity roll-up are the heavy reads, and they were
 * holding up the four numbers at the top — the part someone actually opens
 * this page for, and the part that is cheapest to produce.
 *
 * Split across `<Suspense>`, React renders these three zones concurrently and
 * flushes each one as its own data lands, so "my day" paints while the
 * portfolio is still being counted. Nothing that was parallel became serial:
 * each zone still batches its own reads.
 *
 * This is only affordable because of the request-scoped deduplication added in
 * lib/session.ts — three zones all needing to know who is signed in would
 * otherwise be three more `select … from users` round trips on top of the
 * layout's.
 *
 * Zone order is the page's argument, and it is also the useful streaming
 * order: yours, then the team's, then the portfolio's.
 */

/**
 * Muted divider label between the page's zones. Exported so loading.tsx can
 * render the same labels in the cold-entry skeleton — they are constants, and
 * a grey box where a known word belongs makes a page feel slower than it is.
 */
export function ZoneLabel({ children }: { children: string }) {
  return (
    <h2 className="mt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  )
}

/**
 * THE TWO-CARD ROW, held to one height.
 *
 * These rows pair cards whose lengths are unrelated: capacity is one line per
 * person, sprints is one per sprint. A twelve-person team running two sprints
 * put a very tall card beside a very short one, and `items-start` let each
 * size to its own content — so the row ended in a column of dead space as
 * tall as the difference. Swap which side is longer and the gap just moves.
 *
 * Three rules fix it, and none of them touch the card components themselves —
 * `PersonTasksCard` and friends are shared with /people/[id], where a natural
 * height is right and this cap would be wrong:
 *
 * - No `items-start`, so the pair stretches to a common height and the row
 *   reads as a row.
 * - `max-h` on the card, from `lg` up only — the cap exists to keep a PAIR
 *   even, and single-column mobile has no pair to keep even.
 * - The content area scrolls (`min-h-0` is what lets a flex child shrink
 *   below its own content at all), so capping never hides a person: the
 *   twelfth teammate is one scroll away rather than clipped.
 *
 * 30rem is roughly ten list rows — enough that most teams never scroll, short
 * enough that no single card owns the fold.
 *
 * A FUNCTION of the child count, not a constant: an unconditional
 * `lg:grid-cols-2` left every lone card (a non-admin's Portfolio zone) at
 * half width beside a permanently empty cell. One child collapses to one
 * column; the two-up layout only exists when there is a pair to lay out.
 *
 * `scrollbar-width`/`scrollbar-color` on the scrolling content are the
 * card's scroll AFFORDANCE: overlay scrollbars (macOS default) hide until
 * hover, so a capped card gave no visible sign that a twelfth teammate
 * existed. Styling the scrollbar opts it out of overlay rendering in both
 * engines, so an overflowing card shows a thin, token-coloured bar at rest.
 */
export function pairedCards(count: number): string {
  return cn(
    'grid grid-cols-1 gap-6',
    count > 1 && 'lg:grid-cols-2',
    '[&>*]:h-full [&_[data-slot=card]]:h-full',
    'lg:[&_[data-slot=card]]:max-h-[30rem]',
    '[&_[data-slot=card-content]]:min-h-0 [&_[data-slot=card-content]]:overflow-y-auto',
    '[&_[data-slot=card-content]]:[scrollbar-width:thin]',
    '[&_[data-slot=card-content]]:[scrollbar-color:var(--border)_transparent]',
  )
}

/* ─────────────────────────── My day ─────────────────────────── */

/**
 * Where each stat tile's ANSWER lives — the card that holds the rows the
 * number is counting. "Overdue 3" without a destination names a problem and
 * won't take you to it; these anchors are the shortest path from the number
 * to its rows (which sit several scrolls below on mobile). The anchor ids are
 * on wrappers in this same zone, so tile and target always resolve together.
 */
const STAT_HREFS: Record<string, string> = {
  'due-soon': '#my-tasks',
  overdue: '#my-tasks',
  owed: '#my-followups',
  'meetings-today': '#my-meetings',
}

/** person-stats tone vocabulary → StatTile's. */
const STAT_TONES: Record<StatTone, 'default' | 'attention' | 'destructive'> = {
  normal: 'default',
  warn: 'attention',
  alert: 'destructive',
}

const STAT_GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'

function MyDayStatTiles({ stats }: { stats: PersonStat[] }) {
  return (
    <div className={STAT_GRID}>
      {stats.map((stat) => (
        <StatTile
          key={stat.key}
          label={stat.label}
          value={stat.value}
          meta={stat.meta}
          tone={STAT_TONES[stat.tone]}
          href={STAT_HREFS[stat.key]}
        />
      ))}
    </div>
  )
}

export async function MyDayZone({ userId, userName }: { userId: string; userName: string }) {
  const [workload, followups, meetings, notificationItems] = await Promise.all([
    getPersonWorkload(userId),
    getPersonFollowups(userId),
    getPersonMeetings(userId),
    listNotifications(userId, 8),
  ])

  // meetings.today, NOT a filter over meetings.upcoming: `upcoming` is a
  // display slice — capped at 5 and holding only meetings that have not
  // ended — so counting from it undercounts a busy day and drops every
  // meeting already finished. See features/people/meeting-window.ts.
  const myDayStats = buildMyDayStats({
    tasks: workload.load,
    followupsOwed: followups.owed.length,
    oldestOwedDays: followups.oldestOwedDays,
    meetingsToday: meetings.today,
  })

  // One "now" for this zone, shared with the Portfolio zone's convention:
  // NotificationsCard's relative timestamps must count back from the same
  // moment as every other "ago" on the page.
  const now = new Date()

  return (
    <>
      <MyDayStatTiles stats={myDayStats} />
      <div className={pairedCards(4)}>
        <div id="my-tasks" className="scroll-mt-6">
          <PersonTasksCard
            openTasks={workload.openTasks}
            todayIso={workload.todayIso}
            doneCount={workload.doneCount}
            totalCount={workload.totalCount}
          />
        </div>
        <div id="my-followups" className="scroll-mt-6">
          <PersonFollowupsCard followups={followups} personName={userName} />
        </div>
        <div id="my-meetings" className="scroll-mt-6">
          <PersonMeetingsCard meetings={meetings} />
        </div>
        <div id="notifications" className="scroll-mt-6">
          <NotificationsCard items={notificationItems} now={now} />
        </div>
      </div>
    </>
  )
}

export function MyDayZoneSkeleton() {
  return (
    <>
      <span className="sr-only" role="status">
        Loading your day…
      </span>
      <div className={STAT_GRID} aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          // Shaped like StatTile: bordered tile, label over a mono value over
          // a meta line — not the old free-floating card, so the swap to the
          // real tiles is not a layout shift.
          <div
            key={i}
            className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-10" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className={pairedCards(4)} aria-hidden>
        {Array.from({ length: 4 }, (_, i) =>
          // The fourth slot is where NotificationsCard resolves, and the
          // header's UnreadMentionsPill points at #notifications — the id
          // lives on the skeleton too, so clicking the pill mid-stream
          // scrolls to where the card is about to land instead of no-opping.
          i === 3 ? (
            <div key={i} id="notifications" className="scroll-mt-6">
              <CardSkeleton rows={4} />
            </div>
          ) : (
            <CardSkeleton key={i} rows={4} />
          ),
        )}
      </div>
    </>
  )
}

/* ──────────────────────────── Team ──────────────────────────── */

export async function TeamZone({ isAdmin }: { isAdmin: boolean }) {
  const [capacities, activeSprints, assignableApps] = await Promise.all([
    getUserCapacities(),
    getActiveSprints(),
    // Only the admin's inline "Assign to app" control renders this list — a
    // member never sees it, so don't pay for the query.
    isAdmin ? listAssignableApps() : Promise.resolve([]),
  ])
  // Only needed for the sprints card's empty-but-not-really state, so it is
  // fetched after we already know whether anything is running now.
  const nextSprint = activeSprints.length === 0 ? await getNextUpcomingSprint() : null

  return (
    <div className={pairedCards(2)}>
      <CapacityHeat capacities={capacities} isAdmin={isAdmin} apps={assignableApps} />
      <ActiveSprints sprints={activeSprints} nextSprint={nextSprint} />
    </div>
  )
}

export function TeamZoneSkeleton() {
  return (
    <div className={pairedCards(2)} aria-hidden>
      <CardSkeleton rows={5} />
      <CardSkeleton rows={3} />
    </div>
  )
}

/* ───────────────────────── Portfolio ────────────────────────── */

export async function PortfolioZone({ isAdmin }: { isAdmin: boolean }) {
  const [apps, recentActivity, pendingUsers] = await Promise.all([
    listApps(),
    listRecentActivity(10),
    isAdmin ? listPendingUsers() : Promise.resolve([]),
  ])

  const summary = summarizePortfolio(apps)
  // One "now" for this zone: the activity trail's relative timestamps must all
  // agree on which moment they are counting back from.
  const now = new Date()
  const showApprovals = isAdmin && pendingUsers.length > 0

  return (
    <>
      {apps.length > 0 ? (
        <PortfolioSummaryStrip
          summary={summary}
          atRiskHref={browseHref('/apps', parseBrowseParams({}), {
            risk: 'at-risk',
            status: 'live',
          })}
        />
      ) : null}
      <div className={pairedCards(showApprovals ? 2 : 1)}>
        <RecentActivityCard rows={recentActivity} now={now} />
        {showApprovals ? <PendingApprovalsCard users={pendingUsers} /> : null}
      </div>
    </>
  )
}

/**
 * Shaped like the COMMON resolved zone: summary strip plus one full-width
 * card. The zone renders no strip when the portfolio is empty and a second
 * card only for an admin with pending signups — both rare, and neither is
 * knowable while the query is still running, so the skeleton promises the
 * usual shape rather than always drawing the widest one.
 */
export function PortfolioZoneSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-2 py-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-10" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className={pairedCards(1)} aria-hidden>
        <CardSkeleton rows={6} />
      </div>
    </>
  )
}

/* ───────────────────── Header unread pill ───────────────────── */

/**
 * Streamed on its own, with a `null` fallback rather than a shimmer. It is a
 * decoration on the greeting: appearing a beat late reads as nothing at all,
 * whereas a placeholder box that resolves to "no unread mentions" would be a
 * flicker of nothing turning into nothing.
 *
 * Its `#notifications` target exists from the zone's FIRST paint — the
 * MyDayZoneSkeleton carries the id on the slot the card resolves into — so
 * clicking before the data lands scrolls to the right place instead of
 * silently doing nothing.
 */
export async function UnreadMentionsPill({ userId }: { userId: string }) {
  const unread = await unreadNotificationCount(userId)
  if (unread === 0) return null

  return (
    <Link
      href="#notifications"
      className="flex items-center gap-1.5 rounded-full bg-chart-1/15 px-3 py-1.5 text-xs font-medium text-foreground outline-none transition-colors duration-150 hover:bg-chart-1/25 focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none"
    >
      <AtSign className="size-3.5 text-chart-1" aria-hidden />
      {unread} unread
    </Link>
  )
}

/* ─────────────────────────── Shared ─────────────────────────── */

function CardSkeleton({ rows }: { rows: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
