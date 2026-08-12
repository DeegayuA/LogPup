'use client'

/**
 * The calendar surface: one toolbar, four views (Day, Week, Month, Agenda) and
 * the meeting detail dialog they all open into.
 *
 * WHAT LIVES WHERE
 *  - Day and Week are the same scrollable time grid with a different number of
 *    columns (meetings-time-grid.tsx).
 *  - Month is the EXISTING month grid, unchanged apart from now accepting the
 *    focused month as a prop so the URL and the grid cannot disagree. It keeps
 *    its own prev/next/Today header, so this toolbar stands its own down in
 *    that view rather than putting two sets of the same control on screen.
 *  - Agenda is the existing meeting rows, grouped by day.
 *
 * The view and the focused date are owned by the URL (see calendar-view.ts) and
 * handed down as props — this component never stores them, so there is nothing
 * here that can drift out of sync with the address bar.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, isSameMonth } from 'date-fns'
import {
  CalendarRangeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListIcon,
  MinusIcon,
  PlusIcon,
  Columns3Icon,
  Grid3x3Icon,
  SquareIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toIsoDateInTimeZone } from '@/lib/lk-holidays'
import {
  DEFAULT_PX_PER_HOUR,
  MAX_PX_PER_HOUR,
  MIN_PX_PER_HOUR,
  PX_PER_HOUR_STEP,
  clampPxPerHour,
  dayWindow,
} from '@/features/meetings/calendar-grid'
import {
  VIEW_LABEL,
  VIEW_STEP_UNIT,
  isTimeGridView,
  isoToDisplayDate,
  stepFocusedDate,
  visibleRange,
  type CalendarView,
} from '@/features/meetings/calendar-view'
import { MeetingDetailDialog } from '@/features/meetings/components/meeting-detail-dialog'
import { MeetingsAgenda } from '@/features/meetings/components/meetings-agenda'
import { MeetingsMonthCalendar } from '@/features/meetings/components/meetings-month-calendar'
import { MeetingsTimeGrid } from '@/features/meetings/components/meetings-time-grid'
import type { MentionUser } from '@/components/mention-textarea'
import type { MeetingSummary } from '@/features/meetings/queries'

/** Survives a reload but is deliberately NOT in the URL: how tall an hour is
 *  is a property of this person's screen and eyesight, not of the week they
 *  are looking at, so it must not ride along on a shared link. */
const ZOOM_STORAGE_KEY = 'logpup:meetings-calendar-px-per-hour'

/** Below this the week grid is seven columns in a phone's width — legible for
 *  nobody. Matches Tailwind's `md`. */
const WIDE_SCREEN_QUERY = '(min-width: 768px)'

/**
 * How a toolbar control says "not available right now" WITHOUT leaving the
 * focus order.
 *
 * `disabled` on Today, Shorter hours and Taller hours meant the button became
 * disabled while the user's focus was still on it — pressing Today made Today
 * unavailable — and a focused element that turns disabled is dropped by the
 * browser onto `<body>`, so the next Tab restarted from the top of the page
 * and a screen reader announced nothing at all. `aria-disabled` says the same
 * thing to assistive tech, keeps the button focusable, and each `onClick`
 * guards itself (the zoom's `changeZoom` already no-ops at the clamp).
 * `pointer-events-none` keeps the pointer behaviour identical to `disabled`.
 */
const UNAVAILABLE = 'aria-disabled:pointer-events-none aria-disabled:opacity-50'

const VIEW_OPTIONS = [
  { id: 'day', icon: SquareIcon },
  { id: 'week', icon: Columns3Icon },
  { id: 'month', icon: Grid3x3Icon },
  { id: 'agenda', icon: ListIcon },
] as const satisfies readonly { id: Exclude<CalendarView, 'list'>; icon: typeof ListIcon }[]

/**
 * Whether the viewport is wide enough for the week grid. `null` until mounted:
 * the server has no viewport, and guessing one would make the first client
 * render disagree with the HTML it is hydrating.
 *
 * Exported because the List/Calendar switcher one level up needs the same
 * answer to decide which view "Calendar" should open into.
 */
