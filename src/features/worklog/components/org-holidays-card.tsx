'use client'

import { useId, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarOff, Loader2Icon, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
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
import {
  buildHolidayCalendar,
  closesTheStudio,
  splitByDay,
  HOLIDAY_CATEGORY_LABEL,
  type HolidayCalendarRow,
} from '@/features/worklog/holiday-listing'
import { excusesWork, LK_HOLIDAYS, toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { cn } from '@/lib/utils'

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

  // Both sources in one list. The gazetted days are what exempt most of the
  // year, so a page that showed only `org_holidays` could not answer the
  // question it exists to answer.
  const { upcoming, past } = useMemo(
    () => splitByDay(buildHolidayCalendar(holidays), todayIso),
    [holidays, todayIso],
  )

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

  function handleRevoke(holiday: HolidayCalendarRow) {
    // Gazetted rows never reach here — they have no orgId and render no
    // Revoke control. The guard is belt-and-braces for the type, not a case
    // the UI can produce.
    if (!holiday.orgId) return
    const orgId = holiday.orgId
    setRevokingId(orgId)
    startRevoking(async () => {
      try {
        const res = await revokeOrgHoliday({ id: orgId })
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
          <CardTitle as="h2">Add a company holiday</CardTitle>
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
                  {/* Whether the gazetted day already closes the studio changes what
                      adding one on top of it MEANS — a duplicate, or the thing that
                      makes the day off real. Saying "harmless" for both was wrong for
                      the bank closing days, which the studio works through. */}
                  {excusesWork(gazetted.categories)
                    ? `${day} is already a Sri Lankan mercantile holiday (${gazetted.name}), so nobody logs work that day either way. Adding this is harmless for coverage but will show as a duplicate in the list below.`
                    : `${day} is gazetted (${gazetted.name}) but NOT on the mercantile list, so it is an ordinary working day here. Adding it will genuinely close the studio that day.`}
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
          <CardTitle as="h2">Holiday calendar</CardTitle>
          <CardDescription>
            Every gazetted and company holiday, from both sources at once — and whether
            each one actually shuts the studio. Only the Mercantile list (Shop and
            Office Employees Act) excuses anyone from logging work, so a gazetted day
            without it, such as a bank closing day, is a normal working day here.
            Gazetted days apply automatically and are read-only; company holidays sit on
            top of that calendar and can be revoked. Revoking does not delete — the row
            stays, marked cancelled from a date, so it is still visible once it no
            longer counts as a holiday.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {upcoming.length === 0 && past.length === 0 ? (
            <EmptyState
              icon={CalendarOff}
              title="No holidays on file."
              description="The gazetted Sri Lankan calendar only covers the years listed in lk-holidays.ts — add a company holiday above for any day the studio shuts down on top of it."
              className="rounded-xl border border-dashed border-border"
            />
          ) : (
            <>
              <section className="flex flex-col gap-2">
                <h3 className="font-heading text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Upcoming
                </h3>
                {upcoming.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nothing left on the calendar — every holiday on file has passed.
                  </p>
                ) : (
                  renderHolidayTable(upcoming)
                )}
              </section>

              {past.length > 0 ? (
                <details className="group rounded-xl border border-dashed border-border px-3 py-2">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground marker:text-muted-foreground/50">
                    Already passed ({past.length})
                  </summary>
                  <div className="pt-3">{renderHolidayTable(past)}</div>
                </details>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )

  /**
   * The revoke control, shared by both layouts. The two dialog sentences are
   * load-bearing: a past day keeps its exemption forever (strict
   * `day < revokedFrom` in orgHolidaySet), a future day genuinely reopens.
   */
  function renderRevoke(holiday: HolidayCalendarRow, staysExcusedIfRevoked: boolean) {
    if (holiday.source === 'gazette' || holiday.revokedFrom !== null) return null
    return (
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              disabled={revoking && revokingId === holiday.orgId}
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
              disabled={revoking && revokingId === holiday.orgId}
              onClick={() => handleRevoke(holiday)}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  /** The per-row facts both layouts print. Derived once, rendered twice. */
  function rowFacts(holiday: HolidayCalendarRow) {
    // Cancelling always takes effect "today" (revokeOrgHoliday sets
    // revokedFrom to Colombo's today), and orgHolidaySet's rule is
    // strict `day < revokedFrom` — so a day that is today or still to
    // come drops out of force, but a day that already passed keeps
    // its exemption forever, no matter when it is cancelled.
    const staysExcusedIfRevoked = holiday.day < todayIso
    const isCancelled = holiday.revokedFrom !== null
    const isGazetted = holiday.source === 'gazette'
    // The consequence, not the paperwork. Category badges are evidence
    // for this line; on their own they ask the reader to know which
    // gazette list means a day off, which is the thing they came here
    // to look up.
    const closes = closesTheStudio(holiday)
    return { staysExcusedIfRevoked, isCancelled, isGazetted, closes }
  }

  function renderAppliesAs(holiday: HolidayCalendarRow, isGazetted: boolean, closes: boolean) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap gap-1">
          {isGazetted ? (
            // The gazette publishes these lists separately, and
            // which one a day is on decides who actually gets it
            // off — a bank-only closing day is not a day the
            // studio closes. Showing the categories is the whole
            // point of listing gazetted days here.
            holiday.categories.map((category) => (
              <Badge key={category} variant="outline" className="text-2xs">
                {HOLIDAY_CATEGORY_LABEL[category]}
              </Badge>
            ))
          ) : (
            <Badge variant="secondary" className="text-2xs">Company</Badge>
          )}
        </div>
        {/* Words, not a colour: the two outcomes have to be
            distinguishable to a reader who cannot compare hues. */}
        <span
          className={cn(
            'text-2xs',
            closes ? 'font-medium text-foreground' : 'text-muted-foreground',
          )}
        >
          {closes
            ? 'Studio closed — no work logged'
            : isGazetted
              ? 'Studio open — not a mercantile holiday'
              : 'Studio open — this holiday was cancelled'}
        </span>
      </div>
    )
  }

  function renderStatus(holiday: HolidayCalendarRow, isGazetted: boolean, isCancelled: boolean) {
    if (isGazetted) return <Badge variant="secondary">Automatic</Badge>
    if (isCancelled)
      return (
        <Badge variant="outline" className="font-mono text-2xs tabular-nums">
          Cancelled from {holiday.revokedFrom}
        </Badge>
      )
    return <Badge variant="secondary">In force</Badge>
  }

  /**
   * Two layouts for one list. The 7-column table needs ~640px; below md it
   * relied on ui/table's generic horizontal scroll, which parked the Status
   * and Revoke columns off-screen where nobody discovers them — so small
   * screens get stacked cards with every fact (and the Revoke control)
   * visible, and the table keeps the scan-down-a-column read from md up.
   */
  function renderHolidayTable(rows: HolidayCalendarRow[]) {
    return (
      <>
        <ul className="flex flex-col gap-2 md:hidden">
          {rows.map((holiday) => {
            const { staysExcusedIfRevoked, isCancelled, isGazetted, closes } = rowFacts(holiday)
            return (
              <li key={holiday.key} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {holiday.day}
                    </span>
                    <span className="font-medium">{holiday.name}</span>
                  </div>
                  {renderStatus(holiday, isGazetted, isCancelled)}
                </div>
                {renderAppliesAs(holiday, isGazetted, closes)}
                {holiday.note ? (
                  <p className="text-xs text-muted-foreground">{holiday.note}</p>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-2xs text-muted-foreground">
                    {isGazetted ? 'Sri Lanka gazette' : (holiday.addedByName ?? '—')}
                  </span>
                  {renderRevoke(holiday, staysExcusedIfRevoked)}
                </div>
              </li>
            )
          })}
        </ul>

        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Applies as</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Added by</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((holiday) => {
                const { staysExcusedIfRevoked, isCancelled, isGazetted, closes } = rowFacts(holiday)
                return (
                  <TableRow key={holiday.key}>
                    <TableCell className="font-mono text-xs tabular-nums">{holiday.day}</TableCell>
                    <TableCell className="font-medium">{holiday.name}</TableCell>
                    <TableCell>{renderAppliesAs(holiday, isGazetted, closes)}</TableCell>
                    <TableCell className="text-muted-foreground">{holiday.note ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {isGazetted ? 'Sri Lanka gazette' : (holiday.addedByName ?? '—')}
                    </TableCell>
                    <TableCell>{renderStatus(holiday, isGazetted, isCancelled)}</TableCell>
                    <TableCell>{renderRevoke(holiday, staysExcusedIfRevoked)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </>
    )
  }
}
