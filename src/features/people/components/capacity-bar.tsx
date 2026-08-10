import { cn } from '@/lib/utils'

function capacityColor(totalPct: number) {
  if (totalPct > 100) return 'bg-destructive'
  if (totalPct > 80) return 'bg-amber-500'
  return 'bg-emerald-500'
}

/**
 * Presentational capacity meter, no client-only APIs — safe to render from
 * either a server component (person detail) or a client component
 * (dashboard, Task 9).
 */
export function CapacityBar({ totalPct }: { totalPct: number }) {
  const width = Math.min(totalPct, 100)

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full min-w-16 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-[width]', capacityColor(totalPct))}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">{totalPct}%</span>
    </div>
  )
}
