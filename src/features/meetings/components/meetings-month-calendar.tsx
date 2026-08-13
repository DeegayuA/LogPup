'use client'

import { useMemo, useOptimistic, useRef, useState, useTransition, type ReactNode } from 'react'
import {
  DragOverlay,
  useDraggable,
  useDroppable,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DragSurface } from '@/components/shared/drag-surface'
import { HolidayIcons, holidayCategoryLabel, holidayToneClass } from '@/components/shared/holiday-icon'
import { getLkHoliday, isLkSunday } from '@/lib/lk-holidays'
import { cn } from '@/lib/utils'
import { rescheduleMeeting } from '@/features/meetings/actions'
import { meetingTiming } from '@/features/meetings/components/meeting-glance'
import { MeetingDetailDialog } from '@/features/meetings/components/meeting-detail-dialog'
import { MeetingForm } from '@/features/meetings/components/meeting-form'
import { MeetingNotesDialog } from '@/features/meetings/components/meeting-notes-dialog'
import { dayKeyToDate, moveMeetingToDay } from '@/features/meetings/reschedule'
import type { MeetingSummary } from '@/features/meetings/queries'
import {
  eventFadedClasses,
  eventSolidClasses,
  meetingColorKey,
} from '@/features/meetings/event-color'

/*
 * Chip colour encodes STATE FIRST, then identity.
 *
 * App tinting was here once, was removed, and is now back in a different
 * form. That history is worth keeping, because the objections that killed it
 * were right and this version has to answer them:
 *
 *   - "two apps collide as soon as their char codes agree mod 5" — the old
 *     version hashed the app NAME over five slots. This one hashes the app
 *     ID (stable across renames) with FNV-1a over eight, and its tests pin
 *     the distribution. Collisions still happen; they are now a grouping
 *     nuisance rather than the norm.
 *   - "the ramp is the data-viz ramp, borrowed and needed elsewhere" — this
 *     one has its own tokens (--event-1..8), so chart-1 stays the ember that
 *     means attention and nothing else.
 *   - "colour cannot name the app, so the name is repeated as text anyway" —
 *     still true, and still the design: the name is always rendered. Colour
 *     is not the label, it is what makes a week of eight meetings across
 *     three products scannable without reading eight labels.
 *
 * What has NOT changed is the ordering: running-right-now and already-over
 * are states you must be able to read instantly, so they keep their accent
 * and their recessive treatment and override the app hue entirely. Identity
 * paints only what is left, which is the merely-scheduled majority.
 *
 * Exported so the Day/Week time grid paints all of this the same way. Two
 * colour languages on one page, a single click apart, would be worse than
 * either alone.
 *
 * `appId` is optional so a caller with no app in scope keeps the neutral
 * chip rather than being forced to invent one.
 */
