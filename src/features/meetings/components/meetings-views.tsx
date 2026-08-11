'use client'

import { useState } from 'react'
import { CalendarDays, List } from 'lucide-react'
import {
  CalendarBody,
  CalendarDate,
  CalendarDatePagination,
  CalendarDatePicker,
  CalendarHeader,
  CalendarItem,
  CalendarMonthPicker,
  CalendarProvider,
  CalendarYearPicker,
  type Feature,
} from '@/components/kibo-ui/calendar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { UpcomingMeetingsFiltered } from '@/features/meetings/components/upcoming-filter'
import { PastMeetingsSection } from '@/features/meetings/components/past-meetings-section'
import type { MentionUser } from '@/components/mention-textarea'
import type { MeetingSummary } from '@/features/meetings/queries'

const VIEWS = [
  { id: 'list', label: 'List', icon: List },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
] as const

type ViewId = (typeof VIEWS)[number]['id']

function toFeatures(upcoming: MeetingSummary[], past: MeetingSummary[]): Feature[] {
  const map = (meeting: MeetingSummary, tone: 'upcoming' | 'past'): Feature => ({
    id: meeting.id,
    name: meeting.title,
    startAt: new Date(meeting.startsAt),
    endAt: new Date(meeting.endsAt),
    status:
      tone === 'upcoming'
        ? { id: 'upcoming', name: 'Upcoming', color: 'var(--color-primary)' }
        : { id: 'past', name: 'Past', color: 'var(--color-muted-foreground)' },
  })
  return [...upcoming.map((m) => map(m, 'upcoming')), ...past.map((m) => map(m, 'past'))]
}

/** List/calendar switcher for the meetings page — calendar is the Kibo month grid. */
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
  const features = view === 'calendar' ? toFeatures(upcoming, past) : []

  return (
    <div className="flex flex-col gap-4">
      <div
        role="group"
        aria-label="Meetings view"
        className="flex w-fit items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5"
      >
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant="ghost"
            size="sm"
            type="button"
            aria-pressed={view === id}
            onClick={() => setView(id)}
            className={cn(
              'h-7 px-2.5',
              view === id && 'bg-card text-foreground shadow-xs hover:bg-card',
            )}
          >
            <Icon /> {label}
          </Button>
        ))}
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
        <div className="rounded-xl border bg-card">
          <CalendarProvider className="text-sm">
            <CalendarDate>
              <CalendarDatePicker>
                <CalendarMonthPicker />
                <CalendarYearPicker start={2024} end={2030} />
              </CalendarDatePicker>
              <CalendarDatePagination />
            </CalendarDate>
            <CalendarHeader />
            <CalendarBody features={features}>
              {({ feature }) => <CalendarItem feature={feature} key={feature.id} />}
            </CalendarBody>
          </CalendarProvider>
        </div>
      )}
    </div>
  )
}
