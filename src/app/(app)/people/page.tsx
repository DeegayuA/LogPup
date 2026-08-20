import { Suspense } from 'react'
import Link from 'next/link'
import { History, PawPrint } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { getPeopleNow, getUserCapacities } from '@/features/people/queries'
import { listApps, type AppPortfolioEntry } from '@/features/apps/queries'
import { loadActor } from '@/features/auth/actor'
import { PeopleDirectory } from '@/features/people/components/directory'
import { CohortNav } from '@/features/people/components/cohort-nav'
import {
  CohortDataSkeleton,
  DirectoryDataSkeleton,
  ProjectCohortList,
  ProjectOverlapView,
  SharedPeopleList,
} from '@/features/people/components/cohort-views'
import {
  buildOverlapReport,
  buildProjectCohorts,
  buildSharedPeople,
} from '@/features/people/cohorts'
import {
  COHORT_VIEW_HINT,
  parseCohortParams,
  type CohortParams,
  type RawCohortParams,
} from '@/features/people/cohort-params'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'

/**
 * FOUR VIEWS OF THE SAME ROSTER, all URL state.
 *
 * "People" is the directory this page has always been and is unchanged: same
 * component, same props, same client-side filter. The three cohort views
 * answer the question it could not — who works WITH whom — by folding the very
 * same capacity read the other way round (features/people/cohorts.ts). Which
 * one is in front lives entirely in the query string (cohort-params.ts), so
 * every cohort is a link and the page stays a server component.
 *
 * ── QUERY BUDGET ──────────────────────────────────────────────────────────
 * No new query was written for any of this, and none of them grows with the
 * number of people or projects:
 *   people   getUserCapacities (1) + getPeopleNow (2)   — exactly as before
 *   shared   getUserCapacities (1) + loadActor (≤1)
 *   overlap  getUserCapacities (1) + loadActor (≤1)
 *   projects getUserCapacities (1) + loadActor (≤1) + listApps (6, batched)
 * `listApps` is the portfolio read /apps already runs — six fixed aggregates
 * whatever the workspace size — and it is reused rather than re-implemented so
 * the health verdict on a project card here is literally the one app-health.ts
 * computed for /apps, never a second calculation that could disagree with it.
 * Both reads are wrapped in React `cache`, so the two components below share
 * one round trip per request even where both would ask.
 *
 * ── THE SIX FRONTEND API SKILLS ───────────────────────────────────────────
 * APPLY:
 *  • Request dedup — `getUserCapacities` and `listApps` are React-`cache`d, so
 *    the view switch, the data body and anything else on this request share a
 *    single read of each. This is the reason a cohort view can ask for the
 *    capacity list without caring whether the directory already did.
 *  • Streaming UI — the title and the view switch render from the URL alone,
 *    before anything is awaited, behind a <Suspense> boundary with a skeleton
 *    (never a spinner). Switching views therefore never blanks the control you
 *    just clicked.
 *  • Preloading — every control on this page is a <Link>, so Next prefetches
 *    the next view on hover and in-viewport. Nothing hand-rolled: making the
 *    controls links instead of buttons IS the preloading strategy here.
 * DO NOT APPLY:
 *  • Optimistic updates + rollback — there is no mutation on this page. All
 *    four views are reads; assignments are edited on /apps and the dashboard,
 *    which own that interaction and its rollback.
 *  • SWR / client-side cache — nothing is fetched from the client at all.
 *    Every view is server-rendered from URL state, so a client cache would be
 *    a second copy of data the server already streams, with its own staleness.
 *  • Smart polling — allocations change when somebody edits an assignment,
 *    which is a navigation, not an event this page can miss. Polling would
 *    re-run a six-query portfolio batch for a page whose answer changes a few
 *    times a week.
 */

// Only the "nobody exists yet" case lives here now — an empty *search* result
// is rendered by PeopleDirectory, which owns the query text. No action slot:
// people join through sign-up approval, so this emptiness is genuinely
// terminal for whoever is reading it.
function NobodyYet() {
  return (
    <div className="rounded-xl border border-dashed px-6 py-8">
      <EmptyState
        icon={PawPrint}
        title="Nobody in the pack yet."
        description="Teammates appear here once they join the workspace."
      />
    </div>
  )
}

