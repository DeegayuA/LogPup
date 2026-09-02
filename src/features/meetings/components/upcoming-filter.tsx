'use client'

import { type KeyboardEvent } from 'react'
import { differenceInCalendarDays, format, isSameDay } from 'date-fns'
import { CalendarDaysIcon, X } from 'lucide-react'
import {
  MiniCalendar,
  MiniCalendarDay,
  MiniCalendarDays,
  MiniCalendarNavigation,
  MiniCalendarTodayButton,
} from '@/components/kibo-ui/mini-calendar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isoToDisplayDate } from '@/features/meetings/calendar-view'
import { JumpToDate } from '@/features/meetings/components/jump-to-date'
import { MeetingList } from '@/features/meetings/components/meeting-list'
import { GhostRows } from '@/features/meetings/components/past-meetings-section'
import type { ListFilter } from '@/features/meetings/list-filter'
import type { MentionUser } from '@/components/mention-textarea'
import type { MeetingSummary } from '@/features/meetings/queries'

/** Days rendered in the strip at once. */
const STRIP_DAYS = 30

/**
 * The docket's control rail plus the Upcoming half.
 *
 * The quick-filter chips that used to live here are gone — the triage rail's
 * tiles ARE the filters now (`?f=`, see triage-rail.tsx), counted from the
 * ONE batched glance response instead of whatever rows had happened to
 * scroll into view. Day (`?day=`), filter (`?f=`) and the client-local
 * search compose in MeetingsViews, which hands this component the already-
 * filtered rows — one predicate for the tiles, the counts and the list.
 */
export function UpcomingMeetingsFiltered({
  meetings,
  currentUserId,
  isAdmin,
  users = [],
  apps = [],
  dayIso,
  onDayIsoChange,
  search,
  onSearchChange,
  filter,
  counting = false,
  onClearFilters,
  onOpenMeeting,
  now,
  todayIso,
  stripStart,
  onStripStartChange,
}: {
  /** The FILTERED upcoming rows — day, `?f` and search already applied. */
  meetings: MeetingSummary[]
  currentUserId: string
  isAdmin: boolean
  users?: MentionUser[]
  apps?: { id: string; name: string }[]
  /** The `?day=` filter as a business-day ISO string, or undefined. */
  dayIso?: string
  /** Writes (or clears) `?day=` — the caller owns the URL. */
  onDayIsoChange: (iso: string | undefined) => void
  /** Client-local search — no URL writes, no history thrash. */
  search: string
  onSearchChange: (value: string) => void
  /** The active `?f=`, for the filtered-empty copy only — the filtering
   *  itself already happened upstream. */
  filter: ListFilter | null
  /** True while a glance-backed `?f` is applied but the batch is still
   *  counting — skeleton rows instead of a filtered-empty state that would
   *  flash "no matches" about counts that have not arrived. */
  counting?: boolean
  /** Clears `?f` and `?day` together (the empty state's one Clear). */
  onClearFilters: () => void
  onOpenMeeting: (meeting: MeetingSummary) => void
  /** The shared list clock from useListNow. */
  now: Date
  /** Today in Asia/Colombo, threaded from the server so day-group labels
   *  agree across hydration. */
  todayIso?: string
  /** The strip's visible window, lifted to the caller so JumpToDate can
   *  re-anchor it onto an out-of-window pick. */
  stripStart: Date
  onStripStartChange: (date: Date) => void
}) {
  const selected = dayIso ? isoToDisplayDate(dayIso) : undefined

  function setSelected(date: Date | undefined) {
    onDayIsoChange(date ? format(date, 'yyyy-MM-dd') : undefined)
  }

  // The strip's window is held by the caller so the roving tab stop always
  // lands on a day that is actually rendered — after paging, neither the
  // selection nor today is necessarily still in range, and a strip where
  // every cell is tabIndex -1 would vanish from the tab order altogether.
  const today = now
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

  const anyFilter = Boolean(selected || filter || search.trim() !== '')

  return (
    <div className="flex flex-col gap-3">
      {/* The control rail: search, the day strip, the anywhere-in-time jump.
          Sticky BELOW the shell header (which is sticky z-20 in the same
          window scrollport — top-0 would pin this rail underneath its
          translucent blur): --shell-header-h is the header's 3.5rem plus any
          maintenance banner, the same offset the activity feed docks at.
          Hairline ring-1 elevation, never a shadow (the sheet is the page's
          only floating layer). */}
      <div className="sticky top-[var(--shell-header-h,3.5rem)] z-10 flex flex-wrap items-center gap-2 rounded-xl bg-card p-2 ring-1 ring-border">
        <Input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          aria-label="Search meetings"
          placeholder="Search meetings…"
          autoComplete="off"
          className="h-8 w-full sm:w-52"
        />
        <MiniCalendar
          value={selected}
          onValueChange={setSelected}
          startDate={stripStart}
          onStartDateChange={(date) => date && onStripStartChange(date)}
          days={STRIP_DAYS}
          className="bg-card"
        >
          <MiniCalendarTodayButton />
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
        <JumpToDate day={dayIso} onPickDay={(iso) => onDayIsoChange(iso)} />
        {selected ? (
          <Button variant="ghost" size="sm" type="button" onClick={() => setSelected(undefined)}>
            <X /> All days
          </Button>
        ) : null}
      </div>

      {counting ? (
        // The batch is still counting the filter's facts — pulse at final
        // row size rather than flashing "no meetings match" about an answer
        // that has not arrived.
        <div className="flex flex-col gap-2">
          <p role="status" className="text-sm text-muted-foreground">
            Counting…
          </p>
          <GhostRows />
        </div>
      ) : anyFilter && meetings.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-10 text-center">
          <CalendarDaysIcon className="size-8 text-muted-foreground" aria-hidden />
          <div className="flex flex-col gap-1">
            {/* "Upcoming", not just "No meetings": the same day filter also
                narrows the Past section below, which may well have meetings
                on that day. */}
            <p className="font-heading font-semibold">
              {selected ? 'No upcoming meetings that day.' : 'No upcoming meetings match.'}
            </p>
            <p className="text-sm text-muted-foreground">
              {search.trim() !== ''
                ? 'Try different words, or clear the filters.'
                : selected && filter
                  ? 'Pick another day or clear the filters.'
                  : selected
                    ? 'Pick another day or clear the filter.'
                    : 'Clear the filter to see every upcoming meeting.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => {
              onClearFilters()
              onSearchChange('')
            }}
          >
            {selected || filter ? 'Clear filters' : 'Clear search'}
          </Button>
        </div>
      ) : (
        <MeetingList
          meetings={meetings}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          users={users}
          apps={apps}
          offerCreate={!anyFilter}
          groupBy="day"
          now={now}
          todayIso={todayIso}
          onOpenMeeting={onOpenMeeting}
        />
      )}
    </div>
  )
}
