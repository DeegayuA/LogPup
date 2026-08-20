import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  BURN_GAP_THRESHOLD,
  completionPct,
  parseCalendarDate,
  sprintDayProgress,
  type AppSprintSnapshot,
  type AppTaskCounts,
} from '@/features/apps/app-health'

/**
 * "Where are we in the sprint" as one band: the dates, the day counter, and a
 * bar that shows time elapsed against work done.
 *
 * The two-track bar is the whole point. A completion bar alone says "40%
 * done"; put the time track behind it and the same 40% reads very differently
 * on day 2 than on day 9. That gap is exactly the signal `appHealth` scores,
 * so drawing both here means the card's verdict and this picture are the same
 * fact told twice rather than two numbers a reader has to reconcile.
 */
export function AppSprintBand({
  sprint,
  tasks,
  today,
  className,
}: {
  sprint: AppSprintSnapshot
  tasks: AppTaskCounts
  today: string
  className?: string
}) {
  const progress = sprintDayProgress(sprint.startDate, sprint.endDate, today)
  const done = completionPct(tasks)
  const overrun = progress.phase === 'ended'
  // Imported, never re-typed. A literal 25 here would silently stop agreeing
  // with the health verdict the moment anyone tuned the weight in
  // app-health.ts — and the whole point of this band is that it draws the same
  // fact the verdict is scored on.
  const behind = progress.pct - done >= BURN_GAP_THRESHOLD && progress.phase === 'running'

  return (
    <section
      aria-label="Current sprint"
      className={cn('flex flex-col gap-3 rounded-xl border bg-card p-4', className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-heading text-base font-semibold tracking-tight">{sprint.name}</h2>
        <p className="font-mono text-xs text-muted-foreground tabular-nums">
          {format(parseCalendarDate(sprint.startDate), 'MMM d')} –{' '}
          {format(parseCalendarDate(sprint.endDate), 'MMM d, yyyy')}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        {/* Time elapsed */}
        <div className="flex items-center gap-3">
          <span className="w-14 shrink-0 text-2xs text-muted-foreground">Time</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full', overrun ? 'bg-destructive' : 'bg-chart-1')}
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <span
            className={cn(
              'w-24 shrink-0 text-right font-mono text-xs tabular-nums',
              overrun ? 'font-medium text-destructive' : 'text-muted-foreground',
            )}
          >
            {overrun
              ? `${-progress.remainingDays} ${-progress.remainingDays === 1 ? 'day' : 'days'} over`
              : `${progress.remainingDays} ${progress.remainingDays === 1 ? 'day' : 'days'} left`}
          </span>
        </div>

        {/* Work done */}
        <div className="flex items-center gap-3">
          <span className="w-14 shrink-0 text-2xs text-muted-foreground">Done</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${done}%` }} />
          </div>
          <span className="w-24 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
            {tasks.done}/{tasks.total}
          </span>
        </div>
      </div>

      <p className="font-mono text-2xs text-muted-foreground tabular-nums">
        Day {progress.elapsedDays} of {progress.totalDays} · {progress.pct}% of the time,{' '}
        {done}% of the work
      </p>

      {overrun || behind ? (
        <p role="status" className="text-xs font-medium text-destructive">
          {overrun
            ? 'This sprint is past its end date and still open — close it or move the date.'
            : 'Work is running behind the clock on this sprint.'}
        </p>
      ) : null}
    </section>
  )
}
