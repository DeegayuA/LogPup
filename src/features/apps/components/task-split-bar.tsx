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
 *
 * `elapsedPct` DRAWS TIME ACROSS WORK. The health rules score an app when the
 * share of the sprint spent runs 25 points ahead of the share of tasks done
 * (BURN_GAP_THRESHOLD in app-health.ts), and until now the card printed those
 * two percentages ~90px apart and left the subtraction to the reader. The tick
 * puts them on one axis, so the gap is a distance you can see.
 *
 * It is a TICK and not a second bar on purpose. Two stacked bars would have to
 * be told apart by fill, and there is no fill available for the second one:
 * every candidate on the chart ramp sits within 0.06 lightness of --primary or
 * of --chart-1 in light or dark (see the ember note in globals.css, where that
 * exact experiment was already run and written down), and reaching for
 * --success/--warning/--destructive instead would put a status token inside a
 * chart — the thing health-dot.tsx exists to forbid. So the tick is
 * --foreground, a neutral that belongs to neither family, it is the only
 * VERTICAL mark on the card, and it is taller than the track it crosses so the
 * ends that carry its contrast sit on --card rather than on a fill. Shape
 * carries the distinction; colour only has to make it visible.
 */
export function TaskSplitBar({
  tasks,
  elapsedPct,
  className,
}: {
  tasks: AppTaskCounts
  /** Sprint days used, 0–100, drawn as a target tick. Null when none is running. */
  elapsedPct?: number | null
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
  // Clamped rather than trusted: `sprintDayProgress` already pins its own
  // percentage to [0, 100], but a tick at 140% would silently escape the
  // track and float over the caption instead of failing visibly.
  const elapsed =
    elapsedPct === null || elapsedPct === undefined
      ? null
      : Math.min(Math.max(elapsedPct, 0), 100)

  return (
    <div
      className={cn('flex flex-col gap-1', className)}
      role="img"
      // The counts first and unchanged, so this reads the same as it always
      // has for anyone who has learned it; the sprint clause is appended
      // rather than woven in because it is the one part that is sometimes
      // absent. Without it the tick would be a graphical comparison with no
      // text form anywhere on the card.
      aria-label={
        `${tasks.done} done, ${tasks.in_progress} in progress, ${tasks.todo} to do, of ${tasks.total} tasks` +
        (elapsed === null ? '' : `; ${Math.round(elapsed)}% of the current sprint elapsed`)
      }
    >
      <div className="relative">
        <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="bg-primary" style={{ width: `${donePct}%` }} />
          <div className="bg-chart-1" style={{ width: `${inProgressPct}%` }} />
        </div>
        {elapsed === null ? null : (
          // Positioned by giving a spacer the elapsed percentage as its WIDTH
          // and hanging the tick off its right edge — the same
          // percentage-width idiom the segments above use, so the tick cannot
          // drift out of step with the fills at any container width. It lives
          // outside the track's `overflow-hidden` because the whole point is
          // that its ends protrude past the bar.
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 flex items-center"
            style={{ width: `${elapsed}%` }}
          >
            <span className="ml-auto h-3 w-0.5 rounded-full bg-foreground" />
          </div>
        )}
      </div>
      {/* truncate, not wrap: at three and four columns this caption is wider
          than the card, and a second line here would push every card in the
          row down with it. The bar and the accessible name above both still
          carry the full counts. */}
      <p aria-hidden className="truncate font-mono text-2xs text-muted-foreground tabular-nums">
        {tasks.done} done · {tasks.in_progress} in progress · {tasks.todo} to do
      </p>
    </div>
  )
}
