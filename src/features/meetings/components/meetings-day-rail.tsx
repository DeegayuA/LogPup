'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ExternalLink, Users } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { isoToDisplayDate } from '@/features/meetings/calendar-view'
import {
  durationLabel,
  meetingTiming,
  tallyRsvps,
} from '@/features/meetings/components/meeting-glance'
import { formatBusinessTime } from '@/features/people/format-instant'
import type { MeetingSummary } from '@/features/meetings/queries'

/**
 * The day view's right rail: a mini-month for jumping between days, and the
 * details of the day's most relevant meeting.
 *
 * ADDITIVE ONLY — every existing interaction is untouched. Chips still open
 * the detail dialog, the header stepper still steps, and below `xl` this rail
 * simply is not there (a phone-width day view has no room to give it). What
 * it adds is the two things wanted at a glance without opening anything:
 * where the month's meetings cluster (the dots), and what is live-or-next
 * today.
 *
 * DISPLAY-SPACE DATES, deliberately. react-day-picker works in local `Date`
 * objects; this app's day identity is a business-timezone ISO string. The
 * conversion happens at exactly two edges — `isoToDisplayDate` going in,
 * `format(date, 'yyyy-MM-dd')` coming out — the same contract the month grid
 * uses, so a click on "12" can never land on the 11th from a UTC-offset
 * browser.
 */
export function MeetingsDayRail({
  meetings,
  focusedDate,
  onFocusedDateChange,
  onOpenMeeting,
}: {
  meetings: MeetingSummary[]
  /** Business-timezone ISO day, e.g. "2026-08-12". */
  focusedDate: string
  onFocusedDateChange: (iso: string) => void
  /** Opens the existing detail dialog — the rail never replaces it. */
  onOpenMeeting: (meetingId: string) => void
}) {
  // Which month the picker shows — independent of the focused day, so
  // browsing September does not yank the grid off August 12th until a day is
  // actually clicked.
  const [month, setMonth] = useState(() => isoToDisplayDate(focusedDate))

  // One ISO day per meeting, business timezone — the same mapping the grid
  // columns use, so a dot and a chip can never disagree about which day a
  // meeting belongs to.
  const meetingDays = useMemo(
    () => new Set(meetings.map((meeting) => toIsoDateInTimeZone(meeting.startsAt))),
    [meetings],
  )

  const dayMeetings = useMemo(
    () =>
      meetings
        .filter((meeting) => toIsoDateInTimeZone(meeting.startsAt) === focusedDate)
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    [meetings, focusedDate],
  )

  // Live beats next-up beats most-recent: the question the rail answers is
  // "what should I care about right now", not "what happened first today".
  const now = new Date()
  const highlighted =
    dayMeetings.find((m) => meetingTiming(m.startsAt, m.endsAt, now).state === 'live') ??
    dayMeetings.find((m) => m.startsAt.getTime() > now.getTime()) ??
    dayMeetings[dayMeetings.length - 1]

  const rsvp = highlighted ? tallyRsvps(highlighted.attendees) : null

  return (
    <aside
      aria-label="Day overview"
      className="flex w-64 shrink-0 flex-col gap-4 rounded-xl border border-border bg-card p-3"
    >
      <Calendar
        mode="single"
        month={month}
        onMonthChange={setMonth}
        selected={isoToDisplayDate(focusedDate)}
        onSelect={(date) => {
          if (date) onFocusedDateChange(format(date, 'yyyy-MM-dd'))
        }}
        modifiers={{
          hasMeeting: (date: Date) => meetingDays.has(format(date, 'yyyy-MM-dd')),
        }}
        modifiersClassNames={{
          // The dot under days that have meetings — content-[''] is what makes
          // the pseudo-element exist at all.
          hasMeeting:
            "relative after:absolute after:bottom-0.5 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary after:content-['']",
        }}
        className="w-full p-0"
      />

      {highlighted ? (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <div className="flex flex-col gap-0.5">
            <h3 className="font-heading text-sm font-semibold">{highlighted.title}</h3>
            <p className="font-mono text-xs tabular-nums text-muted-foreground">
              {formatBusinessTime(highlighted.startsAt)} – {formatBusinessTime(highlighted.endsAt)}{' '}
              · {durationLabel(highlighted.startsAt, highlighted.endsAt)}
            </p>
          </div>

          {highlighted.attendees.length > 0 ? (
            <div className="flex items-center gap-2">
              <AvatarGroup>
                {highlighted.attendees.slice(0, 5).map((attendee) => (
                  <Avatar key={attendee.id} size="sm">
                    {attendee.avatarUrl ? <AvatarImage src={attendee.avatarUrl} alt="" /> : null}
                    <AvatarFallback>{attendee.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                ))}
              </AvatarGroup>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="size-3.5" aria-hidden />
                {rsvp ? `${rsvp.going} / ${highlighted.attendees.length} going` : null}
              </span>
            </div>
          ) : null}

          {highlighted.agenda ? (
            <p className="line-clamp-3 text-xs text-muted-foreground">{highlighted.agenda}</p>
          ) : null}

          <div className="flex items-center gap-2 pt-1">
            <Button type="button" size="sm" onClick={() => onOpenMeeting(highlighted.id)}>
              Open details
            </Button>
            {highlighted.meetingUrl ? (
              <Button
                variant="outline"
                size="sm"
                render={<a href={highlighted.meetingUrl} target="_blank" rel="noopener noreferrer" />}
              >
                <ExternalLink aria-hidden /> Join
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          Nothing scheduled this day.
        </p>
      )}
    </aside>
  )
}
