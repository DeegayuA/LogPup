'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import { canMoveTask } from '@/features/sprints/permissions'
import { TaskCard } from '@/features/sprints/components/task-card'
import { TaskComposer } from '@/features/sprints/components/task-composer'
import type { TaskWithAssignee } from '@/features/sprints/queries'
import type { TaskStatus } from '@/features/sprints/components/board'

export function BoardColumn({
  status,
  title,
  tasks,
  team,
  appId,
  sprintId,
  currentUser,
  onOpenTask,
}: {
  status: TaskStatus
  title: string
  tasks: TaskWithAssignee[]
  team: { userId: string; name: string }[]
  appId: string
  sprintId: string | null
  currentUser: { id: string; role: 'admin' | 'member' }
  onOpenTask: (task: TaskWithAssignee) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="flex min-w-64 flex-1 snap-start flex-col rounded-xl bg-muted/50 p-2">
      <div className="flex items-center justify-between px-1 pb-2">
        <h3 className="font-heading text-sm font-semibold">{title}</h3>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-24 flex-1 flex-col gap-2 rounded-lg ring-2 ring-transparent transition-[background-color,box-shadow] duration-150 ring-inset',
          isOver && 'bg-accent ring-primary/40',
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border px-2 py-6 text-xs text-muted-foreground/70">
              Drop tasks here
            </p>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                draggable={canMoveTask(
                  currentUser.role,
                  currentUser.id,
                  task.assignee?.id ?? null,
                )}
                onOpen={onOpenTask}
              />
            ))
          )}
        </SortableContext>
      </div>
      <TaskComposer
        status={status}
        columnTitle={title}
        team={team}
        appId={appId}
        sprintId={sprintId}
      />
    </div>
  )
}
