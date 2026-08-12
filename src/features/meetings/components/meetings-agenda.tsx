'use client'

/**
 * The Agenda view: one month of meetings as a chronological reading list,
 * grouped by day.
 *
 * It renders the EXISTING `MeetingList` rows rather than a third way of
 * drawing a meeting. Those rows already carry the timing chip, the RSVP tally,
 * the outcome chips and the notes/transcript panel — everything the grid views
 * deliberately cannot show — so the agenda's whole job is to put the right
 * meetings under the right day headings and then get out of the way.
 *
 * It is also the answer for a phone: a week grid on a 380px screen is
 * unreadable, and this is the same month's worth of information in a shape
 * that reads perfectly at that width.
 */

import { format } from 'date-fns'
import { CalendarDaysIcon } from 'lucide-react'
import { HolidayIcons, holidayCategoryLabel, holidayToneClass } from '@/components/shared/holiday-icon'
import { getLkHoliday, isLkSunday, toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { cn } from '@/lib/utils'
import { isoDayInstant, isoToDisplayDate } from '@/features/meetings/calendar-view'
import { MeetingList } from '@/features/meetings/components/meeting-list'
import type { MentionUser } from '@/components/mention-textarea'
import type { MeetingSummary } from '@/features/meetings/queries'

export function MeetingsAgenda({
  days,
  meetings,
  currentUserId,
  isAdmin,
  users,
  apps = [],
  openMeetingId,
  todayIso,
}: {
  /** Every ISO day in the focused month, in order. */
  days: string[]
  /** Meetings already narrowed to that month by the caller. */
  meetings: MeetingSummary[]
  currentUserId: string
  isAdmin: boolean
  users: MentionUser[]
  apps?: { id: string; name: string }[]
  openMeetingId?: string
  todayIso: string
}) {
  // Grouped by the meeting's Colombo START day, so a 22:00 call that runs past
  // midnight is listed once, under the evening it began — not twice, and not
  // under a Wednesday nobody would think to look at.
  const byDay = new Map<string, MeetingSummary[]>()
  for (const meeting of meetings) {
    const key = toIsoDateInTimeZone(meeting.startsAt)
    const list = byDay.get(key) ?? []
    list.push(meeting)
    byDay.set(key, list)
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  }

  // Days with nothing on them are skipped: a reading list padded with thirty
  // "no meetings" headings is a list you stop reading.
  const populated = days.filter((iso) => (byDay.get(iso)?.length ?? 0) > 0)

  if (populated.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border px-4 py-10 text-center">
        <CalendarDaysIcon className="size-5 text-muted-foreground/60" aria-hidden />
        <p className="text-sm font-medium">Nothing scheduled this month.</p>
        <p className="text-xs text-muted-foreground">
          Step to another month, or schedule a meeting to fill it.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {populated.map((iso) => {
        const instant = isoDayInstant(iso)
        const holiday = getLkHoliday(instant)
        const isWeekendDay = isLkSunday(instant) && !holiday
        const display = isoToDisplayDate(iso)
        const dayMeetings = byDay.get(iso) ?? []

        return (
          <section key={iso} className="flex flex-col gap-2.5">
            {/* h3 — /meetings owns the h1 and the view heading above is an h2,
                so a day heading must not skip a level. */}
            <h3 className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-border pb-1.5">
              <span
                className={cn(
                  'font-heading text-sm font-semibold',
                  iso === todayIso
                    ? 'text-primary'
                    : holiday
                      ? holidayToneClass(holiday.categories)
                      : isWeekendDay
                        ? 'text-weekend'
                        : 'text-foreground',
                )}
              >
                {format(display, 'EEEE, MMMM d')}
              </span>
              {iso === todayIso ? (
                <span className="font-mono text-2xs text-primary">Today</span>
              ) : null}
              {holiday ? (
                <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                  <HolidayIcons categories={holiday.categories} className="size-3 shrink-0" />
                  {holiday.name}
                  <span className="sr-only">, {holidayCategoryLabel(holiday.categories)}</span>
                </span>
              ) : null}
              <span className="ml-auto font-mono text-2xs tabular-nums text-muted-foreground">
                {dayMeetings.length}
              </span>
            </h3>
            <MeetingList
              meetings={dayMeetings}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              users={users}
              apps={apps}

              openMeetingId={openMeetingId}
            />
          </section>
        )
      })}
    </div>
  )
}
