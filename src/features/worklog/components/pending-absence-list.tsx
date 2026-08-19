'use client'

import { useState, useTransition } from 'react'
import { Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { bilingualText } from '@/features/meetings/components/meeting-chips'
import { withdrawAbsence } from '@/features/worklog/absence-actions'
import {
  ABSENCE_KIND_LABELS,
  formatAbsenceRange,
} from '@/features/worklog/components/declare-absence-dialog'
import type { MyAbsence } from '@/features/worklog/queries'

/**
 * What a person has filed and nobody has decided yet.
 *
 * These days have left the gap list above — they are dealt with — but they
 * have NOT left the count: a pending absence exempts nothing, so the panel
 * says so above this list rather than letting the person's coverage number
 * and this panel disagree.
 *
 * Withdraw is here because the alternative is a state only somebody else can
 * clear: a range filed by mistake would otherwise sit in an approver's inbox
 * and keep its days out of the catch-up list until they got round to
 * rejecting it.
 */
export function PendingAbsenceList({ absences }: { absences: MyAbsence[] }) {
  return (
    <ul className="flex flex-col divide-y rounded-xl border bg-card">
      {absences.map((absence) => (
        <PendingAbsenceRow key={absence.id} absence={absence} />
      ))}
    </ul>
  )
}

function PendingAbsenceRow({ absence }: { absence: MyAbsence }) {
  const [withdrawing, startWithdrawing] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleWithdraw() {
    setError(null)
    startWithdrawing(async () => {
      try {
        const res = await withdrawAbsence({ id: absence.id })
        if (!res.ok) {
          // Most likely someone reviewed it a moment ago. The action
          // revalidates either way, so the row rerenders as whatever it now is.
          setError(res.error)
          return
        }
        toast.success('Withdrawn')
      } catch {
        setError('Could not withdraw that — try again')
      }
    })
  }

  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2">
      <span className="w-40 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
        {formatAbsenceRange(absence.startDate, absence.endDate)}
      </span>
      <span className="text-sm font-medium">{ABSENCE_KIND_LABELS[absence.kind]}</span>
      {absence.reason ? (
        <span className={cn(bilingualText, 'min-w-0 flex-1 text-sm text-muted-foreground')}>
          {absence.reason}
        </span>
      ) : (
        <span className="flex-1" />
      )}
      {error ? (
        <span role="alert" className="text-2xs text-destructive">
          {error}
        </span>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleWithdraw}
        disabled={withdrawing}
      >
        {withdrawing ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
        Withdraw
      </Button>
    </li>
  )
}
