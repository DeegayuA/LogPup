'use client'

import { useState, type KeyboardEvent } from 'react'
import { differenceInCalendarDays, isSameDay } from 'date-fns'
import { CalendarDaysIcon, X } from 'lucide-react'
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

/** Days rendered in the strip at once. */
const STRIP_DAYS = 30

/** Upcoming meetings with a Kibo mini-calendar day strip as a quick filter. */
export function UpcomingMeetingsFiltered({
  meetings,
  currentUserId,
  isAdmin,
  users = [],
  selectedDay,
  onSelectedDayChange,
}: {
  meetings: MeetingSummary[]
  currentUserId: string
  isAdmin: boolean
  users?: MentionUser[]
  /** Controlled day filter — omit both to keep the selection internal. */
  selectedDay?: Date
  onSelectedDayChange?: (date: Date | undefined) => void
}) {
  const [internalDay, setInternalDay] = useState<Date | undefined>(undefined)
  const isControlled = onSelectedDayChange !== undefined
  const selected = isControlled ? selectedDay : internalDay

  function setSelected(date: Date | undefined) {
    if (!isControlled) setInternalDay(date)
    onSelectedDayChange?.(date)
  }

  const filtered = selected
    ? meetings.filter((meeting) => isSameDay(meeting.startsAt, selected))
    : meetings

  // The strip's window is held here so the roving tab stop always lands on a
  // day that is actually rendered — after paging, neither the selection nor
  // today is necessarily still in range, and a strip where every cell is
  // tabIndex -1 would vanish from the tab order altogether.
  const [stripStart, setStripStart] = useState(() => new Date())
  const today = new Date()
  const inStrip = (date: Date) => {
    const offset = differenceInCalendarDays(date, stripStart)
    return offset >= 0 && offset < STRIP_DAYS
  }
  let rovingDate = stripStart
  if (selected && inStrip(selected)) rovingDate = selected
  else if (inStrip(today)) rovingDate = today

  // Roving tabindex (WAI-ARIA composite-widget pattern): the 30-day strip is a
  // single tab stop with arrow-key navigation inside it, rather than 30
  // sequential stops — most of them scrolled out of view — between the page
  // header and the meeting list.
  function handleStripKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'))
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    if (index === -1) return
    event.preventDefault()
    const next = items[index + (event.key === 'ArrowRight' ? 1 : -1)]
    if (!next) return
    items[index].tabIndex = -1
    next.tabIndex = 0
    next.focus()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <MiniCalendar
          value={selected}
          onValueChange={setSelected}
          startDate={stripStart}
          onStartDateChange={(date) => date && setStripStart(date)}
          days={STRIP_DAYS}
          className="bg-card"
        >
          <MiniCalendarNavigation direction="prev" aria-label="Show earlier days" />
          {/* All 30 days render at once; the strip fills the full width of its
              container edge-to-edge and scrolls horizontally in its own
              overflow-x container (never the page body), arrows still page
              for keyboard users. */}
          <MiniCalendarDays onKeyDown={handleStripKeyDown}>
            {(date) => (
              <MiniCalendarDay
                date={date}
                key={date.toISOString()}
                className="snap-start"
                aria-pressed={selected ? isSameDay(date, selected) : false}
                tabIndex={isSameDay(date, rovingDate) ? 0 : -1}
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
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center">
          <CalendarDaysIcon className="size-8 text-muted-foreground" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="font-heading font-semibold">No meetings that day.</p>
            <p className="text-sm text-muted-foreground">Pick another day or clear the filter.</p>
          </div>
          <Button variant="outline" size="sm" type="button" onClick={() => setSelected(undefined)}>
            Show all days
          </Button>
        </div>
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
