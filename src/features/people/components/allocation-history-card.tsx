import Link from 'next/link'
import { History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AllocationTrend } from '@/features/people/components/allocation-trend'
import { SectionEmpty } from '@/features/people/components/section-empty'
import { formatBusinessDateTime } from '@/features/people/format-instant'
import {
  describeAllocationChange,
  type ChangeKind,
  type PersonAllocationHistoryView,
} from '@/features/people/allocation-history'
import { cn } from '@/lib/utils'

const linkClass =
  'rounded-sm underline-offset-2 transition-colors duration-150 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

const KIND_LABEL: Record<ChangeKind, string> = {
  assigned: 'Assigned',
  updated: 'Updated',
  removed: 'Removed',
}

// A removal is the one change worth flagging visually; the other two are
// routine and would just add noise as coloured chips.
const KIND_DOT: Record<ChangeKind, string> = {
  assigned: 'bg-primary',
  updated: 'bg-chart-1',
  removed: 'bg-destructive/70',
}

/**
 * Per-person allocation history: what changed, by whom, when, and from → to,
 * plus the total-allocation trend above it.
 *
 * Mobile: the meta line wraps under the description rather than sitting
 * beside it, and the whole card never needs a horizontal scroller — the only
 * wide thing here is the trend, which scales to its container.
 */
export function AllocationHistoryCard({
  history,
}: {
  history: PersonAllocationHistoryView
}) {
  const { timeline, trend } = history

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Allocation history</CardTitle>
        {timeline.length > 0 ? (
          <CardAction>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {timeline.length} {timeline.length === 1 ? 'change' : 'changes'}
            </span>
          </CardAction>
        ) : null}
      </CardHeader>
      {timeline.length === 0 ? (
        // SectionEmpty, not a hand-rolled block: this card had drifted into
        // its own rhythm (py-4, no min-h floor) — the exact drift the shared
        // empty state exists to prevent.
        <SectionEmpty
          icon={History}
          title="No changes recorded yet."
          hint="Allocation edits will show up here with who made them."
        />
      ) : (
        <>
          <CardContent>
            <AllocationTrend points={trend} />
          </CardContent>
          <CardContent className="border-t border-border pt-4">
            <ol className="flex flex-col divide-y divide-border">
              {timeline.map((entry) => (
                <li key={entry.id} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span
                    className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', KIND_DOT[entry.changeKind])}
                    aria-hidden
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <Link
                        href={`/apps/${entry.slug}`}
                        className={cn('truncate text-sm font-medium', linkClass)}
                      >
                        {entry.appName}
                      </Link>
                      <Badge
                        variant={entry.changeKind === 'removed' ? 'outline' : 'secondary'}
                        className="text-2xs"
                      >
                        {KIND_LABEL[entry.changeKind]}
                      </Badge>
                    </div>
                    <p className="font-mono text-xs tabular-nums">
                      {describeAllocationChange(entry)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="whitespace-nowrap">
                        {entry.changedByName ?? 'Unknown user'}
                      </span>
                      {' · '}
                      {/* Business timezone, never date-fns format() — this is
                          a server component, so format() resolves against the
                          SERVER's zone (UTC on Vercel). See format-instant.ts. */}
                      <time
                        dateTime={entry.effectiveFrom.toISOString()}
                        className="font-mono tabular-nums whitespace-nowrap"
                      >
                        {formatBusinessDateTime(entry.effectiveFrom)}
                      </time>
                    </p>
                    {entry.note ? (
                      <p className="text-2xs text-muted-foreground/80">{entry.note}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </>
      )}
    </Card>
  )
}
