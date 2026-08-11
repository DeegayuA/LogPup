'use client'

import { useState } from 'react'
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
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="font-heading text-base font-medium">Upcoming</h2>
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
            meetings={past}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            users={users}
          />
        </div>
      ) : (
        <MeetingsMonthCalendar
          upcoming={upcoming}
          past={past}
          onSelectDay={(selected) => {
            setDay(selected)
            setView('list')
          }}
        />
      )}
    </div>
  )
}
