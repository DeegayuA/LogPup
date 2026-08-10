'use client'

import type { CSSProperties } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { TaskWithAssignee } from '@/features/sprints/queries'

const PRIORITY_DOT: Record<number, string | null> = {
  0: null,
  1: 'bg-blue-500',
  2: 'bg-amber-500',
  3: 'bg-red-500',
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

  const style: CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`
      : undefined,
    transition,
  }

  const dot = PRIORITY_DOT[task.priority]

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task)}
      className={cn(
        'flex flex-col gap-2 rounded-lg border bg-card p-3 text-left shadow-xs transition-colors hover:ring-1 hover:ring-foreground/15',
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        isDragging && 'opacity-40',
      )}
    >
      <div className="flex items-start gap-2">
        {dot ? (
          <span
            className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', dot)}
            aria-label={PRIORITY_LABEL[task.priority]}
            title={PRIORITY_LABEL[task.priority]}
          />
        ) : null}
        <p className="text-sm leading-snug font-medium">{task.title}</p>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {task.assignee ? task.assignee.name : 'Unassigned'}
        </span>
        {task.assignee ? (
          <Avatar size="sm">
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
