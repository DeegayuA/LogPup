'use client'

import { useState } from 'react'
import { isSameDay } from 'date-fns'
import { CalendarDays, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HolidayLegend } from '@/components/shared/holiday-icon'
import { UpcomingMeetingsFiltered } from '@/features/meetings/components/upcoming-filter'
import { PastMeetingsSection } from '@/features/meetings/components/past-meetings-section'
import { MeetingsMonthCalendar } from '@/features/meetings/components/meetings-month-calendar'
import type { MentionUser } from '@/components/mention-textarea'
import type { MeetingSummary } from '@/features/meetings/queries'

const VIEWS = [
  { id: 'list', label: 'List', icon: List },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
] as const

type ViewId = (typeof VIEWS)[number]['id']

/** List/calendar switcher for the meetings page — calendar is the month event grid. */
export function MeetingsViews({
  upcoming,
  past,
  currentUserId,
  isAdmin,
  users,
}: {
  upcoming: MeetingSummary[]
  past: MeetingSummary[]
  currentUserId: string
  isAdmin: boolean
  users: MentionUser[]
}) {
  const [view, setView] = useState<ViewId>('list')
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
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant={view === id ? 'default' : 'ghost'}
              size="sm"
              type="button"
              aria-pressed={view === id}
              onClick={() => setView(id)}
              className="h-7 px-2.5"
            >
              <Icon /> {label}
            </Button>
          ))}
        </div>
        {/* Both the day strip (list view) and the month grid (calendar view)
            mark holidays with these icons — one legend covers whichever view
            is active instead of duplicating it per-view. */}
        <HolidayLegend />
      </div>

      {view === 'list' ? (
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-3">
            {/* text-lg semibold — the same level the calendar view's month
                heading renders at. These two are one click apart and were
                visibly different sizes and weights for the same heading
                level. The count is here because a section heading with a
                number in it is the cheapest at-a-glance fact on the page. */}
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
        <MeetingsMonthCalendar
          upcoming={upcoming}
          past={past}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onSelectDay={(selected) => {
            setDay(selected)
            setView('list')
          }}
        />
      )}
    </div>
  )
}
