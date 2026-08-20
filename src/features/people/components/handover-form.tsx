'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { todayIso } from '@/features/people/as-of-date'
import { applyHandover } from '@/features/people/handover-actions'
import type { HandoverGroup } from '@/features/people/handover-queries'
import type { TransferableGroup } from '@/features/people/handover-inventory'
import { cn } from '@/lib/utils'

const UNASSIGNED = '__none__'

/**
 * The groups applyHandover can actually move. Everything else in the
 * inventory is rendered WITHOUT a successor picker: the previous version drew
 * a Select for all eight groups, submitted only two of them, and even listed
 * the ignored six as "moving" in the preview — six silent data losses per
 * Confirm. A choice the action cannot honour must not be offered.
 */
const ACTION_MOVES = new Set<TransferableGroup>(['assignments', 'app_roles', 'tasks'])

/** Why each unmovable group is unmovable, and where to handle it instead. */
const MANUAL_NOTE: Partial<Record<TransferableGroup, string>> = {
  meetings:
    'Meetings keep their organizer — reschedule or cancel each one from the meetings list.',
  change_requests:
    'A request records who asked; approve or decline these from the pending queue instead.',
  absences:
    'Leave is personal and cannot be inherited — approve or decline it from the absences queue.',
  app_grants:
    'Stakeholder access closes with the account; grant the successor their own access from each app.',
  followups: 'Follow-ups resolve from their meeting pages.',
}

/**
 * Two modes, because both are real: most handovers go to one person, and the
 * ones that do not are usually a split of allocations rather than of
 * everything.
 *
 * Nothing writes until Confirm. The preview below the controls is the whole
 * point — an operator should see every row that will change before any of them
 * does, and (just as important) exactly which rows will NOT change.
 */
