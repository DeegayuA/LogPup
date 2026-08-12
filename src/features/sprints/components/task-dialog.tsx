'use client'

import { useEffect, useState, useTransition, type FormEvent } from 'react'
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
import { STATUS_LABEL, TASK_STATUSES, type TaskStatus } from '@/features/sprints/board-view'
import type { SprintOption } from '@/features/sprints/actions'
import type { TaskWithAssignee } from '@/features/sprints/queries'

const UNASSIGNED = '__unassigned__'
/** Sentinel for "no sprint" — a Select value must be a non-empty string, and
 *  the backlog is a real choice, not the absence of one. */
const BACKLOG = '__backlog__'

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
  status: TaskStatus
  /** yyyy-mm-dd or '' — the native date input's own empty value. */
  dueDate: string
  sprintId: string
}

function toFormState(task: TaskWithAssignee): FormState {
  return {
    title: task.title,
    description: task.description ?? '',
    assigneeId: task.assignee?.id ?? UNASSIGNED,
    priority: String(task.priority),
    status: task.status,
    dueDate: task.dueDate ?? '',
    sprintId: task.sprintId ?? BACKLOG,
  }
}

function emptyForm(): FormState {
  return {
    title: '',
    description: '',
    assigneeId: UNASSIGNED,
    priority: '0',
    status: 'todo',
    dueDate: '',
    sprintId: BACKLOG,
  }
}

