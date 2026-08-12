'use client'

/**
 * The scrollable time grid behind the Day and Week views — one component, two
 * views, because a week IS seven days side by side and building them twice is
 * how they drift apart.
 *
 * WHAT IT PROMISES
 *  - A FULL 24 hours, always. No meeting can be scheduled somewhere this grid
 *    refuses to draw. The 08:00–18:00 band is emphasised and everything else
 *    dimmed, and the scroller parks itself at 08:00 on open, so the cost of
 *    that completeness is paid in pixels rather than in missing meetings.
 *  - Day headers stay put at the top and the time gutter stays put on the left
 *    while you scroll in either direction, so a block is never orphaned from
 *    the day and hour it belongs to.
 *  - A meeting that crosses midnight is drawn on BOTH days, cut at the
 *    boundary, rather than hanging off the bottom of one of them.
 *
 * WHAT IT DELIBERATELY DOES NOT DO (YET): drag to move, drag to resize. See
 * the seam comment on `TimeGridEvent`.
 *
 * All the arithmetic lives in calendar-grid.ts and calendar-overlap.ts, which
 * are pure and tested. This file positions divs.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import {
  HolidayIcons,
  holidayCategoryLabel,
  holidayToneClass,
} from '@/components/shared/holiday-icon'
import { getLkHoliday, isLkSunday } from '@/lib/lk-holidays'
import { cn } from '@/lib/utils'
import {
  GRID_END_HOUR,
  GRID_START_HOUR,
  PX_PER_HOUR_STEP,
  SCROLL_TO_HOUR,
  clipToDay,
  dayWindow,
  eventGeometry,
  hourLabel,
  isAllDayMeeting,
  isWorkingHour,
  minutesIntoDay,
  type DayWindow,
} from '@/features/meetings/calendar-grid'
import { laneFraction, overlapMap } from '@/features/meetings/calendar-overlap'
import { isoDayInstant, isoToDisplayDate } from '@/features/meetings/calendar-view'
import { chipTone } from '@/features/meetings/components/meetings-month-calendar'
import { durationLabel, meetingTiming } from '@/features/meetings/components/meeting-glance'
import type { MeetingSummary } from '@/features/meetings/queries'

/** Width of the sticky hour gutter. Wide enough for "00:00" at `text-2xs`
 *  plus the padding that keeps it off the column edge. */
const GUTTER_WIDTH_PX = 56
/** Fixed so the all-day strip can stick directly beneath the header — the two
 *  sticky rows have to agree on where one ends and the other begins. */
const HEADER_HEIGHT_PX = 52
/** Narrower than this and a day column cannot hold a readable title, so the
 *  grid scrolls sideways inside its own box instead of squeezing. */
const MIN_DAY_COLUMN_PX = 132
/** How often the now line re-reads the clock. A minute is the resolution the
 *  line is drawn at; anything faster is work nobody can see. */
const NOW_TICK_MS = 60_000

type TimedBlock = {
  meeting: MeetingSummary
  top: number
  height: number
  /** Lane geometry as percentages of the day column. */
  leftPct: number
  widthPct: number
  continuesBefore: boolean
  continuesAfter: boolean
}

type DayColumn = {
  iso: string
  window: DayWindow
  blocks: TimedBlock[]
  allDay: MeetingSummary[]
}

