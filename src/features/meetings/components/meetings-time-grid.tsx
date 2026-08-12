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
 *  - DRAG TO MOVE. A block can be dragged to another time, another day, or
 *    both; it snaps to the quarter hour and keeps its length. The pixel->time
 *    arithmetic lives in features/meetings/time-drag.ts, where it is unit
 *    tested without a DOM.
 *
 * WHAT IT DELIBERATELY DOES NOT DO (YET): drag to RESIZE. Moving and resizing
 * are separate gestures with separate failure modes — a resize needs its own
 * handle, must be suppressed on a midnight-cut edge, and can invert a
 * meeting's start and end, none of which a move has to think about. See the
 * seam comment on `TimeGridEvent`.
 *
 * ── THE Z-TIER LADDER ─────────────────────────────────────────────────────
 * Written out once, here, because every layer in this file is either sticky or
 * absolutely positioned and two layers that TIE on z-index are resolved by DOM
 * order — which put meeting blocks on top of the pinned hour labels and drew
 * the now line straight across the day headers.
 *
 * Each day column is `isolate`, so it is its own stacking context and the two
 * tiers below can never escape it:
 *     now line ............ z-[5]   above the hour cells, BELOW the blocks it
 *                                    marks (a marker that covers the thing it
 *                                    marks is worse than none — same rule the
 *                                    sprint roadmap states at roadmap-timeline
 *                                    for its today line)
 *     meeting block ....... z-10
 *     focused block ....... z-20
 *
 * Inside the scroller (also `isolate`), every sticky layer therefore outranks
 * a whole day column, which sits at z-auto:
 *     hour gutter ......... z-10
 *     all-day day cells ... z-20
 *     all-day gutter cell . z-30
 *     day headers ......... z-40
 *     corner spacer ....... z-50
 * No two of these are equal, so nothing here depends on DOM order any more.
 *
 * All the arithmetic lives in calendar-grid.ts and calendar-overlap.ts, which
 * are pure and tested. This file positions divs.
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from 'react'
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { PlusIcon } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  HolidayIcons,
  holidayCategoryLabel,
  holidayToneClass,
} from '@/components/shared/holiday-icon'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
  minEventMinutes,
  minutesIntoDay,
  type DayWindow,
} from '@/features/meetings/calendar-grid'
import { laneFraction, overlapMap } from '@/features/meetings/calendar-overlap'
import { isoDayInstant, isoToDisplayDate } from '@/features/meetings/calendar-view'
import { chipTone } from '@/features/meetings/components/meetings-month-calendar'
import { rescheduleMeeting } from '@/features/meetings/actions'
import { draggedMinutes, isRealMove, moveMeetingByDrag } from '@/features/meetings/time-drag'
import { durationLabel, meetingTiming } from '@/features/meetings/components/meeting-glance'
import { formatBusinessTime } from '@/features/people/format-instant'
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
/** Below roughly two lines there is no room for a second line of text, so the
 *  time joins the title on one row instead of being clipped out of existence. */
const COMPACT_BLOCK_PX = 40
/** Matches the month grid and the sprint board: a plain click must still open
 *  the meeting, so a drag only starts once the pointer has actually
 *  travelled. */
const DRAG_ACTIVATION_DISTANCE = 8

/** One meeting's slice of one day, with everything that does NOT depend on the
 *  zoom or the clock resolved once: the midnight clipping, and the labels. */
type DaySlice = {
  meeting: MeetingSummary
  startMinutes: number
  endMinutes: number
  continuesBefore: boolean
  continuesAfter: boolean
  /** `9:00 AM` — Colombo-pinned, like the geometry around it. */
  startLabel: string
  /** `9:00 AM to 10:00 AM`. */
  timeRange: string
  /** `1h 30m`. */
  duration: string
}

type TimedBlock = {
  slice: DaySlice
  top: number
  height: number
  /** Lane geometry as percentages of the day column. */
  leftPct: number
  widthPct: number
}

/** A day's meetings, clipped and labelled — none of it depends on the zoom, so
 *  it survives a zoom notch untouched (and with it ~5 Intl formatter lookups
 *  and a sort per day). */
type DayShape = {
  iso: string
  window: DayWindow
  /** `Wednesday, August 12, 2026` — names the column in the accessible tree. */
  dayLabel: string
  /** `Wed 12 Aug` — prefixed to every block's accessible name, so a block
   *  announced on its own still says which day it is on. */
  dayPrefix: string
  slices: DaySlice[]
  allDay: { meeting: MeetingSummary; label: string }[]
}

