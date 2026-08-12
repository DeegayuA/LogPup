'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  differenceInCalendarDays,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { updateSprint } from '@/features/sprints/actions'
import { SprintEditDialog } from '@/features/sprints/components/sprint-edit-dialog'
import {
  PX_PER_DAY,
  ZOOM_LABEL,
  ZOOM_LEVELS,
  barGeometry,
  offsetOfDate,
  packRows,
  parseZoom,
  rowCount,
  snapDays,
  timelineWindow,
  type Span,
  type TimelineWindow,
  type Zoom,
} from '@/features/sprints/roadmap-layout'
import {
  inclusiveDayCount,
  moveSprintRange,
  resizeSprintEnd,
  resizeSprintStart,
  type SprintRange,
} from '@/features/sprints/sprint-date-range'
import type { Sprint } from '@/features/sprints/queries'

const ROW_HEIGHT = 44
const BAR_HEIGHT = 28
const HEADER_HEIGHT = 30

/**
 * Tighter than the board's 8px. A resize handle is 10px wide, so an
 * activation distance of 8 would mean letting go before the drag had even
 * started. The click-versus-drag ambiguity that motivates the larger
 * threshold on cards is handled here by the same pointer-travel check the
 * meetings calendar uses.
 */
const DRAG_ACTIVATION_DISTANCE = 4

/** How far past the outermost sprint the axis extends, so a bar can be
 *  dragged beyond today's extremes without the axis resizing mid-gesture. */
const PAD_DAYS: Record<Zoom, number> = { week: 21, month: 60, quarter: 150 }

/**
 * Bars are drawn two pixels narrower than their true span.
 *
 * Sequential sprints (one ends the 7th, the next starts the 8th) share a row
 * — correctly, they don't overlap — but their bars then touch and read as a
 * single long sprint. The alternative considered and rejected was demanding
 * a day gap in `packRows`: that pushes every consecutive sprint onto its own
 * row, so a year of back-to-back sprints becomes a twelve-row staircase.
 * A hairline is a drawing problem and gets a drawing fix.
 */
const BAR_INSET_PX = 2

/** Keyboard nudges write through a debounce: holding an arrow key must not
 *  become one server round trip per repeat. */
const KEY_COMMIT_DELAY_MS = 400

const STATUS_BAR: Record<Sprint['status'], string> = {
  // Planned gets a hollow dashed treatment so planned vs active is never
  // colour-only (the two pine tones are nearly identical).
  planned: 'border border-dashed border-chart-2 bg-chart-2/25 text-foreground',
  active: 'bg-primary text-primary-foreground',
  done: 'bg-muted-foreground/40 text-foreground',
}

const STATUS_LABEL: Record<Sprint['status'], string> = {
  planned: 'Planned',
  active: 'Active',
  done: 'Done',
}

type DragKind = 'move' | 'start' | 'end'
type ActiveDrag = { sprintId: string; kind: DragKind; deltaDays: number }

/** dnd-kit ids are flat strings; `<uuid>|move` keeps the two halves
 *  unambiguous because a uuid never contains a pipe. */
const dragId = (sprintId: string, kind: DragKind) => `${sprintId}|${kind}`
function parseDragId(id: string): { sprintId: string; kind: DragKind } | null {
  const at = id.lastIndexOf('|')
  if (at === -1) return null
  const kind = id.slice(at + 1)
  if (kind !== 'move' && kind !== 'start' && kind !== 'end') return null
  return { sprintId: id.slice(0, at), kind }
}

/** A `date` column is a calendar day. `new Date('2026-08-14')` parses as UTC
 *  midnight and renders as the 13th west of Greenwich; noon survives any
 *  offset. Same rule as the app detail route and the task card. */