export function TaskDialog({
  task,
  team,
  isAdmin,
  currentUserId,
  onOpenChange,
  mentionUsers,
  sprintOptions,
  sprintOptionsFailed = false,
  onNeedSprintOptions,
}: {
  task: TaskWithAssignee | null
  team: { userId: string; name: string }[]
  isAdmin: boolean
  /** Who is looking. `updateTask` allows an admin or the task's own assignee
   *  and refuses everyone else — without this the dialog cannot tell which
   *  one you are, so it offers a form that only fails on Save. */
  currentUserId?: string
  onOpenChange: (open: boolean) => void
  /** Wider mention pool (e.g. all active users) — falls back to the app team. */
  mentionUsers?: { id: string; name: string }[]
  /** Null until the app's sprints have been fetched; the control says so
   *  rather than silently offering only the backlog. */
  sprintOptions?: SprintOption[] | null
  /** True once that fetch has failed — so the control can say so instead of
   *  claiming to still be loading. */
  sprintOptionsFailed?: boolean
  onNeedSprintOptions?: () => void
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

  /*
   * Exactly the rule `updateTask` enforces on the server: an admin, or the
   * person the task is assigned to. Mirroring it here is not the permission
   * (the action re-checks) — it is what stops the dialog from being a dead
   * end: a member opening a teammate's card previously got every field
   * enabled, typed a change, pressed Save and was told "Not allowed" with
   * their edit still on screen and nowhere to go. `currentUserId` is optional
   * for callers outside the board, which get the previous always-editable
   * behaviour rather than a silently read-only dialog.
   */
  const canEdit =
    isAdmin ||
    currentUserId === undefined ||
    (task?.assignee?.id != null && task.assignee.id === currentUserId)

  // Fetching the app's other sprints is a real request, so it waits until a
  // dialog is actually opened — a board nobody edits never pays for it.
  const isOpen = task !== null
  useEffect(() => {
    if (isOpen) onNeedSprintOptions?.()
  }, [isOpen, onNeedSprintOptions])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!task || !canEdit) return
    startTransition(async () => {
      try {
        const res = await updateTask(task.id, {
          title: form.title,
          description: form.description,
          assigneeId: form.assigneeId === UNASSIGNED ? null : form.assigneeId,
          priority: Number(form.priority),
          status: form.status,
          // '' from a cleared native date input means "no due date". Sending
          // '' would fail the ISO-date check and reject the whole save.
          dueDate: form.dueDate === '' ? null : form.dueDate,
          sprintId: form.sprintId === BACKLOG ? null : form.sprintId,
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
          <DialogTitle>{canEdit ? 'Edit task' : 'Task'}</DialogTitle>
          <DialogDescription>
            {canEdit
              ? 'Update the task’s details.'
              : task?.assignee
                ? `Only ${task.assignee.name} or an admin can change this task.`
                : 'Only an admin can change an unassigned task.'}
          </DialogDescription>
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
              disabled={!canEdit}
              className="h-9 font-medium md:text-base"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-description">Description</Label>
            <MentionTextarea
              id="task-description"
              disabled={!canEdit}
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
                disabled={!canEdit}
                onValueChange={(value) => setForm((f) => ({ ...f, assigneeId: value ?? UNASSIGNED }))}
              >
                <SelectTrigger id="task-assignee" className="w-full">
                  {/* Explicit label mapping — the raw id is the Select's `value`,
                      so without this the trigger falls back to rendering that id
                      (a UUID) instead of the assignee's name. An id that isn't in
                      `team` (assignee since removed from the app) is labelled
                      honestly rather than as "Unassigned", which would tell the
                      editor the task is free while still saving the hidden id. */}
                  <SelectValue>
                    {(value: string) =>
                      value === UNASSIGNED
                        ? 'Unassigned'
                        : (team.find((member) => member.userId === value)?.name ??
                          'Assigned — no longer on this app team')
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {form.assigneeId !== UNASSIGNED &&
                  !team.some((member) => member.userId === form.assigneeId) ? (
                    <SelectItem value={form.assigneeId}>
                      Current assignee — no longer on this app team
                    </SelectItem>
                  ) : null}
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
                disabled={!canEdit}
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
          {/*
            Status, due date and sprint were previously unreachable: status
            could ONLY be changed by a pointer drag (so keyboard-only users
            could never move a task at all), a due date could be set by the
            quick-add and then never seen or edited again, and there was no
            way anywhere in the product to move a task between sprints even
            though the action already accepted it.
          */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-status">Status</Label>
              <Select
                value={form.status}
                disabled={!canEdit}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, status: (value ?? 'todo') as TaskStatus }))
                }
              >
                <SelectTrigger id="task-status" className="w-full">
                  <SelectValue>
                    {(value: string) => STATUS_LABEL[value as TaskStatus] ?? 'To do'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABEL[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-due">Due date</Label>
              <Input
                id="task-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                disabled={!canEdit}
                className="h-9 font-mono hover:border-ring/40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-sprint">Sprint</Label>
              <Select
                value={form.sprintId}
                disabled={!canEdit}
                onValueChange={(value) => setForm((f) => ({ ...f, sprintId: value ?? BACKLOG }))}
              >
                <SelectTrigger id="task-sprint" className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      value === BACKLOG
                        ? 'Backlog'
                        : (sprintOptions?.find((sprint) => sprint.id === value)?.name ??
                          'Current sprint')
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BACKLOG}>Backlog (no sprint)</SelectItem>
                  {/* The task's own sprint must remain selectable while the
                      list is still loading, or reopening the dialog would
                      offer no way back to where the task already is. */}
                  {form.sprintId !== BACKLOG &&
                  !(sprintOptions ?? []).some((sprint) => sprint.id === form.sprintId) ? (
                    <SelectItem value={form.sprintId}>Current sprint</SelectItem>
                  ) : null}
                  {(sprintOptions ?? []).map((sprint) => (
                    <SelectItem key={sprint.id} value={sprint.id}>
                      {sprint.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Three states, all said out loud: loading, failed, and the
                  ordinary list. Silence on failure would leave a control
                  offering only "Backlog" and looking like the truth. */}
              {sprintOptions === null ? (
                <p className="text-2xs text-muted-foreground" role="status">
                  {sprintOptionsFailed
                    ? 'Couldn’t load this app’s sprints — reopen this task to try again.'
                    : 'Loading sprints…'}
                </p>
              ) : null}
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
            {canEdit ? (
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving…' : 'Save changes'}
              </Button>
            ) : (
              // No Save at all rather than a disabled one: there is nothing
              // this person can do to enable it, and a permanently greyed
              // button reads as a bug to be poked at.
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