export default async function PeoplePage(props: {
  searchParams: Promise<RawCohortParams>
}) {
  const params = parseCohortParams(await props.searchParams)

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
      <div className="flex flex-col gap-4">
        {/* One sentence per view, from cohort-params.ts, so the lead under
            the title always describes what is actually below it. */}
        <PageHeader
          title="People"
          description={COHORT_VIEW_HINT[params.view]}
          actions={
            <Button variant="outline" size="sm" render={<Link href="/people/history" />}>
              <History aria-hidden /> Capacity history
            </Button>
          }
        />

        <CohortNav params={params} />
      </div>

      {/* Only the DATA waits. The header and the view switch above are rendered
          from the URL alone, so they are on screen and clickable while the
          reads behind whichever view is in front are still running. */}
      <Suspense
        fallback={params.view === 'people' ? <DirectoryDataSkeleton /> : <CohortDataSkeleton />}
      >
        {params.view === 'people' ? <DirectoryData /> : <CohortData params={params} />}
      </Suspense>
    </div>
  )
}

/**
 * The directory, unchanged. Same two reads in the same order, the same props
 * into the same component — it has simply moved behind the page's Suspense
 * boundary so the view switch above it can paint first.
 */
async function DirectoryData() {
  // Everyone is loaded once; the name filter is client-side inside
  // PeopleDirectory so it narrows on every keystroke instead of needing a
  // form submit and a server round trip per search.
  const people = await getUserCapacities()
  // Two more queries for the whole page, not two per person — getPeopleNow is
  // batched precisely because this list grows with the workspace.
  const now = await getPeopleNow(people.map((person) => person.user.id))
  // Resolved here, in the business timezone, so no row calls `new Date()` and
  // every "overdue" on the page agrees about which day it is.
  const todayIso = toIsoDateInTimeZone(new Date(), LK_TIMEZONE)

  // The stat strip lives inside PeopleDirectory — it has to count the rows the
  // org filter actually leaves on screen, not every search result.
  if (people.length === 0) return <NobodyYet />
  return <PeopleDirectory people={people} now={now} todayIso={todayIso} />
}

/**
 * The three cohort views.
 *
 * `getPeopleNow` is deliberately NOT read here: "what is this person doing
 * right now" is a directory row's business, and none of these views renders
 * it. Skipping it is two fewer queries on every cohort view.
 */
async function CohortData({ params }: { params: CohortParams }) {
  // Only "By project" needs the portfolio — it is the one view that names a
  // PM, a lead, a sprint and a health verdict, and the only one that has to
  // show projects nobody is assigned to. Same shape as TeamZone's conditional
  // read on the dashboard: don't pay for a query the view will not render.
  const needsPortfolio = params.view === 'projects'
  const [people, actor, apps] = await Promise.all([
    getUserCapacities(),
    // ONE query for the whole request (features/auth/actor.ts), after which
    // every `can()` below is a pure lookup. This is what lets visibility be
    // decided per project without a check per project hitting the database.
    loadActor(),
    needsPortfolio ? listApps() : Promise.resolve<AppPortfolioEntry[]>([]),
  ])

  const cohorts = buildProjectCohorts(people)

  if (params.view === 'projects') {
    // Membership comes from the capacity read, not from listApps' member rows:
    // that one joins `assignments` to every user, while getUserCapacities is
    // filtered to the active, approved roster. Using one source for all four
    // views is what stops "By project" listing somebody "Shared" has never
    // heard of.
    const byApp = new Map(cohorts.map((cohort) => [cohort.appId, cohort]))
    const todayIso = toIsoDateInTimeZone(new Date(), LK_TIMEZONE)
    return (
      <ProjectCohortList
        apps={apps}
        cohorts={byApp}
        actor={actor}
        todayIso={todayIso}
      />
    )
  }

  if (params.view === 'shared') {
    // The ranking follows what the reader can see: by how evenly someone is
    // Ranked by how fragmented the person is, which is the question this
    // view exists to answer. The card's own description says so.
    return (
      <SharedPeopleList
        rows={buildSharedPeople(people, { rankBySplit: true })}
        params={params}
      />
    )
  }

  // Overlap. The anchor is a slug in the URL; an unreadable one falls back to
  // the first project rather than erroring, and the view says on screen that
  // it did — the same rule the capacity-history date picker follows.
  const requested = params.project
    ? cohorts.find((cohort) => cohort.slug === params.project)
    : undefined
  const anchor = requested ?? cohorts[0]
  return (
    <ProjectOverlapView
      cohorts={cohorts}
      report={anchor ? buildOverlapReport(cohorts, anchor.appId) : null}
      params={params}
      unknownProject={Boolean(params.project) && !requested}
    />
  )
}
