import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { PortfolioSummary } from '@/features/apps/app-health'

/**
 * The numbers you check before you decide what to look at.
 *
 * Four deliberate choices:
 *  - Every figure describes the WHOLE workspace, never the current filter.
 *    A strip that shrinks when you click "Active" can't be used to answer
 *    "is anything on fire", which is the only reason it exists.
 *  - Only "Overdue" and "At risk" are allowed to take colour, and only when
 *    they are non-zero. A strip where six tiles glow is a strip nobody reads.
 *  - No count-up animation. `StatNumber` is the house treatment elsewhere,
 *    but it is a client component, and shipping the motion runtime to render
 *    six integers on an otherwise fully server-rendered page fails the
 *    "money-tight on client JS" rule for no legibility gain. `tabular-nums`
 *    is what actually makes these readable.
 *  - "At risk" is a stretched link (::after covering the tile) rather than an
 *    <a> wrapped around the <dt>/<dd> pair, which would be invalid inside a
 *    <dl>. Same pattern the People directory rows use.
 */
type Tile = {
  label: string
  value: number
  href?: string
  hint?: string
  alert?: boolean
}

export function PortfolioSummaryStrip({
  summary,
  atRiskHref,
}: {
  summary: PortfolioSummary
  atRiskHref: string
}) {
  const tiles: Tile[] = [
    { label: 'Apps', value: summary.apps, hint: `${summary.live} live` },
    { label: 'Open tasks', value: summary.openTasks },
    { label: 'Overdue', value: summary.overdueTasks, alert: summary.overdueTasks > 0 },
    { label: 'Active sprints', value: summary.activeSprints },
    { label: 'Meetings this week', value: summary.meetingsThisWeek },
    {
      label: 'At risk',
      value: summary.atRisk,
      alert: summary.atRisk > 0,
      href: summary.atRisk > 0 ? atRiskHref : undefined,
      // Only ever offered when there is something to show, and the wording
      // states what the click DOES. "Sort by risk →" was the old hint on a
      // link that resolved to the current URL — an affordance that lied.
      hint: summary.atRisk > 0 ? 'Show only these →' : undefined,
    },
  ]

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className={cn(
            'relative flex flex-col gap-1 rounded-xl border bg-card p-3',
            tile.href &&
              // The <a> itself is `outline-none` because its own outline would
              // trace the text, not the tile the stretched ::after actually
              // covers — so the tile has to draw the indicator. A border-colour
              // swap alone (what this used to be) is a 1px change that does not
              // read as focus; the ring does.
              'transition-colors duration-150 hover:border-ring/40 motion-reduce:transition-none has-[a:focus-visible]:border-ring has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring',
          )}
        >
          <dt className="text-xs text-muted-foreground">
            {tile.href ? (
              <Link
                href={tile.href}
                className='rounded-sm outline-none after:absolute after:inset-0 after:content-[""]'
              >
                {tile.label}
                {/* The number lives in the <dd>, outside the link, so the
                    bare accessible name would be "At risk, link" — no count,
                    no idea what happens on activation. Both belong in the
                    name; the visible text stays two words. */}
                <span className="sr-only">
                  : {tile.value} — show only these apps
                </span>
              </Link>
            ) : (
              tile.label
            )}
          </dt>
          <dd
            className={cn(
              'font-mono text-2xl leading-none font-semibold tabular-nums',
              tile.alert ? 'text-destructive' : 'text-foreground',
            )}
          >
            {tile.value}
          </dd>
          <p className="min-h-4 text-2xs text-muted-foreground">{tile.hint ?? ''}</p>
        </div>
      ))}
    </dl>
  )
}