type DayColumn = DayShape & { blocks: TimedBlock[] }

/**
 * A day column as a drop target.
 *
 * Its own component because `useDroppable` is a hook and the columns are
 * rendered from a `.map`. It renders no box of its own — `setNodeRef` goes
 * onto the column element the grid was already drawing, so the drop target
 * and the visible column are the same rectangle and cannot drift apart.
 */
function DayDropColumn({
  iso,
  dayLabel,
  height,
  children,
}: {
  iso: string
  dayLabel: string
  height: number
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: iso })
  return (
    <div
      ref={setNodeRef}
      /* The one programmatic tie between a column and the day it draws:
         the header above it is a sibling grid item, so it cannot label
         this by proximity alone. */
      role="group"
      aria-label={dayLabel}
      /* `isolate` is load-bearing — see the z-tier ladder at the top. */
      className={cn(
        'relative isolate border-r border-border last:border-r-0',
        // Only while something is actually over it. A permanent hover tint
        // would read as a state the column is in.
        isOver && 'bg-accent/30',
      )}
      style={{ height }}
    >
      {children}
    </div>
  )
}

export function MeetingsTimeGrid({
  days,
  meetings,
  pxPerHour,
  todayIso,
  onOpenMeeting,
  onCreateAt,
  onZoomBy,
}: {
  /** The ISO days on screen, in order — one for Day view, seven for Week. */
  days: string[]
  /** Meetings already narrowed to the visible range by the caller. */
  meetings: MeetingSummary[]
  pxPerHour: number
  todayIso: string
  onOpenMeeting: (meetingId: string) => void
  /** Clicking an empty hour asks the caller to open a create dialog at that instant. */
  onCreateAt?: (start: Date) => void
  /** Alt + wheel hands a signed pixel delta back to the toolbar, which owns
   *  the clamping and the stored preference. */
  onZoomBy: (deltaPx: number) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  /** Null until mounted: the now line must not be part of the server HTML, or
   *  it hydrates against a different clock. */
  const [nowMs, setNowMs] = useState<number | null>(null)
  const [, startTransition] = useTransition()

  /* Optimistic moves, same contract as the month grid: the dropped block
     repaints at its new time immediately, and React reverts it by itself if
     the action rejects or throws once the transition settles. Keyed off the
     `meetings` prop, so a server refresh replaces this rather than fighting
     it. */
  const [visibleMeetings, applyOptimisticMove] = useOptimistic(
    meetings,
    (state: MeetingSummary[], patch: { meetingId: string; startsAt: Date; endsAt: Date }) =>
      state.map((m) =>
        m.id === patch.meetingId ? { ...m, startsAt: patch.startsAt, endsAt: patch.endsAt } : m,
      ),
  )

  /* Same activation distance as the month grid and the sprint board: a plain
     click must still open the meeting, so a drag only begins once the
     pointer has actually travelled. */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE } }),
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const sourceIso = event.active.data.current?.sourceIso as string | undefined
      const meetingId = event.active.data.current?.meetingId as string | undefined
      if (!sourceIso || !meetingId) return

      // No drop target means the block was released outside every column —
      // over the gutter, the header, or off the grid. Treat that as a
      // cancel, not as "keep the day and take the time".
      const targetIso = event.over ? String(event.over.id) : null
      if (!targetIso) return

      const dayDelta = days.indexOf(targetIso) - days.indexOf(sourceIso)
      const minuteDelta = draggedMinutes(event.delta.y, pxPerHour)
      if (!isRealMove(dayDelta, minuteDelta)) return

      const meeting = visibleMeetings.find((m) => m.id === meetingId)
      if (!meeting) return

      const next = moveMeetingByDrag({
        startsAt: meeting.startsAt,
        endsAt: meeting.endsAt,
        dayDelta,
        minuteDelta,
        gridStartHour: GRID_START_HOUR,
        gridEndHour: GRID_END_HOUR,
      })

      startTransition(async () => {
        // Inside the transition, so React ties the optimistic state to this
        // action's lifetime and rolls it back on failure.
        applyOptimisticMove({ meetingId, ...next })
        try {
          const res = await rescheduleMeeting(
            meetingId,
            next.startsAt.toISOString(),
            next.endsAt.toISOString(),
          )
          if (!res.ok) {
            toast.error(res.error)
            return
          }
          // The action reports a Google Calendar failure as a warning while
          // still having moved the meeting — surfaced, not swallowed.
          if (res.data?.calendarWarning) toast.warning(res.data.calendarWarning)
        } catch {
          toast.error('Could not move that meeting — try again')
        }
      })
    },
    [days, pxPerHour, visibleMeetings, applyOptimisticMove],
  )

  /* Two passes, deliberately. The day window, the midnight clipping and every
     label depend on the DAYS and the MEETINGS; only the lane packing and the
     pixel geometry depend on the zoom. Keeping them in one memo meant a zoom
     notch re-derived seven day windows (~5 Intl lookups each) and re-clipped
     and re-formatted every meeting, sixty times a second while the wheel was
     turning. */
  const shapes = useMemo(
    () => days.map((iso) => buildShape(iso, visibleMeetings)),
    [days, visibleMeetings],
  )
  const columns = useMemo<DayColumn[]>(
    () => shapes.map((shape) => ({ ...shape, blocks: packBlocks(shape, pxPerHour) })),
    [shapes, pxPerHour],
  )

  const hasAllDay = shapes.some((shape) => shape.allDay.length > 0)
  const bodyHeight = (GRID_END_HOUR - GRID_START_HOUR) * pxPerHour
  const hours = useMemo(
    () => Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => GRID_START_HOUR + i),
    [],
  )

  /* The now line, on a timer that is always cleared — and only while today is
     actually on screen. A meeting can only start or finish "now" on today, so
     a week that does not contain today has nothing to re-read the clock for,
     and the old unconditional timer spent a tick a minute, all day, moving a
     line that was never rendered. */
  const showsToday = days.includes(todayIso)
  useEffect(() => {
    if (!showsToday) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock is an external system, and the first read can only happen after mount: reading it during render would put a time in the server HTML that the browser then hydrates against a different one.
    setNowMs(Date.now())
    const timer = setInterval(() => setNowMs(Date.now()), NOW_TICK_MS)
    return () => clearInterval(timer)
  }, [showsToday])

  /** One clock read for the whole grid, so no two blocks can disagree about
   *  what is running right now. Before the first tick this is the render-time
   *  clock, exactly as it was when every block read `new Date()` itself. */
  const now = useMemo(() => (nowMs === null ? new Date() : new Date(nowMs)), [nowMs])

  /* The all-day strip is content-sized, so how far a focused block has to be
     held clear of it can only be measured. ResizeObserver delivers an initial
     observation on `observe`, so there is no separate first read to make. */
  const allDayRef = useRef<HTMLDivElement>(null)
  const [allDayHeightPx, setAllDayHeightPx] = useState(0)
  useEffect(() => {
    const el = allDayRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      setAllDayHeightPx(el.getBoundingClientRect().height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasAllDay])

  /** How far below the scrollport's top edge a block must land when focus
   *  scrolls it into view — otherwise it parks underneath the sticky header
   *  and all-day strip, where its focus ring is invisible (WCAG 2.4.11). */
  const eventScrollMarginTop = HEADER_HEIGHT_PX + (hasAllDay ? allDayHeightPx : 0)

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
   * ALT + wheel zooms; a bare wheel scrolls exactly as it always did.
   *
   * It used to be Ctrl/⌘ + wheel, which is the browser's OWN page-zoom gesture
   * on every desktop platform — and on a macOS trackpad, pinch-to-zoom arrives
   * as a wheel event with `ctrlKey` set. Calling preventDefault on those
   * swallowed the standard user-agent zoom over the whole calendar (WCAG 1.4.4
   * Resize Text): someone reaching for Ctrl+scroll to enlarge the page got
   * taller hour rows and text that did not change size at all. Ctrl and ⌘ are
   * now explicitly let through; the toolbar's Shorter/Taller buttons remain the
   * keyboard route.
   *
   * Registered by hand with `{ passive: false }` because React's onWheel is
   * attached passively and cannot preventDefault. The guard runs BEFORE
   * preventDefault, so an ordinary scroll never touches it.
   *
   * A trackpad emits wheel events faster than the browser paints, and each one
   * re-packs and re-measures the grid, so the steps are coalesced through a
   * frame: one frame produces at most one zoom step.
   */
  const zoomFrame = useRef<number | null>(null)
  const pendingZoom = useRef(0)
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return
      event.preventDefault()
      pendingZoom.current = event.deltaY < 0 ? PX_PER_HOUR_STEP : -PX_PER_HOUR_STEP
      if (zoomFrame.current !== null) return
      zoomFrame.current = requestAnimationFrame(() => {
        zoomFrame.current = null
        const delta = pendingZoom.current
        pendingZoom.current = 0
        if (delta !== 0) onZoomBy(delta)
      })
    },
    [onZoomBy],
  )

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', handleWheel)
      if (zoomFrame.current !== null) cancelAnimationFrame(zoomFrame.current)
      zoomFrame.current = null
    }
  }, [handleWheel])

  const columnTemplate = {
    gridTemplateColumns: `${GUTTER_WIDTH_PX}px repeat(${days.length}, minmax(${MIN_DAY_COLUMN_PX}px, 1fr))`,
  }

  return (
    /* One DndContext for the whole grid. Wrapping the SCROLLER rather than
       each column means a drag that crosses columns is a single gesture, and
       dnd-kit measures against the same scroll offset the blocks are
       positioned in. */
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
    <div
      ref={scrollRef}
      /* Focusable and named, so arrow keys, Page Up/Down and Home/End scroll it
         in every engine. Chrome auto-focuses scrollers with no focusable
         content; Firefox and Safari do not, which left a keyboard user on a
         quiet day unable to reach 06:00 or 21:00 at all (WCAG 2.1.1). */
      tabIndex={0}
      role="region"
      aria-label={days.length === 1 ? 'Day time grid' : 'Week time grid'}
      /* One scroll container for BOTH axes. Splitting them would break the
         lockstep between the day headers and the columns underneath, since a
         box with `overflow-y: auto` resolves its x axis to `auto` too. `isolate`
         keeps the sticky z-stack from reaching outside this box. */
      className={cn(
        'relative isolate max-h-[70svh] overflow-auto rounded-xl border border-border bg-card',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
      )}
    >
      <div className="grid min-w-fit" style={columnTemplate}>
        {/* ── day headers ───────────────────────────────────────────── */}
        <div
          className="sticky top-0 left-0 z-50 border-r border-b border-border bg-card"
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
              ref={allDayRef}
              className="sticky left-0 z-30 flex items-start justify-end border-r border-b border-border bg-card px-2 py-1.5"
              style={{ top: HEADER_HEIGHT_PX }}
            >
              <span aria-hidden className="font-mono text-2xs text-muted-foreground">
                All day
              </span>
            </div>
            {columns.map((column) => (
              <div
                key={column.iso}
                className="sticky z-20 flex min-w-0 flex-col gap-1 border-r border-b border-border bg-card p-1 last:border-r-0"
                style={{ top: HEADER_HEIGHT_PX }}
              >
                {column.allDay.map((banner) => (
                  <AllDayEvent
                    key={banner.meeting.id}
                    meeting={banner.meeting}
                    label={banner.label}
                    onOpen={onOpenMeeting}
                  />
                ))}
              </div>
            ))}
          </>
        ) : null}

        {/* ── hour gutter ───────────────────────────────────────────── */}
        <HourGutter hours={hours} pxPerHour={pxPerHour} height={bodyHeight} />

        {/* ── day columns ───────────────────────────────────────────── */}
        {columns.map((column) => (
          <DayDropColumn
            key={column.iso}
            iso={column.iso}
            dayLabel={column.dayLabel}
            height={bodyHeight}
          >
            <HourCells
              hours={hours}
              pxPerHour={pxPerHour}
              iso={column.iso}
              onCreateAt={onCreateAt}
            />

            {column.iso === todayIso ? (
              <NowLine nowMs={nowMs} window={column.window} pxPerHour={pxPerHour} />
            ) : null}

            {column.blocks.map((block) => {
              const state = meetingTiming(
                block.slice.meeting.startsAt,
                block.slice.meeting.endsAt,
                now,
              ).state
              return (
                <TimeGridEvent
                  key={block.slice.meeting.id}
                  block={block}
                  dayPrefix={column.dayPrefix}
                  dayIso={column.iso}
                  isLive={state === 'live'}
                  isPast={state === 'past'}
                  scrollMarginTop={eventScrollMarginTop}
                  onOpen={onOpenMeeting}
                />
              )
            })}
          </DayDropColumn>
        ))}
      </div>
    </div>
    </DndContext>
  )
}

