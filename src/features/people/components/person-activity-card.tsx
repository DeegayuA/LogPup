import { format } from 'date-fns'
import { Activity } from 'lucide-react'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ActivityGraph } from '@/features/people/components/activity-graph'
import { SectionEmpty } from '@/features/people/components/section-empty'
import { ACTIVITY_THRESHOLDS, type ActivityLevel } from '@/features/people/activity-levels'
import type { PersonActivity } from '@/features/people/queries'
import { cn } from '@/lib/utils'

/**
 * The level ramp, in one place, written twice on purpose: the grid paints SVG
 * rects (`fill-*`) and the legend paints DOM swatches (`bg-*`), and Tailwind has
 * no single utility that does both. Keeping the two columns adjacent is the only
 * thing that stops the legend from advertising a shade the grid never draws.
 *
 * Level 0 uses `muted` rather than the faintest primary tint, because "nothing
 * happened" must not read as "a little happened" — the difference between an
 * empty day and a one-task day is the whole point of the first step.
 *
 * Classes are literal strings so Tailwind's scanner finds them; they cannot be
 * built by interpolation.
 */
const FILL_CLASSES = [
  'data-[level="0"]:fill-muted',
  'data-[level="1"]:fill-primary/25',
  'data-[level="2"]:fill-primary/50',
  'data-[level="3"]:fill-primary/75',
  'data-[level="4"]:fill-primary',
].join(' ')

const SWATCH: Record<ActivityLevel, string> = {
  0: 'bg-muted',
  1: 'bg-primary/25',
  2: 'bg-primary/50',
  3: 'bg-primary/75',
  4: 'bg-primary',
}

/** `YYYY-MM-DD` at local noon — the bare string parses as midnight UTC, which
 *  renders as the previous day west of Greenwich. */
function formatDay(iso: string): string {
  return format(new Date(`${iso}T12:00:00`), 'd MMM yyyy')
}

/**
 * Six months of task activity, with a legend that finally says what the shades
 * mean.
 *
 * THE OLD LEGEND SAID "Less … More". That is not a scale: a reader could not
 * tell whether the darkest cell was two tasks or twenty, which makes the graph
 * decorative. The swatch labels now come from ACTIVITY_THRESHOLDS — the same
 * array `activityLevel()` buckets with — so the legend is generated from the
 * rule rather than restating it, and the two cannot disagree. The busiest-day
 * figure underneath gives the ramp a ceiling in real units.
 *
 * WHAT IT MEASURES IS STATED, not implied. The card counts tasks CREATED with
 * this person as assignee, on the day they were created — work arriving, not
 * work finishing. `tasks` records no completion timestamp, so a "shipped" graph
 * is not derivable from this schema, and a graph whose caption lets you assume
 * otherwise is a lie told in good faith.
 */
export function PersonActivityCard({ activity }: { activity: PersonActivity }) {
  const { days, total, peak, fromIso, toIso } = activity
  const activeDays = days.filter((day) => day.count > 0).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        <CardAction>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {total} tasks · {activeDays} active days
          </span>
        </CardAction>
      </CardHeader>

      {total === 0 ? (
        <SectionEmpty
          icon={Activity}
          title="No task activity in six months."
          hint="This fills in as tasks are assigned to them — each square is one day, darker means more."
        />
      ) : (
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Tasks assigned to them, by the day the task was created.{' '}
            <span className="whitespace-nowrap">
              {formatDay(fromIso)} – {formatDay(toIso)}
            </span>
          </p>

          <ActivityGraph days={days} fillClassName={FILL_CLASSES} />

          {/* The grid itself is aria-hidden — 182 announced rects is not a way
              to read six months — so the same information goes to assistive
              tech as one sentence here. */}
          <p className="sr-only">
            {total} tasks assigned across {activeDays} active days between {formatDay(fromIso)} and{' '}
            {formatDay(toIso)}. Busiest day: {peak} {peak === 1 ? 'task' : 'tasks'}.
          </p>

          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border pt-3"
            aria-hidden
          >
            <span className="text-2xs text-muted-foreground">Tasks per day</span>
            <ul className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {ACTIVITY_THRESHOLDS.map((step) => (
                <li key={step.level} className="flex items-center gap-1">
                  {/* size-2.5 / rounded-xs are the graph's own blockSize (10)
                      and blockRadius (2). A swatch that is not the same shape
                      as the cell it stands for makes the reader check. */}
                  <span className={cn('size-2.5 rounded-xs', SWATCH[step.level])} />
                  <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                    {step.label}
                  </span>
                </li>
              ))}
            </ul>
            <span className="ml-auto font-mono text-2xs tabular-nums text-muted-foreground">
              busiest day {peak}
            </span>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
