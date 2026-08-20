'use client'

import { useId, useState, useTransition } from 'react'
import { format } from 'date-fns'
import { Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createAbsence } from '@/features/worklog/absence-actions'
import type { MyAbsence } from '@/features/worklog/queries'
import { overlaps } from '@/features/worklog/schedules'
import { HelpNote } from '@/components/shared/help-note'

/**
 * "I was not working that day."
 *
 * Until this existed the only way to clear a day from the catch-up list was to
 * log an entry implying work happened, and the panel's copy had to apologise
 * for it. Filing here does NOT clear the day by itself: the absence starts
 * pending, a pending absence never exempts a day (coverage.ts), and the day
 * moves to the panel's "waiting on approval" group rather than vanishing.
 * Anything that let a person lower their own denominator by typing would be
 * self-approval wearing a different hat.
 */

export type AbsenceKind = MyAbsence['kind']

/** Every kind the column can hold, for reading back what was filed. */
export const ABSENCE_KIND_LABELS: Record<AbsenceKind, string> = {
  annual: 'Annual leave',
  sick: 'Sick leave',
  unpaid: 'Unpaid leave',
  training: 'Training',
  other_project: 'On another project',
  no_work_assigned: 'No work assigned',
  other: 'Other',
}

/**
 * The five a person may declare ABOUT THEMSELVES, mirroring SELF_DECLARABLE in
 * absence-actions.ts — which validates the same list server-side, so this can
 * only ever be narrower than what is accepted, never wider.
 *
 * `no_work_assigned` is missing on purpose: it is a statement about the studio
 * failing to give someone work, and a person filing it against themselves
 * turns a grievance into a form field. `other` is the admin escape hatch.
 * Neither belongs in a self-service picker.
 */
export const SELF_DECLARABLE_KINDS = [
  'annual',
  'sick',
  'unpaid',
  'training',
  'other_project',
] as const satisfies readonly AbsenceKind[]

type SelfDeclarableKind = (typeof SELF_DECLARABLE_KINDS)[number]

/** An absence already on file — pending or approved — that a new one may clash with. */
export type FiledAbsence = {
  startDate: string
  endDate: string
  kind: AbsenceKind
  status: 'pending' | 'approved'
}

