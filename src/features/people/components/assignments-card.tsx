'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { Crown, LayoutGrid, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { AssignDialog } from '@/features/people/components/assign-dialog'
import { removeAssignment } from '@/features/people/actions'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CapacityBar, capacityBand } from '@/features/people/components/capacity-bar'
import { SectionEmpty } from '@/features/people/components/section-empty'
import { formatPct, PCT_CLASS } from '@/features/people/format-pct'
import type { AssignableApp, PersonAssignment } from '@/features/people/queries'
import { cn } from '@/lib/utils'

const linkClass =
  'rounded-sm underline-offset-2 transition-colors duration-150 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

const APP_STATUS_LABEL: Record<PersonAssignment['appStatus'], string> = {
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
}

/**
 * Where the person's capacity actually goes.
 *
 * OVER-ALLOCATION IS SHOWN, NOT LEFT TO BE COUNTED. Each row's share bar is
 * scaled against `max(total, 100)` — the same denominator for every row — so a
 * person at 130% draws four rows that visibly overflow the 100% marker instead
 * of four bars that each look reasonable. The old card clipped every row at
 * 100% individually, which made 130% and 100% draw an identical picture.
 *
 * The marker is the 100% line, and it is drawn ONLY when someone is over it.
 * At or under 100% the line would sit hard against the right edge of the track,
 * where it is either clipped by the rounded mask or reads as a stray tick on
 * every row of every normally-loaded person — noise on the common case to
 * explain the rare one. Past 100% it slides left, and everything beyond it is
 * the overage. Colour never carries that alone: CapacityBar's aria-label names
 * the band, and the sentence below the meter says it in words.
 */
