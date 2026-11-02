'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { STATUS_LABEL, type TaskStatus } from '@/features/sprints/board-view'
import { childToggleTarget } from '@/features/sprints/child-toggle'
import { updateTask } from '@/features/sprints/task-actions'

/**
 * The ✓/○ beside a child in its parent's list. Without it, finishing a
 * sub-task meant hunting down its own card on the board.
 *
 * Controlled: the list owns the status, because the row's strike-through and
 * the "x of y done" count must flip with the tick — the dialog's list is a
 * snapshot no refresh rewrites. `onChange` fires optimistically and again
 * with the old status on failure.
 *
 * `canEdit` is presentation only and judged on the PARENT (the board has no
 * per-child grant to hand); a member whose parent is theirs but whose child
 * is not gets the tick, and the server's task.edit refusal reverts it.
 */
export function ChildDoneToggle({
  id,
  title,
  status,
  canEdit,
  onChange,
}: {
  id: string
  title: string
  status: TaskStatus
  canEdit: boolean
  onChange: (next: TaskStatus) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const done = status === 'done'
  const mark = (
    <span aria-hidden className={done ? 'text-primary' : 'text-muted-foreground'}>
      {done ? '✓' : '○'}
    </span>
  )
  if (!canEdit) return mark

  function toggle() {
    const before = status
    const next = childToggleTarget(before)
    onChange(next)
    startTransition(async () => {
      try {
        const res = await updateTask(id, { status: next })
        if (!res.ok) {
          onChange(before)
          toast.error(res.error)
          return
        }
        toast.success(next === 'done' ? 'Marked done' : `Moved back to ${STATUS_LABEL[next]}`)
        router.refresh()
      } catch {
        onChange(before)
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <button
      type="button"
      // A fixed label with the pressed state carrying done/not-done; a label
      // that flipped as well would read "not done, pressed".
      aria-pressed={done}
      aria-label={`Done: ${title}`}
      title={done ? 'Mark not done' : 'Mark done'}
      disabled={isPending}
      onClick={(event) => {
        event.stopPropagation()
        toggle()
      }}
      onPointerDown={(event) => event.stopPropagation()}
      className="grid size-4 shrink-0 place-items-center rounded-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      {mark}
    </button>
  )
}
