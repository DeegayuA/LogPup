'use client'

import { useCallback, useState, useTransition } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { isSameDay } from 'date-fns'
import { CalendarDays, List, Loader2, NotebookPen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HolidayLegend } from '@/components/shared/holiday-icon'
import { UpcomingMeetingsFiltered } from '@/features/meetings/components/upcoming-filter'
import { PastMeetingsSection } from '@/features/meetings/components/past-meetings-section'
import { MeetingForm } from '@/features/meetings/components/meeting-form'
import { createMeeting } from '@/features/meetings/actions'
import { toast } from 'sonner'
import {
  formatBusinessTime,
  formatBusinessWeekdayDayMonth,
} from '@/features/people/format-instant'
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
  apps = [],
  initialView,
  initialDate,
  todayIso,
}: {
  upcoming: MeetingSummary[]
  past: MeetingSummary[]
  currentUserId: string
  isAdmin: boolean
  users: MentionUser[]
  /** Apps the row-level edit dialog can move a meeting to. */
  apps?: { id: string; name: string }[]
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

  /**
   * The meeting whose write-up should already be open when the list view
   * paints — set only by the calendar dialog's "Open the write-up, transcript
   * and follow-ups" button, and cleared whenever the day filter is cleared.
   *
   * Without this, that button switched the view and set the day filter and
   * did nothing else, so it delivered you to a list with the write-up it had
   * just named still collapsed somewhere down the page. It kept its implicit
   * promise (get me to the meeting) and broke the one in its label.
   */
  const [openMeetingId, setOpenMeetingId] = useState<string | undefined>(undefined)

  function openMeetingInList(meeting: MeetingSummary) {
    setDay(meeting.startsAt)
    setOpenMeetingId(meeting.id)
    writeUrl('list', focusedDate)
  }

  /**
   * The empty slot somebody clicked in the grid, or `undefined` for "no create
   * dialog open".
   *
   * ONE form for the whole calendar, opened from here — not one per cell. A
   * week view is 7 days × 17 hours of empty slots, and mounting a dialog
   * behind each of them would be ~119 `MeetingForm` instances (each with its
   * own attendee picker and quick-add parser) to serve the one a person might
   * eventually click.
   *
   * The `key` matters: `MeetingForm` seeds its state once per mount, so
   * without it, clicking 3 PM after 2 PM would reopen the dialog still holding
   * 2 PM. Keying on the instant makes each slot a fresh form.
   */
  const [createAt, setCreateAt] = useState<Date | undefined>(undefined)

  /**
   * QUICK NOTES — an unplanned, note-taking-first meeting.
   *
   * "I need to take notes NOW" is a different gesture from scheduling: no
   * app, no invite list, no form — the meeting is the notebook. One click
   * creates a real meeting row (appId null, sole attendee: you, starting this
   * minute) and lands on it with the write-up panel already open, recorder a
   * click away.
   *
   * A REAL meeting row on purpose, not a separate "scratch notes" store: it
   * shows on every calendar view like anything else (which is the ask), the
   * whole notes/transcript/follow-ups surface works unchanged, and it can be
   * edited later into a proper meeting — retitled, moved onto an app, given
   * attendees — because it never was a second kind of thing.
   *
   * `createMeeting`'s Google-invite warning is deliberately swallowed here:
   * it means "attendees were not emailed", and the only attendee is you.
   */
  const [creatingQuickNotes, startQuickNotes] = useTransition()

  function handleQuickNotes() {
    startQuickNotes(async () => {
      try {
        const start = new Date()
        const end = new Date(start.getTime() + 60 * 60 * 1000)
        const res = await createMeeting({
          appId: null,
          title: `Quick notes — ${formatBusinessWeekdayDayMonth(start)} · ${formatBusinessTime(start)}`,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          attendeeIds: [currentUserId],
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setDay(start)
        setOpenMeetingId(res.data.meetingId)
        writeUrl('list', focusedDate)
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

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
        <div className="flex items-center gap-3">
          {/* The notebook-first path: creates the meeting AND opens its
              write-up in one click — see handleQuickNotes. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={creatingQuickNotes}
            onClick={handleQuickNotes}
          >
            {creatingQuickNotes ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <NotebookPen aria-hidden />
            )}
            {creatingQuickNotes ? 'Opening…' : 'Quick notes'}
          </Button>
          {/* Both the day strip (list view) and the calendar views mark holidays
              with these icons — one legend covers whichever view is active
              instead of duplicating it per-view. */}
          <HolidayLegend />
        </div>
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
              apps={apps}

              openMeetingId={openMeetingId}
              selectedDay={day}
              onSelectedDayChange={setDay}
            />
          </section>
          <PastMeetingsSection
            meetings={pastForDay}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            users={users}
            apps={apps}

            openMeetingId={openMeetingId}
            selectedDay={day}
            onClearDay={() => {
              setDay(undefined)
              setOpenMeetingId(undefined)
            }}
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
          apps={apps}
          openMeetingId={openMeetingId}
          onViewChange={(next) => writeUrl(next, focusedDate)}
          onFocusedDateChange={(next) => writeUrl(view, next)}
          onSelectDay={(selected) => {
            setDay(selected)
            writeUrl('list', focusedDate)
          }}
          onOpenMeetingInList={openMeetingInList}
          onCreateAt={setCreateAt}
        />
      )}

      {/* Opened by a `+` on an empty calendar slot. Keyed on the instant so
          each slot mounts a form seeded with its own time (see createAt). */}
      {createAt ? (
        <MeetingForm
          key={createAt.toISOString()}
          apps={apps}
          activeUsers={users}
          defaultStart={createAt}
          defaultOpen
          onOpenChange={(next) => {
            if (!next) setCreateAt(undefined)
          }}
          trigger={<span className="hidden" />}
        />
      ) : null}
    </div>
  )
}
