import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSession } from '@/lib/session'
import { z } from 'zod'
import { LazyDisclosure } from '@/components/shared/lazy-disclosure'
import { AllocationHistoryCard } from '@/features/people/components/allocation-history-card'
import { PersonAppRoleHistoryCard } from '@/features/people/components/app-role-history-card'
import { AssignmentsCard } from '@/features/people/components/assignments-card'
import { PersonActivityCard } from '@/features/people/components/person-activity-card'
import { PersonFollowupsCard } from '@/features/people/components/person-followups-card'
import { loadActor } from '@/features/auth/actor'
import { can, effectiveGrant } from '@/features/auth/capabilities'
import { maintenanceActiveNow } from '@/features/maintenance/freeze'
import { canViewPerson } from '@/features/people/visibility'
import { PersonHeader } from '@/features/people/components/person-header'
import { PersonMeetingsCard } from '@/features/people/components/person-meetings-card'
import { PersonStatRow } from '@/features/people/components/person-stat-row'
import { PersonSummaryCard } from '@/features/people/components/person-summary-card'
import { derivePersonSummary, factsFromPersonViews } from '@/features/people/summary'
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
  listAssignableApps,
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

  // Who is LOOKING — the meetings card is viewer-scoped now (attendees-only
  // meetings exist), and getSession is request-cached, so this costs nothing
  // the shell has not already paid for.
  const session = await getSession()
  const viewerId = session?.user?.id ?? ''

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
  const [
    overview,
    workload,
    followups,
    meetings,
    activity,
    history,
    roleHistory,
    actor,
    assignableApps,
  ] = await Promise.all([
    getPersonOverview(userId),
    getPersonWorkload(userId),
    getPersonFollowups(userId),
    getPersonMeetings(userId, viewerId),
    getPersonActivity(userId),
    getPersonAllocationHistory(userId),
    getPersonAppRoleHistory(userId),
    // Whether to OFFER the workload controls AT ALL. NOT `can(actor,
    // 'app.assign')` (no resource) or the old `requireCapability('app.assign')`
    // (same thing): `app.assign` is SCOPED for manager, and asking a scoped
    // grant with no resource fails closed — every manager lost this door even
    // though `assignUser`/`updateAssignment`/`removeAssignment` (each asked
    // WITH the real appId) would accept them. This page is per-PERSON, not
    // per-app, so there is no single appId to ask `can()` with either; the
    // door is therefore the SEAT question — does this role hold app.assign at
    // all. Each row's actual controls DO stay app-scoped below, via
    // `assignableAppIds` computed after this Promise.all (one `can()` per app,
    // against its real id) — a manager who runs app-1 gets Edit/Remove only on
    // that row and a picker limited to that project, not every one.
    loadActor(),
    // Joined to the same fan-out rather than fetched behind the gate: it is a
    // small cached read, and awaiting it after `canAssign` would put a second
    // round trip in front of the one page section that needs it.
    listAssignableApps(),
  ])

  if (!overview) notFound()

  // THE MATRIX'S GATE, finally enforced here (security review F7 — this page
  // had none). `user.view.directory` deliberately lists everyone for members
  // by design; the DETAIL page is what the matrix actually scopes (editor and
  // member: 'scoped', stakeholder: 'none'), so a client-seat stakeholder or a
  // member outside this person's projects must get the same `notFound()`
  // every other refused route in this app returns — never a 200 with a
  // page they should not have reached.
  //
  // Reuses `overview.assignments`, already fetched above for the Assignments
  // card — no second query for the appIds this person is scoped by.
  if (!actor || !canViewPerson(actor, { id: userId, appIds: overview.assignments.map((a) => a.appId) })) {
    notFound()
  }

  // `requireCapability` applies the maintenance-freeze refusal itself; this
  // door bypasses it (loadActor + effectiveGrant, not requireCapability) so
  // the freeze has to be re-checked here, or the controls draw and every save
  // 404s for the whole duration of an active window.
  const canAssign =
    actor !== null &&
    effectiveGrant(actor.role, actor.employmentType, 'app.assign') !== 'none' &&
    !(await maintenanceActiveNow())

  // The PER-APP door, for the controls themselves. Admin/superadmin's grant is
  // 'all', so `can()` answers true for every app with no scope lookup; a
  // manager's is 'scoped', so this is exactly the ids `app.assign`'s scope
  // arm actually reaches for THEM — never every live project, which is what
  // canAssign alone used to leave every row and the picker offering.
  //
  // Candidates are `assignableApps` (the live projects the "Add" picker may
  // offer) UNION every appId this person already has a row for — an existing
  // assignment can sit on a paused or archived app, which `listAssignableApps`
  // deliberately excludes, and `can()` only matches `appId` against the
  // actor's scope; it does not care whether the app is live. Checking the
  // live list alone would silently hide Edit/Remove on a manager's own
  // archived-app row.
  const candidateAppIds = new Set(assignableApps.map((app) => app.id))
  for (const a of overview.assignments) candidateAppIds.add(a.appId)
  const assignableAppIds = actor
    ? [...candidateAppIds].filter((appId) => can(actor, 'app.assign', { appId }))
    : []

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

      {/* Server-derived first paint: the same four views feed the fact sheet,
          so this costs no extra query and no skeleton. The card itself asks
          once for the AI rewrite and swaps it in when one exists. */}
      <PersonSummaryCard
        personId={userId}
        initial={{
          text: derivePersonSummary(
            factsFromPersonViews({ overview, workload, followups, meetings }),
          ),
          source: 'derived',
          model: null,
          generatedAtIso: new Date().toISOString(),
        }}
      />

      {/*
        One flat grid, not two hand-built columns. DOM order IS the mobile
        order — overloaded (Workload) → owes (Follow-ups) → doing (Tasks) →
        calendar — and on a wide screen the same order flows row-major into two
        columns. Two column <div>s would have read correctly at 1440px and
        shuffled into nonsense at 375px, which is the usual way this layout
        goes wrong.

        Obligations now precede current work in that order, where Tasks used to
        come second. What somebody owes, and how long they have owed it, is the
        thing a reader can act on; what they are doing is context for it.

        `items-start` keeps a short card from stretching to match a tall
        neighbour — which is right, and is also why the PAIRING below has to do
        the work instead. History is no longer in this grid at all: three
        full-width bands of archive belong behind the disclosure underneath.
      */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* PAIRED BY HOW THEY GROW, not by subject. Every card here is
            data-driven, and which one is tall is a property of the PERSON, not
            of the card: Assignments renders one row per app and Follow-ups
            renders every open item — neither query carries a LIMIT — while
            Tasks and Meetings both self-cap at five rows per group. The old
            order paired unbounded with capped twice (Assignments|Tasks, then
            Follow-ups|Meetings), and because a grid row is as tall as its
            TALLEST cell, each pairing stranded the capped side's column empty
            for the rest of the row. Pairing unbounded with unbounded and capped
            with capped closes that gap with no layout machinery at all — no
            masonry, no spans, no hand-built columns. */}
        <AssignmentsCard
          assignments={overview.assignments}
          totalPct={overview.totalPct}
          overallocated={overview.overallocated}
          personId={userId}
          personName={overview.user.name}
          canAssign={canAssign}
          // Nothing to choose from when the reader cannot assign anyway, so the
          // project list is not shipped to their browser either.
          assignableApps={canAssign ? assignableApps : []}
          // Per-row gate: a manager who runs app-1 only sees Edit/Remove on
          // that row and only that project in either picker, not every one.
          assignableAppIds={canAssign ? assignableAppIds : []}
        />

        <PersonFollowupsCard
          followups={followups}
          personName={overview.user.name}
          /* Reading your own page is a normal thing to do — PersonHeader says
             so — and without this the card addresses you in the third person
             about yourself: "Deeghayu owes", "They aren't waiting on anyone". */
          self={viewerId === userId}
        />

        <PersonTasksCard
          openTasks={workload.openTasks}
          todayIso={workload.todayIso}
          doneCount={workload.doneCount}
          totalCount={workload.totalCount}
        />

        <PersonMeetingsCard meetings={meetings} />
      </div>

      {/* HISTORY, BEHIND A DISCLOSURE.
          These three were `lg:col-span-2` siblings inside the grid — three
          full-width bands stacked below the fold, which is roughly three
          screens of archival material sitting between the reader and nothing.
          They answer "what happened" and never "what do I do now", so they
          rank last; collapsing them is what lets the four live cards above own
          the viewport.

          LazyDisclosure rather than a bare <details>: its children are not
          MOUNTED until it is opened, so a 26-week contribution grid, a 600-unit
          step chart and the full role ledger cost nothing on a page nobody
          scrolled. Native disclosure semantics, no client JS of our own. */}
      <LazyDisclosure
        summary="History"
        hint="Contribution activity, allocation over time, and past project roles."
      >
        <div className="flex flex-col gap-6">
          <PersonActivityCard activity={activity} />
          <AllocationHistoryCard history={history} />
          <PersonAppRoleHistoryCard history={roleHistory} />
        </div>
      </LazyDisclosure>
    </div>
  )
}
