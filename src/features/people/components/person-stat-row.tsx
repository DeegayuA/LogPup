import { StatNumber } from '@/components/animate-ui/stat-number'
import type { PersonStat, StatTone } from '@/features/people/person-stats'
import { cn } from '@/lib/utils'

/**
 * The at-a-glance strip. Seven figures, one line of context each, above every
 * card on the page — the direct answer to "easy to see data at a glance", which
 * the old person page had none of (every number was tiny mono text buried in a
 * card header).
 *
 * `tabular-nums` on every value, always: these tiles sit in a grid, and
 * proportional digits make a row of numbers visibly ragged. The number is also
 * the largest type on the page after the person's name — a stat tile whose
 * label outweighs its value is decoration, not data.
 *
 * MARKUP: a real <dl>, with the term BEFORE its description in the DOM and the
 * order flipped visually by `flex-col-reverse`. A screen reader therefore hears
 * "Overdue, oldest 9 days late — 2" (which parses) rather than "2 — Overdue"
 * (which does not), while the eye still gets the number first. The meta line
 * lives inside the <dt> because a <dl> group may only contain dt/dd.
 *
 * Tone comes from person-stats.ts and is spent only on meaning. The tinted ring
 * and the coloured figure always travel WITH the words in `meta`, so nothing
 * here depends on being able to tell amber from red.
 */
const VALUE_TONE: Record<StatTone, string> = {
  normal: 'text-foreground',
  warn: 'text-chart-1',
  alert: 'text-destructive',
}

const RING_TONE: Record<StatTone, string> = {
  normal: 'ring-foreground/10',
  warn: 'ring-chart-1/35',
  alert: 'ring-destructive/35',
}

export function PersonStatRow({ stats }: { stats: PersonStat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {stats.map((stat) => (
        <div
          key={stat.key}
          className={cn(
            'flex min-h-[4.75rem] flex-col-reverse justify-end gap-0.5 rounded-xl bg-card px-3 py-2.5 ring-1',
            RING_TONE[stat.tone],
          )}
        >
          <dt className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-foreground">{stat.label}</span>
            {stat.meta ? (
              <span className="truncate text-2xs text-muted-foreground" title={stat.meta}>
                {stat.meta}
              </span>
            ) : null}
          </dt>
          <dd
            className={cn(
              'mb-1 font-mono text-2xl leading-none font-semibold tabular-nums',
              VALUE_TONE[stat.tone],
            )}
          >
            <StatNumber value={stat.value} />
            {stat.suffix ? <span className="text-lg">{stat.suffix}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}
