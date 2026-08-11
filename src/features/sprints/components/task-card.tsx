'use client'

import type { CSSProperties } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { TaskWithAssignee } from '@/features/sprints/queries'

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

export function TaskCard({
  task,
  draggable,
  onOpen,
}: {
  task: TaskWithAssignee
  draggable: boolean
  onOpen: (task: TaskWithAssignee) => void
}) {
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

  const bar = PRIORITY_BAR[task.priority]

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      tabIndex={0}
      onClick={() => onOpen(task)}
      onKeyDown={(event) => {
        // dnd-kit registers only PointerSensor, so Enter/Space are free to
        // open the dialog — a div never fires click from the keyboard.
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(task)
        }
      }}
      className={cn(
        'relative flex flex-col gap-2 overflow-hidden rounded-lg border bg-card p-3 text-left shadow-xs outline-none transition-[border-color,box-shadow] duration-150 hover:border-ring/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        isDragging && 'z-10 shadow-md',
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
      <p className="line-clamp-2 text-sm leading-snug font-medium">{task.title}</p>
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
