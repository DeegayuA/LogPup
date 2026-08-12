import Link from 'next/link'
import { CalendarDays, Video } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionEmpty } from '@/features/people/components/section-empty'
import { formatBusinessMeetingRange } from '@/features/people/format-instant'
import type { AttendeeResponse, PersonMeetingEntry } from '@/features/people/meeting-window'
import type { PersonMeetingsView } from '@/features/people/queries'
import { cn } from '@/lib/utils'

const linkClass =
  'rounded-sm underline-offset-2 transition-colors duration-150 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

/**
 * RSVP is shown for what it is. 'pending' is the column default that most rows
 * never move off, so it is rendered as the quiet "no reply" rather than as a
 * state anyone chose — and 'declined' is the only one that gets the danger
 * token, because it is the only one that changes whether they were there.
 */
const RESPONSE_LABEL: Record<AttendeeResponse, string> = {
  going: 'Going',
  maybe: 'Maybe',
  declined: 'Declined',
  pending: 'No reply',
}

const RESPONSE_CLASS: Record<AttendeeResponse, string> = {
  going: 'text-primary',
  maybe: 'text-chart-1',
  declined: 'text-destructive',
  pending: 'text-muted-foreground',
}

/**
 * Meetings this person is on, ahead and behind.
 *
 * The old card listed upcoming meetings only, as inert text: no end time, no
 * app, no RSVP, no link, and nothing at all about whether they had been turning
 * up. Since `meeting_attendees.response` was already stored and never read, "he
 * has declined the next three" was invisible.
 *
 * There is no per-meeting route in this product, so rows link to /meetings
 * (where the list lives) and, when there is one, offer the call link directly —
 * a dead-end row that looks clickable is worse than one that does not.
 */
export function PersonMeetingsCard({ meetings }: { meetings: PersonMeetingsView }) {
  const { upcoming, recent, totalUpcoming, totalRecent, attendedRecently, attendedWindowDays } =
    meetings

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meetings</CardTitle>
        <CardAction>
          {/* Says what the number IS. `meeting_attendees.response` defaults to
              'pending' and most people never move it, so this counts meetings
              they did not decline — not meetings anyone confirmed they were
              in. "{n} in 30d" next to a heading called Meetings would be read
              as attendance, which is a claim this schema cannot support. */}
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {attendedRecently} not declined · {attendedWindowDays}d
          </span>
        </CardAction>
      </CardHeader>

      {totalUpcoming + totalRecent === 0 ? (
        <SectionEmpty
          icon={CalendarDays}
          title="No meetings either side of today."
          hint="Nothing in the last 60 days and nothing scheduled in the next 60."
        />
      ) : (
        <CardContent className="flex flex-col gap-4">
          <MeetingList
            heading="Upcoming"
            emptyLine="Nothing scheduled."
            entries={upcoming}
            total={totalUpcoming}
          />
          <MeetingList
            heading="Recent"
            emptyLine="Nothing in the last 60 days."
            entries={recent}
            total={totalRecent}
          />
        </CardContent>
      )}
    </Card>
  )
}

function MeetingList({
  heading,
  emptyLine,
  entries,
  total,
}: {
  heading: string
  emptyLine: string
  entries: PersonMeetingEntry[]
  total: number
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {heading}
        </h3>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{total}</span>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLine}</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-1 px-3 py-2">
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 text-sm">{entry.title}</span>
                  {entry.inProgress ? (
                    <Badge variant="default" className="shrink-0 text-2xs">
                      Now
                    </Badge>
                  ) : null}
                  {entry.meetingUrl ? (
                    <a
                      href={entry.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={cn('shrink-0 text-muted-foreground', linkClass)}
                    >
                      <Video className="size-3.5" aria-hidden />
                      <span className="sr-only">Join {entry.title}</span>
                    </a>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-muted-foreground">
                  {/* Colombo wall clock, 12-hour, matching /meetings — see
                      format-instant.ts. This is a SERVER component, so
                      date-fns `format()` here printed the server's timezone:
                      a 9:00 AM standup rendered as "03:30" on Vercel while the
                      meetings list, which formats on the client, said 9:00 AM
                      for the same row. */}
                  <time
                    dateTime={entry.startsAt.toISOString()}
                    className="font-mono tabular-nums whitespace-nowrap"
                  >
                    {formatBusinessMeetingRange(entry.startsAt, entry.endsAt)}
                  </time>
                  <span aria-hidden>·</span>
                  <span className={RESPONSE_CLASS[entry.response]}>
                    {RESPONSE_LABEL[entry.response]}
                  </span>
                  {entry.appSlug && entry.appName ? (
                    <>
                      <span aria-hidden>·</span>
                      <Link href={`/apps/${entry.appSlug}`} className={cn('truncate', linkClass)}>
                        {entry.appName}
                      </Link>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {total > entries.length ? (
            <Link
              href="/meetings"
              className={cn('w-fit text-xs text-muted-foreground', linkClass)}
            >
              {total - entries.length} more in Meetings
            </Link>
          ) : null}
        </>
      )}
    </section>
  )
}
