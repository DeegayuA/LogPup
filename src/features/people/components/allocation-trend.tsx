import { formatPct, PCT_CLASS } from '@/features/people/format-pct'
import type { TrendPoint } from '@/features/people/allocation-history'
import { cn } from '@/lib/utils'

const VIEW_W = 600
const VIEW_H = 120

/**
 * Total allocation over time, drawn as a STEP line rather than a smooth one:
 * an allocation is a constant that jumps on the day it is edited, so joining
 * the points diagonally would invent a gradual ramp that never happened.
 *
 * The y-axis is always scaled to at least 100 so the "full capacity" rule
 * stays in frame — a person who never passed 40% should still read as having
 * headroom, not as having filled the chart.
 *
 * Server-safe (pure SVG, no client APIs). `vector-effect="non-scaling-stroke"`
 * keeps the 2px line 2px wide while the viewBox stretches to the container.
 */
export function AllocationTrend({
  points,
  now = new Date(),
  reference = 100,
  referenceLabel = '100% line',
}: {
  points: TrendPoint[]
  now?: Date
  /**
   * The "full" line every value is judged against. 100 for one person; for a
   * TEAM total it must be the team's own capacity (headcount × 100), or a
   * team of two or more renders permanently above the line in the
   * over-capacity colour — an alarm that means nothing.
   */
  reference?: number
  referenceLabel?: string
}) {
  if (points.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
        No allocation changes recorded yet.
      </p>
    )
  }

  const current = points[points.length - 1].totalPct
  const peak = Math.max(...points.map((point) => point.totalPct))
  const yMax = Math.max(reference, peak)

  // Extend the last step to "now" so the line reaches the right edge instead
  // of stopping at whenever the last edit happened.
  const startMs = points[0].at.getTime()
  const endMs = Math.max(now.getTime(), points[points.length - 1].at.getTime())
  const span = endMs - startMs

  const x = (ms: number) => (span === 0 ? 0 : ((ms - startMs) / span) * VIEW_W)
  const y = (pct: number) => VIEW_H - (pct / yMax) * VIEW_H

  // Step-after: hold the previous value across to the new x, then jump.
  const commands: string[] = []
  points.forEach((point, index) => {
    const px = x(point.at.getTime())
    const py = y(point.totalPct)
    if (index === 0) {
      commands.push(`M ${px} ${py}`)
    } else {
      commands.push(`L ${px} ${y(points[index - 1].totalPct)}`, `L ${px} ${py}`)
    }
  })
  commands.push(`L ${VIEW_W} ${y(current)}`)

  const referenceY = y(reference)
  const overReference = current > reference

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          Now{' '}
          <span
            className={cn(PCT_CLASS, 'text-sm font-medium', overReference && 'text-destructive')}
          >
            {formatPct(current)}
          </span>
        </span>
        <span className="text-xs text-muted-foreground">
          Peak <span className={cn(PCT_CLASS, 'font-medium')}>{formatPct(peak)}</span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="h-24 w-full overflow-visible"
        role="img"
        aria-label={`Total allocation over time: currently ${formatPct(current)}, peak ${formatPct(peak)} against ${referenceLabel} of ${formatPct(reference)}, across ${points.length} ${points.length === 1 ? 'change' : 'changes'}.`}
      >
        {/* The reference line — the thing every value is judged against. */}
        <line
          x1="0"
          x2={VIEW_W}
          y1={referenceY}
          y2={referenceY}
          className="stroke-border"
          strokeWidth="1"
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={commands.join(' ')}
          fill="none"
          className={overReference ? 'stroke-destructive' : 'stroke-primary'}
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between text-2xs text-muted-foreground">
        <time dateTime={points[0].at.toISOString()} className="font-mono tabular-nums">
          {points[0].at.toISOString().slice(0, 10)}
        </time>
        <span className="font-mono tabular-nums">{referenceLabel}</span>
        <time dateTime={new Date(endMs).toISOString()} className="font-mono tabular-nums">
          {new Date(endMs).toISOString().slice(0, 10)}
        </time>
      </div>
    </div>
  )
}
