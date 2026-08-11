import { cn } from '@/lib/utils'

/** The threshold at which someone is close enough to full to be worth flagging. */
export const NEAR_CAPACITY_PCT = 80

export type CapacityBand = 'normal' | 'near' | 'over'

/**
 * The one definition of which band a total falls in. Exported because the
 * band has to be reinforced OUTSIDE the bar as well — the fill colour alone
 * cannot carry it (WCAG 1.4.1), and amber-vs-green is exactly the pair a
 * deuteranopic reader cannot separate.
 */
export function capacityBand(totalPct: number): CapacityBand {
  if (totalPct > 100) return 'over'
  if (totalPct >= NEAR_CAPACITY_PCT) return 'near'
  return 'normal'
}

const FILL: Record<CapacityBand, string> = {
  over: 'bg-destructive',
  near: 'bg-chart-1',
  normal: 'bg-primary',
}

/** What assistive tech is told, so a threshold crossing is audible at all. */
const BAND_SUFFIX: Record<CapacityBand, string> = {
  over: ' — over capacity',
  near: ' — near capacity',
  normal: '',
}

/**
 * Presentational capacity meter, no client-only APIs — safe to render from
 * either a server component (person detail) or a client component (dashboard).
 *
 * The track is scaled to max(totalPct, 100): when someone is overallocated the
 * portion beyond 100% renders as a separated, lighter destructive segment so
 * the overage reads at a glance instead of clipping silently.
 *
 * The aria-label names the band rather than only the number: "95% allocated"
 * and "45% allocated" were the same sentence, so a screen-reader user got no
 * hint that one of them had crossed the line the amber fill exists to mark.
 */
export function CapacityBar({ totalPct }: { totalPct: number }) {
  const band = capacityBand(totalPct)
  const over = band === 'over'
  const scale = Math.max(totalPct, 100)
  const fillPct = (Math.min(totalPct, 100) / scale) * 100
  const overflowPct = over ? ((totalPct - 100) / scale) * 100 : 0

  return (
    <div className="flex w-full items-center gap-2">
      <div
        role="img"
        aria-label={`${totalPct}% allocated${BAND_SUFFIX[band]}`}
        className="flex h-2 min-w-16 flex-1 gap-0.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-200 ease-out motion-reduce:transition-none',
            FILL[band],
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