export function useIsWideScreen(): boolean | null {
  const [isWide, setIsWide] = useState<boolean | null>(null)

  useEffect(() => {
    const query = window.matchMedia(WIDE_SCREEN_QUERY)
    // The viewport is an external system: read it once on mount, then let it
    // push changes in. There is no other moment it can first be known.
    const sync = () => setIsWide(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return isWide
}

export function MeetingsCalendar({
  view,
  focusedDate,
  todayIso,
  upcoming,
  past,
  currentUserId,
  isAdmin,
  users,
  apps = [],
  onViewChange,
  onFocusedDateChange,
  onSelectDay,
  onOpenMeetingInList,
  openMeetingId,
  onCreateAt,
}: {
  /** Never 'list' — the list view is rendered by MeetingsViews, untouched. */
  view: Exclude<CalendarView, 'list'>
  focusedDate: string
  /** Today in Asia/Colombo, computed once on the server so both sides agree. */
  todayIso: string
  upcoming: MeetingSummary[]
  past: MeetingSummary[]
  currentUserId: string
  isAdmin: boolean
  users: MentionUser[]
  /** Apps the edit dialog can move a meeting to. */
  apps?: { id: string; name: string }[]
  onViewChange: (view: CalendarView) => void
  onFocusedDateChange: (iso: string) => void
  /** Hands a day back to the list view (its notes, transcript and follow-ups). */
  onSelectDay?: (date: Date) => void
  /** Jump to the list view AND open this meeting's write-up there. */
  onOpenMeetingInList?: (meeting: MeetingSummary) => void
  openMeetingId?: string
  /** An empty calendar slot was clicked — open a create dialog at that instant. */
  onCreateAt?: (start: Date) => void
}) {
  const isWide = useIsWideScreen()
  const [openId, setOpenId] = useState<string | null>(null)
  const [pxPerHour, setPxPerHour] = useState(DEFAULT_PX_PER_HOUR)

  // The stored zoom, read once after mount. It cannot be read during render:
  // the server has no localStorage, so seeding state from it would hydrate
  // against different markup.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ZOOM_STORAGE_KEY)
      if (raw === null) return
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydrate of a stored preference
      setPxPerHour(clampPxPerHour(Number(raw)))
    } catch {
      /* localStorage blocked (private mode, hardened browser) — the default
         zoom is a perfectly good calendar; it just won't be remembered. */
    }
  }, [])

  const changeZoom = useCallback(
    (deltaPx: number) => {
      const next = clampPxPerHour(pxPerHour + deltaPx)
      if (next === pxPerHour) return
      setPxPerHour(next)
      try {
        window.localStorage.setItem(ZOOM_STORAGE_KEY, String(next))
      } catch {
        /* see above — a preference that cannot be saved is not an error worth
           interrupting anyone over. */
      }
    },
    [pxPerHour],
  )

  /*
   * Week does not fit on a phone. Rather than quietly rewriting the URL — which
   * would mean a link somebody sent you opens as something else with no
   * explanation — the request is honoured in the switcher (Week stays the
   * selected view) and DAY is what gets drawn, with a notice saying so and a
   * one-tap way to make it official.
   */
  const weekTooNarrow = view === 'week' && isWide === false
  const drawnView: Exclude<CalendarView, 'list'> = weekTooNarrow ? 'day' : view

  const range = useMemo(() => visibleRange(drawnView, focusedDate), [drawnView, focusedDate])

  const allMeetings = useMemo(() => [...past, ...upcoming], [past, upcoming])

  /** Meetings that touch the visible days at all — a whole-year list narrowed
   *  to the week on screen before any layout work is done. */
  const inRange = useMemo(() => {
    if (range.days.length === 0) return []
    const from = dayWindow(range.days[0]).startMs
    const to = dayWindow(range.days[range.days.length - 1]).endMs
    return allMeetings.filter(
      (meeting) => meeting.endsAt.getTime() > from && meeting.startsAt.getTime() < to,
    )
  }, [allMeetings, range])

  const open = useMemo(
    () => (openId ? (allMeetings.find((meeting) => meeting.id === openId) ?? null) : null),
    [allMeetings, openId],
  )

  const stepUnit = VIEW_STEP_UNIT[drawnView]
  const showStepper = drawnView !== 'month'
  const showZoom = isTimeGridView(drawnView)
  /* The month grid renders its own h2 of the same month name, its own date
     subtitle and its own Today pill, so this toolbar stands the heading down
     there for the same reason it stands the stepper down — two h2 siblings
     reading "August 2026" are a duplicate control to a sighted reader and a
     broken heading outline to a screen reader. The meeting count stays: it is
     the one thing on this line the month grid does not also say. */
  const showHeading = drawnView !== 'month'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          {/* h2 — /meetings owns the h1 and the list view's "Upcoming" is an
              h2, so this must sit at the same level. */}
          {showHeading ? (
            <h2 className="font-heading text-lg leading-tight font-semibold">
              {rangeHeading(drawnView, focusedDate, range.start, range.end)}
            </h2>
          ) : null}
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {inRange.length === 0
              ? 'No meetings in view'
              : `${inRange.length} meeting${inRange.length === 1 ? '' : 's'} in view`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showZoom ? (
            <div
              role="group"
              aria-label="Hour height"
              className="flex items-center gap-0.5 rounded-lg border border-border p-0.5"
            >
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                aria-label="Shorter hours"
                aria-disabled={pxPerHour <= MIN_PX_PER_HOUR}
                className={UNAVAILABLE}
                onClick={() => changeZoom(-PX_PER_HOUR_STEP)}
              >
                <MinusIcon />
              </Button>
              {/* The number itself, not a bare pair of buttons: zoom is one
                  value with a named range, and showing it is what makes the
                  Alt-scroll shortcut discoverable as the same control. */}
              <span
                className="min-w-10 text-center font-mono text-2xs tabular-nums text-muted-foreground"
                title={`${pxPerHour}px per hour — hold Alt (⌥) and scroll to zoom`}
              >
                {pxPerHour}px
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                aria-label="Taller hours"
                aria-disabled={pxPerHour >= MAX_PX_PER_HOUR}
                className={UNAVAILABLE}
                onClick={() => changeZoom(PX_PER_HOUR_STEP)}
              >
                <PlusIcon />
              </Button>
            </div>
          ) : null}

          {showStepper ? (
            <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                aria-label={`Previous ${stepUnit}`}
                onClick={() => onFocusedDateChange(stepFocusedDate(drawnView, focusedDate, -1))}
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                className={`h-7 px-2.5 ${UNAVAILABLE}`}
                aria-disabled={focusedDate === todayIso}
                onClick={() => {
                  if (focusedDate === todayIso) return
                  onFocusedDateChange(todayIso)
                }}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                aria-label={`Next ${stepUnit}`}
                onClick={() => onFocusedDateChange(stepFocusedDate(drawnView, focusedDate, 1))}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          ) : null}

          <div
            role="group"
            aria-label="Calendar view"
            className="flex w-fit items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5"
          >
            {VIEW_OPTIONS.map(({ id, icon: Icon }) => (
              <Button
                key={id}
                variant={view === id ? 'default' : 'ghost'}
                size="sm"
                type="button"
                aria-pressed={view === id}
                onClick={() => onViewChange(id)}
                className="h-7 px-2.5"
              >
                <Icon /> {VIEW_LABEL[id]}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {weekTooNarrow ? (
        /* Said out loud, next to the control that caused it. `role="status"`
           rather than an alert: it is an explanation, not a problem. */
        <div
          role="status"
          className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
        >
          <CalendarRangeIcon className="size-3.5 shrink-0" aria-hidden />
          <span>
            Week needs a wider screen — showing <strong className="font-medium">Day</strong> instead.
            Your view is still set to Week.
          </span>
          <Button
            variant="outline"
            size="xs"
            type="button"
            className="ml-auto"
            onClick={() => onViewChange('day')}
          >
            Switch to Day
          </Button>
        </div>
      ) : null}

      {drawnView === 'month' ? (
        <MeetingsMonthCalendar
          upcoming={upcoming}
          past={past}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          users={users}
          apps={apps}
          onSelectDay={onSelectDay}
          onOpenMeetingInList={onOpenMeetingInList}
          month={isoToDisplayDate(focusedDate)}
          onMonthChange={(next) => onFocusedDateChange(format(next, 'yyyy-MM-dd'))}
        />
      ) : drawnView === 'agenda' ? (
        <MeetingsAgenda
          days={range.days}
          meetings={inRange.filter((meeting) =>
            range.days.includes(toIsoDateInTimeZone(meeting.startsAt)),
          )}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          users={users}
          apps={apps}
          openMeetingId={openMeetingId}
          todayIso={todayIso}
        />
      ) : (
        <>
          <MeetingsTimeGrid
            days={range.days}
            meetings={inRange}
            pxPerHour={pxPerHour}
            todayIso={todayIso}
            onOpenMeeting={setOpenId}
            onCreateAt={onCreateAt}
            onZoomBy={changeZoom}
          />
          <p className="text-xs text-muted-foreground">
            All 24 hours are shown; 08:00–18:00 is emphasised. Select a meeting for its details,
            attendees and notes. Hold Alt (<span className="font-mono">⌥</span>) while scrolling to
            zoom, or use the hour-height buttons above — Ctrl and{' '}
            <span className="font-mono">⌘</span> are left to the browser&rsquo;s own page zoom.
          </p>
        </>
      )}

      <MeetingDetailDialog
        meeting={open}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        users={users}
        apps={apps}
        onOpenChange={(next) => {
          if (!next) setOpenId(null)
        }}
        onOpenInList={onOpenMeetingInList ?? (onSelectDay ? (meeting) => onSelectDay(meeting.startsAt) : undefined)}
      />
    </div>
  )
}

/** What the toolbar's heading says for each view. Week collapses the month name
 *  when both ends share one ("August 10 – 16, 2026") and spells both out when
 *  they do not ("Aug 31 – Sep 6, 2026"), because that is the case where the
 *  short form would be actively misleading. */
function rangeHeading(
  view: Exclude<CalendarView, 'list'>,
  focusedIso: string,
  startIso: string,
  endIso: string,
): string {
  const focus = isoToDisplayDate(focusedIso)
  if (view === 'day') return format(focus, 'EEEE, MMMM d, yyyy')
  if (view === 'week') {
    const start = isoToDisplayDate(startIso)
    const end = isoToDisplayDate(endIso)
    return isSameMonth(start, end)
      ? `${format(start, 'MMMM d')} – ${format(end, 'd, yyyy')}`
      : `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
  }
  return format(focus, 'MMMM yyyy')
}
