import Link from 'next/link'
import { cn } from '@/lib/utils'
import { boardHref } from '@/features/apps/tabs'
import { RISK_LABEL, readinessScore } from '@/features/sprints/readiness'
import type { RefinementRow } from '@/features/sprints/readiness-queries'
import { TaskTypeIcon } from '@/features/sprints/components/task-type-icon'
import { TASK_TYPE_LABEL } from '@/features/sprints/hierarchy'

/**
 * The Refinement view: everything not yet in a running sprint, not-ready
 * first, each with its Definition of Ready score and what is still missing.
 * Read-only here — open the item on the board to refine it (the dialog's
 * "Ready to start?" panel does the writing).
 */
export function RefinementQueue({ rows, slug, truncated }: { rows: RefinementRow[]; slug: string; truncated: boolean }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        Nothing waiting for refinement. New stories and tasks in the backlog (or in a planned sprint) show up here.
      </p>
    )
  }
  const readyCount = rows.filter((r) => r.readyAt).length
  return (
    <section className="flex flex-col gap-3" aria-labelledby="refinement-heading">
      <div className="flex flex-col gap-0.5">
        <h3 id="refinement-heading" className="font-heading text-sm font-semibold">Backlog refinement</h3>
        <p className="text-2xs text-muted-foreground">
          {readyCount} of {rows.length} ready. Open an item and use “Ready to start?” under Breakdown to tick it off.
        </p>
      </div>
      <ul className="flex flex-col divide-y rounded-xl border bg-card">
        {rows.map((r) => {
          const score = readinessScore(r.checks)
          const missing = r.checks.filter((c) => !c.met).map((c) => c.label)
          return (
            <li key={r.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <TaskTypeIcon type={r.type} />
                <span className="sr-only">{TASK_TYPE_LABEL[r.type]}</span>
                {r.taskKey ? <span className="shrink-0 font-mono text-2xs text-muted-foreground tabular-nums">{r.taskKey}</span> : null}
                <Link
                  href={boardHref(slug, r.sprintId ?? 'backlog')}
                  className="truncate text-sm hover:underline focus-visible:underline focus-visible:outline-none"
                  title={r.title}
                >
                  {r.title}
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-2xs text-muted-foreground">
                {r.sprintName ? <span>{r.sprintName}</span> : <span>Backlog</span>}
                {r.storyPoints !== null ? <span className="tabular-nums">{r.storyPoints} pts</span> : null}
                {r.risk ? (
                  <span className={cn(r.risk === 'high' && 'text-destructive')}>{RISK_LABEL[r.risk]}</span>
                ) : null}
                <span className="tabular-nums" title={missing.length > 0 ? `Missing: ${missing.join(', ')}` : 'All checks met'}>
                  {score.met}/{score.total} checks
                </span>
                {r.readyAt ? (
                  <span className="rounded-full border border-primary/40 px-1.5 py-px text-primary">✓ Ready</span>
                ) : (
                  <span className="rounded-full border px-1.5 py-px">Not ready</span>
                )}
              </div>
              {missing.length > 0 && !r.readyAt ? (
                <p className="text-2xs text-muted-foreground sm:hidden">Missing: {missing.join(', ')}</p>
              ) : null}
            </li>
          )
        })}
      </ul>
      {truncated ? (
        <p className="text-2xs text-muted-foreground">Showing the first {rows.length}. See the Backlog tab for everything.</p>
      ) : null}
    </section>
  )
}