/**
 * Everything about one day that the zoom cannot change: which meetings touch
 * it, where their midnight cuts fall, and what they are called.
 *
 * The slices come out in TIME ORDER, and stay in it all the way to the DOM.
 * The caller hands meetings over as `[...past, ...upcoming]` with `past` in
 * newest-first order, so without this sort the buttons in a column would be
 * tabbed and read as 11:00 → 09:00 → 14:00 — focus starting in the middle of
 * the column and jumping up the screen (WCAG 2.4.3). The key is the same one
 * `layoutOverlaps` packs with, so paint order agrees with it too.
 */
function buildShape(iso: string, meetings: MeetingSummary[]): DayShape {
  const window = dayWindow(iso)
  const display = isoToDisplayDate(iso)
  const dayLabel = format(display, 'EEEE, MMMM d, yyyy')
  const dayPrefix = format(display, 'EEE d MMM')
  const allDay: { meeting: MeetingSummary; label: string }[] = []
  const slices: DaySlice[] = []

  for (const meeting of meetings) {
    const startMs = meeting.startsAt.getTime()
    const endMs = meeting.endsAt.getTime()
    const segment = clipToDay(startMs, endMs, window)
    if (!segment) continue
    if (isAllDayMeeting(startMs, endMs)) {
      allDay.push({
        meeting,
        label: [dayPrefix, meeting.title, 'all day', meeting.appName].filter(Boolean).join(', '),
      })
      continue
    }
    /* Times are formatted through `formatBusinessTime`, NOT date-fns `format`.
       Every bit of geometry in this grid is pinned to Asia/Colombo — the day
       window, the clipping, the hour labels — and date-fns has no timezone
       support, so a `format()` here printed the viewer's (or, server-side,
       Vercel's UTC) clock inside a rectangle the grid had placed by Colombo's.
       A 09:00 Colombo meeting drawn against the 09:00 gridline announced
       itself as "3:30 AM". */
    slices.push({
      meeting,
      ...segment,
      startLabel: formatBusinessTime(meeting.startsAt),
      timeRange: `${formatBusinessTime(meeting.startsAt)} to ${formatBusinessTime(meeting.endsAt)}`,
      duration: durationLabel(meeting.startsAt, meeting.endsAt),
    })
  }

  allDay.sort((a, b) => a.meeting.startsAt.getTime() - b.meeting.startsAt.getTime())
  slices.sort(
    (a, b) =>
      a.startMinutes - b.startMinutes ||
      b.endMinutes - a.endMinutes ||
      a.meeting.id.localeCompare(b.meeting.id),
  )

  return { iso, window, dayLabel, dayPrefix, slices, allDay }
}

