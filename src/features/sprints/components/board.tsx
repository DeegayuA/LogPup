'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { toast } from 'sonner'
import { BoardColumn } from '@/features/sprints/components/board-column'
import { TaskDialog } from '@/features/sprints/components/task-dialog'
import { moveTask } from '@/features/sprints/task-actions'
import type { Board as BoardData, TaskWithAssignee } from '@/features/sprints/queries'

export type TaskStatus = 'todo' | 'in_progress' | 'done'

const COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: 'todo', title: 'To do' },
  { status: 'in_progress', title: 'In progress' },
  { status: 'done', title: 'Done' },
]

// Spacing used when a task lands at either end of a column, or when the
// fractional-midpoint strategy below runs out of integer room and needs a
// clean re-spread.
const SORT_GAP = 1024

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

/**
 * sortOrder strategy: `sortOrder` is a Postgres `integer` column, so we
 * can't use arbitrary fractional indices. We first try the classic
 * fractional-midpoint between the two neighbors the task is dropped
 * between — that works as long as there's at least a 2-wide gap. Newly
 * created tasks all share the DB default of 0 though, so that gap often
 * doesn't exist yet; when it doesn't, we fall back to a fresh
 * `(index + 1) * SORT_GAP` slot. That's simple, collision-free, and the
 * remaining tasks in the column naturally regain spacing the next time
 * they're individually moved.
 */
function sortOrderForIndex(neighbors: TaskWithAssignee[], index: number): number {
  const before = index > 0 ? neighbors[index - 1].sortOrder : null
  const after = index < neighbors.length ? neighbors[index].sortOrder : null

  if (before === null && after === null) return SORT_GAP
  if (before === null) return after! - SORT_GAP
  if (after === null) return before + SORT_GAP

  const mid = Math.floor((before + after) / 2)
  if (mid <= before || mid >= after) return (index + 1) * SORT_GAP
  return mid
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require a small drag distance before activating: without this, a
      // plain click (to open the TaskDialog) would immediately register as
      // a drag-start and swallow the click.
      activationConstraint: { distance: 8 },
    }),
  )

  function handleDragEnd(event: DragEndEvent) {
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

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex flex-col gap-4 sm:flex-row">
          {COLUMNS.map((col) => (
            <BoardColumn
              key={col.status}
              status={col.status}
              title={col.title}
              tasks={board[col.status]}
              appId={appId}
              sprintId={sprintId}
              currentUser={currentUser}
              onOpenTask={setEditingTask}
            />
          ))}
        </div>
      </DndContext>
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
