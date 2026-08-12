'use client'

import { useCallback, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { isSameDay } from 'date-fns'
import { CalendarDays, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HolidayLegend } from '@/components/shared/holiday-icon'
import { UpcomingMeetingsFiltered } from '@/features/meetings/components/upcoming-filter'
import { PastMeetingsSection } from '@/features/meetings/components/past-meetings-section'
import { MeetingsCalendar, useIsWideScreen } from '@/features/meetings/components/meetings-calendar'
import {
  calendarUrlPatch,
  parseCalendarView,
  parseFocusedDate,
  type CalendarView,
} from '@/features/meetings/calendar-view'
import type { MentionUser } from '@/components/mention-textarea'
import type { MeetingSummary } from '@/features/meetings/queries'

const VIEWS = [
  { id: 'list', label: 'List', icon: List },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
] as const

/** List/calendar switcher for the meetings page — the calendar side now carries
 *  Day, Week, Month and Agenda (see meetings-calendar.tsx). */
export function MeetingsViews({
  upcoming,
  past,
  currentUserId,
  isAdmin,
  users,
  initialView,
  initialDate,
  todayIso,
}: {
  upcoming: MeetingSummary[]
  past: MeetingSummary[]
  currentUserId: string
  isAdmin: boolean
  users: MentionUser[]
  /** Parsed from the page's awaited `searchParams`, so the first server paint
   *  is already the view the URL asked for rather than a default that flips
   *  after hydration. */
  initialView: CalendarView
  initialDate: string
  /** Today in Asia/Colombo, read once on the server. Both sides of hydration
   *  need the same answer or "today" lands on two different squares. */
  todayIso: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isWide = useIsWideScreen()

  /*
   * The view and the focused date live in the URL, written with the History API
   * rather than the router — the same choice the sprint board makes and for the
   * same reason: the page has already fetched every meeting, so routing on each
   * Prev click would re-run three server queries to redraw data the browser is
   * holding. Next keeps `useSearchParams` in sync with a native replaceState,
   * so this still re-renders.
   *
   * replaceState, not pushState: paging through a month of weeks would
   * otherwise bury wherever you came from under thirty history entries.
   *
   * `calendarUrlPatch` always writes `view`, so a missing key can only mean
   * "nobody has touched the switcher yet" — in which case the server's parse
   * (initialView) is exactly right.
   */
  const view = parseCalendarView(searchParams.get('view') ?? initialView)
  // Only read when `view` is a calendar view; the list has no focused date.
  const focusedDate = parseFocusedDate(searchParams.get('date') ?? initialDate, todayIso)

  const writeUrl = useCallback(
    (nextView: CalendarView, nextDate: string) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(calendarUrlPatch(nextView, nextDate))) {
        if (value === null) params.delete(key)
        else params.set(key, value)
      }
      const query = params.toString()
      window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname)
    },
    [pathname, searchParams],
  )

  // Day selection lives here, not in UpcomingMeetingsFiltered, so a calendar
  // chip can hand its day to the list view on the way over.
  const [day, setDay] = useState<Date | undefined>(undefined)

  // The day filter has to reach BOTH halves of the list view. It used to reach
  // only the upcoming half, so the calendar dialog's "Open the write-up,
  // transcript and follow-ups" — the one route from a chip to a meeting's
  // notes — sent anyone who clicked it on a PAST meeting to an upcoming list
  // filtered to a day in the past (always empty) with the past section still
  // collapsed. The meeting they asked for was on screen nowhere.
  const pastForDay = day ? past.filter((meeting) => isSameDay(meeting.startsAt, day)) : past

  /** Week is unusable on a phone, so that is not what "Calendar" opens into
   *  there. This is a DEFAULT, not an override: someone who then picks Week
   *  keeps Week (see the notice in meetings-calendar.tsx). */
  const calendarEntryView: CalendarView = isWide === false ? 'day' : 'week'

  function handleTopLevel(next: (typeof VIEWS)[number]['id']) {
    if (next === 'list') {
      writeUrl('list', focusedDate)
      return
    }
    // Arriving at the calendar always lands on today: it is opened to answer
    // "what is happening now", and a date left over from a link somebody sent
    // last month is not an answer to that.
    writeUrl(view === 'list' ? calendarEntryView : view, todayIso)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Meetings view"
          className="flex w-fit items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5"
        >
          {/* Filled variant for the active view — `bg-card` on this `muted/50`
              track resolves to the same color as the track in dark theme, i.e. no
              visible selected state at all. */}
          {VIEWS.map(({ id, label, icon: Icon }) => {
            const active = id === 'list' ? view === 'list' : view !== 'list'
            return (
              <Button
                key={id}
                variant={active ? 'default' : 'ghost'}
                size="sm"
                type="button"
                aria-pressed={active}
                onClick={() => handleTopLevel(id)}
                className="h-7 px-2.5"
              >
                <Icon /> {label}
              </Button>
            )
          })}
        </div>
        {/* Both the day strip (list view) and the calendar views mark holidays
            with these icons — one legend covers whichever view is active
            instead of duplicating it per-view. */}
        <HolidayLegend />
      </div>

      {view === 'list' ? (
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-3">
            {/* text-lg semibold — the same level the calendar view's heading
                renders at. These two are one click apart and were visibly
                different sizes and weights for the same heading level. The
                count is here because a section heading with a number in it is
                the cheapest at-a-glance fact on the page. */}
            <h2 className="flex items-baseline gap-2 font-heading text-lg font-semibold">
              Upcoming
              <span className="font-mono text-sm font-normal text-muted-foreground">
                {upcoming.length}
              </span>
            </h2>
            <UpcomingMeetingsFiltered
              meetings={upcoming}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              users={users}
              selectedDay={day}
              onSelectedDayChange={setDay}
            />
          </section>
          <PastMeetingsSection
            meetings={pastForDay}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            users={users}
            selectedDay={day}
            onClearDay={() => setDay(undefined)}
          />
        </div>
      ) : (
        <MeetingsCalendar
          view={view}
          focusedDate={focusedDate}
          todayIso={todayIso}
          upcoming={upcoming}
          past={past}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          users={users}
          onViewChange={(next) => writeUrl(next, focusedDate)}
          onFocusedDateChange={(next) => writeUrl(view, next)}
          onSelectDay={(selected) => {
            setDay(selected)
            writeUrl('list', focusedDate)
          }}
        />
      )}
    </div>
  )
}