/** Both bounds inclusive, so a one-day absence reads as the day itself. */
export function formatAbsenceRange(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T12:00:00`)
  if (startDate === endDate) return format(start, 'EEE d MMM yyyy')
  return `${format(start, 'd MMM')} – ${format(new Date(`${endDate}T12:00:00`), 'd MMM yyyy')}`
}

/** A `type="date"` field reports '' and every partial state while being typed into. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

type Refusal =
  | { kind: 'reversed' }
  | { kind: 'clash'; clash: FiledAbsence }
  | { kind: 'nothing-owed' }

export function DeclareAbsenceDialog({
  day,
  filed,
  owedDays,
  knownFrom,
  knownTo,
}: {
  /** The catch-up day this button sits on. Pre-fills BOTH bounds. */
  day: string
  /** Pending and approved absences, so a clash can be named without a roundtrip. */
  filed: readonly FiledAbsence[]
  /** Days in the known window the studio expected work on — fraction > 0. */
  owedDays: readonly string[]
  /** The window `owedDays` describes: [knownFrom, knownTo). */
  knownFrom: string
  knownTo: string
}) {
  const [open, setOpen] = useState(false)
  const [startDate, setStartDate] = useState(day)
  const [endDate, setEndDate] = useState(day)
  const [kind, setKind] = useState<SelfDeclarableKind | ''>('')
  const [reason, setReason] = useState('')
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()
  // One dialog per day is rendered in the catch-up panel, so a fixed id would
  // point every label at the first day's controls.
  const fieldId = useId()

  function handleOpenChange(next: boolean) {
    setOpen(next)
    // Re-seed from the day on every open change. The initializers above run
    // once at mount, and this instance outlives a filing: without this, a
    // second visit would show whatever was typed the first time.
    setStartDate(day)
    setEndDate(day)
    setKind('')
    setReason('')
    setServerError(null)
  }

  const datesReady = ISO_DATE_RE.test(startDate) && ISO_DATE_RE.test(endDate)

  /**
   * The three ways this can be refused before it is worth a roundtrip. Each
   * one is a different sentence, because "that didn't work" tells a person
   * nothing about which of the three they hit.
   *
   * The server checks the first two again and is the authority on both — this
   * set of filed absences is only the ones the panel loaded.
   */
  const refusal: Refusal | null = !datesReady
    ? null
    : endDate < startDate
      ? { kind: 'reversed' }
      : ((): Refusal | null => {
          const clash = filed.find((row) => overlaps({ startDate, endDate }, row))
          if (clash) return { kind: 'clash', clash }
          // A range of Sundays and holidays files a request that exempts
          // nothing and asks somebody to approve nothing. Only ever claimed
          // about days the panel has coverage for — a range reaching outside
          // the window is not a no-op anyone here can prove.
          const known = startDate >= knownFrom && endDate < knownTo
          if (known && !owedDays.some((owed) => owed >= startDate && owed <= endDate)) {
            return { kind: 'nothing-owed' }
          }
          return null
        })()

  function handleSubmit() {
    if (!kind || refusal || !datesReady) return
    setServerError(null)
    startSaving(async () => {
      try {
        const res = await createAbsence({
          startDate,
          endDate,
          kind,
          reason: reason.trim() ? reason.trim() : undefined,
        })
        if (!res.ok) {
          setServerError(res.error)
          return
        }
        // Deliberately not optimistic. The action revalidates /worklog, and
        // what comes back is the truth: the day leaves the gap list and joins
        // the waiting-on-approval group. Pretending it was approved would put
        // the panel a state ahead of the record.
        toast.success('Filed — waiting on approval')
        handleOpenChange(false)
      } catch {
        setServerError('Could not file that — try again')
      }
    })
  }

  /** Typed like every other Select handler here: Base UI reports a cleared
   *  selection as null, and '' is this form's "not chosen yet". */
  function handleKindChange(value: string | null) {
    setKind((value ?? '') as SelfDeclarableKind | '')
  }

  const errorId = `${fieldId}-error`
  const hasError = Boolean(refusal || serverError)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Not a working day
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Not a working day</DialogTitle>
          <DialogDescription>
            You are saying you owed no work on{' '}
            {format(new Date(`${day}T12:00:00`), 'EEEE, MMMM d')}. It goes for approval — until
            somebody approves it, the day still counts as unlogged.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-start`}>First day</Label>
              <Input
                id={`${fieldId}-start`}
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value)
                  setServerError(null)
                }}
                required
                aria-invalid={refusal?.kind === 'reversed'}
                aria-describedby={hasError ? errorId : undefined}
                className="h-9 font-mono hover:border-ring/40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-end`}>Last day</Label>
              <Input
                id={`${fieldId}-end`}
                type="date"
                value={endDate}
                onChange={(event) => {
                  setEndDate(event.target.value)
                  setServerError(null)
                }}
                required
                aria-invalid={refusal?.kind === 'reversed'}
                aria-describedby={hasError ? errorId : undefined}
                className="h-9 font-mono hover:border-ring/40"
              />
            </div>
          </div>
          {/* Both bounds start on the day that was clicked, so the common
              correction — "it was actually the whole week" — is moving one
              field rather than filling in two. */}
          <HelpNote>Both days count. Move the last day if it ran longer than one.</HelpNote>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-kind`}>What was it?</Label>
            <Select value={kind} onValueChange={handleKindChange}>
              <SelectTrigger id={`${fieldId}-kind`} className="w-full">
                {/* Explicit label mapping — the enum value is the Select's
                    `value`, so without this the trigger renders `other_project`
                    at the person rather than "On another project". */}
                <SelectValue placeholder="Choose one">
                  {(value: string) =>
                    value ? ABSENCE_KIND_LABELS[value as AbsenceKind] : 'Choose one'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SELF_DECLARABLE_KINDS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {ABSENCE_KIND_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* The absent options are the ones that raise a question. "No work
                assigned" is a statement about the studio failing to give
                somebody work, so a person filing it against themselves turns a
                grievance into a form field; it is filed for you, not by you. */}
            <HelpNote>
              Filed for approval either way. If nobody had work for you, an admin files that one —
              it is not yours to declare about yourself.
            </HelpNote>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-reason`}>Anything to add? (optional)</Label>
            <Textarea
              id={`${fieldId}-reason`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              rows={2}
              className="min-h-16"
            />
            <p className="text-2xs text-muted-foreground">
              Whoever reviews this reads it. One line is plenty.
            </p>
          </div>

          {refusal || serverError ? (
            <p
              id={errorId}
              role="alert"
              className="text-2xs text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-150"
            >
              {refusal?.kind === 'reversed' ? (
                'That ends before it starts — the last day has to be on or after the first.'
              ) : refusal?.kind === 'clash' ? (
                <>
                  {'Those days overlap one you already filed — '}
                  <span className="font-medium">{ABSENCE_KIND_LABELS[refusal.clash.kind]}</span>
                  {', '}
                  <span className="font-mono tabular-nums">
                    {formatAbsenceRange(refusal.clash.startDate, refusal.clash.endDate)}
                  </span>
                  {refusal.clash.status === 'approved'
                    ? ', already approved.'
                    : ', still waiting on approval.'}
                </>
              ) : refusal?.kind === 'nothing-owed' ? (
                'Nothing to file — not one of those days was a working day for you. Sundays, public holidays and days your schedule leaves empty already do not count.'
              ) : (
                serverError
              )}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          {/* An explicit way out. Esc and the backdrop still work, but a
              dialog whose only button files the thing teaches people the only
              exit is submitting — the same defect ReportBugDialog fixed. */}
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !kind || !datesReady || Boolean(refusal)}
          >
            {saving ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
            Send for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