/** Lanes and pixels — the half of a column that the zoom does change. */
function packBlocks(shape: DayShape, pxPerHour: number): TimedBlock[] {
  if (shape.slices.length === 0) return []

  /* Lanes are computed from the CLIPPED instants, so a meeting running past
     midnight competes for width only with what shares its own day — and from
     the RENDERED extent rather than the true one. `eventGeometry` stretches
     anything shorter than MIN_EVENT_HEIGHT_PX, and the packer deliberately
     treats back-to-back meetings as non-overlapping; feed it the true end and
     two 15-minute standups both take the full column width, then the first
     one's stretched box is painted over by the second one's opaque fill and
     simply disappears. Clamping the end here turns that into a real lane
     split, which is what the reader is actually looking at. */
  const floorMinutes = minEventMinutes(pxPerHour)
  const lanes = overlapMap(
    shape.slices.map((slice) => ({
      id: slice.meeting.id,
      startMs: shape.window.startMs + slice.startMinutes * 60_000,
      endMs:
        shape.window.startMs +
        Math.max(slice.endMinutes, slice.startMinutes + floorMinutes) * 60_000,
    })),
  )

  return shape.slices.map<TimedBlock>((slice) => {
    const { top, height } = eventGeometry(slice.startMinutes, slice.endMinutes, pxPerHour)
    const placement = lanes.get(slice.meeting.id) ?? {
      id: slice.meeting.id,
      lane: 0,
      laneCount: 1,
    }
    const { left, width } = laneFraction(placement)
    return { slice, top, height, leftPct: left * 100, widthPct: width * 100 }
  })
}