export function HandoverForm({
  leaverId,
  leaverName,
  groups,
  successors,
}: {
  leaverId: string
  leaverName: string
  groups: HandoverGroup[]
  successors: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // Prefilled with today (Asia/Colombo): "they leave today" is the common
  // case, and an empty field used to be enforced only by a toast AFTER the
  // operator had clicked through the whole flow.
  const [lastWorkingDay, setLastWorkingDay] = useState(() => todayIso())
  const [successorByGroup, setSuccessorByGroup] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)
  const [dateError, setDateError] = useState(false)
  // Two-step confirm WITH focus management (repo law for destructive-weight
  // actions): arming moves focus onto the Confirm control, Esc disarms and
  // hands focus back to the button that armed it.
  const confirmRef = useRef<HTMLButtonElement>(null)
  const previewRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (confirming) confirmRef.current?.focus()
  }, [confirming])

  function disarm() {
    setConfirming(false)
    // After this state lands the preview button is back in the tree; focus it
    // on the next frame so keyboard users are not dropped at <body>.
    requestAnimationFrame(() => previewRef.current?.focus())
  }

  const nameOf = (id: string) => successors.find((s) => s.id === id)?.name ?? 'nobody'
  const successorFor = (group: string) => {
    const value = successorByGroup[group] ?? UNASSIGNED
    return value === UNASSIGNED ? null : value
  }

  const movable = groups.filter((g) => ACTION_MOVES.has(g.group))
  const manual = groups.filter((g) => !ACTION_MOVES.has(g.group))
  const unassigned = movable.filter((g) => successorFor(g.group) === null)

  function submit() {
    if (!lastWorkingDay) {
      // Inline, not a toast: the error belongs next to the field it names.
      setDateError(true)
      return
    }
    startTransition(async () => {
      try {
        const taskSuccessor = successorFor('tasks')
        const roleSuccessor = successorFor('app_roles')
        const allocationSuccessor = successorFor('assignments')
        const res = await applyHandover({
          leaverId,
          lastWorkingDay,
          taskSuccessorId: taskSuccessor,
          // Every allocation the leaver holds, moved whole to the chosen
          // successor at the SAME percentage and the leaver's own free-text
          // role — or left unassigned (empty shares) when nobody was picked,
          // which applyHandover treats as "close it and hand it to no one".
          allocations: (groups.find((g) => g.group === 'assignments')?.items ?? []).map(
            (item) => ({
              appId: item.appId!,
              total: item.allocationPct ?? 0,
              role: item.role ?? '',
              shares:
                allocationSuccessor && (item.allocationPct ?? 0) > 0
                  ? [{ userId: allocationSuccessor, pct: item.allocationPct ?? 0 }]
                  : [],
            }),
          ),
          appRoles: (groups.find((g) => g.group === 'app_roles')?.items ?? []).map((item) => ({
            historyId: item.id,
            appId: item.appId!,
            // The structural pm/lead kind from the row itself — the old code
            // guessed it from the display label's suffix.
            role: item.roleKind ?? 'pm',
            successorId: roleSuccessor,
          })),
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(`Moved ${res.data.moved} items`)
        setConfirming(false)
        // Re-read the server-rendered inventory: without this the page keeps
        // listing the already-moved items as open work until a manual reload.
        router.refresh()
      } catch {
        // A thrown error (e.g. DB outage) is not `{ ok: false }` — without
        // this catch it's an unhandled rejection and Confirm silently does
        // nothing. Same fix assign-dialog.tsx documents.
        toast.error('Something went wrong — nothing was moved. Try again.')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Who takes it on</CardTitle>
        <CardDescription>
          Leave a group unassigned if nobody should inherit it — that is a choice, and the
          summary will say so rather than skipping it quietly.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex max-w-xs flex-col gap-1">
          <label htmlFor="handover-last-day" className="text-2xs text-muted-foreground">
            Last working day
          </label>
          <Input
            id="handover-last-day"
            type="date"
            value={lastWorkingDay}
            required
            aria-invalid={dateError || undefined}
            onChange={(e) => {
              setLastWorkingDay(e.target.value)
              if (e.target.value) setDateError(false)
            }}
            aria-label={`Last working day for ${leaverName}`}
            className="pointer-coarse:min-h-11 font-mono tabular-nums"
          />
          {dateError ? (
            <span role="alert" className="text-2xs text-destructive">
              Set their last working day first — it is what stops their coverage.
            </span>
          ) : (
            <span className="text-2xs text-muted-foreground">
              Prefilled with today. Their work schedule closes the day after, so they stop
              accruing missing days.
            </span>
          )}
        </div>

        <ul className="flex flex-col gap-3">
          {movable.map((group) => (
            <li
              key={group.group}
              className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm">
                {group.label}{' '}
                <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                  {group.items.length}
                </span>
              </span>
              <Select
                value={successorByGroup[group.group] ?? UNASSIGNED}
                onValueChange={(v) =>
                  setSuccessorByGroup((prev) => ({ ...prev, [group.group]: v ?? UNASSIGNED }))
                }
              >
                <SelectTrigger
                  size="sm"
                  className="pointer-coarse:min-h-11 min-w-48"
                  aria-label={`Successor for ${group.label}`}
                >
                  <SelectValue>
                    {(v: string) => (v === UNASSIGNED ? 'Leave unassigned' : nameOf(v))}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Leave unassigned</SelectItem>
                  {successors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>

        {manual.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Not moved by this handover — handle these by hand:
            </p>
            <ul className="flex flex-col gap-1.5">
              {manual.map((group) => (
                <li key={group.group} className="text-xs text-muted-foreground">
                  <span className="text-foreground">
                    {group.label}{' '}
                    <span className="font-mono text-2xs tabular-nums">{group.items.length}</span>
                  </span>
                  {' — '}
                  {MANUAL_NOTE[group.group] ?? 'Review these from their own pages.'}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {confirming ? (
          <div
            className="flex flex-col gap-3 rounded-lg border border-border p-3"
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !isPending) {
                event.stopPropagation()
                disarm()
              }
            }}
          >
            <p className="text-sm font-medium">This will move:</p>
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {movable.map((g) => (
                <li key={g.group}>
                  <span className="font-mono tabular-nums">{g.items.length}</span> × {g.label} →{' '}
                  {successorFor(g.group) === null ? 'nobody' : nameOf(successorByGroup[g.group])}
                </li>
              ))}
            </ul>
            {unassigned.length > 0 && (
              <p className="text-sm text-warning">
                {unassigned.length} {unassigned.length === 1 ? 'group stays' : 'groups stay'}{' '}
                unassigned. Nobody will pick that work up.
              </p>
            )}
            {manual.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {manual.map((g) => `${g.items.length} × ${g.label.toLowerCase()}`).join(', ')}{' '}
                {manual.length === 1 ? 'is' : 'are'} not touched by this tool — see the notes
                above.
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button ref={confirmRef} onClick={submit} disabled={isPending}>
                {isPending ? 'Moving…' : 'Confirm handover'}
              </Button>
              <Button variant="ghost" onClick={disarm} disabled={isPending}>
                Back
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button
              ref={previewRef}
              onClick={() => {
                if (!lastWorkingDay) {
                  setDateError(true)
                  return
                }
                setConfirming(true)
              }}
              className={cn(isPending && 'opacity-60')}
            >
              Preview handover
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
