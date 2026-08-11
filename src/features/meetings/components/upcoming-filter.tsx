'use client'

import { useState } from 'react'
import { isSameDay } from 'date-fns'
import { X } from 'lucide-react'
import {
  MiniCalendar,
  MiniCalendarDay,
  MiniCalendarDays,
  MiniCalendarNavigation,
} from '@/components/kibo-ui/mini-calendar'
import { Button } from '@/components/ui/button'
import { MeetingList } from '@/features/meetings/components/meeting-list'
import type { MeetingSummary } from '@/features/meetings/queries'

/** Upcoming meetings with a Kibo mini-calendar day strip as a quick filter. */
export function UpcomingMeetingsFiltered({
  meetings,
  currentUserId,
  isAdmin,
}: {
  meetings: MeetingSummary[]
  currentUserId: string
  isAdmin: boolean
}) {
  const [selected, setSelected] = useState<Date | undefined>(undefined)
  const filtered = selected
    ? meetings.filter((meeting) => isSameDay(meeting.startsAt, selected))
    : meetings

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <MiniCalendar
          value={selected}
          onValueChange={setSelected}
          days={7}
          className="bg-card"
        >
          <MiniCalendarNavigation direction="prev" />
          <MiniCalendarDays>
            {(date) => <MiniCalendarDay date={date} key={date.toISOString()} />}
          </MiniCalendarDays>
          <MiniCalendarNavigation direction="next" />
        </MiniCalendar>
        {selected ? (
          <Button variant="ghost" size="sm" type="button" onClick={() => setSelected(undefined)}>
            <X /> All days
          </Button>
        ) : null}
      </div>
      {selected && filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No meetings that day — pick another or clear the filter.
        </p>
      ) : (
        <MeetingList meetings={filtered} currentUserId={currentUserId} isAdmin={isAdmin} />
      )}
    </div>
  )
}