export function chipTone(isPast: boolean, isLive: boolean, colorKey?: string | null): string {
  // Color is the meeting's PEOPLE (meetingColorKey): the same crew's standup
  // and retro wear the same hue. State rides on top — a live meeting keeps
  // its team color and gains a ring, a past one keeps the hue faded — and is
  // always also said in words (chipLabel), never carried by color alone.
  const solid = eventSolidClasses(colorKey) ?? 'border-muted-foreground/40 bg-card text-foreground'
  if (isLive) return cn(solid, 'ring-2 ring-ring ring-offset-1 ring-offset-background')
  if (isPast) return eventFadedClasses(colorKey) ?? 'border-transparent bg-muted/50 text-muted-foreground'
  return solid
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_VISIBLE = 3
const DAY_KEY = 'yyyy-MM-dd'
/** Matches the sprint board: a plain click must still open the chip, so a drag
    only starts once the pointer has actually travelled. */
const DRAG_ACTIVATION_DISTANCE = 8

/* Now backed by the shared drag kit's Space-to-lift KeyboardSensor, so
   dnd-kit's own default instructions are almost right — this just adds the
   detail panel as the alternative for anyone who'd rather type exact
   times. */
const DRAG_INSTRUCTIONS =
  'Meetings can be dragged with a mouse, by touch, or with a keyboard — focus a meeting and press Space to lift it, arrow keys to move it, Space to drop it. Or open it and edit its start and end fields directly.'

type Entry = { meeting: MeetingSummary; isPast: boolean }
type ReschedulePatch = { meetingId: string; startsAt: Date; endsAt: Date; isPast: boolean }

/** Full chip text for the accessible tree — the visible spans truncate, and a
    chip's state is otherwise carried by colour alone. */
function chipLabel(meeting: MeetingSummary, isPast: boolean, isLive: boolean): string {
  const state = isLive ? 'happening now' : isPast ? 'past' : null
  return [meeting.title, format(meeting.startsAt, 'h:mm a'), meeting.appName, state]
    .filter(Boolean)
    .join(', ')
}

/** Reads a drop target's id back as a spoken day, for the live announcements. */
function spokenDay(dayKey: string): string {
  const date = dayKeyToDate(dayKey)
  return date ? format(date, 'EEEE, MMMM d') : 'another day'
}

export function MeetingsMonthCalendar({
  upcoming,
  past,
  currentUserId,
  isAdmin,
  users = [],
  apps = [],
  onSelectDay,
  onOpenMeetingInList,
  month,
  onMonthChange,
}: {
  upcoming: MeetingSummary[]
  past: MeetingSummary[]
  currentUserId: string
  isAdmin: boolean
  /** Also the attendee list for the "New meeting" form an empty-cell click
   *  opens — `ActiveUser` is this same `{ id, name }` shape, so the grid does
   *  not take a second people prop that would only ever be handed the same
   *  array. */
  users?: { id: string; name: string }[]
  apps?: { id: string; name: string }[]
  /** Hands a day back to the parent so a chip can drop into the filtered list. */
  onSelectDay?: (date: Date) => void
  onOpenMeetingInList?: (meeting: MeetingSummary) => void
  /** Month on show. Pass it (with `onMonthChange`) to drive the grid from
   *  outside — the calendar surface does, so the month the URL names and the
   *  month this grid draws cannot disagree. Omit both and the grid keeps its
   *  own cursor exactly as it always has. */
  month?: Date
  onMonthChange?: (month: Date) => void
}) {
  // One clock read for the whole grid, so every chip in it agrees about which
  // meeting is running right now.
  const now = new Date()
  const [internalCursor, setInternalCursor] = useState(() => startOfMonth(new Date()))
  const cursor = month ? startOfMonth(month) : internalCursor
  const isControlled = month !== undefined
  const setCursor = (next: Date) => {
    if (!isControlled) setInternalCursor(next)
    onMonthChange?.(next)
  }
  const [expanded, setExpanded] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  // One write-up popup for the whole grid rather than one per chip: a busy
  // month renders a hundred chips, and a hundred mounted dialogs is a hundred
  // fetch effects waiting to fire.
  const [notesId, setNotesId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [newMeetingDay, setNewMeetingDay] = useState<Date | null>(null)
  const [, startTransition] = useTransition()

  const entries = useMemo<Entry[]>(
    () => [
      ...past.map((meeting) => ({ meeting, isPast: true })),
      ...upcoming.map((meeting) => ({ meeting, isPast: false })),
    ],
    [upcoming, past],
  )

  // Optimistic moves: the dropped chip repaints on the new day immediately and
  // React reverts it automatically if the action rejects or throws, once the
  // transition settles. Same contract as the sprint board.
  const [visible, applyOptimisticMove] = useOptimistic(
    entries,
    (state: Entry[], patch: ReschedulePatch) =>
      state.map((entry) =>
        entry.meeting.id === patch.meetingId
          ? {
              meeting: { ...entry.meeting, startsAt: patch.startsAt, endsAt: patch.endsAt },
              isPast: patch.isPast,
            }
          : entry,
      ),
  )

  const byId = useMemo(() => {
    const map = new Map<string, Entry>()
    for (const entry of visible) map.set(entry.meeting.id, entry)
    return map
  }, [visible])

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>()
    for (const entry of visible) {
      const key = format(entry.meeting.startsAt, DAY_KEY)
      const list = map.get(key) ?? []
      list.push(entry)
      map.set(key, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.meeting.startsAt.getTime() - b.meeting.startsAt.getTime())
    }
    return map
  }, [visible])

  const announcements = useMemo<Announcements>(
    () => ({
      onDragStart: ({ active }) =>
        `Picked up ${byId.get(String(active.id))?.meeting.title ?? 'meeting'}.`,
      onDragOver: ({ active, over }) =>
        over
          ? `${byId.get(String(active.id))?.meeting.title ?? 'Meeting'} is over ${spokenDay(String(over.id))}.`
          : undefined,
      onDragEnd: ({ active, over }) => {
        const title = byId.get(String(active.id))?.meeting.title ?? 'Meeting'
        return over
          ? `${title} moved to ${spokenDay(String(over.id))}.`
          : `${title} was dropped outside the calendar and did not move.`
      },
      onDragCancel: ({ active }) =>
        `Move cancelled. ${byId.get(String(active.id))?.meeting.title ?? 'The meeting'} stays where it was.`,
    }),
    [byId],
  )

  function canManage(meeting: MeetingSummary): boolean {
    return isAdmin || meeting.createdBy === currentUserId
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null)
    const { active, over } = event
    if (!over) return

    const entry = byId.get(String(active.id))
    if (!entry || !canManage(entry.meeting)) return

    const targetDay = dayKeyToDate(String(over.id))
    if (!targetDay) return

    const next = moveMeetingToDay(entry.meeting.startsAt, entry.meeting.endsAt, targetDay)
    if (next.startsAt.getTime() === entry.meeting.startsAt.getTime()) return

    const meetingId = entry.meeting.id
    startTransition(async () => {
      applyOptimisticMove({
        meetingId,
        startsAt: next.startsAt,
        endsAt: next.endsAt,
        isPast: next.startsAt.getTime() < Date.now(),
      })
      // rescheduleMeeting can reject outright (a DB outage), not only resolve
      // with `{ ok: false }` — without this catch that is an unhandled
      // rejection: no toast, and the chip sits on the wrong day until the next
      // unrelated render.
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
        if (res.data.calendarWarning) toast.warning(res.data.calendarWarning)
        else toast.success(`Moved to ${format(next.startsAt, 'EEE, MMM d · h:mm a')}`)
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id))
  }

  /**
   * A day cell click names a DAY, not an instant — `day` is that day at
   * midnight. MeetingForm takes a supplied start as an exact time, which is
   * right for the day/week grid (a slot click really is a time) and wrong
   * here: it would propose a meeting at the stroke of 12am. Carry the current
   * wall-clock time onto the clicked day instead, and let the form round it
   * up to the next step exactly as it rounds "now".
   */
  function openNewMeetingOn(day: Date) {
    const clicked = new Date()
    setNewMeetingDay(
      new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        clicked.getHours(),
        clicked.getMinutes(),
      ),
    )
  }

  const monthStart = startOfMonth(cursor)
  const monthEnd = endOfMonth(cursor)
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
  })

  const dragging = draggingId ? byId.get(draggingId) : undefined
  const open = openId ? (byId.get(openId)?.meeting ?? null) : null
  const notesFor = notesId ? (byId.get(notesId)?.meeting ?? null) : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Date badge — today's date, Untitled-style */}
          <div className="flex w-12 flex-col overflow-hidden rounded-lg border text-center">
            <span className="bg-muted px-1 py-0.5 font-mono text-2xs font-medium uppercase text-muted-foreground">
              {format(new Date(), 'MMM')}
            </span>
            <span className="py-0.5 font-heading text-lg font-bold leading-tight">
              {format(new Date(), 'd')}
            </span>
          </div>
          <div className="flex flex-col">
            {/* h2 — /meetings owns the h1, and the list view's "Upcoming" is an
                h2, so the calendar view must not skip a level. */}
            <h2 className="font-heading text-lg font-semibold leading-tight">
              {format(cursor, 'MMMM yyyy')}
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              {format(monthStart, 'MMM d')} – {format(monthEnd, 'MMM d, yyyy')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border p-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label="Previous month"
            onClick={() => setCursor(addMonths(cursor, -1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="h-7 px-2.5"
            onClick={() => setCursor(startOfMonth(new Date()))}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label="Next month"
            onClick={() => setCursor(addMonths(cursor, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      {/* Says out loud what the grid offers, for anyone who can't see a chip
          lift under the cursor — and names the keyboard equivalent. */}
      <p className="text-xs text-muted-foreground">
        Select a meeting for its full details, attendees and notes, or click an empty day to schedule
        one. Drag one onto another day to move it — with a mouse, by touch, or by keyboard (Space to
        lift, arrow keys to move) — or reschedule it from its details instead.
      </p>

      <DragSurface
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingId(null)}
        accessibility={{ announcements, screenReaderInstructions: { draggable: DRAG_INSTRUCTIONS } }}
      >
        <div className="overflow-x-auto">
          <div className="min-w-[840px] overflow-hidden rounded-xl border">
            <div className="grid grid-cols-7 border-b bg-muted/40">
              {WEEKDAYS.map((weekday) => (
                <div
                  key={weekday}
                  className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
                >
                  {weekday}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const key = format(day, DAY_KEY)
                const entriesForDay = byDay.get(key) ?? []
                const isExpanded = expanded === key
                return (
                  <DayCell
                    key={key}
                    dayKey={key}
                    day={day}
                    inMonth={isSameMonth(day, cursor)}
                    entries={entriesForDay}
                    isExpanded={isExpanded}
                    onToggleExpanded={() => setExpanded(isExpanded ? null : key)}
                    onEmptyClick={() => openNewMeetingOn(day)}
                  >
                    {(isExpanded ? entriesForDay : entriesForDay.slice(0, MAX_VISIBLE)).map(
                      (entry) => (
                        <MeetingChip
                          key={entry.meeting.id}
                          entry={entry}
                          now={now}
                          draggable={canManage(entry.meeting)}
                          onOpen={setOpenId}
                        />
                      ),
                    )}
                  </DayCell>
                )
              })}
            </div>
          </div>
        </div>
        {/* Portalled to the body: the month grid clips its own overflow, so a
            chip dragged across cells would otherwise disappear at the edge. */}
        <DragOverlay dropAnimation={null}>
          {dragging ? (
            // Opaque wrapper: the chip's own tone is a 15% tint that would
            // read as whatever it happens to fly over.
            <div className="cursor-grabbing rounded-sm bg-popover shadow-md">
              <ChipFace
                entry={dragging}
                isLive={
                  meetingTiming(dragging.meeting.startsAt, dragging.meeting.endsAt, now).state ===
                  'live'
                }
              />
            </div>
          ) : null}
        </DragOverlay>
      </DragSurface>

      {/* Opened by a click on the empty space in a day cell. Keyed on the
          seeded instant so each cell mounts a form carrying its own date —
          the same remount-to-reseed pattern the day/week grid's slot `+`
          uses, rather than a controlled `open` prop the form does not take. */}
      {newMeetingDay ? (
        <MeetingForm
          key={newMeetingDay.toISOString()}
          apps={apps}
          activeUsers={users}
          defaultStart={newMeetingDay}
          defaultOpen
          onOpenChange={(next) => {
            if (!next) setNewMeetingDay(null)
          }}
        />
      ) : null}

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
        onOpenNotes={setNotesId}
      />

      {/* Reading a past meeting's write-up without leaving the month. Mounted
          once and pointed at whichever meeting was asked for; it re-fetches on
          every open, so pointing it somewhere new shows a skeleton rather than
          the last meeting's notes under the new title. */}
      {notesFor ? (
        <MeetingNotesDialog
          meetingId={notesFor.id}
          meetingTitle={notesFor.title}
          startsAt={notesFor.startsAt}
          open
          onOpenChange={(next) => {
            if (!next) setNotesId(null)
          }}
          onOpenFullMeeting={
            onOpenMeetingInList || onSelectDay
              ? (id) => {
                  const meeting = byId.get(id)?.meeting
                  if (!meeting) return
                  if (onOpenMeetingInList) onOpenMeetingInList(meeting)
                  else onSelectDay?.(meeting.startsAt)
                }
              : undefined
          }
        />
      ) : null}
    </div>
  )
}

function DayCell({
  dayKey,
  day,
  inMonth,
  entries,
  isExpanded,
  onToggleExpanded,
  onEmptyClick,
  children,
}: {
  dayKey: string
  day: Date
  inMonth: boolean
  entries: Entry[]
  isExpanded: boolean
  onToggleExpanded: () => void
  /** Opens the "New meeting" form prefilled with this day. */
  onEmptyClick: () => void
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey })

  // Same Sri Lanka holiday/Sunday markers as the mini-calendar day strip
  // (src/components/kibo-ui/mini-calendar), reusing its helpers rather than
  // re-deriving the rules here. A Sunday that is also a holiday still reads as
  // a holiday (holiday wins) — the icon is what keeps that legible without
  // relying on hue alone.
  const holiday = getLkHoliday(day)
  const holidayName = holiday?.name
  const isWeekendDay = isLkSunday(day) && !holidayName

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-28 min-w-0 flex-col gap-1 border-b border-r p-1.5 [&:nth-child(7n)]:border-r-0',
        !inMonth && 'bg-muted/25',
        // No transition on the drop highlight: during a drag the feedback has
        // to land the instant the pointer crosses the cell edge.
        isOver && 'bg-accent ring-2 ring-primary/50 ring-inset',
      )}
    >
      <div className="flex items-center gap-1">
        <span
          aria-hidden
          title={holidayName ? [holidayName, holidayCategoryLabel(holiday?.categories)].filter(Boolean).join(' — ') : undefined}
          className={cn(
            'flex size-5 items-center justify-center rounded-full font-mono text-xs',
            isToday(day)
              ? 'bg-primary font-semibold text-primary-foreground'
              : holiday
                ? holidayToneClass(holiday.categories)
                : isWeekendDay
                  ? 'text-weekend'
                  : inMonth
                    ? 'text-foreground'
                    : // The tinted cell already de-emphasises out-of-month
                      // days; alpha on top of it drops the date below AA.
                      'text-muted-foreground',
          )}
        >
          {format(day, 'd')}
        </span>
        {holiday ? <HolidayIcons categories={holiday.categories} className="size-3 shrink-0" /> : null}
        <span className="sr-only">
          {format(day, 'EEEE, MMMM d')}
          {holidayName ? `, ${holidayName}` : ''}
          {holiday ? `, ${holidayCategoryLabel(holiday.categories)}` : ''}
        </span>
      </div>
      {children}
      {/* Fills whatever's left of the cell below the chips. Deliberately NOT
          a tab stop: a month grid has 30-42 of these, and most days have no
          meeting — one new tab stop per empty cell would badly clutter
          keyboard navigation for a click-to-prefill convenience that
          already has a real keyboard route (the page's own "New meeting"
          button, just without the date prefilled). Mouse/touch only, same
          reasoning as the roadmap's edge-resize handles. */}
      <div
        aria-hidden
        onClick={onEmptyClick}
        title={`New meeting on ${format(day, 'EEEE, MMMM d')}`}
        className="min-h-4 flex-1 rounded-sm transition-colors duration-150 hover:bg-accent/60"
      />
      {/* One button across both states — rendering "+N more" and "Show less" as
          separate elements unmounted the control the user was standing on,
          dropping focus to <body>. */}
      {entries.length > MAX_VISIBLE ? (
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={onToggleExpanded}
          /* 12px, not 11px: this is an interactive control, and muted text at
             11px is below the practical legibility floor. */
          className="w-fit rounded-sm text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        >
          {isExpanded ? 'Show less' : `+${entries.length - MAX_VISIBLE} more`}
        </button>
      ) : null}
    </div>
  )
}

