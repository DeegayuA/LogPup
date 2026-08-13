import Link from 'next/link'
import { format } from 'date-fns'
import { AtSign } from 'lucide-react'
import { getSession } from '@/lib/session'
import {
  getPersonFollowups,
  getPersonMeetings,
  getPersonWorkload,
  getUserCapacities,
  listAssignableApps,
} from '@/features/people/queries'
import { isoDayOf } from '@/features/people/iso-day'
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

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Muted divider label between the page's zones. "My day" needs no label — it
 * starts at the greeting — but the switch from personal to team data, and
 * from team to portfolio, reads clearer with one word than with nothing.
 */
function ZoneLabel({ children }: { children: string }) {
  return (
    <h2 className="mt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  )
}

/**
 * MY DAY FIRST, TEAM BELOW — the redesign's one organizing idea. The page
 * opens with the four numbers that are the signed-in user's own morning
 * briefing and the cards those numbers summarize (reused wholesale from
 * /people/[id], so "overdue" can never mean two different things on two
 * pages), then widens to the team (capacity, sprints), then to the whole
 * portfolio (health strip, the activity trail, approvals).
 *
 * ONE Promise.all, ~11 reads, all indexed and independent — same rule as the
 * person page: never serialize what can run together, never N+1. The two
 * admin-only reads ride along as resolved no-ops for members rather than
 * forcing a second await round after the role is known.
 */
export default async function DashboardPage() {
  const session = await getSession()
  const user = session?.user
  const isAdmin = user?.role === 'admin'

  const [
    workload,
    followups,
    meetings,
    unreadMentions,
    notificationItems,
    recentActivity,
    capacities,
    activeSprints,
    apps,
    assignableApps,
    pendingUsers,
  ] = await Promise.all([
    user ? getPersonWorkload(user.id) : null,
    user ? getPersonFollowups(user.id) : null,
    user ? getPersonMeetings(user.id) : null,
    user ? unreadNotificationCount(user.id) : 0,
    user ? listNotifications(user.id, 8) : [],
    listRecentActivity(10),
    getUserCapacities(),
    getActiveSprints(),
    listApps(),
    // Only the admin's inline "Assign to app" control needs the app list —
    // a member never renders it, so don't pay for the query.
    isAdmin ? listAssignableApps() : Promise.resolve([]),
    isAdmin ? listPendingUsers() : Promise.resolve([]),
  ])
  // Only needed for the sprints card's empty-but-not-really state, so it's
  // fetched after we already know whether anything is running now.
  const nextSprint = activeSprints.length === 0 ? await getNextUpcomingSprint() : null

  const now = new Date()
  const firstName = user?.name?.trim().split(/\s+/)[0]
  const greeting = firstName
    ? `${greetingFor(now.getHours())}, ${firstName}`
    : greetingFor(now.getHours())

  const todayIso = workload?.todayIso ?? isoDayOf(now)
  const meetingsToday =
    meetings?.upcoming.filter((entry) => isoDayOf(entry.startsAt) === todayIso).length ?? 0

  const myDayStats =
    workload && followups
      ? buildMyDayStats({
          tasks: workload.load,
          followupsOwed: followups.owed.length,
          oldestOwedDays: followups.oldestOwedDays,
          meetingsToday,
        })
      : null

  const summary = summarizePortfolio(apps)

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {greeting} · {format(now, 'EEEE, MMMM d')}
          </p>
        </div>
        {unreadMentions > 0 ? (
          <Link
            href="#notifications"
            className="flex items-center gap-1.5 rounded-full bg-chart-1/15 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-chart-1/25"
          >
            <AtSign className="size-3.5 text-chart-1" aria-hidden />
            {unreadMentions} unread
          </Link>
        ) : null}
      </header>

      {/* ——— My day ——— */}
      {myDayStats ? (
        <PersonStatRow
          stats={myDayStats}
          className="grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
        />
      ) : null}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {workload ? (
          <PersonTasksCard
            openTasks={workload.openTasks}
            todayIso={workload.todayIso}
            doneCount={workload.doneCount}
            totalCount={workload.totalCount}
          />
        ) : null}
        {followups && user ? (
          <PersonFollowupsCard followups={followups} personName={user.name ?? 'You'} />
        ) : null}
        {meetings ? <PersonMeetingsCard meetings={meetings} /> : null}
        <div id="notifications" className="scroll-mt-6">
          <NotificationsCard items={notificationItems} />
        </div>
      </div>

      {/* ——— Team ——— */}
      <ZoneLabel>Team</ZoneLabel>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <CapacityHeat capacities={capacities} isAdmin={isAdmin} apps={assignableApps} />
        <ActiveSprints sprints={activeSprints} nextSprint={nextSprint} />
      </div>

      {/* ——— Portfolio ——— */}
      <ZoneLabel>Portfolio</ZoneLabel>
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
    </div>
  )
}
