import Link from 'next/link'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MeetingSummary } from '@/features/meetings/queries'

/**
 * Server-safe: no client-only APIs, so it can render directly from the
 * dashboard server component (mirrors CapacityHeat / ActiveSprints).
 */
export function UpcomingMeetings({ meetings }: { meetings: MeetingSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming meetings</CardTitle>
        {meetings.length > 0 ? (
          <CardAction>
            <span className="font-mono text-xs text-muted-foreground">{meetings.length}</span>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {meetings.length === 0 ? (
          <div className="flex flex-col gap-1 py-4 text-center">
            <p className="text-sm font-medium">No meetings on the horizon.</p>
            <p className="text-xs text-muted-foreground">Your week is clear.</p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {meetings.map((meeting) => (
              <li key={meeting.id} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {meeting.title}
                </span>
                {meeting.appName && meeting.appSlug ? (
                  <Badge
                    variant="secondary"
                    className="shrink-0"
                    render={<Link href={`/apps/${meeting.appSlug}`} />}
                  >
                    {meeting.appName}
                  </Badge>
                ) : null}
                <time
                  dateTime={meeting.startsAt.toISOString()}
                  className="shrink-0 font-mono text-xs text-muted-foreground"
                >
                  {format(meeting.startsAt, 'EEE, MMM d · h:mm a')}
                </time>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
