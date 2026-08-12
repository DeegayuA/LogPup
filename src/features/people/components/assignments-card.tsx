import Link from 'next/link'
import { Crown, LayoutGrid } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CapacityBar, capacityBand } from '@/features/people/components/capacity-bar'
import { SectionEmpty } from '@/features/people/components/section-empty'
import { formatPct, PCT_CLASS } from '@/features/people/format-pct'
import type { PersonAssignment } from '@/features/people/queries'
import { cn } from '@/lib/utils'

const linkClass =
  'rounded-sm underline-offset-2 transition-colors duration-150 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

const APP_STATUS_LABEL: Record<PersonAssignment['appStatus'], string> = {
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
}

/**
 * Where the person's capacity actually goes.
 *
 * OVER-ALLOCATION IS SHOWN, NOT LEFT TO BE COUNTED. Each row's share bar is
 * scaled against `max(total, 100)` — the same denominator for every row — so a
 * person at 130% draws four rows that visibly overflow the 100% marker instead
 * of four bars that each look reasonable. The old card clipped every row at
 * 100% individually, which made 130% and 100% draw an identical picture.
 *
 * The marker is the 100% line, and it is drawn ONLY when someone is over it.
 * At or under 100% the line would sit hard against the right edge of the track,
 * where it is either clipped by the rounded mask or reads as a stray tick on
 * every row of every normally-loaded person — noise on the common case to
 * explain the rare one. Past 100% it slides left, and everything beyond it is
 * the overage. Colour never carries that alone: CapacityBar's aria-label names
 * the band, and the sentence below the meter says it in words.
 */
export function AssignmentsCard({
  assignments,
  totalPct,
  overallocated,
}: {
  assignments: PersonAssignment[]
  totalPct: number
  overallocated: boolean
}) {
  const scale = Math.max(totalPct, 100)
  const band = capacityBand(totalPct)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workload</CardTitle>
        <CardAction>
          <span className={cn(PCT_CLASS, 'text-xs text-muted-foreground')}>
            {assignments.length} {assignments.length === 1 ? 'app' : 'apps'}
          </span>
        </CardAction>
      </CardHeader>

      {assignments.length === 0 ? (
        <SectionEmpty
          icon={LayoutGrid}
          title="Not assigned to any app."
          hint="Allocations are set from an app's Team panel, or inline on the dashboard capacity list."
        />
      ) : (
        <>
          <CardContent className="flex flex-col divide-y divide-border">
            {assignments.map((entry) => (
              <div key={entry.appId} className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <Link
                    href={`/apps/${entry.slug}`}
                    className={cn('truncate text-sm font-medium', linkClass)}
                  >
                    {entry.appName}
                  </Link>
                  {entry.isLead ? (
                    <Badge variant="secondary" className="text-2xs">
                      <Crown aria-hidden /> Lead
                    </Badge>
                  ) : null}
                  {entry.appStatus !== 'active' ? (
                    <Badge variant="outline" className="text-2xs text-muted-foreground">
                      {APP_STATUS_LABEL[entry.appStatus]}
                    </Badge>
                  ) : null}
                  <span className="truncate text-xs text-muted-foreground">{entry.role}</span>
                  <span className={cn(PCT_CLASS, 'ml-auto text-xs')}>
                    {formatPct(entry.allocationPct)}
                  </span>
                </div>
                {/* Every row shares one denominator, so the widths add up to
                    the whole meter — the reason the overflow past the 100%
                    marker is legible at all. */}
                <div className="relative h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className={cn(
                      'h-full rounded-full',
                      entry.appStatus === 'archived' ? 'bg-muted-foreground/40' : 'bg-primary',
                    )}
                    style={{ width: `${(entry.allocationPct / scale) * 100}%` }}
                  />
                  {/* Two device pixels and pulled back onto its own line, so
                      the marker sits ON 100% rather than starting at it. A
                      single `w-px` hairline at 60% opacity was very close to
                      invisible against `bg-muted` on a 6px track — which
                      defeated the whole point of drawing a reference line. */}
                  {overallocated ? (
                    <span
                      className="absolute inset-y-0 -ml-px w-0.5 bg-destructive"
                      style={{ left: `${(100 / scale) * 100}%` }}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>

          <CardContent className="flex flex-col gap-2 border-t border-border pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">Total capacity</span>
              {overallocated ? (
                <span className={cn(PCT_CLASS, 'text-xs font-medium text-destructive')}>
                  {formatPct(totalPct - 100)} over
                </span>
              ) : (
                <span className={cn(PCT_CLASS, 'text-xs text-muted-foreground')}>
                  {formatPct(100 - totalPct)} free
                </span>
              )}
            </div>
            <CapacityBar totalPct={totalPct} />
            {band === 'over' ? (
              <p className="text-xs text-destructive">
                Over capacity — something here has to give before anything new lands.
              </p>
            ) : null}
            {band === 'near' ? (
              <p className="text-xs text-muted-foreground">
                Near capacity — little room for anything new.
              </p>
            ) : null}
          </CardContent>
        </>
      )}
    </Card>
  )
}
