'use client'

import { useMemo, useOptimistic, useState, useTransition } from 'react'
import { DragOverlay, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { toast } from 'sonner'
import { DragSurface, buildDragAnnouncements } from '@/components/shared/drag-surface'
import { sortOrderForIndex } from '@/lib/sort-order'
import { BoardColumn } from '@/features/sprints/components/board-column'
import { TaskCardFace } from '@/features/sprints/components/task-card'
import { TaskDialog } from '@/features/sprints/components/task-dialog'
import { moveTask } from '@/features/sprints/task-actions'
import type { Board as BoardData, TaskWithAssignee } from '@/features/sprints/queries'

export type TaskStatus = 'todo' | 'in_progress' | 'done'

const COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: 'todo', title: 'To do' },
  { status: 'in_progress', title: 'In progress' },
  { status: 'done', title: 'Done' },
]

const COLUMN_TITLE: Record<TaskStatus, string> = Object.fromEntries(
  COLUMNS.map((c) => [c.status, c.title]),
) as Record<TaskStatus, string>

type MoveUpdate = { taskId: string; status: TaskStatus; sortOrder: number }

function applyMove(board: BoardData, update: MoveUpdate): BoardData {
  let moved: TaskWithAssignee | undefined
  const strip = (list: TaskWithAssignee[]) =>
    list.filter((t) => {
      if (t.id !== update.taskId) return true
      moved = t
      return false
    })

  const next: BoardData = {
    todo: strip(board.todo),
    in_progress: strip(board.in_progress),
    done: strip(board.done),
  }
  if (!moved) return board

  const updated: TaskWithAssignee = { ...moved, status: update.status, sortOrder: update.sortOrder }
  next[update.status] = [...next[update.status], updated].sort((a, b) => a.sortOrder - b.sortOrder)
  return next
}

function findTask(board: BoardData, taskId: string): TaskWithAssignee | undefined {
  return (
    board.todo.find((t) => t.id === taskId) ??
    board.in_progress.find((t) => t.id === taskId) ??
    board.done.find((t) => t.id === taskId)
  )
}

export function Board({
  initialBoard,
  team,
  appId,
  sprintId,
  currentUser,
}: {
  initialBoard: BoardData
  team: { userId: string; name: string }[]
  appId: string
  sprintId: string | null
  currentUser: { id: string; role: 'admin' | 'member' }
}) {
  const [board, applyOptimisticMove] = useOptimistic(initialBoard, applyMove)
  const [, startTransition] = useTransition()
  const [editingTask, setEditingTask] = useState<TaskWithAssignee | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  // Names any id the board's DndContext might report — a task's own id, or
  // one of the three column ids it can be dropped on — for the shared
  // announcements builder.
  function nameForId(id: string): string {
    if (id in COLUMN_TITLE) return `the ${COLUMN_TITLE[id as TaskStatus]} column`
    return findTask(board, id)?.title ?? 'the task'
  }
  const announcements = useMemo(() => buildDragAnnouncements(nameForId), [board])

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null)
    const { active, over } = event
    if (!over || over.id === active.id) return

    const taskId = String(active.id)
    const dragged = findTask(board, taskId)
    if (!dragged) return

    const overId = String(over.id)
    const isColumnDrop = COLUMNS.some((c) => c.status === overId)
    const targetStatus: TaskStatus = isColumnDrop
      ? (overId as TaskStatus)
      : ((findTask(board, overId)?.status as TaskStatus | undefined) ?? (dragged.status as TaskStatus))

    const neighbors = board[targetStatus].filter((t) => t.id !== taskId)
    let targetIndex = neighbors.length
    if (!isColumnDrop) {
      const idx = neighbors.findIndex((t) => t.id === overId)
      if (idx !== -1) targetIndex = idx
    }

    const sortOrder = sortOrderForIndex(neighbors, targetIndex)
    if (dragged.status === targetStatus && dragged.sortOrder === sortOrder) return

    startTransition(async () => {
      applyOptimisticMove({ taskId, status: targetStatus, sortOrder })
      // moveTask can also reject outright (e.g. a DB outage — task-actions
      // rethrows anything that isn't a handled foreign-key violation), not
      // just resolve with `{ ok: false }`. Without this catch, that becomes
      // an unhandled promise rejection: no toast, and the optimistic move
      // still visually "succeeds" until the next unrelated render. Catching
      // it here means the transition still settles either way, so
      // useOptimistic reverts to the real (unmoved) board once this async
      // callback returns/throws — no stuck pending state.
      try {
        const res = await moveTask(taskId, targetStatus, sortOrder)
        if (!res.ok) toast.error(res.error)
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  const dragging = draggingId ? findTask(board, draggingId) : undefined

  return (
    <>
      {/* Says out loud what the board offers, for anyone who can't see a card
          lift under the cursor — and names the keyboard route (the calendar
          has the same line for the same reason). */}
      <p className="text-xs text-muted-foreground">
        Select a card to open it. Press Space to lift a card and move it with the arrow keys, Space
        again to drop.
      </p>
      <DragSurface
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingId(null)}
        accessibility={{ announcements }}
      >
        <div className="flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto pb-2">
          {COLUMNS.map((col) => (
            <BoardColumn
              key={col.status}
              status={col.status}
              title={col.title}
              tasks={board[col.status]}
              team={team}
              appId={appId}
              sprintId={sprintId}
              currentUser={currentUser}
              onOpenTask={setEditingTask}
            />
          ))}
        </div>
        {/* Portalled to the body: the board's own row is `overflow-x-auto`,
            so a card dragged toward the third column would otherwise clip at
            the scroller edge instead of following the pointer. */}
        <DragOverlay dropAnimation={null}>
          {dragging ? (
            <TaskCardFace task={dragging} className="shadow-md ring-1 ring-foreground/10" />
          ) : null}
        </DragOverlay>
      </DragSurface>
      <TaskDialog
        task={editingTask}
        team={team}
        isAdmin={currentUser.role === 'admin'}
        onOpenChange={(open) => {
          if (!open) setEditingTask(null)
        }}
      />
    </>
  )
}