export function MeetingsTimeGrid({
  days,
  meetings,
  pxPerHour,
  todayIso,
  onOpenMeeting,
  onZoomBy,
}: {
  /** The ISO days on screen, in order — one for Day view, seven for Week. */
  days: string[]
  /** Meetings already narrowed to the visible range by the caller. */
  meetings: MeetingSummary[]
  pxPerHour: number
  todayIso: string
  onOpenMeeting: (meetingId: string) => void
  /** Ctrl/Cmd + wheel hands a signed pixel delta back to the toolbar, which
   *  owns the clamping and the stored preference. */
  onZoomBy: (deltaPx: number) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  /** Null until mounted: the now line must not be part of the server HTML, or
   *  it hydrates against a different clock. */
  const [nowMs, setNowMs] = useState<number | null>(null)

  const columns = useMemo<DayColumn[]>(
    () => days.map((iso) => buildColumn(iso, meetings, pxPerHour)),
    [days, meetings, pxPerHour],
  )

  const hasAllDay = columns.some((column) => column.allDay.length > 0)
  const bodyHeight = (GRID_END_HOUR - GRID_START_HOUR) * pxPerHour
  const hours = useMemo(
    () => Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => GRID_START_HOUR + i),
    [],
  )

  // The now line, on a timer that is always cleared. Seeded immediately so the
  // line appears on the first paint after hydration rather than a minute later.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock is an external system, and the first read can only happen after mount: reading it during render would put a time in the server HTML that the browser then hydrates against a different one.
    setNowMs(Date.now())
    const timer = setInterval(() => setNowMs(Date.now()), NOW_TICK_MS)
    return () => clearInterval(timer)
  }, [])

  // Park at 08:00 when the grid opens, and again when switching between Day and
  // Week — but NOT on every date step, which would yank the scroll position out
  // from under someone paging through weeks looking at their evenings.
  const parkedFor = useRef<string | null>(null)
  const dayCount = days.length
  useEffect(() => {
    const el = scrollRef.current
    const key = String(dayCount)
    if (!el || parkedFor.current === key) return
    parkedFor.current = key
    el.scrollTop = (SCROLL_TO_HOUR - GRID_START_HOUR) * pxPerHour
  }, [dayCount, pxPerHour])

  // Zooming keeps whatever time is at the top of the viewport at the top of the
  // viewport. Without this, every zoom step also teleports you through the day.
  const lastPxPerHour = useRef(pxPerHour)
  useEffect(() => {
    const el = scrollRef.current
    if (!el || lastPxPerHour.current === pxPerHour) return
    el.scrollTop = (el.scrollTop / lastPxPerHour.current) * pxPerHour
    lastPxPerHour.current = pxPerHour
  }, [pxPerHour])

  /*
   * Ctrl/Cmd + wheel zooms; a bare wheel scrolls exactly as it always did.
   *
   * Registered by hand with `{ passive: false }` because React's onWheel is
   * attached passively and cannot preventDefault — and preventDefault is the
   * whole point here: without it the browser's own page zoom fires as well.
   * The guard runs BEFORE preventDefault, so an ordinary scroll never touches
   * it.
   */
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      onZoomBy(event.deltaY < 0 ? PX_PER_HOUR_STEP : -PX_PER_HOUR_STEP)
    },
    [onZoomBy],
  )

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const columnTemplate = {
    gridTemplateColumns: `${GUTTER_WIDTH_PX}px repeat(${days.length}, minmax(${MIN_DAY_COLUMN_PX}px, 1fr))`,
  }

  return (
    <div
      ref={scrollRef}
      /* One scroll container for BOTH axes. Splitting them would break the
         lockstep between the day headers and the columns underneath, since a
         box with `overflow-y: auto` resolves its x axis to `auto` too. `isolate`
         keeps the sticky z-stack from reaching outside this box. */
      className="relative isolate max-h-[70svh] overflow-auto rounded-xl border border-border bg-card"
    >
      <div className="grid min-w-fit" style={columnTemplate}>
        {/* ── day headers ───────────────────────────────────────────── */}
        <div
          className="sticky top-0 left-0 z-40 border-r border-b border-border bg-card"
          style={{ height: HEADER_HEIGHT_PX }}
        />
        {columns.map((column) => (
          <DayHeader key={column.iso} iso={column.iso} isToday={column.iso === todayIso} />
        ))}

        {/* ── all-day strip ─────────────────────────────────────────────
            Sticky directly under the headers rather than scrolling away: a
            meeting that owns the whole day is context for every block below
            it, and stops being that the moment it leaves the screen. The row
            is only rendered when something is in it — an always-present empty
            band would cost 34px of grid on every ordinary week. */}
        {hasAllDay ? (
          <>
            <div
              className="sticky left-0 z-30 flex items-start justify-end border-r border-b border-border bg-card px-2 py-1.5"
              style={{ top: HEADER_HEIGHT_PX }}
            >
              <span className="font-mono text-2xs text-muted-foreground">All day</span>
            </div>
            {columns.map((column) => (
              <div
                key={column.iso}
                className="sticky z-20 flex min-w-0 flex-col gap-1 border-r border-b border-border bg-card p-1 last:border-r-0"
                style={{ top: HEADER_HEIGHT_PX }}
              >
                {column.allDay.map((meeting) => (
                  <AllDayEvent
                    key={meeting.id}
                    meeting={meeting}
                    onOpen={onOpenMeeting}
                  />
                ))}
              </div>
            ))}
          </>
        ) : null}

        {/* ── hour gutter ───────────────────────────────────────────── */}
        <div
          className="sticky left-0 z-10 border-r border-border bg-card"
          style={{ height: bodyHeight }}
        >
          {hours.map((hour) => (
            <div
              key={hour}
              className="relative border-b border-border/60 last:border-b-0"
              style={{ height: pxPerHour }}
            >
              {/* Sat ON the line rather than inside the box below it, so the
                  label names the boundary it is drawn against. The first one
                  is nudged down so it is not clipped by the header. */}
              <span
                className={cn(
                  'absolute right-2 -top-2 font-mono text-2xs tabular-nums',
                  hour === GRID_START_HOUR && 'top-1',
                  isWorkingHour(hour) ? 'text-muted-foreground' : 'text-muted-foreground/60',
                )}
              >
                {hourLabel(hour)}
              </span>
            </div>
          ))}
        </div>

        {/* ── day columns ───────────────────────────────────────────── */}
        {columns.map((column) => (
          <div
            key={column.iso}
            className="relative border-r border-border last:border-r-0"
            style={{ height: bodyHeight }}
          >
            {hours.map((hour) => (
              <div
                key={hour}
                className={cn(
                  'border-b border-border/60 last:border-b-0',
                  // Off-hours are dimmed, never hidden — the 06:30 standup is
                  // still there, it just isn't where the eye lands first.
                  isWorkingHour(hour) ? 'bg-transparent' : 'bg-muted/40',
                )}
                style={{ height: pxPerHour }}
              />
            ))}

            {column.blocks.map((block) => (
              <TimeGridEvent key={block.meeting.id} block={block} onOpen={onOpenMeeting} />
            ))}

            <NowLine
              nowMs={nowMs}
              window={column.window}
              pxPerHour={pxPerHour}
              isToday={column.iso === todayIso}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Splits one day's meetings into all-day banners and positioned blocks. */
function buildColumn(iso: string, meetings: MeetingSummary[], pxPerHour: number): DayColumn {
  const window = dayWindow(iso)
  const allDay: MeetingSummary[] = []
  const clipped: {
    meeting: MeetingSummary
    startMinutes: number
    endMinutes: number
    continuesBefore: boolean
    continuesAfter: boolean
  }[] = []

  for (const meeting of meetings) {
    const startMs = meeting.startsAt.getTime()
    const endMs = meeting.endsAt.getTime()
    const segment = clipToDay(startMs, endMs, window)
    if (!segment) continue
    if (isAllDayMeeting(startMs, endMs)) {
      allDay.push(meeting)
      continue
    }
    clipped.push({ meeting, ...segment })
  }

  allDay.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())

  // Lanes are computed from the CLIPPED instants, so a meeting running past
  // midnight competes for width only with what shares its own day.
  const lanes = overlapMap(
    clipped.map((entry) => ({
      id: entry.meeting.id,
      startMs: window.startMs + entry.startMinutes * 60_000,
      endMs: window.startMs + entry.endMinutes * 60_000,
    })),
  )

  const blocks = clipped.map<TimedBlock>((entry) => {
    const { top, height } = eventGeometry(entry.startMinutes, entry.endMinutes, pxPerHour)
    const placement = lanes.get(entry.meeting.id) ?? {
      id: entry.meeting.id,
      lane: 0,
      laneCount: 1,
    }
    const { left, width } = laneFraction(placement)
    return {
      meeting: entry.meeting,
      top,
      height,
      leftPct: left * 100,
      widthPct: width * 100,
      continuesBefore: entry.continuesBefore,
      continuesAfter: entry.continuesAfter,
    }
  })

  return { iso, window, blocks, allDay }
}

function DayHeader({ iso, isToday }: { iso: string; isToday: boolean }) {
  // Same Sri Lankan markers as the month grid and the day strip, read through
  // the shipped helpers rather than re-derived: `isoDayInstant` hands them the
  // Colombo midday of this ISO day, which is exact from any runtime.
  const instant = isoDayInstant(iso)
  const holiday = getLkHoliday(instant)
  const isWeekendDay = isLkSunday(instant) && !holiday
  const display = isoToDisplayDate(iso)

  return (
    <div
      className="sticky top-0 z-30 flex flex-col items-center justify-center gap-0.5 border-r border-b border-border bg-card px-2 last:border-r-0"
      style={{ height: HEADER_HEIGHT_PX }}
    >
      <span
        aria-hidden
        className={cn(
          'font-mono text-2xs tracking-wide uppercase',
          holiday
            ? holidayToneClass(holiday.categories)
            : isWeekendDay
              ? 'text-weekend'
              : 'text-muted-foreground',
        )}
      >
        {format(display, 'EEE')}
      </span>
      <span aria-hidden className="flex items-center gap-1">
        <span
          className={cn(
            'flex size-6 items-center justify-center rounded-full font-mono text-sm tabular-nums',
            isToday
              ? 'bg-primary font-semibold text-primary-foreground'
              : holiday
                ? holidayToneClass(holiday.categories)
                : isWeekendDay
                  ? 'text-weekend'
                  : 'text-foreground',
          )}
        >
          {format(display, 'd')}
        </span>
        {holiday ? <HolidayIcons categories={holiday.categories} className="size-3 shrink-0" /> : null}
      </span>
      {/* The visible header is three abbreviations and a coloured glyph; this
          is the same information in words (WCAG 1.4.1). */}
      <span className="sr-only">
        {format(display, 'EEEE, MMMM d, yyyy')}
        {isToday ? ', today' : ''}
        {holiday ? `, ${holiday.name}, ${holidayCategoryLabel(holiday.categories)}` : ''}
        {isWeekendDay ? ', weekend' : ''}
      </span>
    </div>
  )
}

/**
 * One meeting, drawn at its own time.
 *
 * ── DRAG SEAM ────────────────────────────────────────────────────────────
 * Drag-to-move and drag-to-resize are deliberately NOT in this pass. When
 * they are added, this is the component that grows them and nothing else has
 * to change:
 *   - the block is already absolutely positioned from `top`/`height` alone,
 *     both derived by `eventGeometry` from a minute offset and `pxPerHour`, so
 *     the inverse (pixels dragged -> minutes moved) is `deltaPx * 60 /
 *     pxPerHour` rounded to a snap interval — the mirror of `snapDays` in the
 *     sprint roadmap;
 *   - wrap this button in a dnd-kit `useDraggable` exactly as the month grid's
 *     `MeetingChip` does, keeping the same pointer-travel guard so a plain
 *     click still opens the meeting;
 *   - a resize handle belongs on the bottom edge of this element, and must be
 *     omitted when `continuesAfter` is true (that edge is a midnight cut, not
 *     the meeting's end);
 *   - the write goes through the existing `rescheduleMeeting` action, which
 *     already takes a start and an end.
 * Nothing above this component needs to know a drag happened.
 */
function TimeGridEvent({
  block,
  onOpen,
}: {
  block: TimedBlock
  onOpen: (meetingId: string) => void
}) {
  const { meeting, continuesBefore, continuesAfter } = block
  // One clock read per block is fine here — `meetingTiming` only resolves to a
  // day-granularity label, and 'live' is a range test, so two blocks cannot
  // disagree within a render.
  const timing = meetingTiming(meeting.startsAt, meeting.endsAt, new Date())
  const isLive = timing.state === 'live'
  const isPast = timing.state === 'past'
  // Below roughly two lines there is no room for a second line of text, so the
  // time joins the title on one row instead of being clipped out of existence.
  const isCompact = block.height < 40

  return (
    <button
      type="button"
      onClick={() => onOpen(meeting.id)}
      style={{
        top: block.top,
        height: block.height,
        left: `calc(${block.leftPct}% + 2px)`,
        width: `calc(${block.widthPct}% - 4px)`,
      }}
      className={cn(
        'absolute z-10 flex min-w-0 flex-col overflow-hidden border-l-2 px-1.5 py-1 text-left',
        'transition-[background-color,box-shadow] duration-150 motion-reduce:transition-none',
        'hover:brightness-95 hover:shadow-sm',
        'focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        chipTone(isPast, isLive),
        // A cut edge is square and runs flush into the grid boundary; a real
        // edge is rounded and sits inside it. That contrast is the whole
        // visible signal that a meeting continues onto the next day — the
        // sr-only label below says it in words.
        continuesBefore ? 'rounded-t-none' : 'rounded-t-sm',
        continuesAfter ? 'rounded-b-none' : 'rounded-b-sm',
      )}
    >
      <span className="sr-only">
        {[
          meeting.title,
          `${format(meeting.startsAt, 'h:mm a')} to ${format(meeting.endsAt, 'h:mm a')}`,
          durationLabel(meeting.startsAt, meeting.endsAt),
          meeting.appName,
          isLive ? 'happening now' : isPast ? 'past' : null,
          continuesBefore ? 'continued from the previous day' : null,
          continuesAfter ? 'continues on the next day' : null,
        ]
          .filter(Boolean)
          .join(', ')}
      </span>
      <span
        aria-hidden
        className={cn('flex min-w-0 gap-1', isCompact ? 'items-baseline' : 'flex-col')}
      >
        <span className="min-w-0 truncate text-xs font-medium">{meeting.title}</span>
        <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">
          {format(meeting.startsAt, 'h:mm a')}
        </span>
      </span>
      {!isCompact && meeting.appName ? (
        <span aria-hidden className="min-w-0 truncate text-2xs text-muted-foreground">
          {meeting.appName}
        </span>
      ) : null}
    </button>
  )
}

/** A meeting that owns the whole day — see `isAllDayMeeting` for the rule. */
function AllDayEvent({
  meeting,
  onOpen,
}: {
  meeting: MeetingSummary
  onOpen: (meetingId: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(meeting.id)}
      className={cn(
        'flex min-w-0 items-center gap-1 rounded-sm border-l-2 border-l-muted-foreground/40 bg-muted px-1.5 py-0.5 text-left',
        'transition-colors duration-150 hover:bg-accent motion-reduce:transition-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <span className="min-w-0 truncate text-2xs font-medium">{meeting.title}</span>
      <span className="sr-only">, all day</span>
    </button>
  )
}

/**
 * The "you are here" line. Rendered only on a column that is actually today,
 * so it can never be pinned to the top or bottom edge of a day it does not
 * belong to — `minutesIntoDay` returns null for every other day.
 */
function NowLine({
  nowMs,
  window,
  pxPerHour,
  isToday,
}: {
  nowMs: number | null
  window: DayWindow
  pxPerHour: number
  isToday: boolean
}) {
  if (nowMs === null || !isToday) return null
  const minutes = minutesIntoDay(nowMs, window)
  if (minutes === null) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-30 flex items-center"
      style={{ top: ((minutes - GRID_START_HOUR * 60) / 60) * pxPerHour }}
    >
      <span className="-ml-1 size-2 shrink-0 rounded-full bg-destructive" />
      <span className="h-px flex-1 bg-destructive" />
    </div>
  )
}
