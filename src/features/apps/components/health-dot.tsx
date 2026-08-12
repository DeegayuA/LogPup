import { cn } from '@/lib/utils'
import { HEALTH_LABEL, type AppHealth, type HealthLevel } from '@/features/apps/app-health'

/**
 * Colour here is load-bearing, so it is never the ONLY carrier: the level is
 * always spelled out in words next to the dot, and the reasons behind the
 * verdict ride along in the accessible name and the native tooltip. A card
 * that says "At risk" with no way to find out why is just a red light on a
 * dashboard nobody trusts.
 *
 * Renders as a plain <span>: on the index every card is wrapped in a single
 * <Link>, so anything focusable or interactive in here would nest inside it.
 */
/**
 * `--warning`, not `--chart-1`. globals.css defines the success/warning pair
 * precisely BECAUSE the data-viz ramp kept getting pressed into service as a
 * status colour, and --chart-1 is tuned to sit next to --chart-2 in a chart,
 * not to carry meaning on its own against --card. "Watch" is a state, which is
 * exactly what --warning is for; the split bars on the same card keep using
 * the chart ramp, because those really are series in a chart.
 */
const DOT: Record<HealthLevel, string> = {
  'at-risk': 'bg-destructive',
  watch: 'bg-warning',
  'on-track': 'bg-primary',
  dormant: 'bg-muted-foreground/50',
}

const TEXT: Record<HealthLevel, string> = {
  'at-risk': 'text-destructive',
  watch: 'text-warning',
  'on-track': 'text-muted-foreground',
  dormant: 'text-muted-foreground',
}

export function HealthDot({
  health,
  className,
}: {
  health: AppHealth
  className?: string
}) {
  const label = HEALTH_LABEL[health.level]
  const summary = health.reasons.length > 0 ? `${label} — ${health.reasons.join('; ')}` : label

  return (
    <span
      title={summary}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs',
        TEXT[health.level],
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', DOT[health.level])} />
      <span aria-hidden>{label}</span>
      <span className="sr-only">Health: {summary}</span>
    </span>
  )
}