/** The chip's visuals, shared by the real chip and the drag overlay. */
function ChipFace({ entry, isLive = false }: { entry: Entry; isLive?: boolean }) {
  const { meeting, isPast } = entry
  return (
    <div
      className={cn(
        'flex min-w-0 items-center justify-between gap-1.5 rounded-md border px-1.5 py-1 text-left',
        chipTone(isPast, isLive, meetingColorKey(meeting)),
      )}
    >
      <span className="min-w-0 truncate text-xs font-medium">{meeting.title}</span>
      <span className="shrink-0 font-mono text-2xs opacity-85">
        {format(meeting.startsAt, 'h:mm a')}
      </span>
    </div>
  )
}

/*
 * A real control, not a tooltip-only div: the full title, time and app name
 * live in the accessible tree (the visible spans truncate), activating the
 * chip opens the meeting's details, and — for anyone allowed to manage it —
 * dragging it onto another day moves it. "Past" is a recessive fill plus a
 * spoken ", past" (see chipTone / chipLabel) — never opacity, which drove the
 * chip text under AA and said nothing to a screen reader at all.
 */
function MeetingChip({
  entry,
  now,
  draggable,
  onOpen,
}: {
  entry: Entry
  /** Shared clock read for the whole grid — see MeetingsMonthCalendar. */
  now: Date
  draggable: boolean
  onOpen: (meetingId: string) => void
}) {
  const { meeting, isPast } = entry
  const isLive = meetingTiming(meeting.startsAt, meeting.endsAt, now).state === 'live'
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: meeting.id,
    disabled: !draggable,
  })
  // Where the pointer went down, so a drag that ends back over the chip isn't
  // also delivered as a click that pops the details open. Mirrors the sensor's
  // own activation distance.
  const pointerStart = useRef<{ x: number; y: number } | null>(null)

  // Only a chip this user may actually move gets dnd-kit's attributes: they
  // include `aria-roledescription="draggable"` and, when the draggable is
  // disabled, `aria-disabled` — both lies on a read-only chip that still opens
  // its details perfectly well.
  const dragProps = draggable ? { ...attributes, ...listeners } : {}

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...dragProps}
      onPointerDown={(event) => {
        pointerStart.current = { x: event.clientX, y: event.clientY }
        listeners?.onPointerDown?.(event)
      }}
      onClick={(event) => {
        const from = pointerStart.current
        pointerStart.current = null
        if (
          from &&
          Math.hypot(event.clientX - from.x, event.clientY - from.y) >= DRAG_ACTIVATION_DISTANCE
        ) {
          return
        }
        onOpen(meeting.id)
      }}
      className={cn(
        'flex min-w-0 items-center justify-between gap-1.5 rounded-md border px-1.5 py-1 text-left',
        'transition-[filter] duration-150 hover:brightness-110 motion-reduce:transition-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        chipTone(isPast, isLive, meetingColorKey(meeting)),
        draggable && 'cursor-grab active:cursor-grabbing',
        // The chip stays in place as a ghost while its overlay copy follows
        // the pointer, so the day's layout doesn't jump mid-drag.
        isDragging && 'opacity-40',
      )}
    >
      <span className="sr-only">{chipLabel(meeting, isPast, isLive)}</span>
      {/* Color says WHO (the attendee set — same crew, same hue); the title,
          time, app name and state all remain words in the accessible label
          above, so nothing is carried by color alone (WCAG 1.4.1). The app
          name left the visible line when the pill went single-line — it
          stays one focus away in the details panel. */}
      <span aria-hidden className="min-w-0 truncate text-xs font-medium">
        {meeting.title}
      </span>
      <span aria-hidden className="shrink-0 font-mono text-2xs opacity-85">
        {format(meeting.startsAt, 'h:mm a')}
      </span>
    </button>
  )
}