export function AssignmentsCard({
  assignments,
  totalPct,
  overallocated,
  personId,
  personName,
  assignableApps = [],
  canAssign = false,
}: {
  assignments: PersonAssignment[]
  totalPct: number
  overallocated: boolean
  /** Whose workload this is — the fixed end of every allocation edited here. */
  personId?: string
  personName?: string
  /** Live, non-archived projects to choose from. Empty when the reader cannot assign. */
  assignableApps?: AssignableApp[]
  /**
   * `app.assign`, resolved on the server. The controls are hidden without it
   * AND the action checks again — this gate is about not offering a door that
   * would be refused, never about being the lock.
   */
  canAssign?: boolean
}) {
  const scale = Math.max(totalPct, 100)
  const band = capacityBand(totalPct)
  const [isPending, startTransition] = useTransition()

  /* Editable only when we know WHOSE workload this is. The card is rendered in
     one place today, but a caller that forgot to pass the person would
     otherwise get an "Add to a project" button that assigns nobody. */
  const editable = canAssign && personId !== undefined

  function handleRemove(assignmentId: string, appName: string) {
    startTransition(async () => {
      try {
        const res = await removeAssignment(assignmentId)
        if (!res.ok) toast.error(res.error)
        else toast.success(`Taken off ${appName}`)
      } catch {
        // A thrown error is not `{ ok: false }` — without this catch it is an
        // unhandled rejection and Remove silently does nothing. Same fix
        // TeamPanel.handleRemove documents.
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Workload</CardTitle>
        <CardAction className="flex items-center gap-2">
          <span className={cn(PCT_CLASS, 'text-xs text-muted-foreground')}>
            {assignments.length} {assignments.length === 1 ? 'app' : 'apps'}
          </span>
          {editable ? (
            <AssignDialog
              userId={personId}
              apps={assignableApps}
              personTotalPct={totalPct}
              trigger={
                <Button variant="outline" size="sm">
                  <Plus aria-hidden /> Add to project
                </Button>
              }
            />
          ) : null}
        </CardAction>
      </CardHeader>

      {assignments.length === 0 ? (
        <SectionEmpty
          icon={LayoutGrid}
          title="Not assigned to any app."
          hint={
            editable
              ? 'Add them to a project above — allocations can also be set from an app’s Team panel.'
              : "Allocations are set from an app's Team panel, or inline on the dashboard capacity list."
          }
        />
      ) : (
        <>
          <CardContent className="flex flex-col divide-y divide-border">
            {assignments.map((entry) => (
              <div key={entry.appId} className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  {/* Lands on the app's Team panel rather than the page top.
                      It is no longer the ONLY place this allocation can be
                      edited — the controls at the end of this row do it from
                      here — but it is still where the rest of that project's
                      team is. */}
                  <Link
                    href={`/apps/${entry.slug}#team`}
                    className={cn('truncate text-sm font-medium', linkClass)}
                  >
                    {entry.appName}
                  </Link>
                  {entry.isLead ? (
                    <Badge variant="secondary" className="text-2xs">
                      <Crown aria-hidden /> Lead
                    </Badge>
                  ) : null}
                  {entry.appStatus !== 'active' ? (
                    <Badge variant="outline" className="text-2xs text-muted-foreground">
                      {APP_STATUS_LABEL[entry.appStatus]}
                    </Badge>
                  ) : null}
                  <span className="truncate text-xs text-muted-foreground">{entry.role}</span>
                  <span className={cn(PCT_CLASS, 'ml-auto text-xs')}>
                    {formatPct(entry.allocationPct)}
                  </span>
                  {editable ? (
                    <span className="flex shrink-0 items-center gap-0.5">
                      <AssignDialog
                        userId={personId}
                        apps={assignableApps}
                        personTotalPct={totalPct}
                        // The edit form wants the shape the app side passes it.
                        // appId/slug/appName are this card's language; assignmentId,
                        // userId, role and allocationPct are what the action needs.
                        assignment={{
                          assignmentId: entry.assignmentId,
                          userId: personId,
                          name: personName ?? 'this person',
                          email: '',
                          avatarUrl: null,
                          phone: null,
                          role: entry.role,
                          allocationPct: entry.allocationPct,
                          employmentType: null,
                        }}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${personName ?? 'this person'}’s allocation on ${entry.appName}`}
                          >
                            <Pencil aria-hidden />
                          </Button>
                        }
                      />
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={isPending}
                              aria-label={`Take ${personName ?? 'this person'} off ${entry.appName}`}
                            />
                          }
                        >
                          <Trash2 aria-hidden className="text-destructive" />
                        </AlertDialogTrigger>
                        {/* Two steps, because this is not undoable from here:
                            removing closes the allocation interval and writes a
                            history row. Re-adding is possible but it is a new
                            interval, not the old one restored. */}
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Take {personName ?? 'this person'} off {entry.appName}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Their {formatPct(entry.allocationPct)} goes back to their
                              headroom. Work already logged against this project keeps their
                              name on it — this ends the allocation, not the record.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemove(entry.assignmentId, entry.appName)}
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </span>
                  ) : null}
                </div>
                {/* Every row shares one denominator, so the widths add up to
                    the whole meter — the reason the overflow past the 100%
                    marker is legible at all. */}
                <div className="relative h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className={cn(
                      'h-full rounded-full',
                      entry.appStatus === 'archived' ? 'bg-muted-foreground/40' : 'bg-primary',
                    )}
                    style={{ width: `${(entry.allocationPct / scale) * 100}%` }}
                  />
                  {/* Two device pixels and pulled back onto its own line, so
                      the marker sits ON 100% rather than starting at it. A
                      single `w-px` hairline at 60% opacity was very close to
                      invisible against `bg-muted` on a 6px track — which
                      defeated the whole point of drawing a reference line. */}
                  {overallocated ? (
                    <span
                      className="absolute inset-y-0 -ml-px w-0.5 bg-destructive"
                      style={{ left: `${(100 / scale) * 100}%` }}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>

          <CardContent className="flex flex-col gap-2 border-t border-border pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">Total capacity</span>
              {overallocated ? (
                <span className={cn(PCT_CLASS, 'text-xs font-medium text-destructive')}>
                  {formatPct(totalPct - 100)} over
                </span>
              ) : (
                <span className={cn(PCT_CLASS, 'text-xs text-muted-foreground')}>
                  {formatPct(100 - totalPct)} free
                </span>
              )}
            </div>
            <CapacityBar totalPct={totalPct} />
            {band === 'over' ? (
              <p className="text-xs text-destructive">
                Over capacity — something here has to give before anything new lands.
              </p>
            ) : null}
            {band === 'near' ? (
              <p className="text-xs text-muted-foreground">
                Near capacity — little room for anything new.
              </p>
            ) : null}
          </CardContent>
        </>
      )}
    </Card>
  )
}
