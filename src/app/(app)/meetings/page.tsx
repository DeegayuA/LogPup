import Link from 'next/link'
import { format, isToday, isTomorrow } from 'date-fns'
import { PawPrint, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { listUpcomingMeetings, type UpcomingMeeting } from '@/features/meetings/queries'

function dayLabel(date: Date) {
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  return format(date, 'EEE, MMM d')
}

function groupByDay(meetings: UpcomingMeeting[]) {
  const byDay = new Map<string, UpcomingMeeting[]>()
  for (const meeting of meetings) {
    const key = format(meeting.startsAt, 'yyyy-MM-dd')
    const group = byDay.get(key) ?? []
    group.push(meeting)
    byDay.set(key, group)
  }
  return [...byDay.entries()]
}

function MeetingRow({ meeting }: { meeting: UpcomingMeeting }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
      <span className="font-mono text-xs text-muted-foreground">
        {format(meeting.startsAt, 'HH:mm')}–{format(meeting.endsAt, 'HH:mm')}
      </span>
      <span className="text-sm font-medium">{meeting.title}</span>
      {meeting.appSlug ? (
        <Badge variant="secondary" render={<Link href={`/apps/${meeting.appSlug}`} />}>
          {meeting.appName}
        </Badge>
      ) : null}
      <span className="ml-auto flex items-center gap-3">
        {meeting.googleEventId ? (
          <span
            className="text-xs text-muted-foreground/70"
            title="Synced from Google Calendar"
          >
            synced
          </span>
        ) : null}
        {meeting.attendeeCount > 0 ? (
          <span
            className="flex items-center gap-1 text-muted-foreground"
            title={`${meeting.attendeeCount} attendee${meeting.attendeeCount === 1 ? '' : 's'}`}
          >
            <Users className="size-3.5" aria-hidden />
            <span className="font-mono text-xs">{meeting.attendeeCount}</span>
          </span>
        ) : null}
      </span>
    </li>
  )
}

export default async function MeetingsPage() {
  const meetings = await listUpcomingMeetings()
  const days = groupByDay(meetings)

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Meetings</h1>
        {meetings.length > 0 ? (
          <span className="font-mono text-xs text-muted-foreground">
            {meetings.length} upcoming
          </span>
        ) : null}
      </div>
      {meetings.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-accent">
            <PawPrint className="size-5 text-accent-foreground" aria-hidden />
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-heading text-base font-semibold">No meetings on the horizon.</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Calendar sync is coming soon — fetched meetings will land here on their own.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex w-full max-w-3xl flex-col gap-6">
          {days.map(([key, group]) => {
            const label = dayLabel(group[0].startsAt)
            return (
              <section key={key} className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2">
                  <h2 className="font-heading text-sm font-semibold">{label}</h2>
                  {label === 'Today' || label === 'Tomorrow' ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {format(group[0].startsAt, 'EEE, MMM d')}
                    </span>
                  ) : null}
                </div>
                <ul className="divide-y divide-border rounded-lg border bg-card">
                  {group.map((meeting) => (
                    <MeetingRow key={meeting.id} meeting={meeting} />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
