'use client'

import { useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'
import { deleteSprint, updateSprint, updateSprintStatus } from '@/features/sprints/actions'
import { sprintDurationLabel } from '@/features/sprints/sprint-date-range'
import type { Sprint } from '@/features/sprints/queries'

type Status = 'planned' | 'active' | 'done'

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'Active' },
  { value: 'done', label: 'Done' },
]

type FormState = { name: string; goal: string; startDate: string; endDate: string; status: Status }

function toFormState(sprint: Sprint): FormState {
  return {
    name: sprint.name,
    goal: sprint.goal ?? '',
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    status: sprint.status,
  }
}

const EMPTY: FormState = {
  name: '',
  goal: '',
  startDate: '',
  endDate: '',
  status: 'planned',
}

/**
 * Editing a sprint — the thing that did not exist before.
 *
 * Until now a sprint was write-once: `createSprint` and `updateSprintStatus`
 * were the entire surface, so a typo in a name or a wrong end date could
 * only be fixed in the database. This dialog is also the roadmap's
 * conventional keyboard route: every drag it offers (move the bar, drag
 * either edge) is a pair of ordinary date fields here.
 *
 * Status still goes through `updateSprintStatus` rather than being folded
 * into `updateSprint` — activating a sprint demotes any other active sprint
 * in the same app, and that invariant lives in exactly one action.
 */
export function SprintEditDialog({
  sprint,
  slug,
  onOpenChange,
}: {
  sprint: Sprint | null
  slug: string
  onOpenChange: (open: boolean) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<FormState>(() => (sprint ? toFormState(sprint) : EMPTY))
  const [rangeError, setRangeError] = useState<string | null>(null)

  // Re-seed whenever a different sprint is opened. Adjusting state during
  // render rather than in an effect is React's own recommendation for
  // resetting state in response to a prop change, and matches TaskDialog.
  const [syncedSprint, setSyncedSprint] = useState(sprint)
  if (sprint !== syncedSprint) {
    setSyncedSprint(sprint)
    setRangeError(null)
    if (sprint) setForm(toFormState(sprint))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!sprint) return
    if (form.endDate < form.startDate) {
      setRangeError('End date must be on or after the start date')
      return
    }

    startTransition(async () => {
      try {
        const res = await updateSprint(sprint.id, {
          name: form.name,
          goal: form.goal,
          startDate: form.startDate,
          endDate: form.endDate,
        })
        if (!res.ok) {
          setRangeError(res.error)
          return
        }
        // Only touch the status when it actually changed: updateSprintStatus
        // re-runs the single-active-sprint batch every time it is called.
        if (form.status !== sprint.status) {
          const statusRes = await updateSprintStatus(sprint.id, form.status)
          if (!statusRes.ok) {
            toast.error(statusRes.error)
            // The name/goal/dates ARE saved at this point — two actions, no
            // shared transaction. Refreshing before bailing out means the
            // dialog and the timeline behind it show what is actually stored,
            // instead of leaving the status select reading like a change that
            // took while the fields it sits beside have quietly moved on.
            return
          }
        }
        toast.success('Sprint updated')
        onOpenChange(false)
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  function handleDelete() {
    if (!sprint) return
    startTransition(async () => {
      try {
        const res = await deleteSprint(sprint.id)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(
          res.data.releasedTasks > 0
            ? `Sprint deleted — ${res.data.releasedTasks} ${res.data.releasedTasks === 1 ? 'task moved' : 'tasks moved'} to the backlog`
            : 'Sprint deleted',
        )
        onOpenChange(false)
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  const durationLabel = sprintDurationLabel(form.startDate, form.endDate)

  return (
    <Dialog open={sprint !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit sprint</DialogTitle>
          <DialogDescription>
            Rename, re-goal or reschedule this sprint. Dates here do exactly what dragging its bar
            on the roadmap does.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sprint-edit-name">Name</Label>
            <Input
              id="sprint-edit-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              minLength={2}
              maxLength={60}
              required
              className="h-9 font-medium md:text-base"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sprint-edit-goal">Goal</Label>
            <Textarea
              id="sprint-edit-goal"
              value={form.goal}
              onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
              maxLength={300}
              className="min-h-20"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sprint-edit-start">Start date</Label>
              <Input
                id="sprint-edit-start"
                type="date"
                value={form.startDate}
                onChange={(e) => {
                  setRangeError(null)
                  setForm((f) => ({ ...f, startDate: e.target.value }))
                }}
                required
                className="h-9 font-mono hover:border-ring/40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="sprint-edit-end">End date</Label>
                {durationLabel ? (
                  <span
                    id="sprint-edit-duration"
                    className="font-mono text-2xs tabular-nums text-muted-foreground"
                  >
                    {durationLabel}
                  </span>
                ) : null}
              </div>
              <Input
                id="sprint-edit-end"
                type="date"
                value={form.endDate}
                onChange={(e) => {
                  setRangeError(null)
                  setForm((f) => ({ ...f, endDate: e.target.value }))
                }}
                required
                aria-invalid={Boolean(rangeError)}
                aria-describedby={
                  rangeError
                    ? 'sprint-edit-error'
                    : durationLabel
                      ? 'sprint-edit-duration'
                      : undefined
                }
                className="h-9 font-mono hover:border-ring/40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sprint-edit-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, status: (value ?? 'planned') as Status }))
                }
              >
                <SelectTrigger id="sprint-edit-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {rangeError ? (
            <p id="sprint-edit-error" role="alert" className="text-xs text-destructive">
              {rangeError}
            </p>
          ) : null}
          {form.status === 'active' && sprint?.status !== 'active' ? (
            <p className="text-xs text-muted-foreground">
              Making this sprint active will close any other active sprint on this app — only one
              can run at a time.
            </p>
          ) : null}
          <DialogFooter className="justify-between sm:justify-between">
            <AlertDialog>
              <AlertDialogTrigger render={<Button type="button" variant="destructive" />}>
                Delete
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this sprint?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes &ldquo;{sprint?.name}&rdquo;. Its tasks are not
                    deleted — they move back to this app&apos;s backlog. This cannot be undone.
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
            <div className="flex items-center gap-2">
              {sprint ? (
                <Link
                  href={`/apps/${slug}?tab=roadmap&sprint=${sprint.id}`}
                  className={cn(buttonVariants({ variant: 'outline' }))}
                >
                  Open board
                </Link>
              ) : null}
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
