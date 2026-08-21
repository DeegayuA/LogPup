import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { MeetingLoadTrend } from '@/features/meeting-load/components/meeting-load-trend'
import type { LoadTrendData } from '@/features/meeting-load/trend-points'

/**
 * The dashboard's meeting-load reading.
 *
 * NO NAMES, NO NAMED SERIES, NO VERDICTS — this is the one meeting-load surface
 * the whole org sees, and a named series carrying a negative judgement here
 * would be a public accusation about whoever runs it. The props are exactly the
 * numbers below; nothing shaped like a `Suggestion` can be passed in, which is
 * what stops a future edit rendering one by accident.
 *
 * The delta is against the trailing four-week MEDIAN rather than the mean, so
 * one workshop week does not leave the card reading "down 40%" for a month
 * afterwards.
 */
export function MeetingLoadCard({
  thisWeekHours,
  trailingMedianHours,
  coverage,
  trend,
  suggestionCount,
  potentialHoursPerWeek,
}: {
  thisWeekHours: number
  trailingMedianHours: number
  coverage: number
  trend: LoadTrendData
  suggestionCount: number
  potentialHoursPerWeek: number
}) {
  const delta = thisWeekHours - trailingMedianHours
  const rounded = Math.round(thisWeekHours)

  return (
    <Card className="border-border/70 bg-card/60 shadow-xs backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-base">Meeting load</CardTitle>
        <CardDescription>
          {/* The definition travels with the number, every time it is shown. */}
          Hours on calendars, not hours in rooms — we cannot see attendance.
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" render={<Link href="/meetings/load" />}>
            Break it down
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-2xl font-semibold tabular-nums">{rounded}h</span>
          <span className="text-xs text-muted-foreground">
            this week
            {trailingMedianHours > 0 ? (
              delta === 0
                ? ', level with the last four'
                : `, ${delta > 0 ? 'up' : 'down'} ${Math.abs(Math.round(delta))}h on the four-week median`
            ) : null}
          </span>
        </div>

        <MeetingLoadTrend trend={trend} />

        <p className="text-xs text-muted-foreground">
          {coverage === 0
            ? 'None of it recorded, so none of it is analysed.'
            : `${Math.round(coverage * 100)}% of it recorded and analysed.`}
        </p>

        {/* Rendered only when there is something to say. A zero here would be a
            number nobody asked for, sitting on the dashboard every day. */}
        {suggestionCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            {suggestionCount} suggestion{suggestionCount === 1 ? '' : 's'} with organizers,
            {' '}~{potentialHoursPerWeek}h/week potential.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
