import Link from 'next/link'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
      </CardHeader>
      <CardContent>
        {meetings.length === 0 ? (
          <div className="flex flex-col gap-1 py-4 text-center">
            <p className="text-sm text-muted-foreground">No meetings this week</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {meetings.map((meeting) => (
              <li key={meeting.id} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{meeting.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {format(meeting.startsAt, 'EEE MMM d, h:mm a')}
                  </span>
                </div>
                {meeting.appName && meeting.appSlug ? (
                  <Link
                    href={`/apps/${meeting.appSlug}`}
                    className="w-fit text-xs text-muted-foreground hover:text-foreground"
                  >
                    {meeting.appName}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
