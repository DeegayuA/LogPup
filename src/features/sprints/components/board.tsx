'use client'

import { useCallback, useMemo, useOptimistic, useRef, useState, useTransition } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { BoardColumn, groupIdFromDroppable } from '@/features/sprints/components/board-column'
import { BoardToolbar } from '@/features/sprints/components/board-toolbar'
import { BoardBulkBar, type BulkPatch } from '@/features/sprints/components/board-bulk-bar'
import { TaskCardFace, DRAG_ACTIVATION_DISTANCE } from '@/features/sprints/components/task-card'
import { TaskDialog } from '@/features/sprints/components/task-dialog'
import { bulkUpdateTasks, moveTaskOnBoard } from '@/features/sprints/task-actions'
import { listSprintOptions, type SprintOption } from '@/features/sprints/actions'
import {
  activeFilterCount,
  boardSummary,
  boardViewPatch,
  dropIndexIn,
  groupIdForTask,
  groupTasks,
  matchesFilters,
  parseBoardView,
  patchForGroup,
  type BoardView,
  type GroupPatch,
  type TaskStatus,
} from '@/features/sprints/board-view'
import { compareRanked, planInsert } from '@/features/sprints/task-rank'
import type { Board as BoardData, TaskWithAssignee } from '@/features/sprints/queries'
import type { UserRole } from '@/features/auth/capabilities'
import { isAdminRole } from '@/features/auth/capabilities'

export type { TaskStatus }

/* dnd-kit's default instructions are generic. These name the two routes this
   board actually offers, including the grip button — which is the only thing
   the keyboard sensor listens on, and therefore the only thing a keyboard
   user needs to find. */
const DRAG_INSTRUCTIONS =
  'Drag a card with a mouse or by touch to move it between columns or reorder it. With a keyboard, move to a card’s reorder handle, press space to pick it up, use the arrow keys to move it, then press space to drop or escape to cancel.'

type OptimisticMove = {
  taskId: string
  sortOrder: number
  status?: TaskStatus
  assigneeId?: string | null
  priority?: number
  /** Fresh ranks for the destination column when no gap was splittable. */
  rebalance?: { id: string; sortOrder: number }[]
}

/**
 * The optimistic frame for one drag: the moved card takes its patch, and any
 * rebalanced siblings take their new ranks, all in one pass.
 *
 * Ordering is NOT applied here — the groups are sorted by `compareRanked`
 * downstream, so this only has to get the ranks right and the columns fall
 * into place. Doing it in one place is what stops the optimistic order and
 * the server order from being computed two different ways.
 */
function applyMove(tasks: TaskWithAssignee[], move: OptimisticMove): TaskWithAssignee[] {
  const rebalanced = new Map((move.rebalance ?? []).map((entry) => [entry.id, entry.sortOrder]))
  // The moved card may be gaining an assignee it has never had. Reuse a real
  // person object from any card that already has them so the avatar doesn't
  // pop in a frame later; fall back to a name-only stand-in.
  const known = new Map(
    tasks.filter((task) => task.assignee).map((task) => [task.assignee!.id, task.assignee!]),
  )

  return tasks.map((task) => {
    if (task.id === move.taskId) {
      const next: TaskWithAssignee = { ...task, sortOrder: move.sortOrder }
      if (move.status !== undefined) next.status = move.status
      if (move.priority !== undefined) next.priority = move.priority
      if (move.assigneeId !== undefined) {
        next.assignee =
          move.assigneeId === null
            ? null
            : (known.get(move.assigneeId) ?? { id: move.assigneeId, name: '…', avatarUrl: null })
      }
      return next
    }
    const rank = rebalanced.get(task.id)
    return rank === undefined ? task : { ...task, sortOrder: rank }
  })
}

