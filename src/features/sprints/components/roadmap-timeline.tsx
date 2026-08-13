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
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
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
import { GripVertical } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { DragSurface, buildDragAnnouncements } from '@/components/shared/drag-surface'
import { cn } from '@/lib/utils'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { SORT_GAP, sortOrderForIndex } from '@/lib/sort-order'
import { reorderSprint, resortSprintsByDate, updateSprint } from '@/features/sprints/actions'
import { dropIndexIn } from '@/features/sprints/board-view'
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
  /** The same explicit-overlay contract as `overrides`, for the other thing
   *  a sprint row carries: its position in the index below. Kept apart from
   *  `overrides` because the two never interact — a reorder must not disturb
   *  a date drag, which is the entire point of a row order that is not the
   *  date order. */
  const [orderOverrides, setOrderOverrides] = useState<ReadonlyMap<string, number>>(() => new Map())
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
    // mean showing a stale local guess over a known-good answer. The row
    // order is the same bargain, and drops on the same render.
    if (overrides.size > 0) setOverrides(new Map())
    if (orderOverrides.size > 0) setOrderOverrides(new Map())
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

  /**
   * The same sprints in MANUAL row order, with any un-confirmed reorder
   * already applied. Deliberately a second list rather than a re-sort of
   * `ordered`: the bars above are laid out by date and always will be, and
   * `sprints.sortOrder` is a stored column that answers a different question
   * ("which sprint does the team read first?").
   *
   * `getSprintsForApp` already returns rows in `sortOrder` order, so with
   * nothing in flight this hands the prop straight back. The re-sort is on
   * `sortOrder` ALONE, leaning on `Array.prototype.sort` being stable, so
   * that rows sharing a sortOrder keep the server's own relative order — the
   * query orders by that one column too, and inventing a tiebreaker here
   * would make the client and the server disagree about ties.
   */
  const byRowOrder = useMemo(() => {
    if (orderOverrides.size === 0) return sprints
    return sprints
      .map((sprint) => {
        const sortOrder = orderOverrides.get(sprint.id)
        return sortOrder === undefined ? sprint : { ...sprint, sortOrder }
      })
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [sprints, orderOverrides])
  const rowOrderIds = useMemo(() => byRowOrder.map((sprint) => sprint.id), [byRowOrder])

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

  const revertOrder = useCallback((sprintId: string) => {
    setOrderOverrides((current) => {
      const next = new Map(current)
      next.delete(sprintId)
      return next
    })
  }, [])

  /**
   * Writes a row's new position.
   *
   * The grip that calls this is only shown to admins, and that is all the
   * `isAdmin` gate is: `reorderSprint` re-checks for admin itself, exactly as
   * `updateSprint` does for the dates. Hiding the control is a courtesy so
   * nobody is offered an interaction that will fail; it is not the
   * permission, and nothing here should ever be written as though it were.
   */
  const commitReorder = useCallback(
    (sprint: Sprint, sortOrder: number) => {
      setOrderOverrides((current) => new Map(current).set(sprint.id, sortOrder))
      startTransition(async () => {
        try {
          const res = await reorderSprint(sprint.id, sortOrder)
          if (!res.ok) {
            revertOrder(sprint.id)
            toast.error(res.error)
          }
        } catch {
          // Same reasoning as `write`: the action can reject outright, not
          // only resolve with `{ ok: false }`, and without this the row
          // would sit in its new place forever with nothing written.
          revertOrder(sprint.id)
          toast.error('Could not save that order — the row snapped back')
        }
      })
    },
    [revertOrder],
  )

  /**
   * Move `sprintId` to where `overId` currently sits. Returns where it landed
   * so a caller can say so out loud, or undefined when nothing changed.
   *
   * THE DIRECTION RULE IS BORROWED, NOT REWRITTEN. `dropIndexIn` is the
   * board's drop maths and already returns an index into the list with the
   * dragged row REMOVED — precisely the shape `sortOrderForIndex` wants —
   * and it is the only version of this rule with tests behind it. Writing it
   * out again here is exactly how it shipped broken the first time: a row
   * moving DOWN has already vacated its own slot, so "insert before the row
   * below" resolves to the slot it is standing in, `sortOrderForIndex`
   * returns the value already stored, the no-op guard fires, and every
   * downward drop is silently nothing while upward ones work.
   */
  const moveRow = useCallback(
    (sprintId: string, overId: string) => {
      const sprint = byRowOrder.find((row) => row.id === sprintId)
      if (!sprint) return undefined
      const index = dropIndexIn(byRowOrder, sprintId, overId)
      const neighbours = byRowOrder.filter((row) => row.id !== sprintId)
      const sortOrder = sortOrderForIndex(neighbours, index)
      // A drop that resolves to the row's own slot writes nothing, rather
      // than spending a request to store the number already stored.
      if (sortOrder === sprint.sortOrder) return undefined
      commitReorder(sprint, sortOrder)
      return { name: sprint.name, position: index + 1, total: byRowOrder.length }
    },
    [byRowOrder, commitReorder],
  )

  /**
   * The keyboard route to the same move: up/down on a focused grip, no
   * pick-up step.
   *
   * dnd-kit's own KeyboardSensor (space to lift, arrows to move, space to
   * drop) still works on that button — see the grip's own key handler for
   * how the two are kept from both acting on one press. This direct path
   * exists because the timeline above already teaches ← → as "move this
   * sprint's dates"; a reorder that demanded a lift-then-move ritual right
   * next to that would be the odd one out.
   */
  const nudgeRow = useCallback(
    (sprintId: string, direction: -1 | 1) => {
      const from = byRowOrder.findIndex((row) => row.id === sprintId)
      if (from === -1) return
      const to = from + direction
      if (to < 0 || to >= byRowOrder.length) {
        setLiveMessage(`${byRowOrder[from].name} is already ${direction === -1 ? 'first' : 'last'}.`)
        return
      }
      const landed = moveRow(sprintId, byRowOrder[to].id)
      if (landed) setLiveMessage(`${landed.name} moved to position ${landed.position} of ${landed.total}.`)
    },
    [byRowOrder, moveRow],
  )

  /**
   * Puts the row order back in step with the dates.
   *
   * Without this a manual order is a one-way door: once a few rows have been
   * dragged there is no way back to chronological short of dragging every
   * one of them. The optimistic patch reproduces `resortSprintsByDate`'s own
   * seeding — `(index + 1) * SORT_GAP` over `(startDate, id)`, the same
   * ordering the action's SQL uses — so the rows do not visibly re-settle a
   * second time when the server's answer lands.
   */
  const sortRowsByDate = useCallback(() => {
    // Read off the rows rather than taking an `appId` prop: the server shell
    // hands this component `{ sprints, slug }` and every sprint on the page
    // belongs to the same app, so there is nothing to widen.
    const appId = sprints[0]?.appId
    if (!appId) return
    const chronological = [...sprints].sort(
      (a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id),
    )
    setOrderOverrides(
      new Map(chronological.map((sprint, index) => [sprint.id, (index + 1) * SORT_GAP])),
    )
    startTransition(async () => {
      try {
        const res = await resortSprintsByDate(appId)
        if (!res.ok) {
          setOrderOverrides(new Map())
          toast.error(res.error)
        }
      } catch {
        setOrderOverrides(new Map())
        toast.error('Could not sort those sprints — the order snapped back')
      }
    })
  }, [sprints])

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

  // The reorder surface's ids are bare sprint ids, so naming one is a lookup
  // and nothing more. useCallback so the memo below depends on the function
  // rather than reaching past it to `byRowOrder` — same reasoning as the
  // announcements memo above it.
  const rowNameForId = useCallback(
    (id: string) => byRowOrder.find((row) => row.id === id)?.name ?? 'the sprint',
    [byRowOrder],
  )
  const reorderAnnouncements = useMemo(() => buildDragAnnouncements(rowNameForId), [rowNameForId])

  function handleReorderEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || over.id === active.id) return
    // Nothing is spoken from here on purpose: this drop arrived through
    // dnd-kit, whose announcements already describe it. The live region at
    // the bottom of this component is for the paths that bypass a sensor
    // entirely — the date nudges, and `nudgeRow`.
    moveRow(String(active.id), String(over.id))
  }

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
        Every sprint, in one scannable list — and the roadmap's row order.

        A packed timeline puts names inside bars, and a two-day sprint at
        quarter zoom is nine pixels wide — legible as a mark, useless as a
        label. This is the index: it names every sprint regardless of scale,
        and gets you to one that is scrolled far off screen.

        It is also the ONLY place row order can be expressed. Up in the
        timeline a "row" is a lane `packRows` assigned by date — two sprints
        that don't overlap share one — so there is no third row up there to
        drag a sprint into, and if there were, moving it would be a claim
        about its dates. Down here every sprint owns exactly one row, which
        is the thing `sprints.sortOrder` orders, and moving it changes no
        date at all.
      */}
      <div className="rounded-xl border">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b px-3 py-2">
          <h3 className="font-heading text-sm font-semibold">Every sprint</h3>
          {isAdmin ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-muted-foreground">
                Drag a grip to reorder, or focus one and use ↑ ↓. Row order is yours to set and
                changes no dates.
              </p>
              <Button type="button" size="sm" variant="outline" onClick={sortRowsByDate}>
                Sort by date
              </Button>
            </div>
          ) : null}
        </div>

        {/*
          Its own DndContext, separate from the timeline's.

          That one is horizontal by construction: a 4px PointerSensor, a
          drag-move handler that reads `delta.x` as days, and ids of the form
          `<uuid>|move`. Threading a vertical sortable through it would mean
          teaching all three of those to recognise and then ignore a fourth
          kind of drag — new branches in exactly the code that reschedules
          sprints. dnd-kit contexts are independent, so a second one is both
          cheaper and the reason the date paths are untouched by this.
        */}
        <DragSurface
          onDragEnd={handleReorderEnd}
          accessibility={{ announcements: reorderAnnouncements }}
        >
          <SortableContext items={rowOrderIds} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-border/60">
              {byRowOrder.map((sprint) => (
                <SprintIndexRow
                  key={sprint.id}
                  sprint={sprint}
                  range={committedRange(sprint)}
                  slug={slug}
                  isAdmin={isAdmin}
                  onFind={focusSprint}
                  onEdit={openEditor}
                  onNudgeRow={nudgeRow}
                />
              ))}
            </ul>
          </SortableContext>
        </DragSurface>
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
            href={`/apps/${slug}?tab=roadmap&sprint=${sprint.id}`}
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

