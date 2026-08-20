import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { AllocationHistoryCard } from '@/features/people/components/allocation-history-card'
import { PersonAppRoleHistoryCard } from '@/features/people/components/app-role-history-card'
import { AssignmentsCard } from '@/features/people/components/assignments-card'
import { PersonActivityCard } from '@/features/people/components/person-activity-card'
import { PersonFollowupsCard } from '@/features/people/components/person-followups-card'
import { PersonHeader } from '@/features/people/components/person-header'
import { PersonMeetingsCard } from '@/features/people/components/person-meetings-card'
import { PersonStatRow } from '@/features/people/components/person-stat-row'
import { PersonTasksCard } from '@/features/people/components/person-tasks-card'
import { buildPersonStats } from '@/features/people/person-stats'
import {
  getPersonActivity,
  getPersonAllocationHistory,
  getPersonAppRoleHistory,
  getPersonFollowups,
  getPersonMeetings,
  getPersonOverview,
  getPersonWorkload,
} from '@/features/people/queries'

/**
 * THE ROUTE PARAM IS VALIDATED BEFORE IT REACHES THE DATABASE, and this is not
 * defensive decoration. `users.id` is a `uuid` column, so `/people/banana` used
 * to hand Postgres a string it cannot cast and get back an exception —
 * "invalid input syntax for type uuid" — not an empty result. That threw out of
 * the server component, and with no error boundary anywhere under app/ the user
 * landed on the framework's crash screen for what is simply a bad URL.
 *
 * A malformed id is a 404, not a 500: there is no person at that address and
 * there never could be. Parsing here rather than inside each query keeps the
 * queries honest about their contract (they document that callers must have
 * validated) and means the check happens once for all five of them.
 */
const personId = z.uuid()

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await props.params
  const parsed = personId.safeParse(id)
  // No throw and no notFound() here — metadata generation is not the place to
  // decide the response. The page component owns that, and does the same parse.
  if (!parsed.success) return { title: 'Person not found' }

  // Deduplicated with the page's own call by React `cache` (see queries.ts), so
  // titling the tab costs no extra database work.
  const overview = await getPersonOverview(parsed.data)
  if (!overview) return { title: 'Person not found' }

  return {
    title: overview.user.name,
    description: `Workload, tasks, follow-ups and meetings for ${overview.user.name}.`,
  }
}

export default async function PersonDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const parsed = personId.safeParse(id)
  if (!parsed.success) notFound()
  const userId = parsed.data

  /**
   * SIX READS, ALL IN PARALLEL — never N+1. Every section of this page is a
   * single query (or, where a lifetime count is needed alongside a list, one
   * query plus one aggregate issued together inside that function). Nothing
   * here loops over a result set issuing more queries, and nothing fans out
   * per app, per task or per meeting.
   *
   * The overview is awaited with the rest rather than first-then-others: an id
   * that matches nobody is rare enough that serialising every load to rule it
   * out costs more than the five wasted queries on the rare miss.
   */
  const [overview, workload, followups, meetings, activity, history, roleHistory] = await Promise.all([
    getPersonOverview(userId),
    getPersonWorkload(userId),
    getPersonFollowups(userId),
    getPersonMeetings(userId),
    getPersonActivity(userId),
    getPersonAllocationHistory(userId),
    getPersonAppRoleHistory(userId),
  ])

  if (!overview) notFound()

  /**
   * The stat strip is derived from the SAME summaries the cards below render —
   * `workload.load` is what the Tasks card buckets, `followups.owed` is what the
   * Follow-ups card lists — so a tile can never contradict the section it is
   * summarising. That was the point of building the tiles as data
   * (person-stats.ts) instead of hand-writing seven numbers here.
   */
  const stats = buildPersonStats({
    totalPct: overview.totalPct,
    assignmentCount: overview.assignments.length,
    tasks: workload.load,
    doneCount: workload.doneCount,
    totalTaskCount: workload.totalCount,
    meetingsAttended: meetings.attendedRecently,
    meetingsWindowDays: meetings.attendedWindowDays,
    followupsOwed: followups.owed.length,
    followupsAwaiting: followups.awaiting.length,
    followupsOldestOwedDays: followups.oldestOwedDays,
  })

  return (
    <div className="relative flex flex-1 flex-col gap-6 p-6 md:p-8 overflow-hidden">
      {/* Background ambient lighting */}
      <div
        className="pointer-events-none absolute -top-40 right-1/4 -z-10 h-[450px] w-[600px] rounded-full bg-primary/8 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-1/2 -left-40 -z-10 h-[400px] w-[500px] rounded-full bg-chart-1/5 blur-3xl"
        aria-hidden
      />
      <PersonHeader overview={overview} />

      <PersonStatRow stats={stats} />

      {/*
        One flat grid, not two hand-built columns. DOM order IS the mobile
        order — overloaded (Workload) → doing (Tasks) → owes (Follow-ups) →
        calendar → history — and on a wide screen the same order flows
        row-major into two columns. Two column <div>s would have read
        correctly at 1440px and shuffled into nonsense at 375px, which is the
        usual way this layout goes wrong.

        `items-start` keeps a short card from stretching to match a tall
        neighbour; the last two span both columns because a 26-week grid and a
        step chart both want the width.
      */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <AssignmentsCard
          assignments={overview.assignments}
          totalPct={overview.totalPct}
          overallocated={overview.overallocated}
        />

        <PersonTasksCard
          openTasks={workload.openTasks}
          todayIso={workload.todayIso}
          doneCount={workload.doneCount}
          totalCount={workload.totalCount}
        />

        <PersonFollowupsCard followups={followups} personName={overview.user.name} />

        <PersonMeetingsCard meetings={meetings} />

        <div className="lg:col-span-2">
          <PersonActivityCard activity={activity} />
        </div>

        <div className="lg:col-span-2">
          <AllocationHistoryCard history={history} />
        </div>

        <div className="lg:col-span-2">
          <PersonAppRoleHistoryCard history={roleHistory} />
        </div>
      </div>
    </div>
  )
}
