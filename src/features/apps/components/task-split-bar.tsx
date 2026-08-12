import { cn } from '@/lib/utils'
import type { AppTaskCounts } from '@/features/apps/app-health'

/**
 * Done / in-progress / to-do as one slim stacked bar.
 *
 * Widths are percentages of the total, which means a single task in a
 * 200-task app renders as a 0.5% sliver — that is honest and intended. What
 * is NOT acceptable is the bar silently disappearing when an app has no tasks
 * at all (a 0-width bar reads as a rendering bug), so the empty case draws the
 * empty track with an explicit label instead.
 *
 * The bar itself is aria-hidden and the whole thing carries one text
 * alternative: three adjacent coloured rectangles are meaningless read out
 * individually, and screen-reader users need the counts, not the geometry.
 */
export function TaskSplitBar({
  tasks,
  className,
}: {
  tasks: AppTaskCounts
  className?: string
}) {
  if (tasks.total === 0) {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <div className="h-1.5 rounded-full bg-muted" aria-hidden />
        <p className="text-2xs text-muted-foreground">No tasks yet</p>
      </div>
    )
  }

  const donePct = (tasks.done / tasks.total) * 100
  const inProgressPct = (tasks.in_progress / tasks.total) * 100

  return (
    <div
      className={cn('flex flex-col gap-1', className)}
      role="img"
      aria-label={`${tasks.done} done, ${tasks.in_progress} in progress, ${tasks.todo} to do, of ${tasks.total} tasks`}
    >
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="bg-primary" style={{ width: `${donePct}%` }} />
        <div className="bg-chart-1" style={{ width: `${inProgressPct}%` }} />
      </div>
      <p aria-hidden className="font-mono text-2xs text-muted-foreground tabular-nums">
        {tasks.done} done · {tasks.in_progress} in progress · {tasks.todo} to do
      </p>
    </div>
  )
}
