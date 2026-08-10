import Link from 'next/link'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ActiveSprintSummary } from '@/features/sprints/queries'
import { sprintProgress, daysRemaining } from '@/features/dashboard/sprint-progress'

// Plain YYYY-MM-DD strings from the `date` column must not be handed to
// `new Date()` directly — that parses as UTC midnight and can render as the
// previous day in negative-offset timezones. Anchoring to local noon avoids
// the shift while keeping the display date correct (same fix as the app
// detail page's formatSprintDate).
function formatSprintDate(isoDate: string): string {
  return format(new Date(`${isoDate}T12:00:00`), 'MMM d, yyyy')
}

function daysRemainingLabel(days: number): string {
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} left`
  if (days === 0) return 'Ends today'
  return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`
}

/**
 * Server-safe: no client-only APIs, so it can render directly from the
 * dashboard server component (mirrors CapacityHeat).
 */
export function ActiveSprints({ sprints }: { sprints: ActiveSprintSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active sprints</CardTitle>
      </CardHeader>
      <CardContent>
        {sprints.length === 0 ? (
          <div className="flex flex-col gap-1 py-4 text-center">
            <p className="text-sm text-muted-foreground">No active sprints</p>
            <p className="text-xs text-muted-foreground">
              Start a sprint on an app to see it here.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {sprints.map((sprint) => {
              const total = sprint.counts.todo + sprint.counts.in_progress + sprint.counts.done
              const progress = sprintProgress(sprint.counts)
              const remaining = daysRemaining(sprint.endDate)
              return (
                <li key={sprint.sprintId} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/apps/${sprint.appSlug}`}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {sprint.appName}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {daysRemainingLabel(remaining)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {sprint.sprintName} · {formatSprintDate(sprint.startDate)} –{' '}
                    {formatSprintDate(sprint.endDate)}
                  </p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {sprint.counts.done}/{total} tasks done
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
