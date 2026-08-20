'use client'

import { useCallback, useState, type KeyboardEvent } from 'react'
import { differenceInCalendarDays, isSameDay } from 'date-fns'
import {
  CalendarDaysIcon,
  MessageCircleQuestionIcon,
  TriangleAlertIcon,
  UserCheckIcon,
  X,
} from 'lucide-react'
import {
  MiniCalendar,
  MiniCalendarDay,
  MiniCalendarDays,
  MiniCalendarNavigation,
  MiniCalendarTodayButton,
} from '@/components/kibo-ui/mini-calendar'
import { Button } from '@/components/ui/button'
import { MeetingList } from '@/features/meetings/components/meeting-list'
import type { MentionUser } from '@/components/mention-textarea'
import type { MeetingGlance } from '@/features/meetings/components/meeting-notes-model'
import type { MeetingSummary } from '@/features/meetings/queries'

/** Days rendered in the strip at once. */
const STRIP_DAYS = 30

/**
 * QUICK FILTERS — the per-row chips, lifted to list level.
 *
 * Every fact here is already on screen: "No replies yet" and the follow-up /
 * overdue counts render as chips on each row (meeting-list.tsx OutcomeChips),
 * computed from data the rows fetch anyway. What was missing was the lift —
 * finding the three meetings waiting on you meant reading thirty rows. No new
 * fetches and no model calls; this is the same data made scannable.
 *
 * "Waiting on you" counts synchronously from the RSVP data the page loaded.
 * The two glance-backed filters fill in as each row's intel answers (the rows
 * fetch it eagerly on mount), so their chips appear within a moment of the
 * list painting — a chip only renders once it has something to show, which is
 * also why a zero-count chip is absent rather than disabled.
 */
type QuickFilterId = 'waiting' | 'followups' | 'overdue'

const QUICK_FILTERS: {
  id: QuickFilterId
  label: string
  icon: typeof UserCheckIcon
}[] = [
  { id: 'waiting', label: 'Waiting on you', icon: UserCheckIcon },
  { id: 'followups', label: 'Open follow-ups', icon: MessageCircleQuestionIcon },
  { id: 'overdue', label: 'Overdue actions', icon: TriangleAlertIcon },
]

function matchesQuickFilter(
  filter: QuickFilterId,
  meeting: MeetingSummary,
  currentUserId: string,
  glances: Record<string, MeetingGlance | null>,
): boolean {
  if (filter === 'waiting') {
    return meeting.attendees.some(
      (attendee) => attendee.id === currentUserId && attendee.response === 'pending',
    )
  }
  const glance = glances[meeting.id]
  if (!glance) return false
  return filter === 'followups' ? glance.openFollowups > 0 : glance.overdueActions > 0
}

/** Upcoming meetings with a Kibo mini-calendar day strip as a quick filter. */
export function UpcomingMeetingsFiltered({
  meetings,
  currentUserId,
  isAdmin,
  users = [],
  apps = [],
  openMeetingId,
  selectedDay,
  onSelectedDayChange,
}: {
  meetings: MeetingSummary[]
  currentUserId: string
  isAdmin: boolean
  users?: MentionUser[]
  apps?: { id: string; name: string }[]
  openMeetingId?: string
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

  // Glances reported up by each row as its intel loads (see MeetingList's
  // onGlance), keyed by meeting id — what the two glance-backed quick filters
  // count. Single-select: these answer "show me just these", and two at once
  // ("waiting AND overdue") is a question nobody arrives with.
  const [glances, setGlances] = useState<Record<string, MeetingGlance | null>>({})
  const [quickFilter, setQuickFilter] = useState<QuickFilterId | null>(null)
  const handleGlance = useCallback((meetingId: string, glance: MeetingGlance | null) => {
    setGlances((prev) => ({ ...prev, [meetingId]: glance }))
  }, [])

  // Counted over the WHOLE upcoming list, not the day-filtered slice, so the
  // numbers do not reshuffle when a day is picked — the two filters compose
  // on the rows below instead.
  const quickCounts: Record<QuickFilterId, number> = {
    waiting: 0,
    followups: 0,
    overdue: 0,
  }
  for (const meeting of meetings) {
    for (const { id } of QUICK_FILTERS) {
      if (matchesQuickFilter(id, meeting, currentUserId, glances)) quickCounts[id] += 1
    }
  }

  const dayFiltered = selected
    ? meetings.filter((meeting) => isSameDay(meeting.startsAt, selected))
    : meetings
  const filtered = quickFilter
    ? dayFiltered.filter((meeting) =>
        matchesQuickFilter(quickFilter, meeting, currentUserId, glances),
      )
    : dayFiltered

  // A chip earns its place by having rows to show; the active one stays even
  // at zero so it can be un-pressed rather than vanishing mid-use.
  const visibleQuickFilters = QUICK_FILTERS.filter(
    ({ id }) => quickCounts[id] > 0 || quickFilter === id,
  )

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
        {selected ? (
          <Button variant="ghost" size="sm" type="button" onClick={() => setSelected(undefined)}>
            <X /> All days
          </Button>
        ) : null}
      </div>

      {visibleQuickFilters.length > 0 ? (
        <div role="group" aria-label="Quick filters" className="flex flex-wrap items-center gap-1.5">
          {visibleQuickFilters.map(({ id, label, icon: Icon }) => {
            const active = quickFilter === id
            return (
              <Button
                key={id}
                type="button"
                variant={active ? 'default' : 'outline'}
                size="sm"
                aria-pressed={active}
                className="h-7"
                onClick={() => setQuickFilter(active ? null : id)}
              >
                <Icon aria-hidden />
                {label}
                <span className="font-mono tabular-nums">{quickCounts[id]}</span>
              </Button>
            )
          })}
        </div>
      ) : null}

      {(selected || quickFilter) && filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-10 text-center">
          <CalendarDaysIcon className="size-8 text-muted-foreground" aria-hidden />
          <div className="flex flex-col gap-1">
            {/* "Upcoming", not just "No meetings": the same day filter now
                also narrows the Past section below, which may well have
                meetings on that day. */}
            <p className="font-heading font-semibold">
              {selected ? 'No upcoming meetings that day.' : 'No upcoming meetings match.'}
            </p>
            <p className="text-sm text-muted-foreground">
              {selected && quickFilter
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
              setSelected(undefined)
              setQuickFilter(null)
            }}
          >
            {selected && quickFilter ? 'Clear filters' : selected ? 'Show all days' : 'Show all'}
          </Button>
        </div>
      ) : (
        <MeetingList
          meetings={filtered}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          users={users}
          apps={apps}
          offerCreate

          openMeetingId={openMeetingId}
          onGlance={handleGlance}
        />
      )}
    </div>
  )
}
