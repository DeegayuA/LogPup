import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { loadActor } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'
import { isoDayOf } from '@/features/people/iso-day'
import { listActiveUsers, listAssignableApps } from '@/features/people/queries'
import {
  listAppHeadcounts,
  listPersonRates,
  listProjectValues,
  listRoleRates,
} from '@/features/finance/rate-queries'
import { RatesRoleForm, RatesRoleTable } from '@/features/finance/components/rates-role-card'
import { RatesPersonCard } from '@/features/finance/components/rates-person-card'
import { RatesProjectCard } from '@/features/finance/components/rates-project-card'

/**
 * /admin/rates — the caller `rate-actions.ts`'s five actions never had.
 *
 * Before this page, `rate_cards`, `person_rates` and `project_value` were
 * empty because nothing in the repo called `setRoleRate`, `setPersonRate` or
 * `setProjectValue` — every project on /admin/insights read "no rate set" for
 * exactly that reason. This page is the missing caller, gated on the same
 * `finance.view` capability those actions (and /admin/insights) already
 * require.
 *
 * `loadActor` + `can()` + `notFound()`, the `insights/page.tsx` form rather
 * than `requireCapability` — the page needs the actor object regardless, and
 * a 404 beats a page of denial panels for a seat that should not know this
 * route exists.
 *
 * Suspense split: the static headings and the role-rate form (it needs no
 * server data — JOB_ROLE_GROUPS is a static import) paint in the first
 * flush; each of the three tables gets its own boundary so a slow read never
 * blocks the other two, and the person/project forms share a boundary with
 * their own picker rows since both need the same query.
 */
export default async function AdminRatesPage() {
  const actor = await loadActor()
  if (!actor || !can(actor, 'finance.view')) notFound()

  // Resolved once, in the business timezone, and threaded down — a client
  // component must never call `new Date()` for this, which would read the
  // viewer's browser timezone instead of Asia/Colombo.
  const today = isoDayOf(new Date())

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <PageHeader
        title="Rates"
        description="What an hour costs, and what a project is worth."
      />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-heading text-sm font-semibold">Role rate cards</h2>
          <p className="text-2xs text-muted-foreground">
            Job role → hourly rate, from a date.
          </p>
        </div>
        {/* The form needs no server data (JOB_ROLE_GROUPS is a static
            import), so it paints in the first flush, ahead of its table —
            see the spec's "Controls before data" and the card's header. */}
        <RatesRoleForm today={today} />
        <Suspense fallback={<TableSkeleton rows={5} />}>
          <RoleRatesZone today={today} />
        </Suspense>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-heading text-sm font-semibold">Person overrides</h2>
          <p className="text-2xs text-muted-foreground">
            One person&apos;s rate, when it differs from their role&apos;s.
          </p>
        </div>
        <Suspense fallback={<TableSkeleton rows={5} />}>
          <PersonRatesZone today={today} />
        </Suspense>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-heading text-sm font-semibold">Project value</h2>
          <p className="text-2xs text-muted-foreground">
            Contract value and/or monthly subscription, per app.
          </p>
        </div>
        <Suspense fallback={<TableSkeleton rows={5} />}>
          <ProjectValueZone />
        </Suspense>
      </section>
    </div>
  )
}

async function RoleRatesZone({ today }: { today: string }) {
  const result = await listRoleRates()
  if (result.state === 'denied') notFound()
  return <RatesRoleTable rows={result.rows} today={today} />
}

async function PersonRatesZone({ today }: { today: string }) {
  const [result, people] = await Promise.all([listPersonRates(), listActiveUsers()])
  if (result.state === 'denied') notFound()
  return <RatesPersonCard people={people} rows={result.rows} today={today} />
}

async function ProjectValueZone() {
  const [result, apps, headcountsResult] = await Promise.all([
    listProjectValues(),
    listAssignableApps(),
    listAppHeadcounts(),
  ])
  if (result.state === 'denied' || headcountsResult.state === 'denied') notFound()
  return (
    <RatesProjectCard
      apps={apps}
      rows={result.rows}
      headcounts={headcountsResult.counts}
    />
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
