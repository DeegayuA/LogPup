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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createSprint } from '@/features/sprints/actions'
import { defaultSprintRange, shiftEndDate, sprintDurationLabel } from '@/features/sprints/sprint-date-range'

type FormState = {
  name: string
  goal: string
  startDate: string
  endDate: string
}

type FieldErrors = { endDate?: string }

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Local "today", read from the device's own calendar (not UTC) — this is
// deliberately the one place in the sprint-date flow that isn't pure/UTC,
// because it genuinely needs to know what day it is where the user sits,
// matching what a native <input type="date"> would default to. Everything
// downstream of this string stays in sprint-date-range's pure UTC math.
function todayIsoDate(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function initialFormState(): FormState {
  const { startDate, endDate } = defaultSprintRange(todayIsoDate())
  return { name: '', goal: '', startDate, endDate }
}

// The server only returns a single zod message string (no field path); this
// dialog only ever needs to route one of those back to a field, so it's a
// narrower version of the identifyField pattern used in app-form-dialog.tsx.
function identifyField(message: string): keyof FieldErrors | null {
  if (/on or after the start date/i.test(message)) return 'endDate'
  return null
}

export function SprintFormDialog({ appId }: { appId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<FormState>(initialFormState)
  const [errors, setErrors] = useState<FieldErrors>({})
  // Once the user types their own end date, stop auto-shifting it when the
  // start date changes — otherwise a deliberate end-date choice gets
  // silently overwritten the next time the start date moves, which is the
  // classic calendar-tool bug this dialog is meant to avoid.
  const [endDateTouched, setEndDateTouched] = useState(false)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    // Reset on every transition (not just on close) so a dialog left open
    // across midnight, or reopened later, always starts from today rather
    // than whatever day it happened to be created — the app has been bitten
    // twice by dialogs retaining stale state.
    setForm(initialFormState())
    setErrors({})
    setEndDateTouched(false)
  }

  function handleStartDateChange(newStart: string) {
    setForm((f) => {
      const canShift =
        !endDateTouched &&
        ISO_DATE_RE.test(f.startDate) &&
        ISO_DATE_RE.test(f.endDate) &&
        ISO_DATE_RE.test(newStart)
      return {
        ...f,
        startDate: newStart,
        endDate: canShift ? shiftEndDate(f.startDate, f.endDate, newStart) : f.endDate,
      }
    })
    setErrors((e) => (e.endDate ? { ...e, endDate: undefined } : e))
  }

  function handleEndDateChange(newEnd: string) {
    setEndDateTouched(true)
    setForm((f) => ({ ...f, endDate: newEnd }))
    setErrors((e) => (e.endDate ? { ...e, endDate: undefined } : e))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrors({})
    startTransition(async () => {
      const res = await createSprint({
        appId,
        name: form.name,
        goal: form.goal || undefined,
        startDate: form.startDate,
        endDate: form.endDate,
      })
      if (!res.ok) {
        const field = identifyField(res.error)
        if (field) {
          setErrors((e) => ({ ...e, [field]: res.error }))
        } else {
          toast.error(res.error)
        }
        return
      }
      toast.success('Sprint created')
      handleOpenChange(false)
      router.refresh()
    })
  }

  const durationLabel = sprintDurationLabel(form.startDate, form.endDate)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>New sprint</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New sprint</DialogTitle>
          <DialogDescription>Plan the next sprint for this app.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sprint-name">Name</Label>
            <Input
              id="sprint-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              minLength={2}
              maxLength={60}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sprint-goal">Goal</Label>
            <Textarea
              id="sprint-goal"
              value={form.goal}
              onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
              maxLength={300}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sprint-start">Start date</Label>
              <Input
                id="sprint-start"
                type="date"
                className="font-mono hover:border-ring/40"
                value={form.startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="sprint-end">End date</Label>
                {durationLabel ? (
                  <span
                    id="sprint-duration-hint"
                    className="font-mono text-2xs tabular-nums text-muted-foreground"
                  >
                    {durationLabel}
                  </span>
                ) : null}
              </div>
              <Input
                id="sprint-end"
                type="date"
                className="font-mono hover:border-ring/40"
                value={form.endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                aria-invalid={Boolean(errors.endDate)}
                aria-describedby={
                  errors.endDate ? 'sprint-end-error' : durationLabel ? 'sprint-duration-hint' : undefined
                }
                required
              />
              {errors.endDate ? (
                <p id="sprint-end-error" role="alert" className="text-xs text-destructive">
                  {errors.endDate}
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create sprint'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
