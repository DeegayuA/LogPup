import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Coins, TrendingDown } from 'lucide-react'

import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { loadActor } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'
import { portfolioCost } from '@/features/finance/queries'
import { getProgressMatrix } from '@/features/worklog/progress-queries'
import { resolveWorkDay } from '@/features/worklog/worklog-day'
import { cn } from '@/lib/utils'

/**
 * WHERE THE MONEY AND THE HOURS ARE — the workspace, not one project.
 *
 * `portfolioCost` has existed and had no surface: every project's cost in one
 * pass, already written, already gated, never rendered. The only finance
 * surface in the app was a card on a single project's page, which answers
 * "what did Falcon cost" and never "which project is eating the studio".
 *
 * WHAT IS DELIBERATELY NOT HERE: cost per PERSON. A bar chart of hourly rate
 * by individual is a salary chart with extra steps — there is no per-person
 * cost column, and every row below is a project or an hours-and-coverage
 * summary. A one-contributor project's row DOES let a reader divide that
 * row's cost by its hours into somebody's rate; see the guard note below for
 * why that is deliberate here, not an oversight.
 *
 * THE SINGLE-CONTRIBUTOR GUARD IS NARROWER THAN THE TABLE LOOKS. A cost
 * figure over fewer than MIN_COST_CONTRIBUTORS people lets a reader solve for
 * somebody's rate (cost.ts) — but only for a reader who does not already hold
 * `finance.view`. Every viewer of THIS page does (the `notFound()` below), so
 * `portfolioCost` passes `viewerSeesRates: true` and a one-contributor
 * project's real cost renders in the table: refusing it protected nobody,
 * since that admin can already read the same rate straight off the rate
 * card. A project with ZERO contributors still reads "no hours yet" for
 * everyone — there is no rate to reconstruct either way, so that case was
 * never a privacy rule (see MIN_COST_CONTRIBUTORS in cost.ts).
 *
 * People are measured here in HOURS AND COVERAGE, which is the honest pair:
 * hours are a measurement somebody made, coverage is what the studio expected
 * of them. Neither is a verdict on the person.
 */

const WINDOW_DAYS = 30

function shift(iso: string, days: number): string {
  const cursor = new Date(`${iso}T12:00:00Z`)
  cursor.setUTCDate(cursor.getUTCDate() + days)
  return cursor.toISOString().slice(0, 10)
}

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-LK', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    amount,
  )

export default async function AdminInsightsPage() {
  const actor = await loadActor()
  // The same capability portfolioCost itself requires — checked here too so
  // the route 404s rather than rendering a page of "denied" panels.
  if (!actor || !can(actor, 'finance.view')) notFound()

  const today = resolveWorkDay(new Date())
  const from = shift(today, -WINDOW_DAYS)

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <PageHeader
        title="Insights"
        description={`Where the studio's time and money went, the last ${WINDOW_DAYS} days.`}
      />

      <Suspense fallback={<TableSkeleton rows={6} />}>
        <ProjectsZone from={from} to={today} />
      </Suspense>

      <Suspense fallback={<TableSkeleton rows={8} />}>
        <PeopleZone actorId={actor.id} from={from} to={today} />
      </Suspense>
    </div>
  )
}

