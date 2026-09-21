'use client'

import { useId } from 'react'
import { Loader2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatMoney, splitByForce, type RateIntervalRow } from '@/features/finance/rate-intervals'

/**
 * Shared in-force block + "Earlier rates" history disclosure, used by the
 * role and person rate cards (project value has no interval list — one row
 * per app — so it does not use this).
 *
 * Close lives in the in-force block, not in a table row: unlike the holidays
 * calendar this has no off-screen action column to lose on mobile, because
 * there is exactly one live Close target at a time.
 *
 * A `scheduled` row (effectiveFrom in the future) renders inside the
 * in-force block with a "from <date>" note rather than a third zone — the
 * half-open maths in splitByForce produces that split for free.
 */
export function RatesIntervalTable<R extends RateIntervalRow>({
  rows,
  today,
  subjectHeader,
  subjectOf,
  onClose,
  closingId,
}: {
  rows: R[]
  /** Asia/Colombo "today", threaded from the server — never new Date() here. */
  today: string
  subjectHeader: string
  subjectOf: (row: R) => string
  onClose: (row: R) => void
  /** id of the row mid-close, or null — disables only that row's own Close. */
  closingId: string | null
}) {
  const headingId = useId()
  const { inForce, scheduled, history } = splitByForce(rows, today)
  const current = [...inForce, ...scheduled]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <h4
          id={headingId}
          className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          In force now
        </h4>
        {current.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing in force right now.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{subjectHeader}</TableHead>
                  <TableHead scope="col" className="text-right">
                    Amount
                  </TableHead>
                  <TableHead scope="col">From</TableHead>
                  <TableHead scope="col">Set by</TableHead>
                  <TableHead scope="col" className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {current.map((row) => {
                  const isScheduled = row.effectiveFrom > today
                  return (
                    <TableRow key={row.id} className={isScheduled ? undefined : 'bg-accent/40'}>
                      <TableCell className="max-w-48 break-words font-medium">
                        {subjectOf(row)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatMoney(row.hourly, row.currency)}
                      </TableCell>
                      <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                        {isScheduled ? `from ${row.effectiveFrom}` : row.effectiveFrom}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.setByName ?? '—'}
                      </TableCell>
                      <TableCell>
                        {isScheduled ? null : (
                          <RatesCloseDialog
                            subjectLabel={subjectOf(row)}
                            onConfirm={() => onClose(row)}
                            pending={closingId === row.id}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {history.length > 0 ? (
        <details className="group rounded-xl border border-dashed border-border px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground marker:text-muted-foreground/50">
            Earlier rates ({history.length})
          </summary>
          <div className="overflow-x-auto pt-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{subjectHeader}</TableHead>
                  <TableHead scope="col" className="text-right">
                    Amount
                  </TableHead>
                  <TableHead scope="col">From</TableHead>
                  <TableHead scope="col">To</TableHead>
                  <TableHead scope="col">Set by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-48 break-words">{subjectOf(row)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                      {formatMoney(row.hourly, row.currency)}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                      {row.effectiveFrom}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                      {row.effectiveTo}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.setByName ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </details>
      ) : null}
    </div>
  )
}

function RatesCloseDialog({
  subjectLabel,
  onConfirm,
  pending,
}: {
  subjectLabel: string
  onConfirm: () => void
  pending: boolean
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" size="sm" disabled={pending} />}>
        {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
        Close
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Close this rate for {subjectLabel}?</AlertDialogTitle>
          <AlertDialogDescription>
            Hours logged from this day on will be priced by whatever rate you set next; every
            hour before it keeps this one. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={onConfirm}>
            Close rate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
