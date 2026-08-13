import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getCapacityHistoryOverview } from '@/features/people/queries'
import { AsOfPicker } from '@/features/people/components/as-of-picker'
import { AllocationTrend } from '@/features/people/components/allocation-trend'
import { PersonStatRow } from '@/features/people/components/person-stat-row'
import { HistoryFilters } from '@/features/people/components/history-filters'
import {
  HistoryAppsTable,
  HistoryChangeLog,
  HistoryPeopleTable,
  OverloadCard,
} from '@/features/people/components/history-views'
import { hasMovement } from '@/features/people/capacity-compare'
import { Suspense } from 'react'
import { HistoryDataSkeleton } from '@/features/people/components/history-skeleton'
import {
  parseHistoryParams,
  resolveHistoryWindow,
  type HistoryParams,
  type RawHistoryParams,
} from '@/features/people/history-params'
import { buildCapacityHistoryStats } from '@/features/people/history-stats'

export const metadata = { title: 'Capacity history' }

/**
 * How the team's load got to where it is — not just a snapshot of a past day.
 *
 * The previous version rendered exactly one thing: the dashboard's capacity
 * list, re-run at a chosen date, capped at `max-w-2xl`. It could answer "who
 * was loaded on the 3rd" and nothing else — no movement, no per-app
 * percentages, no reason, no duration, and no trace of the `changedBy`/`note`
 * columns the history table has always written.
 *
 * This version is built around the four questions someone actually opens a
 * capacity page to answer:
 *   1. Where does the team stand, and which way is it moving? (stat strip +
 *      trend, every figure shown against the same figure a window ago)
 *   2. Who moved, and what did they pick up or put down? (person view)
 *   3. Which projects are eating the team? (app view)
 *   4. Why did any of it change, and who decided? (change log)
 * Plus the one thing a snapshot structurally cannot say: who has been over
 * capacity, and for how long.
 *
 * All of it is URL state (history-params.ts), so every view is linkable and
 * the page stays a server component with one query behind it.
 */
export default async function TeamCapacityHistoryPage(props: {
  searchParams: Promise<RawHistoryParams>
}) {
  const raw = parseHistoryParams(await props.searchParams)
  const { asOf, from, fromIso } = resolveHistoryWindow(raw)
  // Links are built from the RESOLVED day, never the raw param: an unreadable
  // `at` would otherwise be copied into every control's href, so the "that
  // date couldn't be read" banner could never be cleared by using the page.
  const params = { ...raw, at: asOf.isToday ? undefined : asOf.iso }

  // Formatted from the resolved DAY, not the instant: `asOf.at` is
  // 23:59:59.999 Asia/Colombo, and date-fns formats in the *server's* zone, so
  // running anywhere east of Colombo would print the following day here while
  // the picker still read the day the user asked for. Midday avoids either
  // boundary.
  const stamp = format(new Date(`${asOf.iso}T12:00:00`), 'EEEE, MMMM d, yyyy')
  const compareLabel = `${params.window} days earlier`

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-2xl font-bold tracking-tight">Capacity history</h1>
            <p className="text-sm text-muted-foreground">
              {asOf.isToday
                ? `Where the team stands today, and how it moved over the last ${params.window} days.`
                : `How the team was loaded on ${stamp}, against ${fromIso}.`}
            </p>
          </div>
          <Button variant="outline" size="sm" render={<Link href="/people" />}>
            <ArrowLeft aria-hidden /> People
          </Button>
        </div>

        {asOf.invalid ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            That date couldn’t be read, so today is shown instead.
          </p>
        ) : null}

        <AsOfPicker iso={asOf.iso} isToday={asOf.isToday} params={params} />
        <HistoryFilters params={params} />
      </div>

      {/* Only the DATA waits. The header and both pickers above are rendered
          from the URL alone, so they are on screen and interactive while the
          three history queries are still running — changing the date no
          longer blanks the control you just used. */}
      <Suspense fallback={<HistoryDataSkeleton />}>
        <HistoryData
          params={params}
          from={from}
          asOfAt={asOf.at}
          compareLabel={compareLabel}
        />
      </Suspense>
    </div>
  )
}

/**
 * Everything behind the capacity queries. Split out purely so the page above
 * can render without awaiting them — see the Suspense boundary there.
 */
async function HistoryData({
  params,
  from,
  asOfAt,
  compareLabel,
}: {
  params: HistoryParams
  from: Date
  asOfAt: Date
  compareLabel: string
}) {
  const overview = await getCapacityHistoryOverview(from, asOfAt)

  // One filter expression, applied per view against whatever names that view
  // actually shows — a person matches on their apps too, so filtering by an
  // app name answers "who is on this?" from the person view as well.
  const needle = params.q.toLowerCase()
  const deltaById = new Map(overview.deltas.map((delta) => [delta.userId, delta]))

  const people = overview.current
    .filter(
      (person) =>
        !needle ||
        person.user.name.toLowerCase().includes(needle) ||
        person.breakdown.some((app) => app.appName.toLowerCase().includes(needle)),
    )
    .filter((person) => {
      if (!params.movedOnly) return true
      const delta = deltaById.get(person.user.id)
      return delta ? hasMovement(delta) : false
    })

  const apps = overview.apps.filter(
    (app) =>
      !needle ||
      app.appName.toLowerCase().includes(needle) ||
      app.people.some((person) => person.name.toLowerCase().includes(needle)),
  )

  const changes = overview.changes.filter(
    (change) =>
      !needle ||
      (change.userName ?? '').toLowerCase().includes(needle) ||
      change.appName.toLowerCase().includes(needle),
  )

  const stats = buildCapacityHistoryStats(overview, params.window)
  const filteredListLabel = { people: 'people', apps: 'apps', changes: 'changes' }[params.view]

  return (
    <>
      {/* The strip answers "where does the team stand" in one line, and every
          tile's meta says which way that number moved — a bare number here
          would be exactly the snapshot this page used to be. */}
      <PersonStatRow stats={stats} className="xl:grid-cols-6" />

      {params.q || params.movedOnly ? (
        // The tiles, the trend and the overload card are always WHOLE-TEAM
        // figures — a "team average" recomputed over a filtered subset would
        // be a different statistic wearing the same label. Since the filter
        // sits directly above them, that has to be said rather than assumed.
        <p className="-mt-3 text-2xs text-muted-foreground">
          The figures above and the two cards below cover the whole team; the filter applies to the{' '}
          {filteredListLabel} list at the bottom.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Total team allocation</CardTitle>
            <CardDescription>
              Every allocation across the team, summed, at each point it changed in this window. The
              dashed line is one person&rsquo;s full capacity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* The reference line is the TEAM's capacity, not one person's:
                against a flat 100 every team of two or more sits permanently
                above the line, painted in the over-capacity colour, which
                would make the alarm meaningless. */}
            <AllocationTrend
              points={overview.trend}
              now={asOfAt}
              reference={overview.stats.headcount * 100}
              referenceLabel="full team"
            />
          </CardContent>
        </Card>

        <OverloadCard overloads={overview.overloads} windowDays={params.window} />
      </div>

      {params.view === 'people' ? (
        <HistoryPeopleTable people={people} deltas={deltaById} compareLabel={compareLabel} />
      ) : null}
      {params.view === 'apps' ? <HistoryAppsTable apps={apps} /> : null}
      {params.view === 'changes' ? <HistoryChangeLog changes={changes} /> : null}

      <p className="text-2xs text-muted-foreground">
        People are today&rsquo;s roster; only the allocations are historical. Someone deactivated
        since is not shown even if they carried work on that date.
      </p>
    </>
  )
}
