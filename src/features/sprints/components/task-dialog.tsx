'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateTask, deleteTask } from '@/features/sprints/task-actions'
import type { TaskWithAssignee } from '@/features/sprints/queries'

const UNASSIGNED = '__unassigned__'

const PRIORITY_OPTIONS = [
  { value: '0', label: 'None' },
  { value: '1', label: 'Low' },
  { value: '2', label: 'Medium' },
  { value: '3', label: 'High' },
]

type FormState = {
  title: string
  description: string
  assigneeId: string
  priority: string
}

function toFormState(task: TaskWithAssignee): FormState {
  return {
    title: task.title,
    description: task.description ?? '',
    assigneeId: task.assignee?.id ?? UNASSIGNED,
    priority: String(task.priority),
  }
}

function emptyForm(): FormState {
  return { title: '', description: '', assigneeId: UNASSIGNED, priority: '0' }
}

export function TaskDialog({
  task,
  team,
  isAdmin,
  onOpenChange,
}: {
  task: TaskWithAssignee | null
  team: { userId: string; name: string }[]
  isAdmin: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<FormState>(() => (task ? toFormState(task) : emptyForm()))
  // Tracks the task object we last synced `form` from, so we can re-seed the
  // form whenever a (possibly different, or freshly-refetched) task is
  // opened. Adjusting state during render — rather than in a useEffect — is
  // the React-recommended way to reset state in response to a prop change:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [syncedTask, setSyncedTask] = useState(task)
  if (task !== syncedTask) {
    setSyncedTask(task)
    if (task) setForm(toFormState(task))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!task) return
    startTransition(async () => {
      const res = await updateTask(task.id, {
        title: form.title,
        description: form.description,
        assigneeId: form.assigneeId === UNASSIGNED ? null : form.assigneeId,
        priority: Number(form.priority),
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Task updated')
      onOpenChange(false)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!task) return
    startTransition(async () => {
      const res = await deleteTask(task.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Task deleted')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={task !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
          <DialogDescription>Update the task&apos;s details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              minLength={1}
              maxLength={140}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              maxLength={2000}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-assignee">Assignee</Label>
              <Select
                value={form.assigneeId}
                onValueChange={(value) => setForm((f) => ({ ...f, assigneeId: value ?? UNASSIGNED }))}
              >
                <SelectTrigger id="task-assignee" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {team.map((member) => (
                    <SelectItem key={member.userId} value={member.userId}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-priority">Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(value) => setForm((f) => ({ ...f, priority: value ?? '0' }))}
              >
                <SelectTrigger id="task-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="justify-between sm:justify-between">
            {isAdmin ? (
              <AlertDialog>
                <AlertDialogTrigger render={<Button type="button" variant="destructive" />}>
                  Delete
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this task?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes &ldquo;{task?.title}&rdquo;. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
                      onClick={handleDelete}
                      disabled={isPending}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