/** The pinned time axis. Memoised because it is 24 divs that depend on nothing
 *  but the zoom, and the grid around it re-renders every minute. */
const HourGutter = memo(function HourGutter({
  hours,
  pxPerHour,
  height,
}: {
  hours: number[]
  pxPerHour: number
  height: number
}) {
  return (
    <div className="sticky left-0 z-10 border-r border-border bg-card" style={{ height }}>
      {hours.map((hour) => (
        <div
          key={hour}
          className="relative border-b border-border/60 last:border-b-0"
          style={{ height: pxPerHour }}
        >
          {/* Sat ON the line rather than inside the box below it, so the
              label names the boundary it is drawn against. The first one
              is nudged down so it is not clipped by the header.
              `aria-hidden` because this is the ruler, not the content: read
              out, it is twenty-four bare times to wade through before the
              first meeting, and every block already carries its own time. */}
          <span
            aria-hidden
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
  )
})

/** A day column's hour bands. Same reasoning as `HourGutter`, times seven. */
const HourCells = memo(function HourCells({
  hours,
  pxPerHour,
  iso,
  onCreateAt,
}: {
  hours: number[]
  pxPerHour: number
  /** The day these cells belong to — half of the instant a `+` resolves to. */
  iso: string
  onCreateAt?: (start: Date) => void
}) {
  return (
    <>
      {hours.map((hour) => (
        <div
          key={hour}
          className={cn(
            'group/cell relative border-b border-border/60',
            // Named rather than `last:`: the blocks and the now line are
            // siblings of these cells, so which element is `:last-child`
            // depended on whether the day happened to have any meetings on it.
            hour === GRID_END_HOUR - 1 && 'border-b-0',
            // Off-hours are dimmed, never hidden — the 06:30 standup is
            // still there, it just isn't where the eye lands first.
            isWorkingHour(hour) ? 'bg-transparent' : 'bg-muted/40',
          )}
          style={{ height: pxPerHour }}
        >
          {onCreateAt ? <CreateSlotButton iso={iso} hour={hour} onCreateAt={onCreateAt} /> : null}
        </div>
      ))}
    </>
  )
})

/**
 * The "schedule something here" affordance: an empty hour is the most direct
 * statement anyone can make about when they want a meeting, and until now the
 * only way to act on it was to open a dialog elsewhere and retype the day and
 * time the grid was already showing.
 *
 * Hidden until the cell is hovered, so a week of empty hours is not 168 plus
 * signs — but `focus-visible:opacity-100` keeps it reachable by keyboard,
 * where there is no hover to depend on. `opacity`, not conditional rendering:
 * a button that only exists on hover cannot be tabbed to at all.
 */
function CreateSlotButton({
  iso,
  hour,
  onCreateAt,
}: {
  iso: string
  hour: number
  onCreateAt: (start: Date) => void
}) {
  function handleClick() {
    // `isoDayInstant` hands back Colombo MIDDAY of this ISO day (see
    // DayHeader), so midday minus twelve hours is Colombo midnight exactly —
    // Sri Lanka has no DST, so that arithmetic holds year-round and, unlike
    // `setHours`, gives the same instant whatever timezone the browser is in.
    const dayStart = isoDayInstant(iso).getTime() - 12 * 60 * 60 * 1000
    onCreateAt(new Date(dayStart + hour * 60 * 60 * 1000))
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`New meeting at ${String(hour).padStart(2, '0')}:00 on ${iso}`}
      className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-100 outline-none group-hover/cell:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none"
    >
      <span className="flex size-5 items-center justify-center rounded-md bg-muted text-muted-foreground ring-1 ring-border group-focus-within/cell:ring-ring hover:bg-accent hover:text-foreground">
        <PlusIcon className="size-3.5" aria-hidden />
      </span>
    </button>
  )
}

/** Memoised on two primitives, so the minute tick that moves the now line no
 *  longer rebuilds seven headers — and with them 28 timezone lookups. */
const DayHeader = memo(function DayHeader({ iso, isToday }: { iso: string; isToday: boolean }) {
  // Same Sri Lankan markers as the month grid and the day strip, read through
  // the shipped helpers rather than re-derived: `isoDayInstant` hands them the
  // Colombo midday of this ISO day, which is exact from any runtime.
  const instant = isoDayInstant(iso)
  const holiday = getLkHoliday(instant)
  const isWeekendDay = isLkSunday(instant) && !holiday
  const display = isoToDisplayDate(iso)

  return (
    <div
      className="sticky top-0 z-40 flex flex-col items-center justify-center gap-0.5 border-r border-b border-border bg-card px-2 last:border-r-0"
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
})

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
const TimeGridEvent = memo(function TimeGridEvent({
  block,
  dayPrefix,
  dayIso,
  isLive,
  isPast,
  scrollMarginTop,
  onOpen,
}: {
  block: TimedBlock
  /** `Wed 12 Aug` — the column's day, so a block announced on its own says
   *  which day it belongs to. */
  dayPrefix: string
  /** The column this block is drawn in — the drag origin. */
  dayIso: string
  isLive: boolean
  isPast: boolean
  scrollMarginTop: number
  onOpen: (meetingId: string) => void
}) {
  const { slice } = block
  const { meeting, continuesBefore, continuesAfter } = slice
  const isCompact = block.height < COMPACT_BLOCK_PX

  /* The id carries the DAY as well as the meeting: a meeting crossing
     midnight is drawn as two blocks, and dnd-kit ids must be unique or the
     second one silently never becomes draggable. `sourceIso` is also what
     the drop handler diffs against to get the day delta. */
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${meeting.id}::${dayIso}`,
    data: { meetingId: meeting.id, sourceIso: dayIso },
  })

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onOpen(meeting.id)}
      {...listeners}
      {...attributes}
      style={{
        top: block.top,
        height: block.height,
        left: `calc(${block.leftPct}% + 2px)`,
        width: `calc(${block.widthPct}% - 4px)`,
        /* Translated, never re-laid-out, while dragging: `top` is the
           committed time and must not move until the write lands, or a
           failed reschedule would leave the block at the dropped position
           with the database still holding the old one. */
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        /* Above every other block, so the dragged one is never posted behind
           a neighbour it is passing over. */
        zIndex: isDragging ? 30 : undefined,
        /* Dragging is a pointer gesture; without this the browser claims the
           vertical drag for scrolling on touch and the block never moves. */
        touchAction: 'none',
        /* Focus scrolls a block into view flush with the scrollport edge —
           which is exactly where the sticky header, the all-day strip and the
           hour gutter sit, so a tabbed-to block landed behind them with its
           focus ring invisible (WCAG 2.4.11 Focus Not Obscured). */
        scrollMarginTop,
        scrollMarginLeft: GUTTER_WIDTH_PX,
      }}
      className={cn(
        // NO `overflow-hidden` here, deliberately: the coarse-pointer rule in
        // globals.css grows a control's hit area with an `::after` sized
        // max(100%, 44px), and a button that clips itself clips its own slop
        // back to the 24px box it was meant to escape. The clipping lives on
        // the inner content wrapper instead, which the pseudo-element is not
        // a child of.
        'absolute z-10 flex min-w-0 flex-col border border-border border-l-2 px-1.5 text-left',
        // A block is `bg-card` on a `bg-card` column during working hours, so
        // a 2px left rule at 40% alpha was the ONLY thing marking its extent —
        // nowhere near the 3:1 of WCAG 1.4.11. The full border draws the box
        // whatever the fill.
        isCompact ? 'py-0.5' : 'py-1',
        'transition-[background-color,box-shadow] duration-150 motion-reduce:transition-none',
        'hover:brightness-95 hover:shadow-sm',
        'focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        chipTone(isPast, isLive, meeting.appId),
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
          dayPrefix,
          meeting.title,
          slice.timeRange,
          slice.duration,
          meeting.appName,
          // The faces below are decorative to a screen reader; this is where
          // the same information is actually said.
          meeting.attendees.length > 0
            ? `${meeting.attendees.length} ${meeting.attendees.length === 1 ? 'attendee' : 'attendees'}`
            : null,
          isLive ? 'happening now' : isPast ? 'past' : null,
          continuesBefore ? 'continued from the previous day' : null,
          continuesAfter ? 'continues on the next day' : null,
        ]
          .filter(Boolean)
          .join(', ')}
      </span>
      <span aria-hidden className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Title and time share a row at every size. They used to stack on
            anything taller than COMPACT_BLOCK_PX, which cost a third line the
            block had no room for: a one-hour block fits two lines, so the app
            name got rendered and then sliced through the middle of its glyphs.
            Two rows always beats three rows clipped. */}
        <span className="flex min-w-0 items-baseline gap-1">
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{meeting.title}</span>
          {/* 12px, not 11px: the month chip moved these same two fields off
              11px deliberately ("below the practical floor for muted text"),
              and this view is one click away from it. */}
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {slice.startLabel}
          </span>
        </span>
        {!isCompact && (meeting.appName || meeting.attendees.length > 0) ? (
          <span className="mt-auto flex min-w-0 items-end justify-between gap-1.5">
            <span className="min-w-0 truncate text-xs text-muted-foreground">
              {meeting.appName}
            </span>
            <AttendeeAvatars attendees={meeting.attendees} />
          </span>
        ) : null}
      </span>
    </button>
  )
})

/** How many faces fit before a block starts looking like a contact sheet. */
const MAX_VISIBLE_ATTENDEES = 3

/**
 * Who is in the meeting, as faces.
 *
 * Sized down to 16px from the Avatar default of 32: a block is two lines tall
 * at one hour, and anything larger would own the chip instead of annotating it.
 * The overlap is -space-x-1 rather than AvatarGroup's -space-x-2, which at this
 * size hid half of every face behind the next one.
 *
 * aria-hidden by inheritance — this whole subtree sits inside the block's
 * `aria-hidden` wrapper, and the attendee count is spoken by the sr-only label
 * above instead. Faces are recognised, names are read; the two audiences want
 * different things.
 */
function AttendeeAvatars({ attendees }: { attendees: MeetingSummary['attendees'] }) {
  if (attendees.length === 0) return null
  const visible = attendees.slice(0, MAX_VISIBLE_ATTENDEES)
  const overflow = attendees.length - visible.length

  return (
    <span className="flex shrink-0 items-center -space-x-1">
      {visible.map((attendee) => (
        <Avatar
          key={attendee.id}
          className="size-4 ring-1 ring-card"
          // Not a tooltip: the whole block is one button, and a nested
          // interactive tooltip trigger would break that. `title` still gives
          // the name on hover without adding a second control.
          title={attendee.name}
        >
          {attendee.avatarUrl ? <AvatarImage src={attendee.avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-[8px] font-medium">
            {attendee.name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 ? (
        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[8px] font-medium text-muted-foreground ring-1 ring-card">
          {overflow > 9 ? '9+' : `+${overflow}`}
        </span>
      ) : null}
    </span>
  )
}

/** A meeting that owns the whole day — see `isAllDayMeeting` for the rule. */
function AllDayEvent({
  meeting,
  label,
  onOpen,
}: {
  meeting: MeetingSummary
  /** Day, title and ", all day" — the visible span truncates and says nothing
   *  about which column it is in. */
  label: string
  onOpen: (meetingId: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(meeting.id)}
      // Sits behind the same sticky hour gutter as a timed block does when the
      // week grid is scrolled right.
      style={{ scrollMarginLeft: GUTTER_WIDTH_PX }}
      className={cn(
        'flex min-w-0 items-center gap-1 rounded-sm border-l-2 border-l-muted-foreground/40 bg-muted px-1.5 py-0.5 text-left',
        'transition-colors duration-150 hover:bg-accent motion-reduce:transition-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden className="min-w-0 truncate text-2xs font-medium">
        {meeting.title}
      </span>
    </button>
  )
}

/**
 * The "you are here" line. Mounted only on the column that is actually today
 * — `minutesIntoDay` returns null for every other day, so it can never be
 * pinned to the top or bottom edge of a day it does not belong to.
 *
 * `--chart-1` (ember), not `--destructive`: "now" is not an error, and
 * `--destructive` is a near-identical red to `--weekend`, which this very grid
 * renders in the Sunday header two rows up. The sprint roadmap already marks
 * today on a time axis with `bg-chart-1`; one colour for "you are here".
 */
function NowLine({
  nowMs,
  window,
  pxPerHour,
}: {
  nowMs: number | null
  window: DayWindow
  pxPerHour: number
}) {
  if (nowMs === null) return null
  const minutes = minutesIntoDay(nowMs, window)
  if (minutes === null) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-[5] flex items-center"
      style={{ top: ((minutes - GRID_START_HOUR * 60) / 60) * pxPerHour }}
    >
      <span className="-ml-1 size-2 shrink-0 rounded-full bg-chart-1" />
      <span className="h-px flex-1 bg-chart-1" />
    </div>
  )
}
