import { formatCoverage, type CoverageSummary } from '@/features/worklog/coverage'
import { cn } from '@/lib/utils'

/**
 * The ONLY component that renders a coverage number.
 *
 * There is deliberately no prop that produces a bare percentage. A percentage
 * without its denominator is the bug this whole feature exists to fix: "80%"
 * hides whether the person was expected to log ten days or two, and whether
 * the days they missed were leave, a public holiday, or genuine gaps.
 */
export function CoverageFigure({
  summary,
  label,
  className,
}: {
  summary: CoverageSummary
  label?: string
  className?: string
}) {
  const complete = summary.missing === 0

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      {label && <span className="text-2xs text-muted-foreground">{label}</span>}
      <span
        className={cn(
          'font-mono text-sm tabular-nums',
          // Colour is never the only signal — the sentence beside it already
          // says "expected days logged" and how many were exempt.
          complete ? 'text-success' : 'text-foreground',
        )}
      >
        {formatCoverage(summary)}
      </span>
    </div>
  )
}