function parseIso(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

function formatRange(range: SprintRange): string {
  const start = parseIso(range.startDate)
  const end = parseIso(range.endDate)
  const startPattern = start.getFullYear() === end.getFullYear() ? 'MMM d' : 'MMM d, yyyy'
  return `${format(start, startPattern)} – ${format(end, 'MMM d, yyyy')}`
}

type Tick = { key: string; label: string; leftDays: number; days: number }

/**
 * The axis ruler. Weeks at week zoom, months otherwise — the choice is about
 * label density, not aesthetics: month labels at 26px/day are hundreds of
 * pixels apart and useless for locating a day, and week labels at 3px/day
 * overlap into mush.
 */
function buildTicks(axis: TimelineWindow, zoom: Zoom): Tick[] {
  const winStart = parseIso(axis.startDate)
  const winEnd = parseIso(axis.endDate)

  const periods =
    zoom === 'week'
      ? eachWeekOfInterval({ start: winStart, end: winEnd }, { weekStartsOn: 1 }).map((day) => ({
          from: startOfWeek(day, { weekStartsOn: 1 }),
          to: endOfWeek(day, { weekStartsOn: 1 }),
          label: format(day, 'MMM d'),
          key: format(day, 'yyyy-MM-dd'),
        }))
      : eachMonthOfInterval({ start: winStart, end: winEnd }).map((day) => ({
          from: startOfMonth(day),
          to: endOfMonth(day),
          label: format(day, day.getMonth() === 0 ? 'MMM yyyy' : 'MMM'),
          key: format(day, 'yyyy-MM'),
        }))

  return periods.map((period) => {
    // Clamp to the window: the first and last period are usually partial, and
    // an unclamped width would push every later tick out of alignment with
    // the bars below them.
    const from = period.from < winStart ? winStart : period.from
    const to = period.to > winEnd ? winEnd : period.to
    return {
      key: period.key,
      label: period.label,
      leftDays: differenceInCalendarDays(from, winStart),
      days: differenceInCalendarDays(to, from) + 1,
    }
  })
}

export function RoadmapTimeline({
  sprints,
  slug,
  isAdmin,
}: {
  sprints: Sprint[]
  slug: string
  isAdmin: boolean
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const zoom = parseZoom(searchParams.get('zoom'))
  const pxPerDay = PX_PER_DAY[zoom]

  // Asia/Colombo, matching the dashboard queries and the board — the same
  // definition on the server and in the browser, so the "today" marker can't
  // land on two different days across hydration.
  const todayIso = toIsoDateInTimeZone(new Date(), LK_TIMEZONE)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [, startTransition] = useTransition()
  const [overrides, setOverrides] = useState<ReadonlyMap<string, SprintRange>>(() => new Map())
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null)
  const [editing, setEditing] = useState<Sprint | null>(null)
  const [liveMessage, setLiveMessage] = useState('')
  /** Debounced keyboard nudges that have been PAINTED but not yet written.
   *  The range is kept alongside the timer so the write can still be flushed
   *  if the component goes away first — see the unmount effect. */
  const pendingWrites = useRef(
    new Map<string, { timer: ReturnType<typeof setTimeout>; range: SprintRange }>(),
  )

  /*
   * Optimistic dates are plain state, not `useOptimistic`.
   *
   * useOptimistic drops its overlay the moment the transition settles, which
   * is right for a board card (the server's answer arrives with the same
   * render) but wrong here: a keyboard nudge is debounced, so there are
   * stretches with a visibly moved bar and no transition in flight at all.
   * Holding the range explicitly means the rollback is explicit too — on
   * failure this deletes exactly the entry it wrote.
   */
  const [syncedSprints, setSyncedSprints] = useState(sprints)
  if (sprints !== syncedSprints) {
    setSyncedSprints(sprints)
    // Fresh server data supersedes every optimistic range; keeping them would
    // mean showing a stale local guess over a known-good answer.
    if (overrides.size > 0) setOverrides(new Map())
  }

  /*
   * On unmount, FLUSH the debounced nudges — don't cancel them.
   *
   * Cancelling was silent data loss with a lie attached: the bar had already
   * moved, the live region had already said "Sprint 4 now runs Aug 10 – Aug
   * 16", and then leaving the tab within 400ms threw the write away with
   * nothing written and nothing said. Firing the action from cleanup touches
   * no React state (this component is going away), so all it can do is
   * finish the job the user was told was done. A failure here can only be
   * reported through the global toaster: the bar it belongs to no longer
   * exists to snap back.
   */
  useEffect(() => {
    const pending = pendingWrites.current
    return () => {
      for (const [sprintId, entry] of pending) {
        clearTimeout(entry.timer)
        void updateSprint(sprintId, entry.range)
          .then((res) => {
            if (!res.ok) toast.error(res.error)
          })
          .catch(() => toast.error('Could not save those dates'))
      }
      pending.clear()
    }
  }, [])

  const committedRange = useCallback(
    (sprint: Sprint): SprintRange =>
      overrides.get(sprint.id) ?? { startDate: sprint.startDate, endDate: sprint.endDate },
    [overrides],
  )

  /** The range as it should LOOK right now, including an in-flight drag.
   *  Derived through the same pure functions the commit uses, so the preview
   *  under the cursor can never disagree with what gets written. */
  const previewRange = useCallback(
    (sprint: Sprint): SprintRange => {
      const range = committedRange(sprint)
      if (!activeDrag || activeDrag.sprintId !== sprint.id || activeDrag.deltaDays === 0) {
        return range
      }
      const { kind, deltaDays } = activeDrag
      if (kind === 'move') return moveSprintRange(range.startDate, range.endDate, deltaDays)
      if (kind === 'start') return resizeSprintStart(range.startDate, range.endDate, deltaDays)
      return resizeSprintEnd(range.startDate, range.endDate, deltaDays)
    },
    [activeDrag, committedRange],
  )

  // The axis and the row packing are BOTH computed from committed dates. If
  // they tracked the drag, the ruler would slide under the cursor and bars
  // would hop rows mid-gesture — the two things that make a timeline feel
  // like it is fighting you.
  const committedSpans = useMemo<Span[]>(
    () => sprints.map((sprint) => ({ id: sprint.id, ...committedRange(sprint) })),
    [sprints, committedRange],
  )
  const axis = useMemo(
    () => timelineWindow(committedSpans, todayIso, PAD_DAYS[zoom]),
    [committedSpans, todayIso, zoom],
  )
  const rows = useMemo(() => packRows(committedSpans), [committedSpans])
  const totalRows = Math.max(rowCount(rows), 1)
  const ticks = useMemo(() => buildTicks(axis, zoom), [axis, zoom])
  const timelineWidth = axis.totalDays * pxPerDay
  const todayLeft = (offsetOfDate(axis, todayIso) + 0.5) * pxPerDay

  const ordered = useMemo(
    () =>
      [...sprints].sort(
        (a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name),
      ),
    [sprints],
  )

  const setZoom = useCallback(
    (next: Zoom) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === 'month') params.delete('zoom')
      else params.set('zoom', next)
      const query = params.toString()
      // History API, not the router: the zoom is a client-side concern and
      // Next keeps `useSearchParams` in sync with a native replaceState, so
      // this re-renders without re-running the page's data fetch.
      globalThis.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname)
    },
    [pathname, searchParams],
  )

  const revert = useCallback((sprintId: string) => {
    setOverrides((current) => {
      const next = new Map(current)
      next.delete(sprintId)
      return next
    })
  }, [])

  const write = useCallback(
    (sprint: Sprint, range: SprintRange) => {
      /*
       * Any debounced nudge still queued for this sprint is now stale and
       * must not fire.
       *
       * Every caller computes `range` from `committedRange`, which already
       * INCLUDES the pending nudge's optimistic range — so the write about to
       * go out is a strict superset of the one being dropped, and nothing is
       * lost. Without this, nudging a bar with the arrow keys and then
       * dragging it inside the 400ms window sent the drag first and the older
       * keyboard range 400ms later, silently undoing the drag with no error
       * and no way to tell what had happened.
       */
      const stale = pendingWrites.current.get(sprint.id)
      if (stale) {
        clearTimeout(stale.timer)
        pendingWrites.current.delete(sprint.id)
      }

      startTransition(async () => {
        try {
          const res = await updateSprint(sprint.id, range)
          if (!res.ok) {
            revert(sprint.id)
            toast.error(res.error)
            return
          }
        } catch {
          // updateSprint can reject outright (a DB outage), not only resolve
          // with `{ ok: false }`. Without this the bar would sit at its new
          // dates forever with nothing written and nothing said.
          revert(sprint.id)
          toast.error('Could not save those dates — the sprint snapped back')
        }
      })
    },
    [revert],
  )

  /** Paints immediately, writes once the nudges stop. */
  const scheduleWrite = useCallback(
    (sprint: Sprint, range: SprintRange) => {
      setOverrides((current) => new Map(current).set(sprint.id, range))
      const pending = pendingWrites.current
      const inFlight = pending.get(sprint.id)
      // One pending write per sprint: holding an arrow key must collapse into
      // a single request for the range it finally settles on, not one per
      // key repeat.
      if (inFlight) clearTimeout(inFlight.timer)
      pending.set(sprint.id, {
        range,
        timer: setTimeout(() => {
          pending.delete(sprint.id)
          write(sprint, range)
        }, KEY_COMMIT_DELAY_MS),
      })
    },
    [write],
  )

  /**
   * Opens the edit dialog on the dates the user can currently SEE.
   *
   * Two things go wrong if the raw `sprint` row is handed straight to the
   * dialog. It carries the server's dates, so dragging a bar and immediately
   * pressing enter on it opened a form showing the old range — and saving
   * that form would have written the old range back. And a debounced keyboard
   * nudge would still be queued, so it would land AFTER the dialog's save and
   * quietly undo it. Flushing the nudge now (rather than cancelling it) means
   * the stored dates and the dates in the form are the same thing before a
   * single field is touched, whether the person goes on to save or cancel.
   */
  const openEditor = useCallback(
    (sprint: Sprint) => {
      const range = committedRange(sprint)
      if (pendingWrites.current.has(sprint.id)) write(sprint, range)
      setEditing({ ...sprint, ...range })
    },
    [committedRange, write],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE } }),
  )

  const byId = useMemo(() => new Map(sprints.map((sprint) => [sprint.id, sprint])), [sprints])

  const announcements = useMemo<Announcements>(() => {
    const describe = (id: string) => {
      const parsed = parseDragId(id)
      const sprint = parsed ? byId.get(parsed.sprintId) : undefined
      if (!sprint || !parsed) return { name: 'sprint', verb: 'Moving' }
      return {
        name: sprint.name,
        verb:
          parsed.kind === 'move'
            ? 'Moving'
            : parsed.kind === 'start'
              ? 'Changing the start date of'
              : 'Changing the end date of',
      }
    }
    return {
      onDragStart: ({ active }) => {
        const { name, verb } = describe(String(active.id))
        return `${verb} ${name}.`
      },
      // The timeline registers no droppables — a bar's new dates come from
      // how far it travelled, not from what it landed on — so there is never
      // an "over" target to announce. The final dates are read out on drop.
      onDragOver: () => undefined,
      // Silent on purpose. The dates that were actually committed are
      // announced from this component's own live region, which is also what
      // the keyboard path uses — two live regions racing to describe the
      // same drop would either double-speak or contradict each other.
      onDragEnd: () => undefined,
      onDragCancel: ({ active }) => {
        const { name } = describe(String(active.id))
        return `Cancelled. ${name} keeps its dates.`
      },
    }
  }, [byId])

  function handleDragStart(event: DragStartEvent) {
    const parsed = parseDragId(String(event.active.id))
    if (!parsed) return
    setActiveDrag({ ...parsed, deltaDays: 0 })
  }

  function handleDragMove(event: DragMoveEvent) {
    const days = snapDays(event.delta.x, zoom)
    // Only re-render when the SNAPPED day changes — at 26px/day that is one
    // render per day crossed instead of one per pointer event.
    setActiveDrag((current) =>
      current && current.deltaDays !== days ? { ...current, deltaDays: days } : current,
    )
  }

  function handleDragEnd(event: DragEndEvent) {
    const parsed = parseDragId(String(event.active.id))
    const days = snapDays(event.delta.x, zoom)
    setActiveDrag(null)
    if (!parsed || days === 0) return

    const sprint = byId.get(parsed.sprintId)
    if (!sprint) return

    const range = committedRange(sprint)
    const next =
      parsed.kind === 'move'
        ? moveSprintRange(range.startDate, range.endDate, days)
        : parsed.kind === 'start'
          ? resizeSprintStart(range.startDate, range.endDate, days)
          : resizeSprintEnd(range.startDate, range.endDate, days)

    // A resize clamped against its own opposite edge can come back unchanged.
    if (next.startDate === range.startDate && next.endDate === range.endDate) return

    setOverrides((current) => new Map(current).set(sprint.id, next))
    setLiveMessage(`${sprint.name} now runs ${formatRange(next)}.`)
    write(sprint, next)
  }

  /**
   * The keyboard equivalent of every drag this timeline offers.
   *
   * There is no modifier soup: each control adjusts the one thing it is
   * named for. Arrow keys on the bar move the whole sprint; arrow keys on
   * the start handle move the start; arrow keys on the end handle move the
   * end. Shift multiplies by a week. Every change is spoken through the live
   * region below the timeline.
   */
  function nudge(sprint: Sprint, kind: DragKind, event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const step = (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 7 : 1)
    const range = committedRange(sprint)
    const next =
      kind === 'move'
        ? moveSprintRange(range.startDate, range.endDate, step)
        : kind === 'start'
          ? resizeSprintStart(range.startDate, range.endDate, step)
          : resizeSprintEnd(range.startDate, range.endDate, step)

    if (next.startDate === range.startDate && next.endDate === range.endDate) {
      setLiveMessage(`${sprint.name} cannot be shortened any further.`)
      return
    }
    setLiveMessage(`${sprint.name} now runs ${formatRange(next)}.`)
    scheduleWrite(sprint, next)
  }

  /*
   * Open on today, not on the padded left edge of history.
   *
   * The axis starts weeks or months before the earliest sprint so bars have
   * somewhere to be dragged; without this the roadmap would load looking at
   * empty space from a quarter ago. Re-runs on a zoom change because the
   * pixel position of today changes with the scale, and is keyed on the zoom
   * so it never yanks the view back while someone is scrolling around.
   */
  const scrolledForZoom = useRef<Zoom | null>(null)
  useEffect(() => {
    const container = scrollRef.current
    if (!container || scrolledForZoom.current === zoom) return
    scrolledForZoom.current = zoom
    container.scrollLeft = Math.max(0, todayLeft - container.clientWidth / 3)
  }, [zoom, todayLeft])

  function focusSprint(sprintId: string) {
    const sprint = byId.get(sprintId)
    const container = scrollRef.current
    if (!sprint || !container) return
    const geometry = barGeometry({ id: sprint.id, ...committedRange(sprint) }, axis, zoom)
    container.scrollTo({
      // Land the bar a third of the way in rather than hard against the left
      // edge, so its neighbours stay visible for context.
      left: Math.max(0, geometry.left - container.clientWidth / 3),
      behavior: 'smooth',
    })
  }

  if (sprints.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <p className="font-heading text-base font-semibold">No sprints to map yet.</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Once sprints exist, LogPup will chart them here — and you&apos;ll be able to drag them
          around to reschedule.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-heading text-lg leading-none font-semibold">Roadmap</h2>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {ordered.length} {ordered.length === 1 ? 'sprint' : 'sprints'} · {totalRows}{' '}
            {totalRows === 1 ? 'track' : 'tracks'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {(Object.keys(STATUS_LABEL) as Sprint['status'][]).map((status) => (
              <span key={status} className="inline-flex items-center gap-1.5">
                <span aria-hidden className={cn('size-2 rounded-full', STATUS_BAR[status])} />
                {STATUS_LABEL[status]}
              </span>
            ))}
          </div>
          <div
            role="group"
            aria-label="Timeline scale"
            className="flex items-center gap-0.5 rounded-lg border p-0.5"
          >
            {ZOOM_LEVELS.map((level) => (
              <Button
                key={level}
                type="button"
                size="sm"
                variant={zoom === level ? 'default' : 'ghost'}
                aria-pressed={zoom === level}
                className="h-7 px-2.5"
                onClick={() => setZoom(level)}
              >
                {ZOOM_LABEL[level]}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {isAdmin
          ? 'Drag a bar to move a sprint, or drag either edge to change its start or end — everything snaps to whole days. With a keyboard: tab to a bar and use ← →  to move it, or tab to its start/end handle to change that date. Hold shift for a week at a time. Press enter on a bar to edit everything at once.'
          : 'Select a sprint to open its board. Only admins can reschedule sprints.'}
      </p>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDrag(null)}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              'Sprint bars are dragged with a mouse or by touch. To change a sprint’s dates with the keyboard, focus its bar or one of its date handles and use the left and right arrow keys.',
          },
        }}
      >
        <div ref={scrollRef} className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
          <div
            // The width MUST be explicit. Every child here is absolutely
            // positioned, so they contribute nothing to intrinsic width — a
            // `w-max` container would collapse and the timeline would never
            // scroll past the viewport, silently hiding most of the axis.
            className="relative min-w-full"
            style={{
              width: timelineWidth,
              height: HEADER_HEIGHT + totalRows * ROW_HEIGHT + 8,
            }}
          >
            {/* Ruler + gridlines. One element per tick doing both jobs. */}
            <div aria-hidden className="absolute inset-0 flex" style={{ width: timelineWidth }}>
              {ticks.map((tick) => (
                <div
                  key={tick.key}
                  className="absolute inset-y-0 border-l border-border/60"
                  style={{ left: tick.leftDays * pxPerDay, width: tick.days * pxPerDay }}
                >
                  <span className="block truncate px-1.5 py-2 font-mono text-2xs text-muted-foreground">
                    {tick.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Today. Above the gridlines, below the bars — a marker that
                covers the thing it is marking is worse than none. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 z-10 w-px bg-chart-1"
              style={{ left: todayLeft }}
            >
              <span className="absolute top-1 left-1 whitespace-nowrap rounded-sm border border-chart-1 bg-card px-1 py-px font-mono text-2xs text-foreground">
                Today
              </span>
            </div>

            <ul className="absolute inset-x-0 z-20 list-none" style={{ top: HEADER_HEIGHT }}>
              {ordered.map((sprint) => (
                <SprintBar
                  key={sprint.id}
                  sprint={sprint}
                  range={previewRange(sprint)}
                  row={rows.get(sprint.id) ?? 0}
                  axis={axis}
                  zoom={zoom}
                  slug={slug}
                  isAdmin={isAdmin}
                  isDragging={activeDrag?.sprintId === sprint.id}
                  onEdit={openEditor}
                  onNudge={nudge}
                />
              ))}
            </ul>
          </div>
        </div>
      </DndContext>

      {/* Keyboard nudges happen outside dnd-kit, so they need their own live
          region — dnd-kit only announces what its own sensors did. */}
      <p aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      {/*
        Every sprint, in one scannable list.
        A packed timeline puts names inside bars, and a two-day sprint at
        quarter zoom is nine pixels wide — legible as a mark, useless as a
        label. This is the index: it names every sprint regardless of scale,
        and gets you to one that is scrolled far off screen.
      */}
      <div className="rounded-xl border">
        <h3 className="border-b px-3 py-2 font-heading text-sm font-semibold">Every sprint</h3>
        <ul className="divide-y divide-border/60">
          {ordered.map((sprint) => {
            const range = committedRange(sprint)
            return (
              <li
                key={sprint.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
              >
                <span className="inline-flex shrink-0 items-center gap-1.5">
                  <span aria-hidden className={cn('size-2 rounded-full', STATUS_BAR[sprint.status])} />
                  <span className="sr-only">{STATUS_LABEL[sprint.status]}: </span>
                  <span className="font-medium">{sprint.name}</span>
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {formatRange(range)}
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {inclusiveDayCount(range.startDate, range.endDate)}d
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => focusSprint(sprint.id)}
                  >
                    Find on timeline
                  </Button>
                  {isAdmin ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openEditor(sprint)}
                    >
                      Edit
                    </Button>
                  ) : null}
                  <Link
                    href={`/apps/${slug}?sprint=${sprint.id}&tab=board`}
                    className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                  >
                    Board
                  </Link>
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      <SprintEditDialog
        sprint={editing}
        slug={slug}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      />
    </div>
  )
}

function SprintBar({
  sprint,
  range,
  row,
  axis,
  zoom,
  slug,
  isAdmin,
  isDragging,
  onEdit,
  onNudge,
}: {
  sprint: Sprint
  range: SprintRange
  row: number
  axis: TimelineWindow
  zoom: Zoom
  slug: string
  isAdmin: boolean
  isDragging: boolean
  onEdit: (sprint: Sprint) => void
  onNudge: (sprint: Sprint, kind: DragKind, event: KeyboardEvent) => void
}) {
  const geometry = barGeometry({ id: sprint.id, ...range }, axis, zoom)
  const label = `${sprint.name}, ${formatRange(range)}, ${STATUS_LABEL[sprint.status]}`

  return (
    <li
      className="absolute"
      style={{
        top: row * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2,
        left: geometry.left,
        // Floored well above the inset so a one-day sprint at quarter zoom
        // (3px) stays a visible, grabbable mark rather than disappearing.
        width: Math.max(geometry.width - BAR_INSET_PX, 8),
        height: BAR_HEIGHT,
      }}
    >
      <div
        className={cn(
          'group/bar relative flex h-full items-center rounded-md ring-1 ring-inset ring-foreground/10',
          STATUS_BAR[sprint.status],
          // No transition while dragging: the bar must track the pointer, and
          // a width transition on a resize looks like lag, not polish.
          !isDragging && 'transition-[left,width] duration-150 motion-reduce:transition-none',
          isDragging && 'z-10 shadow-md',
        )}
      >
        {isAdmin ? (
          <ResizeHandle sprint={sprint} range={range} kind="start" onNudge={onNudge} />
        ) : null}

        {isAdmin ? (
          <BarBody sprint={sprint} label={label} onEdit={onEdit} onNudge={onNudge} />
        ) : (
          <Link
            href={`/apps/${slug}?sprint=${sprint.id}&tab=board`}
            aria-label={`${label}. Open board.`}
            className="flex h-full min-w-0 flex-1 items-center rounded-md px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden className="truncate text-xs font-medium">
              {sprint.name}
            </span>
          </Link>
        )}

        {isAdmin ? (
          <ResizeHandle sprint={sprint} range={range} kind="end" onNudge={onNudge} />
        ) : null}

        {/*
          The dates, while you are moving them.
          Snapping to whole days is invisible without this: the bar slides
          smoothly enough that you cannot tell which day an edge has landed
          on, especially at month and quarter zoom where a day is 8 or 3
          pixels. Positioned above the bar so the cursor never covers it, and
          aria-hidden because dnd-kit is already speaking the same thing.
        */}
        {isDragging ? (
          <span
            aria-hidden
            className="pointer-events-none absolute -top-6 left-0 whitespace-nowrap rounded-md border bg-popover px-1.5 py-0.5 font-mono text-2xs tabular-nums text-popover-foreground shadow-md"
          >
            {formatRange(range)} · {inclusiveDayCount(range.startDate, range.endDate)}d
          </span>
        ) : null}
      </div>
    </li>
  )
}

/** The bar itself: a real button, so enter opens the editor and arrow keys
 *  move the sprint. Pointer drags come from dnd-kit's listeners. */
function BarBody({
  sprint,
  label,
  onEdit,
  onNudge,
}: {
  sprint: Sprint
  label: string
  onEdit: (sprint: Sprint) => void
  onNudge: (sprint: Sprint, kind: DragKind, event: KeyboardEvent) => void
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: dragId(sprint.id, 'move') })
  // Where the pointer went down, so a drag that ends back over the bar isn't
  // also delivered as a click that opens the editor.
  const pointerStart = useRef<{ x: number; y: number } | null>(null)

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-label={`${label}. Press enter to edit, or use the arrow keys to move this sprint.`}
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
        onEdit(sprint)
      }}
      onKeyDown={(event) => {
        // Forward to dnd-kit FIRST. `{...listeners}` above spreads its keyboard
        // activator, and a bare onKeyDown here would replace it — the same trap
        // already sidestepped for onPointerDown a few lines up. Harmless while
        // only PointerSensor is registered, but it would silently kill
        // keyboard drag the moment a KeyboardSensor is added, with no error to
        // trace. Disarmed now rather than left for whoever adds one.
        listeners?.onKeyDown?.(event)
        onNudge(sprint, 'move', event)
      }}
      className="flex h-full min-w-0 flex-1 cursor-grab items-center rounded-md px-1 text-left outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span aria-hidden className="truncate text-xs font-medium">
        {sprint.name}
      </span>
    </button>
  )
}

/**
 * One edge of a sprint, as its own focusable control.
 *
 * Making the handles real buttons is what removes the modifier keys: the
 * control you are standing on decides which date the arrow keys move, so
 * there is nothing to memorise and no chance of colliding with a browser
 * shortcut. It also gives each edge its own spoken name and current value.
 */
function ResizeHandle({
  sprint,
  range,
  kind,
  onNudge,
}: {
  sprint: Sprint
  range: SprintRange
  kind: 'start' | 'end'
  onNudge: (sprint: Sprint, kind: DragKind, event: KeyboardEvent) => void
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: dragId(sprint.id, kind) })
  const iso = kind === 'start' ? range.startDate : range.endDate

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-label={`${kind === 'start' ? 'Start' : 'End'} date of ${sprint.name}, ${format(parseIso(iso), 'MMMM d, yyyy')}. Use the arrow keys to change it.`}
      onKeyDown={(event) => {
        // Same forwarding rule as BarBody — see the note there.
        listeners?.onKeyDown?.(event)
        onNudge(sprint, kind, event)
      }}
      className={cn(
        'h-full w-2.5 shrink-0 cursor-ew-resize rounded-md outline-none',
        'bg-foreground/0 transition-colors duration-150 motion-reduce:transition-none',
        'hover:bg-foreground/25 group-hover/bar:bg-foreground/15',
        'focus-visible:bg-foreground/25 focus-visible:ring-2 focus-visible:ring-ring',
      )}
    />
  )
}
