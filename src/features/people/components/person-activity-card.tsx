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
 * THE TINTS START AT 35%, NOT 25%, because at 25 that first step was the
 * faintest one in the whole ramp — the exact opposite of what the paragraph
 * above asks for. Measured against `--card`: the old ramp ran 1.14 / 1.50 /
 * 2.41 / 4.13 / 7.41, so level 0 → level 1 was 1.32:1 while every later step
 * was 1.60 or better. 35/60/80/100 gives 1.14 / 1.80 / 2.96 / 4.63 / 7.41 —
 * steps of 1.58 / 1.65 / 1.56 / 1.60, near enough even that no two neighbours
 * are harder to tell apart than any other pair. Dark theme moves the same way
 * (its first step goes 1.56 → 2.02).
 *
 * EVERY CELL IS STROKED, not just the empty ones. `--muted` is 1.14:1 against
 * `--card`, so an unstroked level-0 cell is effectively invisible and a sparse
 * month reads as a failed render rather than as a quiet one; `--border` sits at
 * 1.33:1 against the card in both themes, which is enough to make the grid read
 * as graph paper. Stroking only level 0 would have drawn a box around exactly
 * the days nothing happened — colour used to mean two different things at once.
 *
 * Classes are literal strings so Tailwind's scanner finds them; they cannot be
 * built by interpolation.
 */
const CELL_CLASSES = [
  'stroke-border stroke-1',
  'data-[level="0"]:fill-muted',
  'data-[level="1"]:fill-primary/35',
  'data-[level="2"]:fill-primary/60',
  'data-[level="3"]:fill-primary/80',
  'data-[level="4"]:fill-primary',
].join(' ')

const SWATCH: Record<ActivityLevel, string> = {
  0: 'bg-muted',
  1: 'bg-primary/35',
  2: 'bg-primary/60',
  3: 'bg-primary/80',
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
 *
 * THE WINDOW STAYS SIX MONTHS EVEN WHEN ALMOST NOTHING IS IN IT. The obvious
 * alternative — shrink the axis when there is little data — crops the emptiness
 * instead of answering it (two tasks over eight weeks is still fifty-odd blank
 * cells) and spends the one thing a fixed axis buys: "this person had a quiet
 * six months" stays a comparable fact between two people and between two visits,
 * rather than a shape that silently rescales itself so the same card means
 * something different every time it loads. What was actually broken about the
 * sparse case was that empty cells sat at 1.14:1 against the card, so a correct
 * graph looked like a failed one; the ramp and the cell stroke above fix that,
 * and the genuinely-nothing case already has its own honest bail-out below. The
 * one thing the picture still cannot do is let you FIND two marks among a
 * hundred and eighty, so when there are three or fewer active days the card just
 * names them in a sentence.
 */
export function PersonActivityCard({ activity }: { activity: PersonActivity }) {
  const { days, total, peak, fromIso, toIso } = activity
  const active = days.filter((day) => day.count > 0)
  const activeDays = active.length

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Activity</CardTitle>
        <CardAction>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {total} {total === 1 ? 'task' : 'tasks'} · {activeDays} active{' '}
            {activeDays === 1 ? 'day' : 'days'}
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

          <ActivityGraph days={days} cellClassName={CELL_CLASSES} />

          {/* Locating two shaded squares among a hundred and eighty is a search
              task the picture cannot win, so at this density the card says it in
              words instead. Capped at three because past that the sentence is
              longer than the graph it is helping read. */}
          {activeDays <= 3 && (
            <p className="text-xs text-muted-foreground">
              {activeDays === 1 ? 'The only active day was ' : 'The active days were '}
              {active
                .map(
                  (day) =>
                    `${formatDay(day.date)} (${day.count} ${day.count === 1 ? 'task' : 'tasks'})`,
                )
                .join(', ')}
              .
            </p>
          )}

          {/* The grid itself is aria-hidden — 180-odd announced rects is not a
              way to read six months — so the same information goes to assistive
              tech as one sentence here. */}
          <p className="sr-only">
            {total} {total === 1 ? 'task' : 'tasks'} assigned across {activeDays} active{' '}
            {activeDays === 1 ? 'day' : 'days'} between {formatDay(fromIso)} and{' '}
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
                  {/* size-3 / rounded-xs / ring-border are the graph's own
                      blockSize (12), blockRadius (2) and cell stroke. A swatch
                      that is not the same shape, size and edge as the cell it
                      stands for makes the reader check — and without the ring
                      the "none" swatch, at 1.14:1, would not read as a swatch
                      at all. */}
                  <span
                    className={cn(
                      'size-3 rounded-xs ring-1 ring-inset ring-border',
                      SWATCH[step.level],
                    )}
                  />
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
