import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { SprintMetrics, VelocityEntry } from '@/features/sprints/sprint-metrics'
import { BurnChart } from '@/features/sprints/components/burn-chart'
import { VelocityChart } from '@/features/sprints/components/velocity-chart'
import { SprintPlanCard } from '@/features/sprints/components/sprint-plan-card'

/**
 * The Metrics tab: one sprint's numbers (chosen by `?sprint=`), its burndown
 * and burnup, and velocity across the project's finished sprints. Server
 * rendered; only the charts' hover is client-side.
 */

export type MetricsSprintOption = { id: string; name: string; status: 'planned' | 'active' | 'done' }

function pct(rate: number | null) {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border bg-card p-3">
      <span className="text-2xs text-muted-foreground">{label}</span>
      <span className="font-heading text-xl font-semibold tabular-nums">{value}</span>
      {hint ? <span className="text-2xs text-muted-foreground">{hint}</span> : null}
    </div>
  )
}

export function SprintMetricsPanel({
  slug,
  sprints,
  selected,
  metrics,
  velocity,
  averageVelocity,
  plan,
  canManageSprints,
}: {
  slug: string
  sprints: MetricsSprintOption[]
  selected: MetricsSprintOption | null
  metrics: SprintMetrics | null
  velocity: VelocityEntry[]
  averageVelocity: number | null
  plan: { capacity: number | null; committed: number | null; committedAt: Date | null } | null
  canManageSprints: boolean
}) {
  if (sprints.length === 0 || !selected || !metrics) {
    return (
      <section className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        <h2 className="sr-only">Metrics</h2>
        No sprints yet. Create a sprint on the Roadmap tab and its numbers will show up here.
      </section>
    )
  }

  const m = metrics
  return (
    <div className="flex flex-col gap-5">
      <h2 className="sr-only">Sprint metrics</h2>
      <nav aria-label="Choose a sprint" className="flex flex-wrap gap-1.5">
        {sprints.map((s) => (
          <Link
            key={s.id}
            href={`/apps/${slug}?tab=metrics&sprint=${s.id}`}
            aria-current={s.id === selected.id ? 'page' : undefined}
            className={cn(
              'rounded-full border px-3 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring',
              s.id === selected.id ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {s.name}
            {s.status === 'active' ? <span className="ml-1 text-primary">· now</span> : null}
          </Link>
        ))}
      </nav>

      {plan ? (
        <SprintPlanCard
          sprintId={selected.id}
          capacity={plan.capacity}
          committed={plan.committed}
          committedAt={plan.committedAt}
          scope={m.scopePoints}
          canManage={canManageSprints}
        />
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label={`${selected.name} in numbers`}>
        <Stat
          label="Points done"
          value={`${m.completedPoints} / ${m.scopePoints}`}
          hint={m.unestimatedCount > 0 ? `${m.unestimatedCount} task${m.unestimatedCount === 1 ? '' : 's'} not estimated` : undefined}
        />
        <Stat label="Tasks done" value={pct(m.completionRate)} hint={`${m.doneCount} of ${m.taskCount}`} />
        <Stat label="Blocked" value={String(m.blockedCount)} hint={m.blockedPoints > 0 ? `${m.blockedPoints} pts` : undefined} />
        <Stat label="Bugs" value={String(m.bugCount)} />
        <Stat label="QA rejection" value={pct(m.qaRejectionRate)} hint="failed / sent to QA" />
        <Stat
          label="Carry-over"
          value={m.carryOver ? String(m.carryOver.count) : '—'}
          hint={m.carryOver ? `${m.carryOver.points} pts left undone` : 'once the sprint ends'}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
          <h3 className="font-heading text-sm font-semibold">Burndown</h3>
          <p className="text-2xs text-muted-foreground">Points left to do each day. Below the dashed line is ahead of plan.</p>
          <BurnChart data={m.burn} mode="down" />
        </section>
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
          <h3 className="font-heading text-sm font-semibold">Burnup</h3>
          <p className="text-2xs text-muted-foreground">Points finished each day, against the sprint&apos;s total scope.</p>
          <BurnChart data={m.burn} mode="up" />
        </section>
      </div>

      <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
        <h3 className="font-heading text-sm font-semibold">Velocity</h3>
        {velocity.length > 0 ? (
          <>
            <p className="text-2xs text-muted-foreground">Points finished in each completed sprint.</p>
            <VelocityChart entries={velocity} average={averageVelocity} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Velocity appears once a sprint is marked done.</p>
        )}
      </section>
    </div>
  )
}
