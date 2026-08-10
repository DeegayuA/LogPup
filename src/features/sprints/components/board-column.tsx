'use client'

import { useState, useTransition, type KeyboardEvent } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { createTask } from '@/features/sprints/task-actions'
import { canMoveTask } from '@/features/sprints/permissions'
import { TaskCard } from '@/features/sprints/components/task-card'
import type { TaskWithAssignee } from '@/features/sprints/queries'
import type { TaskStatus } from '@/features/sprints/components/board'

export function BoardColumn({
  status,
  title,
  tasks,
  appId,
  sprintId,
  currentUser,
  onOpenTask,
}: {
  status: TaskStatus
  title: string
  tasks: TaskWithAssignee[]
  appId: string
  sprintId: string | null
  currentUser: { id: string; role: 'admin' | 'member' }
  onOpenTask: (task: TaskWithAssignee) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const [draft, setDraft] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    const title = draft.trim()
    if (!title || isPending) return
    startTransition(async () => {
      const res = await createTask({
        appId,
        sprintId,
        title,
        assigneeId: null,
        priority: 0,
        status,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setDraft('')
    })
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between px-0.5">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a task…"
        disabled={isPending}
        aria-label={`Add task to ${title}`}
      />
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-24 flex-1 flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors',
          isOver ? 'border-ring bg-muted/40' : 'border-transparent',
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">Drop tasks here</p>
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
    </div>
  )
}