/**
 * One row of the index, and the one control in this component that changes
 * a sprint's position rather than its dates.
 *
 * The grip is a control of its own rather than the whole row being
 * draggable. The row already holds three other targets — find, edit, board —
 * and a drag surface wrapped around them would eat the first few pixels of
 * every click on all three before deciding it was not a drag after all.
 */
function SprintIndexRow({
  sprint,
  range,
  slug,
  isAdmin,
  onFind,
  onEdit,
  onNudgeRow,
}: {
  sprint: Sprint
  range: SprintRange
  slug: string
  isAdmin: boolean
  onFind: (sprintId: string) => void
  onEdit: (sprint: Sprint) => void
  onNudgeRow: (sprintId: string, direction: -1 | 1) => void
}) {
  // Destructured at the call site, not held whole and reached into from the
  // JSX below: `setNodeRef` IS a ref setter and the result object carries
  // dnd-kit's own `node` ref beside it, so reading them during render is a
  // ref access during render — which React 19 does not forgive. Same rule,
  // for the same reason, as BarBody and ResizeHandle above.
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } =
    useSortable({ id: sprint.id, disabled: !isAdmin })

  return (
    <li
      ref={setNodeRef}
      // Only the y component is taken. This is a vertical list, and letting a
      // row wander sideways under the pointer suggests a horizontal move that
      // has no meaning here.
      style={{ transform: transform ? `translate3d(0, ${Math.round(transform.y)}px, 0)` : undefined }}
      className={cn(
        'relative flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm',
        // dnd-kit also hands back a `transition` string, and it is
        // deliberately not used: it would be an inline style, and an inline
        // transition cannot be switched off by `motion-reduce`. Expressed as
        // classes, the reduced-motion override actually wins. Suppressed
        // outright on the row being dragged, which has to track the pointer —
        // the same call the bars above make.
        !isDragging && 'transition-transform duration-150 motion-reduce:transition-none',
        isDragging && 'z-10 bg-card shadow-md',
      )}
    >
      {isAdmin ? (
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${sprint.name}. Use the up and down arrow keys.`}
          onKeyDown={(event) => {
            // Forward to dnd-kit FIRST — `{...listeners}` above spreads its
            // keyboard activator and a bare onKeyDown here would replace it.
            // Same trap, same fix, as BarBody.
            listeners?.onKeyDown?.(event)
            // While the row is LIFTED, the arrows belong to dnd-kit's
            // KeyboardSensor, which is moving a preview and will report the
            // result through onDragEnd. Acting on them here as well would
            // commit one write per keypress underneath that, and then a
            // second, contradictory one on the drop.
            if (isDragging) return
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
            event.preventDefault()
            onNudgeRow(sprint.id, event.key === 'ArrowUp' ? -1 : 1)
          }}
          className={cn(
            'shrink-0 cursor-grab touch-none rounded-sm text-muted-foreground/60 outline-none',
            'transition-colors duration-150 motion-reduce:transition-none',
            'hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
            'active:cursor-grabbing',
          )}
        >
          <GripVertical aria-hidden className="size-3.5" />
        </button>
      ) : null}
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
        <Button type="button" size="sm" variant="ghost" onClick={() => onFind(sprint.id)}>
          Find on timeline
        </Button>
        {isAdmin ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onEdit(sprint)}>
            Edit
          </Button>
        ) : null}
        <Link
          href={`/apps/${slug}?tab=roadmap&sprint=${sprint.id}`}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
        >
          Board
        </Link>
      </span>
    </li>
  )
}
