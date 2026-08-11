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
import { MentionTextarea } from '@/components/mention-textarea'
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
  mentionUsers,
}: {
  task: TaskWithAssignee | null
  team: { userId: string; name: string }[]
  isAdmin: boolean
  onOpenChange: (open: boolean) => void
  /** Wider mention pool (e.g. all active users) — falls back to the app team. */
  mentionUsers?: { id: string; name: string }[]
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
      try {
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
      } catch {
        // A thrown error (e.g. DB outage) is not `{ ok: false }` — without
        // this catch it's an unhandled rejection and Save silently does
        // nothing.
        toast.error('Something went wrong — try again')
      }
    })
  }

  function handleDelete() {
    if (!task) return
    startTransition(async () => {
      try {
        const res = await deleteTask(task.id)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Task deleted')
        onOpenChange(false)
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
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
              className="h-9 font-medium md:text-base"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-description">Description</Label>
            <MentionTextarea
              id="task-description"
              users={mentionUsers ?? team.map((m) => ({ id: m.userId, name: m.name }))}
              value={form.description}
              onValueChange={(description) => setForm((f) => ({ ...f, description }))}
              onMention={(user) => {
                /* A mention doubles as an assignment hint — but only when the
                   assignee is still unset and the mentioned user is actually
                   a valid assignee option. */
                if (form.assigneeId !== UNASSIGNED) return
                if (!team.some((m) => m.userId === user.id)) return
                setForm((f) => ({ ...f, assigneeId: user.id }))
                toast.info(`Assigned to ${user.name} from mention`)
              }}
              maxLength={2000}
              className="min-h-24"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-assignee">Assignee</Label>
              <Select
                value={form.assigneeId}
                onValueChange={(value) => setForm((f) => ({ ...f, assigneeId: value ?? UNASSIGNED }))}
              >
                <SelectTrigger id="task-assignee" className="w-full">
                  {/* Explicit label mapping — the raw id is the Select's `value`,
                      so without this the trigger falls back to rendering that id
                      (a UUID) instead of the assignee's name. */}
                  <SelectValue>
                    {(value: string) =>
                      value === UNASSIGNED
                        ? 'Unassigned'
                        : (team.find((member) => member.userId === value)?.name ?? 'Unassigned')
                    }
                  </SelectValue>
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
                  {/* Same explicit mapping as the assignee select above — the
                      value is a numeric code ('0'-'3'), not the label. */}
                  <SelectValue>
                    {(value: string) =>
                      PRIORITY_OPTIONS.find((opt) => opt.value === value)?.label ?? 'None'
                    }
                  </SelectValue>
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
