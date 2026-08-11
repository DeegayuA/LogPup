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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { renameSprint, updateSprintDates } from '@/features/sprints/actions'
import { shiftEndDate, sprintDurationLabel } from '@/features/sprints/sprint-date-range'
import type { Sprint } from '@/features/sprints/queries'

type FormState = { name: string; startDate: string; endDate: string }

function toFormState(sprint: Sprint): FormState {
  return { name: sprint.name, startDate: sprint.startDate, endDate: sprint.endDate }
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * The roadmap's non-drag route to the exact same edits a mouse/touch drag
 * makes (move dates, rename) — what the roadmap's keyboard hint means by
 * "resize goes through the sprint dialog": there's no keyboard route for
 * dragging an edge, but typing an exact date here reaches the same place.
 * Also the roadmap row's quick menu's "Edit dates" item.
 */
export function SprintEditDialog({
  sprint,
  onOpenChange,
}: {
  sprint: Sprint | null
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<FormState>(() => (sprint ? toFormState(sprint) : { name: '', startDate: '', endDate: '' }))
  const [endDateTouched, setEndDateTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Same render-time re-sync pattern as TaskDialog: adjusts `form` when a
  // (possibly different) sprint is opened, without a useEffect.
  const [syncedSprint, setSyncedSprint] = useState(sprint)
  if (sprint !== syncedSprint) {
    setSyncedSprint(sprint)
    if (sprint) setForm(toFormState(sprint))
    setEndDateTouched(false)
    setError(null)
  }

  function handleStartDateChange(newStart: string) {
    setForm((f) => {
      const canShift =
        !endDateTouched &&
        ISO_DATE_RE.test(f.startDate) &&
        ISO_DATE_RE.test(f.endDate) &&
        ISO_DATE_RE.test(newStart)
      return { ...f, startDate: newStart, endDate: canShift ? shiftEndDate(f.startDate, f.endDate, newStart) : f.endDate }
    })
    setError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!sprint) return
    setError(null)
    startTransition(async () => {
      try {
        if (form.name !== sprint.name) {
          const res = await renameSprint(sprint.id, form.name)
          if (!res.ok) {
            setError(res.error)
            return
          }
        }
        if (form.startDate !== sprint.startDate || form.endDate !== sprint.endDate) {
          const res = await updateSprintDates(sprint.id, form.startDate, form.endDate)
          if (!res.ok) {
            setError(res.error)
            return
          }
        }
        toast.success('Sprint updated')
        onOpenChange(false)
        router.refresh()
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
          <DialogDescription>Rename this sprint or move its dates.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sprint-edit-name">Name</Label>
            <Input
              id="sprint-edit-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              minLength={2}
              maxLength={60}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sprint-edit-start">Start date</Label>
              <Input
                id="sprint-edit-start"
                type="date"
                className="font-mono hover:border-ring/40"
                value={form.startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="sprint-edit-end">End date</Label>
                {durationLabel ? (
                  <span className="font-mono text-2xs tabular-nums text-muted-foreground">{durationLabel}</span>
                ) : null}
              </div>
              <Input
                id="sprint-edit-end"
                type="date"
                className="font-mono hover:border-ring/40"
                value={form.endDate}
                onChange={(e) => {
                  setEndDateTouched(true)
                  setForm((f) => ({ ...f, endDate: e.target.value }))
                  setError(null)
                }}
                aria-invalid={Boolean(error)}
                required
              />
            </div>
          </div>
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
