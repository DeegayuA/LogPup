'use client'

import { useId, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarOff, Loader2Icon, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { addOrgHoliday, revokeOrgHoliday } from '@/features/worklog/org-holiday-actions'
import type { OrgHolidayRow } from '@/features/worklog/org-holiday-queries'
import { LK_HOLIDAYS, toIsoDateInTimeZone } from '@/lib/lk-holidays'

/**
 * Company holidays are GLOBAL: `org_holidays.day` is unique, so a holiday
 * added here applies to the whole workspace, never one team. There is no
 * per-team variant to add later — `holiday.manage` is deliberately unscoped.
 */
export function OrgHolidaysCard({ holidays }: { holidays: OrgHolidayRow[] }) {
  const router = useRouter()
  const fieldId = useId()

  const [day, setDay] = useState('')
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, startAdding] = useTransition()

  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [revoking, startRevoking] = useTransition()

  // "Today" in Sri Lanka, not the browser's local date — the same rule the
  // calendar views use, so the past/future line falls on the same day here
  // as it does everywhere else that reads LK_HOLIDAYS.
  const todayIso = useMemo(() => toIsoDateInTimeZone(new Date()), [])

  const gazetted = day ? LK_HOLIDAYS[day] : undefined
  const isPast = Boolean(day) && day < todayIso

  function resetForm() {
    setDay('')
    setName('')
    setNote('')
    setAddError(null)
  }

  function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!day || !trimmedName) return
    setAddError(null)
    startAdding(async () => {
      try {
        const res = await addOrgHoliday({
          day,
          name: trimmedName,
          note: note.trim() ? note.trim() : undefined,
        })
        if (!res.ok) {
          // The action collapses every failure — including the UNIQUE
          // violation on `day` — into one generic message. Name the actual
          // occupant when we have it in the list we already loaded, rather
          // than leaving the admin to guess which day collided. `day` is
          // unique forever, even for a cancelled row, so this can fire on a
          // row that no longer counts as a holiday too.
          const collision = holidays.find((h) => h.day === day)
          setAddError(
            collision
              ? `${day} is already on file as a company holiday — ${collision.name}.`
              : res.error,
          )
          return
        }
        toast.success('Holiday added')
        resetForm()
        router.refresh()
      } catch {
        setAddError('Something went wrong — try again')
      }
    })
  }

  function handleRevoke(holiday: OrgHolidayRow) {
    setRevokingId(holiday.id)
    startRevoking(async () => {
      try {
        const res = await revokeOrgHoliday({ id: holiday.id })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(`${holiday.name} revoked`)
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      } finally {
        setRevokingId(null)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Add a company holiday</CardTitle>
          <CardDescription>
            This applies to everyone in the workspace, not just one team or office —
            every person&apos;s coverage is exempt on this day once it is added.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-day`}>Date</Label>
                <Input
                  id={`${fieldId}-day`}
                  type="date"
                  value={day}
                  onChange={(event) => {
                    setDay(event.target.value)
                    setAddError(null)
                  }}
                  required
                  className="h-9 font-mono hover:border-ring/40"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-name`}>Name</Label>
                <Input
                  id={`${fieldId}-name`}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    setAddError(null)
                  }}
                  maxLength={120}
                  required
                  placeholder="Studio shutdown"
                  className="h-9"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-note`}>Note (optional)</Label>
              <Textarea
                id={`${fieldId}-note`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={200}
                rows={2}
                className="min-h-16"
              />
            </div>

            {gazetted ? (
              <p className="flex items-start gap-1.5 rounded-lg border border-warning/35 bg-warning/5 px-3 py-2 text-2xs text-warning">
                <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {day} is already a gazetted Sri Lankan public holiday ({gazetted.name}).
                  Adding this is harmless for coverage but will show as a duplicate in the
                  list below.
                </span>
              </p>
            ) : null}

            {isPast ? (
              <p className="flex items-start gap-1.5 rounded-lg border border-warning/35 bg-warning/5 px-3 py-2 text-2xs text-warning">
                <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  This date has already passed — adding it will retroactively exempt
                  everyone from logging that day, even if someone was already told they
                  missed it.
                </span>
              </p>
            ) : null}

            {addError ? (
              <p role="alert" className="text-2xs text-destructive">
                {addError}
              </p>
            ) : null}

            <Button type="submit" disabled={adding || !day || !name.trim()} className="self-start">
              {adding ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
              Add holiday
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company holidays</CardTitle>
          <CardDescription>
            Composed on top of the gazetted Sri Lankan calendar, soonest first. Revoking
            one does not delete it — the row stays, marked cancelled from a date, so it
            stays visible here even once it no longer counts as a holiday.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {holidays.length === 0 ? (
            <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <CalendarOff className="size-5 text-muted-foreground/60" aria-hidden />
              <p className="text-sm font-medium">No company holidays are set.</p>
              <p className="text-xs text-muted-foreground">
                Gazetted Sri Lankan public holidays already apply automatically and are
                not listed here — add one above only for a day the studio shuts down on
                top of that calendar.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Added by</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((holiday) => {
                  // Cancelling always takes effect "today" (revokeOrgHoliday sets
                  // revokedFrom to Colombo's today), and orgHolidaySet's rule is
                  // strict `day < revokedFrom` — so a day that is today or still to
                  // come drops out of force, but a day that already passed keeps
                  // its exemption forever, no matter when it is cancelled.
                  const staysExcusedIfRevoked = holiday.day < todayIso
                  const isCancelled = holiday.revokedFrom !== null

                  return (
                    <TableRow key={holiday.id}>
                      <TableCell className="font-mono text-xs tabular-nums">{holiday.day}</TableCell>
                      <TableCell className="font-medium">{holiday.name}</TableCell>
                      <TableCell className="text-muted-foreground">{holiday.note ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {holiday.createdByName ?? '—'}
                      </TableCell>
                      <TableCell>
                        {isCancelled ? (
                          <Badge variant="outline" className="font-mono text-2xs tabular-nums">
                            Cancelled from {holiday.revokedFrom}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">In force</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {isCancelled ? null : (
                          <AlertDialog>
                            <AlertDialogTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={revoking && revokingId === holiday.id}
                                />
                              }
                            >
                              Revoke
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revoke {holiday.name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {staysExcusedIfRevoked
                                    ? 'This day has already passed, so cancelling it changes nothing about coverage — everyone who already had it off keeps it excused. It only marks the holiday cancelled in the record; this cancellation cannot be undone.'
                                    : 'This day will count as a working day again for everyone. Coverage already reported for it does not change. This cancellation cannot be undone.'}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  disabled={revoking && revokingId === holiday.id}
                                  onClick={() => handleRevoke(holiday)}
                                >
                                  Revoke
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
