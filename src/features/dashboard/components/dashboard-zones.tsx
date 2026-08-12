import Link from 'next/link'
import { AtSign } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
import { PersonStatRow } from '@/features/people/components/person-stat-row'
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

const shimmer = 'animate-pulse rounded-md bg-muted motion-reduce:animate-none'

/* ─────────────────────────── My day ─────────────────────────── */

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

  return (
    <>
      <PersonStatRow
        stats={myDayStats}
        className="grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
      />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <PersonTasksCard
          openTasks={workload.openTasks}
          todayIso={workload.todayIso}
          doneCount={workload.doneCount}
          totalCount={workload.totalCount}
        />
        <PersonFollowupsCard followups={followups} personName={userName} />
        <PersonMeetingsCard meetings={meetings} />
        <div id="notifications" className="scroll-mt-6">
          <NotificationsCard items={notificationItems} />
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
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
        aria-hidden
      >
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-2 py-4">
              <div className={cn(shimmer, 'h-3 w-20')} />
              <div className={cn(shimmer, 'h-7 w-12')} />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <CardSkeleton key={i} rows={4} />
        ))}
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
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <CapacityHeat capacities={capacities} isAdmin={isAdmin} apps={assignableApps} />
      <ActiveSprints sprints={activeSprints} nextSprint={nextSprint} />
    </div>
  )
}

export function TeamZoneSkeleton() {
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2" aria-hidden>
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
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <RecentActivityCard rows={recentActivity} now={now} />
        {isAdmin && pendingUsers.length > 0 ? <PendingApprovalsCard users={pendingUsers} /> : null}
      </div>
    </>
  )
}

export function PortfolioZoneSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-2 py-4">
              <div className={cn(shimmer, 'h-3 w-16')} />
              <div className={cn(shimmer, 'h-6 w-10')} />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2" aria-hidden>
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
 */
export async function UnreadMentionsPill({ userId }: { userId: string }) {
  const unread = await unreadNotificationCount(userId)
  if (unread === 0) return null

  return (
    <Link
      href="#notifications"
      className="flex items-center gap-1.5 rounded-full bg-chart-1/15 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-chart-1/25"
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
        <div className={cn(shimmer, 'h-5 w-32')} />
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className={cn(shimmer, 'size-8 rounded-full')} />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className={cn(shimmer, 'h-4 w-32')} />
              <div className={cn(shimmer, 'h-3 w-20')} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
