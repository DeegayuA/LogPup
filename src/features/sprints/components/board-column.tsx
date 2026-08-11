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
      try {
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
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

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
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a task…"
        disabled={isPending}
        aria-label={`Add task to ${title}`}
        className="mt-2 border-dashed bg-transparent shadow-none hover:border-ring/40 focus-visible:border-solid dark:bg-transparent"
      />
    </div>
  )
}