async function ProjectsZone({ from, to }: { from: string; to: string }) {
  const result = await portfolioCost(from, shift(to, 1))
  if (result.state === 'denied') notFound()

  // Priced work first and heaviest first: the reader is looking for the
  // expensive one, not the alphabetical one. Projects with no hours at all sit
  // at the bottom rather than being dropped — "nobody logged against this"
  // is itself an answer on a page about where time went.
  //
  // `row.hours` reads directly on EITHER state now — hours is never withheld
  // (see the module header), so there is no longer a suppressed case to
  // special-case here the way `row.cost` still must be below.
  const rows = [...result.rows].sort((a, b) => b.hours - a.hours)
  const totalHours = rows.reduce((sum, row) => sum + row.hours, 0)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Coins className="size-4 text-primary" aria-hidden />
          <h2 className="font-heading text-sm font-semibold">Projects</h2>
        </div>
        <p className="font-mono text-2xs tabular-nums text-muted-foreground">
          {totalHours.toFixed(1)}h attributed
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Cost appears here as soon as there is a project with hours against it."
          className="rounded-xl border border-dashed"
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card/50">
          <table className="w-full min-w-[36rem] text-xs">
            <thead className="text-2xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="px-3 py-2 text-left font-medium">Project</th>
                <th className="px-3 py-2 text-right font-medium">People</th>
                <th className="px-3 py-2 text-right font-medium">Hours</th>
                <th className="px-3 py-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.appId} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-2">
                    <Link href={`/apps`} className="rounded-sm hover:underline">
                      {row.appName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                    {row.contributorCount}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {/* Hours, unlike cost, is never withheld — Σhours alone
                        does not divide into anyone's rate (only cost ÷ hours
                        does), so `SuppressedCostFigure` carries it too. */}
                    {row.hours.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {row.state === 'suppressed' ? (
                      /* On this page `contributorCount === 0` (no hours yet)
                         is the only reachable case — `viewerSeesRates` above
                         already releases the 1-contributor cost to every
                         actual viewer here. The other branch stays for a
                         future caller that has not made that check. */
                      <span className="text-2xs text-muted-foreground">
                        {row.contributorCount === 0 ? 'no hours yet' : 'withheld · one person'}
                      </span>
                    ) : row.cost.amount === null ? (
                      <span className="text-2xs text-muted-foreground">no rate set</span>
                    ) : (
                      <span className="flex flex-col items-end">
                        <span>{money(row.cost.amount, row.cost.currency ?? 'LKR')}</span>
                        {row.cost.unpricedMinutes > 0 ? (
                          <span
                            className="text-2xs text-amber-600 dark:text-amber-400"
                            title="Hours from people with no rate on the rate card — not included in the figure beside them."
                          >
                            +{(row.cost.unpricedMinutes / 60).toFixed(1)}h unpriced
                          </span>
                        ) : null}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-2xs text-muted-foreground">
        A project with no hours logged yet shows no cost — there is nothing to price. Every other
        project shows its real cost, unless nobody on it has a rate on the rate card, which the
        row says instead (&ldquo;no rate set&rdquo;) — and a row flagged &ldquo;unpriced&rdquo; is
        showing only the hours that had one. This page is restricted to the seats that can
        already read every rate on the rate card, so there is nothing left to protect by hiding a
        real figure here.
      </p>
    </section>
  )
}

async function PeopleZone({
  actorId,
  from,
  to,
}: {
  actorId: string
  from: string
  to: string
}) {
  const matrix = await getProgressMatrix({ scope: 'all', actorId, from, to, today: to })

  const rows = matrix.people
    .map((person) => {
      let minutes = 0
      const byApp = new Map<string, number>()
      for (const entries of person.entriesByDay.values()) {
        for (const entry of entries) {
          minutes += entry.minutes
          const name = entry.appName ?? 'No project'
          byApp.set(name, (byApp.get(name) ?? 0) + entry.minutes)
        }
      }
      const top = [...byApp.entries()].sort((a, b) => b[1] - a[1])[0] ?? null
      return { person, hours: minutes / 60, top }
    })
    // Most owed days first — the page's job is finding who is behind, and
    // getProgressMatrix already sorts that way; re-stated here so a change to
    // its ordering cannot silently reorder this table into something else.
    .sort((a, b) => b.person.coverage.missing - a.person.coverage.missing)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <TrendingDown className="size-4 text-chart-1" aria-hidden />
        <h2 className="font-heading text-sm font-semibold">People</h2>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card/50">
        <table className="w-full min-w-[40rem] text-xs">
          <thead className="text-2xs uppercase tracking-wide text-muted-foreground">
            <tr className="border-b border-border/60">
              <th className="px-3 py-2 text-left font-medium">Person</th>
              <th className="px-3 py-2 text-right font-medium">Days logged</th>
              <th className="px-3 py-2 text-right font-medium">Behind</th>
              <th className="px-3 py-2 text-right font-medium">Hours</th>
              <th className="px-3 py-2 text-left font-medium">Mostly on</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ person, hours, top }) => (
              <tr key={person.id} className="border-b border-border/40 last:border-0">
                <td className="px-3 py-2">
                  <Link href={`/people/${person.id}`} className="rounded-sm hover:underline">
                    {person.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                  {person.coverage.logged.toFixed(1)}/{person.coverage.expected.toFixed(1)}
                </td>
                <td
                  className={cn(
                    'px-3 py-2 text-right font-mono tabular-nums',
                    person.coverage.missing > 0 ? 'text-chart-1' : 'text-muted-foreground',
                  )}
                >
                  {person.coverage.missing > 0 ? person.coverage.missing.toFixed(1) : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {/* An em dash, never 0.0h — nobody has logged an hour in this
                      workspace yet, and a zero here would read as "worked no
                      hours" rather than "recorded none". */}
                  {hours > 0 ? `${hours.toFixed(1)}h` : '—'}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {top ? `${top[0]} · ${(top[1] / 60).toFixed(1)}h` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-2xs text-muted-foreground">
        Days logged counts whole and half days against what each person&rsquo;s schedule expected,
        so a Saturday counts as half. Hours are what they recorded against projects — separate
        from the score, and not a judgement on anybody.
      </p>
    </section>
  )
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-32" />
      <div className="flex flex-col gap-1 rounded-2xl border border-border/70 p-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    </div>
  )
}