export function Board({
  initialBoard,
  team,
  composerPeople,
  appId,
  sprintId,
  currentUser,
}: {
  initialBoard: BoardData
  /** This app's members — the roster the cards' reassign menus offer. */
  team: { userId: string; name: string }[]
  /** Everyone a name typed into a column composer may resolve to: the whole
   *  workspace, flagged by app membership. Wider than `team` on purpose — see
   *  TaskComposer. */
  composerPeople: { id: string; name: string; onTeam: boolean }[]
  appId: string
  sprintId: string | null
  currentUser: { id: string; role: UserRole }
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  /*
   * "Today" is the Asia/Colombo day, exactly as the dashboard queries define
   * it — not the browser's day and not the server's. That is not a
   * preference: this component is server-rendered and then hydrated, so a
   * definition of today that depends on WHERE the code runs would paint an
   * overdue card red on one side and not the other, which React reports as a
   * hydration mismatch. One timezone, both sides, no mismatch.
   */
  const todayIso = toIsoDateInTimeZone(new Date(), LK_TIMEZONE)

  const view = useMemo(() => parseBoardView(searchParams), [searchParams])

  const initialTasks = useMemo(
    () => [...initialBoard.todo, ...initialBoard.in_progress, ...initialBoard.done],
    [initialBoard],
  )

  const [tasks, applyOptimisticMove] = useOptimistic(initialTasks, applyMove)
  const [isPending, startTransition] = useTransition()
  const [editingTask, setEditingTask] = useState<TaskWithAssignee | null>(null)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set())
  const [draggingId, setDraggingId] = useState<string | null>(null)
  /** A failed move is a state, not a notification: the toast is gone in four
   *  seconds and the card has already snapped back, leaving no trace of what
   *  happened or any way to try again. */
  const [moveError, setMoveError] = useState<{ message: string; retry: () => void } | null>(null)
  const [sprintOptions, setSprintOptions] = useState<SprintOption[] | null>(null)
  /** Null options mean two different things — "still loading" and "the fetch
   *  failed" — and a menu that says "Loading sprints…" forever after a failed
   *  request is a dead end. This separates them so the menu can say which. */
  const [sprintOptionsFailed, setSprintOptionsFailed] = useState(false)
  const sprintOptionsRequested = useRef(false)

  /**
   * The view lives in the URL so a filtered board is shareable and survives a
   * reload — but written with the History API, not router.push. Next
   * integrates native pushState/replaceState with `useSearchParams`, so this
   * re-renders the board WITHOUT a server round trip; routing here would
   * re-run the page's `getBoard` on every keystroke of the search box to
   * filter a list the client already holds in full.
   *
   * replaceState, not pushState, is chosen with eyes open: back therefore
   * leaves the board instead of rewinding one filter at a time. The search
   * box commits after every pause in typing, so pushState would bury
   * wherever the user came from under an entry per typed word — a back
   * button that has to be pressed nine times is worse than one that goes
   * where it says.
   */
  const setView = useCallback(
    (next: BoardView) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(boardViewPatch(next))) {
        if (value === null) params.delete(key)
        else params.set(key, value)
      }
      const query = params.toString()
      window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname)
    },
    [pathname, searchParams],
  )

  const ensureSprintOptions = useCallback(() => {
    if (sprintOptionsRequested.current) return
    sprintOptionsRequested.current = true
    setSprintOptionsFailed(false)
    const failed = (message: string) => {
      // Release the latch so the NEXT open retries, and record the failure so
      // the control says what happened instead of pretending to still load.
      sprintOptionsRequested.current = false
      setSprintOptionsFailed(true)
      toast.error(message)
    }
    listSprintOptions(appId)
      .then((res) => {
        if (res.ok) setSprintOptions(res.data)
        else failed(res.error)
      })
      .catch(() => failed('Could not load this app’s sprints'))
  }, [appId])

  const visible = useMemo(
    () => tasks.filter((task) => matchesFilters(task, view.filters, todayIso)),
    [tasks, view.filters, todayIso],
  )

  const summary = useMemo(() => boardSummary(visible, todayIso), [visible, todayIso])

  /**
   * The selection, intersected with what is actually on screen.
   *
   * `selectedIds` is a raw set that survives filtering, re-grouping and a
   * server refresh, so it can easily name cards the user can no longer see —
   * select five overdue cards, switch the filter off, and the bar would still
   * say "5 selected" with no way to tell which five, then apply a status
   * change to cards nowhere in view. A bulk bar must only ever be able to act
   * on what it can show you. Ids are kept (not pruned from state) so
   * re-applying the same filter brings the selection back rather than
   * silently losing it.
   */
  const visibleIds = useMemo(() => new Set(visible.map((task) => task.id)), [visible])
  const selection = useMemo(
    () => [...selectedIds].filter((id) => visibleIds.has(id)),
    [selectedIds, visibleIds],
  )

  const groups = useMemo(() => {
    const grouped = groupTasks(visible, view.groupBy, { team })
    // Rank order inside every column, tiebroken exactly the way getBoard's
    // ORDER BY does. A card is ranked ONCE, globally — so reordering under
    // one grouping also reorders it under the others. That is a deliberate
    // trade: one rank column means one UPDATE per drag, where per-view ranks
    // would mean a column (and a migration) per grouping we ever add.
    for (const group of grouped) group.tasks.sort(compareRanked)
    return grouped
  }, [visible, view.groupBy, team])

  /**
   * The same columns, built from EVERY task rather than the filtered set.
   *
   * These are never rendered — they exist only so a drop's new rank is
   * computed against the real contents of the column. Ranking against the
   * visible cards instead would place a card relative to neighbours that
   * happen to be on screen and ignore whatever is hidden between them; and a
   * rebalance (see task-rank.ts) would re-spread only the visible cards,
   * leaving the hidden ones at their old ranks and shuffling them through the
   * column at random. Filtering a board must never silently reorder the work
   * it is hiding.
   */
  const fullGroups = useMemo(() => {
    const grouped = groupTasks(tasks, view.groupBy, { team })
    for (const group of grouped) group.tasks.sort(compareRanked)
    return grouped
  }, [tasks, view.groupBy, team])

  const byId = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])
  const groupTitleById = useMemo(
    () => new Map(groups.map((group) => [group.id, group.title])),
    [groups],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require a small drag distance before activating: without this, a
      // plain click (to open the TaskDialog) would immediately register as a
      // drag-start and swallow the click. Shared with the meetings calendar.
      activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE },
    }),
    useSensor(KeyboardSensor, {
      // Teaches the keyboard sensor about sortable geometry: arrow keys walk
      // card-to-card and column-to-column instead of nudging by a fixed
      // pixel step, which on a multi-column board never reaches the next
      // column at all.
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  /** The column an active drop target belongs to, whether the pointer is over
   *  the column itself or over one of its cards. */
  const resolveGroupId = useCallback(
    (overId: string): string | null => {
      const fromColumn = groupIdFromDroppable(overId)
      if (fromColumn !== null) return fromColumn
      const overTask = byId.get(overId)
      return overTask ? groupIdForTask(view.groupBy, overTask) : null
    },
    [byId, view.groupBy],
  )

  const announcements = useMemo<Announcements>(
    () => ({
      onDragStart: ({ active }) => `Picked up ${byId.get(String(active.id))?.title ?? 'card'}.`,
      onDragOver: ({ active, over }) => {
        if (!over) return undefined
        const title = byId.get(String(active.id))?.title ?? 'Card'
        const groupId = resolveGroupId(String(over.id))
        const column = groupId ? groupTitleById.get(groupId) : null
        return column ? `${title} is over ${column}.` : undefined
      },
      onDragEnd: ({ active, over }) => {
        const title = byId.get(String(active.id))?.title ?? 'Card'
        if (!over) return `${title} was dropped outside the board and did not move.`
        const groupId = resolveGroupId(String(over.id))
        const column = groupId ? groupTitleById.get(groupId) : null
        return column ? `${title} moved to ${column}.` : `${title} was moved.`
      },
      onDragCancel: ({ active }) =>
        `Move cancelled. ${byId.get(String(active.id))?.title ?? 'The card'} stays where it was.`,
    }),
    [byId, groupTitleById, resolveGroupId],
  )

  const commitMove = useCallback(
    (move: OptimisticMove) => {
      startTransition(async () => {
        applyOptimisticMove(move)
        try {
          const res = await moveTaskOnBoard(move)
          if (!res.ok) {
            setMoveError({ message: res.error, retry: () => commitMove(move) })
            return
          }
          setMoveError(null)
        } catch {
          // moveTaskOnBoard can reject outright (a DB outage), not only
          // resolve with `{ ok: false }`. Without this catch that is an
          // unhandled rejection: the optimistic move still visually
          // "succeeds" until the next unrelated render, with nothing said.
          setMoveError({
            message: 'Could not save that move — the card snapped back.',
            retry: () => commitMove(move),
          })
        }
      })
    },
    [applyOptimisticMove],
  )

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null)
    const { active, over } = event
    if (!over) return

    const taskId = String(active.id)
    const overId = String(over.id)
    // Dropped back on itself. Without this the card is absent from the
    // neighbour list AND absent from the index lookup, so it would fall
    // through to "append to the end of the column" — a card that jumps to
    // the bottom when you pick it up and put it down again.
    if (overId === taskId) return

    const dragged = byId.get(taskId)
    if (!dragged) return
    const targetGroupId = resolveGroupId(overId)
    if (targetGroupId === null) return

    // The UNFILTERED column: see `fullGroups` and `dropIndexIn`. A rank is a
    // position among all of a column's cards, not among the ones currently
    // showing.
    const destination = fullGroups.find((group) => group.id === targetGroupId)
    if (!destination) return

    // The insertion index is always computed against the destination WITHOUT
    // the dragged card — otherwise "move down one" would mean "insert before
    // yourself", which is a no-op.
    const index = dropIndexIn(
      destination.tasks,
      taskId,
      // A column droppable means "the empty area of this column", i.e.
      // append; anything else is the id of the card that was dropped on.
      groupIdFromDroppable(overId) === null ? overId : null,
    )

    const plan = planInsert(
      destination.tasks
        .filter((task) => task.id !== taskId)
        .map((task) => ({ id: task.id, sortOrder: task.sortOrder })),
      index,
      taskId,
    )

    const sameGroup = groupIdForTask(view.groupBy, dragged) === targetGroupId
    // Only send the column patch when the column actually changed: a plain
    // reorder must not rewrite the assignee with the value it already has.
    const columnPatch: GroupPatch = sameGroup
      ? {}
      : (patchForGroup(view.groupBy, targetGroupId) ?? {})

    // A true no-op: same column, same rank, nothing else to write. Guarded on
    // `kind` because a rebalance is NEVER a no-op — the moved card's rank can
    // coincide with the one it already had while every sibling in the column
    // still needs its fresh rank, and returning here would drop those writes
    // and leave the column tied exactly as it was.
    if (plan.kind === 'rank' && sameGroup && dragged.sortOrder === plan.sortOrder) return

    commitMove({
      taskId,
      sortOrder: plan.sortOrder,
      ...columnPatch,
      ...(plan.kind === 'rebalance' ? { rebalance: plan.writes } : {}),
    })
  }

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id))
  }

  const toggleSelect = useCallback((taskId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (!next.delete(taskId)) next.add(taskId)
      return next
    })
  }, [])

  function applyBulk(patch: BulkPatch) {
    const taskIds = selection
    if (taskIds.length === 0) return
    startTransition(async () => {
      try {
        const res = await bulkUpdateTasks({ taskIds, patch })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        const { updated, skipped } = res.data
        toast.success(
          skipped > 0
            ? `${updated} updated · ${skipped} skipped (not yours to change)`
            : `${updated} ${updated === 1 ? 'task' : 'tasks'} updated`,
        )
        setSelectedIds(new Set())
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  const dragging = draggingId ? byId.get(draggingId) : undefined
  // One definition of "is anything filtered", shared with the toolbar's badge
  // — an inlined copy here would eventually disagree with it about a filter
  // added later, and the two are used to say contradictory things about the
  // same board (a "Clear" button that appears while the columns claim nothing
  // is filtered).
  const filtersActive = activeFilterCount(view.filters) > 0

  return (
    <div className="flex flex-col gap-4">
      <BoardToolbar view={view} summary={summary} team={team} onChange={setView} />

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-8 text-center">
          <p className="font-heading text-base font-semibold">Nothing to fetch here yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Type into any column below to add the first task. LogPup will keep watch over it.
          </p>
        </div>
      ) : null}

      {moveError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm"
        >
          <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden />
          <span className="flex-1">{moveError.message}</span>
          <Button size="sm" variant="outline" onClick={moveError.retry} disabled={isPending}>
            Try again
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMoveError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <DndContext
        sensors={sensors}
        // Corners, not the default rectangle-intersection: on a board of tall
        // columns the pointer is often over no card at all (the gap between
        // two), and closestCorners still resolves that to the nearest one
        // instead of dropping the move.
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingId(null)}
        accessibility={{
          announcements,
          screenReaderInstructions: { draggable: DRAG_INSTRUCTIONS },
        }}
      >
        <div className="flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto pb-2">
          {groups.map((group) => (
            <BoardColumn
              key={group.id}
              group={group}
              share={summary.total === 0 ? 0 : group.tasks.length / summary.total}
              composerPatch={patchForGroup(view.groupBy, group.id) ?? {}}
              team={team}
              composerPeople={composerPeople}
              appId={appId}
              sprintId={sprintId}
              currentUser={currentUser}
              todayIso={todayIso}
              selectedIds={selectedIds}
              selectionMode={selection.length > 0}
              filtersActive={filtersActive}
              onOpenTask={setEditingTask}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>

        {/* Rendered OUTSIDE the column strip above, not portalled (dnd-kit's
            DragOverlay does not portal by default and there is no createPortal
            here). That placement is what matters: the strip is overflow-x-auto,
            so an overlay nested inside it would be clipped at the edge mid-drag.
            Keep this as a sibling of the strip — moving it inside would
            reintroduce the clipping this avoids. */}
        <DragOverlay>
          {dragging ? <TaskCardFace task={dragging} todayIso={todayIso} /> : null}
        </DragOverlay>
      </DndContext>

      {selection.length > 0 ? (
        <BoardBulkBar
          count={selection.length}
          sprintOptions={sprintOptions}
          sprintOptionsFailed={sprintOptionsFailed}
          team={team}
          isPending={isPending}
          onApply={applyBulk}
          onClear={() => setSelectedIds(new Set())}
          onOpenSprintMenu={ensureSprintOptions}
        />
      ) : null}

      <TaskDialog
        task={editingTask}
        team={team}
        isAdmin={isAdminRole(currentUser.role)}
        currentUserId={currentUser.id}
        sprintOptions={sprintOptions}
        sprintOptionsFailed={sprintOptionsFailed}
        onNeedSprintOptions={ensureSprintOptions}
        onOpenChange={(open) => {
          if (!open) setEditingTask(null)
        }}
      />
    </div>
  )
}
