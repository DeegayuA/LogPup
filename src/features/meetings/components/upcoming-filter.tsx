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
import type { MentionUser } from '@/components/mention-textarea'
import type { MeetingSummary } from '@/features/meetings/queries'

/** Upcoming meetings with a Kibo mini-calendar day strip as a quick filter. */
export function UpcomingMeetingsFiltered({
  meetings,
  currentUserId,
  isAdmin,
  users = [],
}: {
  meetings: MeetingSummary[]
  currentUserId: string
  isAdmin: boolean
  users?: MentionUser[]
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
          days={30}
          className="bg-card"
        >
          <MiniCalendarNavigation direction="prev" aria-label="Show earlier days" />
          {/* All 30 days render at once; the strip fills the full width of its
              container edge-to-edge and scrolls horizontally in its own
              overflow-x container (never the page body), arrows still page
              for keyboard users. */}
          <MiniCalendarDays>
            {(date) => (
              <MiniCalendarDay
                date={date}
                key={date.toISOString()}
                className="snap-start"
                aria-pressed={selected ? isSameDay(date, selected) : false}
              />
            )}
          </MiniCalendarDays>
          <MiniCalendarNavigation direction="next" aria-label="Show later days" />
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
        <MeetingList
          meetings={filtered}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          users={users}
        />
      )}
    </div>
  )
}
