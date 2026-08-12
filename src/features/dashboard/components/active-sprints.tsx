import Link from 'next/link'
import { format } from 'date-fns'
import { PawPrint } from 'lucide-react'
import { StatNumber } from '@/components/animate-ui/stat-number'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ActiveSprintSummary, UpcomingSprintSummary } from '@/features/sprints/queries'
import { sprintProgress, daysRemaining } from '@/features/dashboard/sprint-progress'
import { cn } from '@/lib/utils'

// Plain YYYY-MM-DD strings from the `date` column must not be handed to
// `new Date()` directly — that parses as UTC midnight and can render as the
// previous day in negative-offset timezones. Anchoring to local noon avoids
// the shift while keeping the display date correct (same fix as the app
// detail page's formatSprintDate).
function formatSprintDate(isoDate: string): string {
  return format(new Date(`${isoDate}T12:00:00`), 'MMM d')
}

function daysRemainingLabel(days: number): string {
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} left`
  if (days === 0) return 'Ends today'
  return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`
}

// `daysRemaining` is generic calendar-day-difference math (see
// sprint-progress.ts) — reused here against a future startDate instead of
// an endDate, so it always comes back positive for the upcoming-sprint card.
function startsInLabel(days: number): string {
  if (days === 1) return 'Starts in 1 day'
  return `Starts in ${days} days`
}

// Plain YYYY-MM-DD strings from the `date` column must not be handed to
// `new Date()` directly — that parses as UTC midnight and can render as the
// previous day in negative-offset timezones. Anchoring to local noon avoids
// the shift while keeping the display date correct (same fix as
// formatSprintDate above).
function formatUpcomingDate(isoDate: string): string {
  return format(new Date(`${isoDate}T12:00:00`), 'EEEE, MMM d')
}

/**
 * Server-safe: no client-only APIs, so it can render directly from the
 * dashboard server component (mirrors CapacityHeat).
 */
export function ActiveSprints({
  sprints,
  nextSprint = null,
}: {
  sprints: ActiveSprintSummary[]
  nextSprint?: UpcomingSprintSummary | null
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active sprints</CardTitle>
        {sprints.length > 0 ? (
          <CardAction>
            <span className="font-mono text-xs text-muted-foreground">
              <StatNumber value={sprints.length} />
            </span>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {sprints.length === 0 && nextSprint ? (
          <Link
            href={`/apps/${nextSprint.appSlug}?tab=roadmap`}
            className="flex flex-col items-center gap-1.5 rounded-lg py-4 text-center transition-colors duration-150 hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
          >
            <PawPrint className="size-5 text-muted-foreground/60" aria-hidden />
            <p className="text-sm font-medium">{nextSprint.sprintName}</p>
            <p className="text-xs text-muted-foreground">
              {nextSprint.appName} · {formatUpcomingDate(nextSprint.startDate)}
            </p>
            <p className="font-mono text-xs tabular-nums text-muted-foreground">
              {startsInLabel(daysRemaining(nextSprint.startDate))}
            </p>
          </Link>
        ) : sprints.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-4 text-center">
            <PawPrint className="size-5 text-muted-foreground/60" aria-hidden />
            <p className="text-sm font-medium">Nothing on the run.</p>
            <p className="text-xs text-muted-foreground">
              Start a sprint on an app and LogPup will keep watch here.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
            {sprints.map((sprint) => {
              const total = sprint.counts.todo + sprint.counts.in_progress + sprint.counts.done
              const progress = sprintProgress(sprint.counts)
              const remaining = daysRemaining(sprint.endDate)
              return (
                <li key={sprint.sprintId}>
                  <Link
                    href={`/apps/${sprint.appSlug}?tab=roadmap`}
                    className="flex flex-col gap-1.5 px-3 py-2.5 transition-colors duration-150 hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="flex min-w-0 items-baseline gap-1.5">
                        <span className="truncate text-sm font-medium">{sprint.sprintName}</span>
                        {sprint.status === 'planned' ? (
                          <Badge
                            variant="outline"
                            className="shrink-0 text-muted-foreground"
                            title="Running by date, but its status hasn't been flipped to Active yet"
                          >
                            not started
                          </Badge>
                        ) : null}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 font-mono text-xs',
                          remaining < 0 ? 'font-medium text-destructive' : 'text-muted-foreground',
                        )}
                      >
                        {daysRemainingLabel(remaining)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-xs text-muted-foreground">
                        {sprint.appName}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {formatSprintDate(sprint.startDate)} – {formatSprintDate(sprint.endDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.round(progress * 100)}%` }}
                        />
                      </div>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        <StatNumber value={sprint.counts.done} />/
                        <StatNumber value={total} />
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
