'use client'

import { useState, useTransition, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useSortable } from '@dnd-kit/sortable'
import { GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { CardQuickMenu, type QuickMenuItem } from '@/components/shared/card-quick-menu'
import { InlineRename } from '@/components/shared/inline-rename'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { deleteTask, updateTask } from '@/features/sprints/task-actions'
import type { TaskWithAssignee } from '@/features/sprints/queries'
import type { TaskStatus } from '@/features/sprints/components/board'

// Priority 0 (none) draws nothing; the ramp climbs sage → ember → destructive
// per the redesign spec — no new hues.
const PRIORITY_BAR: Record<number, string | null> = {
  0: null,
  1: 'bg-chart-2',
  2: 'bg-chart-1',
  3: 'bg-destructive',
}

const PRIORITY_LABEL: Record<number, string> = {
  0: 'No priority',
  1: 'Low priority',
  2: 'Medium priority',
  3: 'High priority',
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}
const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'done']

/**
 * The card's visuals only — no sortable wiring, no listeners. Shared by the
 * real (draggable) card below and the board's `DragOverlay`, which needs the
 * exact same face for the copy that follows the pointer.
 */
export function TaskCardFace({
  task,
  grip,
  className,
  titleSlot,
}: {
  task: TaskWithAssignee
  /** Rendered as the grip affordance's visibility state — omit to hide it
      entirely (e.g. the overlay copy, or a card no one may drag). */
  grip?: 'idle' | 'visible'
  className?: string
  /** Swaps the plain title text for something else (the real card's inline
      rename control) — wrapped so a click on it never also bubbles to the
      card's own "open" handler. Omit for the plain, read-only title (the
      overlay copy, or a card no one may edit). */
  titleSlot?: ReactNode
}) {
  const bar = PRIORITY_BAR[task.priority]
  return (
    <div
      className={cn(
        'relative flex flex-col gap-2 overflow-hidden rounded-lg border bg-card p-3 text-left shadow-xs',
        className,
      )}
    >
      {bar ? (
        <span
          role="img"
          className={cn('absolute inset-y-0 left-0 w-1', bar)}
          aria-label={PRIORITY_LABEL[task.priority]}
          title={PRIORITY_LABEL[task.priority]}
        />
      ) : null}
      {grip ? (
        <GripVertical
          aria-hidden
          className={cn(
            'absolute top-2 right-2 size-3.5 text-muted-foreground/50 transition-opacity duration-150',
            grip === 'visible' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
          )}
        />
      ) : null}
      {titleSlot ? (
        <div onClick={(e) => e.stopPropagation()} className="pr-4">
          {titleSlot}
        </div>
      ) : (
        <p className="line-clamp-2 pr-4 text-sm leading-snug font-medium">{task.title}</p>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">
          {task.assignee ? task.assignee.name : 'Unassigned'}
        </span>
        {task.assignee ? (
          <Avatar size="sm" className="shrink-0">
            {task.assignee.avatarUrl ? (
              <AvatarImage src={task.assignee.avatarUrl} alt={task.assignee.name} />
            ) : null}
            <AvatarFallback>{task.assignee.name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
        ) : null}
      </div>
    </div>
  )
}

export function TaskCard({
  task,
  draggable,
  isAdmin,
  team,
  onOpen,
}: {
  task: TaskWithAssignee
  /** Whether THIS user may move/edit/reassign this specific card — the same
      `canMoveTask` check the board already uses to decide draggability, and
      the quick menu's assign/priority/status items respect the identical
      gate rather than a separate rule. */
  draggable: boolean
  isAdmin: boolean
  team: { userId: string; name: string }[]
  onOpen: (task: TaskWithAssignee) => void
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)

  // dnd-kit still needs a stable sortable registration even for non-draggable
  // cards (they must remain valid drop targets within the column's
  // SortableContext) — `disabled` just suppresses the drag listeners/attrs.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !draggable,
  })

  // The drag tilt rides on dnd-kit's own pointer-follow transform (inline
  // styles win over class transforms, so it has to live here, not in CSS).
  const dragTilt = isDragging ? ' rotate(2deg) scale(1.02)' : ''
  const style: CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})${dragTilt}`
      : undefined,
    transition,
  }

  function runUpdate(patch: Record<string, unknown>, successMessage: string) {
    startTransition(async () => {
      try {
        const res = await updateTask(task.id, patch)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(successMessage)
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        const res = await deleteTask(task.id)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Task deleted')
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  const items: QuickMenuItem[] = []
  if (draggable) {
    for (const status of STATUS_ORDER) {
      if (status === task.status) continue
      items.push({
        type: 'item',
        key: `status-${status}`,
        label: `Move to ${STATUS_LABEL[status]}`,
        onSelect: () => runUpdate({ status }, `Moved to ${STATUS_LABEL[status]}`),
      })
    }
    items.push({ type: 'separator', key: 'sep-priority' })
    for (const [key, label] of Object.entries(PRIORITY_LABEL)) {
      const value = Number(key)
      if (value === task.priority) continue
      items.push({
        type: 'item',
        key: `priority-${value}`,
        label,
        onSelect: () => runUpdate({ priority: value }, 'Priority updated'),
      })
    }
    items.push({ type: 'separator', key: 'sep-assignee' })
    if (task.assignee) {
      items.push({
        type: 'item',
        key: 'unassign',
        label: 'Unassign',
        onSelect: () => runUpdate({ assigneeId: null }, 'Unassigned'),
      })
    }
    for (const member of team) {
      if (member.userId === task.assignee?.id) continue
      items.push({
        type: 'item',
        key: `assign-${member.userId}`,
        label: `Assign to ${member.name}`,
        onSelect: () => runUpdate({ assigneeId: member.userId }, `Assigned to ${member.name}`),
      })
    }
  }
  if (isAdmin) {
    if (items.length > 0) items.push({ type: 'separator', key: 'sep-delete' })
    items.push({ type: 'item', key: 'delete', label: 'Delete', destructive: true, onSelect: handleDelete })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      tabIndex={0}
      onClick={() => onOpen(task)}
      onKeyDown={(event) => {
        // The shared drag kit's KeyboardSensor claims Space to lift the
        // card, so only Enter opens it now — Space here would race the
        // sensor's own onKeyDown and either double-fire or fight the lift.
        if (event.key === 'Enter') {
          event.preventDefault()
          onOpen(task)
        }
      }}
      onContextMenu={(event) => {
        if (items.length === 0) return
        event.preventDefault()
        setMenuOpen(true)
      }}
      className={cn(
        'group relative outline-none transition-[border-color,box-shadow] duration-150 rounded-lg focus-visible:ring-2 focus-visible:ring-ring/50',
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        isDragging && 'z-10 opacity-40',
      )}
    >
      <TaskCardFace
        task={task}
        grip={draggable ? 'idle' : undefined}
        className="transition-[border-color,box-shadow] duration-150 hover:border-ring/60 group-focus-visible:border-ring"
        titleSlot={
          draggable ? (
            <InlineRename
              value={task.title}
              onSave={(next) => runUpdate({ title: next }, 'Task renamed')}
              ariaLabel="Task title"
              className="line-clamp-2 text-sm leading-snug font-medium"
              maxLength={140}
            />
          ) : undefined
        }
      />
      <CardQuickMenu items={items} open={menuOpen} onOpenChange={setMenuOpen} label="Task actions" />
    </div>
  )
}
