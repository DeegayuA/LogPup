import type { LoadTrendData } from '@/features/meeting-load/trend-points'

const VIEW_W = 600
const VIEW_H = 100

/**
 * Twelve weeks of invited hours.
 *
 * A SIBLING OF AllocationTrend, not a reuse of it. That component draws a STEP
 * line, because an allocation is a constant that jumps on the day it is edited.
 * Hours are different: each week is its own measured total, so the points join
 * directly — and there is no "100% line" to hold in frame, because hours have
 * no full mark. Forcing one type over both would have meant a reference line
 * that means nothing sitting across this chart forever.
 *
 * Server-safe: pure SVG, no client APIs, no chart library.
 * `vector-effect="non-scaling-stroke"` keeps the line 2px while the viewBox
 * stretches to its container.
 */
export function MeetingLoadTrend({ trend }: { trend: LoadTrendData }) {
  const { points, yMax } = trend
  if (points.length === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">No weeks recorded yet.</p>
  }

  const x = (index: number) =>
    points.length === 1 ? VIEW_W : (index / (points.length - 1)) * VIEW_W
  const y = (hours: number) => VIEW_H - (hours / yMax) * VIEW_H

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point.hours)}`)
    .join(' ')

  const peak = points.reduce((max, point) => Math.max(max, point.hours), 0)
  const current = points[points.length - 1]

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      className="h-16 w-full"
      role="img"
      // A full sentence, not "trend chart": a screen reader gets the same
      // reading a sighted person takes from the shape.
      aria-label={
        `Invited hours over the last ${points.length} weeks. `
        + `This week ${Math.round(current.hours)} hours; `
        + `the highest week was ${Math.round(peak)}.`
      }
    >
      <path
        d={path}
        fill="none"
        stroke="var(--color-chart-1)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
