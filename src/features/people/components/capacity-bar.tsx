import { cn } from '@/lib/utils'

function fillColor(totalPct: number) {
  if (totalPct > 100) return 'bg-destructive'
  if (totalPct >= 80) return 'bg-chart-1'
  return 'bg-primary'
}

/**
 * Presentational capacity meter, no client-only APIs — safe to render from
 * either a server component (person detail) or a client component (dashboard).
 *
 * The track is scaled to max(totalPct, 100): when someone is overallocated the
 * portion beyond 100% renders as a separated, lighter destructive segment so
 * the overage reads at a glance instead of clipping silently.
 */
export function CapacityBar({ totalPct }: { totalPct: number }) {
  const over = totalPct > 100
  const scale = Math.max(totalPct, 100)
  const fillPct = (Math.min(totalPct, 100) / scale) * 100
  const overflowPct = over ? ((totalPct - 100) / scale) * 100 : 0

  return (
    <div className="flex w-full items-center gap-2">
      <div
        role="img"
        aria-label={`${totalPct}% allocated`}
        className="flex h-2 min-w-16 flex-1 gap-0.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-200 ease-out motion-reduce:transition-none',
            fillColor(totalPct),
          )}
          style={{ width: `${fillPct}%` }}
        />
        {over ? (
          <div
            aria-hidden
            className="h-full rounded-full bg-destructive/40 transition-[width] duration-200 ease-out motion-reduce:transition-none"
            style={{ width: `${overflowPct}%` }}
          />
        ) : null}
      </div>
      <span
        aria-hidden
        className={cn(
          'shrink-0 font-mono text-xs',
          over ? 'font-medium text-destructive' : 'text-muted-foreground',
        )}
      >
        {totalPct}%
      </span>
    </div>
  )
}
