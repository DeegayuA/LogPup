'use client'

import {
  useCallback,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  DragOverlay,
  useDraggable,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type Modifier,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import {
  differenceInCalendarDays,
  eachMonthOfInterval,
  endOfMonth,
  format,
  getDaysInMonth,
  startOfMonth,
} from 'date-fns'
import { toast } from 'sonner'
import { GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DragSurface, buildDragAnnouncements } from '@/components/shared/drag-surface'
import { InlineRename } from '@/components/shared/inline-rename'
import { CardQuickMenu, type QuickMenuItem } from '@/components/shared/card-quick-menu'
import { SprintEditDialog } from '@/features/sprints/components/sprint-edit-dialog'
import { sortOrderForIndex } from '@/lib/sort-order'
import { cn } from '@/lib/utils'
import { PX_PER_DAY, daysFromOffset, resizeEnd, resizeStart, shiftRange } from '@/features/sprints/roadmap-geometry'
import {
  deleteSprint,
  renameSprint,
  reorderSprint,
  resortSprintsByDate,
  updateSprintDates,
  updateSprintStatus,
} from '@/features/sprints/actions'
import type { Sprint } from '@/features/sprints/queries'

const LABEL_WIDTH = 224
const ROW_HEIGHT = 56
const NUDGE_DEBOUNCE_MS = 400

// Id suffixes disambiguate the bar's three independent drag surfaces from
// the reorder grip's bare sprint id (a plain `useSortable({id: sprintId})`
// for the grip and a plain `useDraggable({id: sprintId})` for the bar would
// collide — dnd-kit keys its draggable registry by id, one registration per
// id per DndContext).
const SHIFT_SUFFIX = ':shift'
const START_SUFFIX = ':start'
const END_SUFFIX = ':end'

/* Planned gets a hollow dashed treatment so planned vs active is never
   color-only (the two pine tones are nearly identical). */
const STATUS_COLOR: Record<Sprint['status'], string> = {
  planned: 'border border-dashed border-chart-2 bg-chart-2/25',
  active: 'bg-primary',
  done: 'bg-muted-foreground/40',
}

const STATUS_LABEL: Record<Sprint['status'], string> = {
  planned: 'Planned',
  active: 'Active',
  done: 'Done',
}
const STATUS_ORDER: Sprint['status'][] = ['planned', 'active', 'done']

// Plain YYYY-MM-DD strings from the `date` column must not be handed to
// `new Date()` directly — that parses as UTC midnight and can shift a day in
// negative-offset timezones. Anchoring to local noon keeps the date stable.
function parseSprintDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`)
}

function formatRange(start: Date, end: Date): string {
  const startPattern = start.getFullYear() === end.getFullYear() ? 'MMM d' : 'MMM d, yyyy'
  return `${format(start, startPattern)} – ${format(end, 'MMM d, yyyy')}`
}

type RoadmapPatch =
  | { type: 'dates'; sprintId: string; startDate: string; endDate: string }
  | { type: 'rename'; sprintId: string; name: string }
  | { type: 'status'; sprintId: string; status: Sprint['status'] }
  | { type: 'reorder'; sprintId: string; sortOrder: number }
  | { type: 'resort' }
  | { type: 'delete'; sprintId: string }

function applyPatch(rows: Sprint[], patch: RoadmapPatch): Sprint[] {
  switch (patch.type) {
    case 'dates':
      return rows.map((s) =>
        s.id === patch.sprintId ? { ...s, startDate: patch.startDate, endDate: patch.endDate } : s,
      )
    case 'rename':
      return rows.map((s) => (s.id === patch.sprintId ? { ...s, name: patch.name } : s))
    case 'status':
      return rows.map((s) => (s.id === patch.sprintId ? { ...s, status: patch.status } : s))
    case 'reorder': {
      const moved = rows.find((s) => s.id === patch.sprintId)
      if (!moved) return rows
      const rest = rows.filter((s) => s.id !== patch.sprintId)
      const updated = { ...moved, sortOrder: patch.sortOrder }
      return [...rest, updated].sort((a, b) => a.sortOrder - b.sortOrder)
    }
    case 'resort':
      // Visual-only re-sort by date, mirroring what `resortSprintsByDate`
      // does server-side — the real sortOrder values sync in on the next
      // revalidated render; this just avoids a flash of the OLD order while
      // that round trip is in flight.
      return [...rows].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id))
    case 'delete':
      return rows.filter((s) => s.id !== patch.sprintId)
  }
}

/** Same "what sortOrder does dropping HERE produce" math the pointer drag
 *  and the keyboard reorder nudge both need — `overId` is the id of
 *  whichever sprint is currently occupying the target slot (from `over.id`
 *  for a pointer drop, or synthesized from `rows[targetIndex]` for a
 *  keyboard nudge). Returns null when nothing would actually change. */
function computeReorderSortOrder(rows: Sprint[], sprintId: string, overId: string): number | null {
  const dragged = rows.find((s) => s.id === sprintId)
  if (!dragged) return null
  const neighbors = rows.filter((s) => s.id !== sprintId)
  const overIndex = neighbors.findIndex((s) => s.id === overId)
  const targetIndex = overIndex === -1 ? neighbors.length : overIndex
  const sortOrder = sortOrderForIndex(neighbors, targetIndex)
  return dragged.sortOrder === sortOrder ? null : sortOrder
}

function idKind(id: string): 'shift' | 'start' | 'end' | 'reorder' {
  if (id.endsWith(SHIFT_SUFFIX)) return 'shift'
  if (id.endsWith(START_SUFFIX)) return 'start'
  if (id.endsWith(END_SUFFIX)) return 'end'
  return 'reorder'
}

function sprintIdFromDragId(id: string): string {
  const kind = idKind(id)
  return kind === 'reorder' ? id : id.slice(0, id.length - (kind === 'shift' ? SHIFT_SUFFIX : kind === 'start' ? START_SUFFIX : END_SUFFIX).length)
}

/** Horizontal-only lock for the bar body and its two edge handles; the
 *  reorder grip (bare sprint id) is left alone — a normal 2D sortable-drag
 *  follow, same as the board's task cards. */
const roadmapModifier: Modifier = ({ transform, active }) => {
  const id = active ? String(active.id) : ''
  if (idKind(id) !== 'reorder') return { ...transform, y: 0 }
  return transform
}

export function Roadmap({
  sprints,
  slug,
  appId,
  isAdmin,
}: {
  sprints: Sprint[]
  slug: string
  appId: string
  isAdmin: boolean
}) {
  const router = useRouter()
  // Same contract as board.tsx: `rows` reverts to the real `sprints` prop
  // automatically once each mutation's transition settles, UNLESS
  // `router.refresh()` has already landed a fresh `sprints` reflecting the
  // change — no manual rollback bookkeeping needed either way.
  const [rows, applyOptimisticPatch] = useOptimistic(sprints, applyPatch)
  const [, startTransition] = useTransition()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dragDeltaX, setDragDeltaX] = useState(0)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null)

  const reorderPending = useRef<{ sprintId: string; targetIndex: number } | null>(null)

  function commitDates(sprintId: string, startDate: string, endDate: string) {
    startTransition(async () => {
      applyOptimisticPatch({ type: 'dates', sprintId, startDate, endDate })
      try {
        const res = await updateSprintDates(sprintId, startDate, endDate)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  function commitReorder(sprintId: string, sortOrder: number) {
    startTransition(async () => {
      applyOptimisticPatch({ type: 'reorder', sprintId, sortOrder })
      try {
        const res = await reorderSprint(sprintId, sortOrder)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      } finally {
        // Once this specific reorder has settled (either way), a later,
        // unrelated Alt+Up/Down press should re-derive its starting index
        // from the current `rows` rather than an old remembered target —
        // otherwise a press long after a completed reorder could drift.
        if (reorderPending.current?.sprintId === sprintId) reorderPending.current = null
      }
    })
  }

  function commitRename(sprintId: string, name: string) {
    startTransition(async () => {
      applyOptimisticPatch({ type: 'rename', sprintId, name })
      try {
        const res = await renameSprint(sprintId, name)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Sprint renamed')
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  function commitStatus(sprintId: string, status: Sprint['status']) {
    startTransition(async () => {
      applyOptimisticPatch({ type: 'status', sprintId, status })
      try {
        const res = await updateSprintStatus(sprintId, status)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(`Marked ${STATUS_LABEL[status].toLowerCase()}`)
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  function commitDelete(sprintId: string) {
    startTransition(async () => {
      applyOptimisticPatch({ type: 'delete', sprintId })
      try {
        const res = await deleteSprint(sprintId)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Sprint deleted')
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  function handleSortByDate() {
    startTransition(async () => {
      applyOptimisticPatch({ type: 'resort' })
      try {
        const res = await resortSprintsByDate(appId)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Sorted by date')
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  /** Alt+Up/Down on a bar, and the reorder grip's pointer drop, both funnel
   *  through here — `overId` is the id of whichever sprint the dragged one
   *  should land in front of. */
  function nudgeReorder(sprintId: string, direction: 1 | -1) {
    const baseIndex =
      reorderPending.current?.sprintId === sprintId
        ? reorderPending.current.targetIndex
        : rows.findIndex((s) => s.id === sprintId)
    if (baseIndex === -1) return
    const targetIndex = Math.min(Math.max(baseIndex + direction, 0), rows.length - 1)
    if (targetIndex === baseIndex) return
    reorderPending.current = { sprintId, targetIndex }
    const overId = rows[targetIndex]?.id
    if (!overId) return
    const sortOrder = computeReorderSortOrder(rows, sprintId, overId)
    if (sortOrder === null) return
    commitReorder(sprintId, sortOrder)
  }

  // useCallback so the memo below can depend on the function itself rather
  // than reaching past it to what it closes over. Identity changes exactly
  // when `rows` does, so `announcements` is rebuilt on precisely the same
  // renders as the previous `[rows]` dependency — this is the dependency the
  // memo always had, now stated honestly instead of by proxy.
  const nameForId = useCallback(
    (id: string): string => {
      const sprintId = sprintIdFromDragId(id)
      return rows.find((s) => s.id === sprintId)?.name ?? 'the sprint'
    },
    [rows],
  )
  const announcements = useMemo(() => buildDragAnnouncements(nameForId), [nameForId])

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
    setDragDeltaX(0)
  }

  function handleDragMove(event: DragMoveEvent) {
    setDragDeltaX(event.delta.x)
  }

  function handleDragCancel() {
    setActiveId(null)
    setDragDeltaX(0)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    setDragDeltaX(0)
    const { active, over, delta } = event
    const id = String(active.id)
    const kind = idKind(id)

    if (kind !== 'reorder') {
      const days = daysFromOffset(delta.x)
      if (days === 0) return
      const sprintId = sprintIdFromDragId(id)
      const sprint = rows.find((s) => s.id === sprintId)
      if (!sprint) return
      if (kind === 'shift') {
        const next = shiftRange(sprint.startDate, sprint.endDate, days)
        commitDates(sprintId, next.start, next.end)
      } else if (kind === 'start') {
        commitDates(sprintId, resizeStart(sprint.startDate, sprint.endDate, days), sprint.endDate)
      } else {
        commitDates(sprintId, sprint.startDate, resizeEnd(sprint.startDate, sprint.endDate, days))
      }
      return
    }

    if (!over || over.id === active.id) return
    const sortOrder = computeReorderSortOrder(rows, id, String(over.id))
    if (sortOrder === null) return
    commitReorder(id, sortOrder)
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <p className="font-heading text-base font-semibold">No sprints to map yet.</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Once sprints exist, LogPup will chart them here on a timeline.
        </p>
      </div>
    )
  }

  const lastEnd = rows.reduce((max, sprint) => (sprint.endDate > max ? sprint.endDate : max), rows[0].endDate)
  const firstStart = rows.reduce(
    (min, sprint) => (sprint.startDate < min ? sprint.startDate : min),
    rows[0].startDate,
  )
  const timelineStart = startOfMonth(parseSprintDate(firstStart))
  const timelineEnd = endOfMonth(parseSprintDate(lastEnd))
  const months = eachMonthOfInterval({ start: timelineStart, end: timelineEnd })
  const totalDays = differenceInCalendarDays(timelineEnd, timelineStart) + 1
  const timelineWidth = totalDays * PX_PER_DAY

  const todayOffset = differenceInCalendarDays(new Date(), timelineStart)
  const showToday = todayOffset >= 0 && todayOffset < totalDays
  const todayLeft = LABEL_WIDTH + (todayOffset + 0.5) * PX_PER_DAY

  const activeSprintId = activeId ? sprintIdFromDragId(activeId) : null
  const activeSprint = activeSprintId ? rows.find((s) => s.id === activeSprintId) : undefined
  const activeKind = activeId ? idKind(activeId) : null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>
          <span className="font-mono">{rows.length}</span> {rows.length === 1 ? 'sprint' : 'sprints'}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          {(Object.keys(STATUS_LABEL) as Sprint['status'][]).map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span aria-hidden className={cn('size-2 rounded-full', STATUS_COLOR[status])} />
              {STATUS_LABEL[status]}
            </span>
          ))}
          {isAdmin ? (
            <Button variant="outline" size="xs" type="button" onClick={handleSortByDate}>
              Sort by date
            </Button>
          ) : null}
        </div>
      </div>

      {/* Says out loud what the roadmap offers, and names the honest
          keyboard route — resize has none; it goes through the dialog. */}
      <p className="text-xs text-muted-foreground">
        {isAdmin
          ? 'Drag a bar to move it, or its edges to resize. Grip a row to reorder it. Focus a bar: Left/Right shifts a day, Shift+Left/Right a week, Alt+Up/Down reorders. Resizing has no keyboard route — use Edit dates from the row menu instead.'
          : 'Select a sprint to open its board.'}
      </p>

      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="relative w-max min-w-full">
          {/* Month gridlines, behind everything. */}
          <div aria-hidden className="pointer-events-none absolute inset-y-0 z-0 flex" style={{ left: LABEL_WIDTH }}>
            {months.map((month) => (
              <div
                key={month.toISOString()}
                className="h-full border-r border-border/60"
                style={{ width: getDaysInMonth(month) * PX_PER_DAY }}
              />
            ))}
          </div>

          {/* Header: sticky label cell + proportional month columns. */}
          <div className="relative z-10 flex border-b border-border">
            <div
              className="sticky left-0 z-30 shrink-0 border-r border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground"
              style={{ width: LABEL_WIDTH }}
            >
              Sprint
            </div>
            <div className="flex" style={{ width: timelineWidth }}>
              {months.map((month, index) => (
                <div
                  key={month.toISOString()}
                  className="shrink-0 px-2 py-2 font-mono text-2xs text-muted-foreground"
                  style={{ width: getDaysInMonth(month) * PX_PER_DAY }}
                >
                  {format(month, index === 0 || month.getMonth() === 0 ? 'MMM yyyy' : 'MMM')}
                </div>
              ))}
            </div>
          </div>

          <DragSurface
            modifiers={[roadmapModifier]}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
            accessibility={{ announcements }}
          >
            <SortableContext items={rows.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="relative z-10 divide-y divide-border/60">
                {rows.map((sprint) => (
                  <RoadmapRow
                    key={sprint.id}
                    sprint={sprint}
                    slug={slug}
                    isAdmin={isAdmin}
                    timelineStart={timelineStart}
                    timelineWidth={timelineWidth}
                    menuOpen={menuOpenId === sprint.id}
                    onMenuOpenChange={(open) => setMenuOpenId(open ? sprint.id : null)}
                    onCommitDates={commitDates}
                    onNudgeReorder={nudgeReorder}
                    onRename={commitRename}
                    onOpenEdit={() => setEditingSprint(sprint)}
                    onStatusChange={commitStatus}
                    onDelete={() => commitDelete(sprint.id)}
                  />
                ))}
              </div>
            </SortableContext>

            {/* Portalled to the body: the roadmap's own wrapper is
                `overflow-x-auto`, so a bar dragged far right would otherwise
                clip at the scroller edge instead of following the pointer. */}
            <DragOverlay dropAnimation={null}>
              {activeSprint && activeKind ? (
                <RoadmapDragPreview sprint={activeSprint} kind={activeKind} deltaX={dragDeltaX} />
              ) : null}
            </DragOverlay>
          </DragSurface>

          {/* Today marker, above bars but below the sticky label column. */}
          {showToday ? (
            <div aria-hidden className="pointer-events-none absolute inset-y-0 z-20 w-px bg-chart-1" style={{ left: todayLeft }}>
              <span className="absolute top-1 left-1 whitespace-nowrap rounded-sm border border-chart-1 bg-card px-1 py-px font-mono text-2xs text-foreground">
                Today
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <SprintEditDialog sprint={editingSprint} onOpenChange={(open) => !open && setEditingSprint(null)} />
    </div>
  )
}

/** The floating pill on the drag overlay — a live preview of exactly what
 *  will be saved, computed the same way the drop handler computes it. */
function RoadmapDragPreview({
  sprint,
  kind,
  deltaX,
}: {
  sprint: Sprint
  kind: 'shift' | 'start' | 'end' | 'reorder'
  deltaX: number
}) {
  if (kind === 'reorder') {
    return (
      <div className="rounded-md bg-popover px-2 py-1 text-xs font-medium shadow-md ring-1 ring-foreground/10">
        {sprint.name}
      </div>
    )
  }

  const days = daysFromOffset(deltaX)
  let start = sprint.startDate
  let end = sprint.endDate
  if (kind === 'shift') {
    const next = shiftRange(sprint.startDate, sprint.endDate, days)
    start = next.start
    end = next.end
  } else if (kind === 'start') {
    start = resizeStart(sprint.startDate, sprint.endDate, days)
  } else {
    end = resizeEnd(sprint.startDate, sprint.endDate, days)
  }

  return (
    <div className="rounded-md bg-popover px-2 py-1 text-xs font-medium tabular-nums shadow-md ring-1 ring-foreground/10">
      {formatRange(parseSprintDate(start), parseSprintDate(end))}
    </div>
  )
}

function RoadmapRow({
  sprint,
  slug,
  isAdmin,
  timelineStart,
  timelineWidth,
  menuOpen,
  onMenuOpenChange,
  onCommitDates,
  onNudgeReorder,
  onRename,
  onOpenEdit,
  onStatusChange,
  onDelete,
}: {
  sprint: Sprint
  slug: string
  isAdmin: boolean
  timelineStart: Date
  timelineWidth: number
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
  onCommitDates: (sprintId: string, startDate: string, endDate: string) => void
  onNudgeReorder: (sprintId: string, direction: 1 | -1) => void
  onRename: (sprintId: string, name: string) => void
  onOpenEdit: () => void
  onStatusChange: (sprintId: string, status: Sprint['status']) => void
  onDelete: () => void
}) {
  // A plain (non-optimistic) local override for the duration of a debounced
  // keyboard nudge: the parent's real commit only fires 400ms after the
  // LAST keypress, but the bar should visibly move on every single one.
  // Plain `useState` (not `useOptimistic`) deliberately — an optimistic
  // update only stays visible for the life of the transition that set it,
  // and this preview has no async work of its own to keep it pending across
  // that whole debounce window.
  const [pending, setPending] = useState<{ start: string; end: string } | null>(null)
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const effectiveStart = pending?.start ?? sprint.startDate
  const effectiveEnd = pending?.end ?? sprint.endDate

  function nudgeDate(days: number) {
    const next = shiftRange(pending?.start ?? sprint.startDate, pending?.end ?? sprint.endDate, days)
    setPending(next)
    if (pendingTimer.current) clearTimeout(pendingTimer.current)
    pendingTimer.current = setTimeout(() => {
      onCommitDates(sprint.id, next.start, next.end)
      setPending(null)
    }, NUDGE_DEBOUNCE_MS)
  }

  const {
    attributes: gripAttributes,
    listeners: gripListeners,
    setNodeRef,
    setActivatorNodeRef,
    transform: rowTransform,
    transition: rowTransition,
    isDragging: isReordering,
  } = useSortable({ id: sprint.id, disabled: !isAdmin })

  // Destructured at the call site, exactly like the useSortable above.
  // Holding the whole hook result and reaching into it from the JSX reads, to
  // the compiler and to anyone else, as touching a ref container mid-render —
  // `setNodeRef` IS a ref setter and the result object carries dnd-kit's own
  // `node` ref alongside it. Naming what we need up front keeps the render
  // body free of that, and is what the sortable in this same component does.
  const {
    setNodeRef: setShiftNodeRef,
    attributes: shiftAttributes,
    listeners: shiftListeners,
    transform: shiftTransform,
  } = useDraggable({ id: `${sprint.id}${SHIFT_SUFFIX}`, disabled: !isAdmin })
  const {
    setNodeRef: setStartNodeRef,
    listeners: startListeners,
    transform: startTransform,
  } = useDraggable({ id: `${sprint.id}${START_SUFFIX}`, disabled: !isAdmin })
  const {
    setNodeRef: setEndNodeRef,
    listeners: endListeners,
    transform: endTransform,
  } = useDraggable({ id: `${sprint.id}${END_SUFFIX}`, disabled: !isAdmin })

  const rowStyle = {
    transform: rowTransform ? `translate3d(0, ${rowTransform.y}px, 0)` : undefined,
    transition: rowTransition,
  }

  const start = parseSprintDate(effectiveStart)
  const end = parseSprintDate(effectiveEnd)
  const barLeft = differenceInCalendarDays(start, timelineStart) * PX_PER_DAY
  const barWidth = Math.max((differenceInCalendarDays(end, start) + 1) * PX_PER_DAY, PX_PER_DAY * 2)

  const barTranslateX = shiftTransform?.x ?? 0
  const startTranslateX = startTransform?.x ?? 0
  const endTranslateX = endTransform?.x ?? 0

  function handleBarKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!isAdmin) return
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const direction = event.key === 'ArrowLeft' ? -1 : 1
      nudgeDate(event.shiftKey ? direction * 7 : direction)
    } else if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault()
      onNudgeReorder(sprint.id, event.key === 'ArrowUp' ? -1 : 1)
    }
  }

  const menuItems: QuickMenuItem[] = isAdmin
    ? [
        { type: 'item', key: 'edit', label: 'Edit dates', onSelect: onOpenEdit },
        { type: 'separator', key: 'sep-status' },
        ...STATUS_ORDER.filter((status) => status !== sprint.status).map(
          (status): QuickMenuItem => ({
            type: 'item',
            key: `status-${status}`,
            label: `Mark ${STATUS_LABEL[status].toLowerCase()}`,
            onSelect: () => onStatusChange(sprint.id, status),
          }),
        ),
        { type: 'separator', key: 'sep-open' },
        {
          type: 'item',
          key: 'open',
          label: 'Open board',
          onSelect: () => {
            window.location.href = `/apps/${slug}?sprint=${sprint.id}&tab=board`
          },
        },
        { type: 'separator', key: 'sep-delete' },
        { type: 'item', key: 'delete', label: 'Delete', destructive: true, onSelect: onDelete },
      ]
    : []

  return (
    <div
      ref={setNodeRef}
      style={rowStyle}
      onContextMenu={(event) => {
        if (menuItems.length === 0) return
        event.preventDefault()
        onMenuOpenChange(true)
      }}
      className={cn('group relative flex', isReordering && 'z-20 opacity-60')}
    >
      <div
        className="sticky left-0 z-30 flex shrink-0 flex-col justify-center gap-0.5 border-r border-border bg-card px-3 py-1.5 transition-colors duration-150 group-hover:bg-accent"
        style={{ width: LABEL_WIDTH }}
      >
        <div className="flex items-center gap-1">
          {isAdmin ? (
            <button
              ref={setActivatorNodeRef}
              type="button"
              {...gripAttributes}
              {...gripListeners}
              aria-label={`Reorder ${sprint.name}`}
              className="shrink-0 cursor-grab touch-none rounded-sm text-muted-foreground/60 outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing"
            >
              <GripVertical className="size-3.5" aria-hidden />
            </button>
          ) : null}
          <InlineRename
            value={sprint.name}
            onSave={(name) => onRename(sprint.id, name)}
            disabled={!isAdmin}
            ariaLabel="Sprint name"
            className="min-w-0 truncate text-sm font-medium"
            maxLength={60}
          />
        </div>
        {/* The label cell's actual link to the board — kept separate from
            the name above so double-click/F2 rename never fights an
            anchor's own click-to-navigate. */}
        <Link
          href={`/apps/${slug}?sprint=${sprint.id}&tab=board`}
          className="truncate rounded-sm font-mono text-xs text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline"
        >
          {formatRange(start, end)}
        </Link>
        <CardQuickMenu
          items={menuItems}
          open={menuOpen}
          onOpenChange={onMenuOpenChange}
          label="Sprint actions"
        />
      </div>
      <div className="relative shrink-0" style={{ width: timelineWidth, height: ROW_HEIGHT }}>
        <div
          ref={setShiftNodeRef}
          aria-label={
            isAdmin
              ? `${sprint.name}, ${formatRange(start, end)}. Drag, or use the arrow keys, to move.`
              : undefined
          }
          {...(isAdmin ? shiftAttributes : {})}
          {...(isAdmin ? shiftListeners : {})}
          // Overrides whatever onKeyDown the spread above just set: dnd-kit's
          // own KeyboardSensor (Space-to-lift) is deliberately not used on
          // this bar — the direct Left/Right/Alt+Up/Down nudge model below
          // doesn't need a separate "pick up" step, so it owns the key here
          // instead.
          onKeyDown={handleBarKeyDown}
          className={cn(
            'absolute top-1/2 h-6 -translate-y-1/2 rounded-md ring-1 ring-inset ring-foreground/10 outline-none',
            STATUS_COLOR[sprint.status],
            isAdmin ? 'cursor-grab touch-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring' : 'cursor-default',
          )}
          style={{ left: barLeft + barTranslateX, width: barWidth }}
        >
          {isAdmin ? (
            <>
              <div
                ref={setStartNodeRef}
                aria-hidden
                {...startListeners}
                className="absolute inset-y-0 left-0 w-2 cursor-ew-resize touch-none opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100"
                style={{ transform: `translateX(${startTranslateX}px)` }}
              />
              <div
                ref={setEndNodeRef}
                aria-hidden
                {...endListeners}
                className="absolute inset-y-0 right-0 w-2 cursor-ew-resize touch-none opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100"
                style={{ transform: `translateX(${endTranslateX}px)` }}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
