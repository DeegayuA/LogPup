'use client'

import { useMemo, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CapacityBar } from '@/features/people/components/capacity-bar'
import { sortCapacities } from '@/features/dashboard/sort-capacities'
import { summarizeAllocations } from '@/features/people/allocation'
import { assignUser, removeAssignment, updateAssignment } from '@/features/people/actions'
import { formatPct, PCT_CLASS } from '@/features/people/format-pct'
import { JOB_ROLES } from '@/lib/job-roles'
import type {
  AssignableApp,
  CapacityBreakdownEntry,
  UserCapacity,
} from '@/features/people/queries'
import type { ActionResult } from '@/lib/action-result'
import {
  CapacityCard,
  CapacityEmpty,
  PersonAvatar,
  PersonHeading,
} from '@/features/dashboard/components/capacity-card'
import { cn } from '@/lib/utils'

const MIN_PCT = 5
const MAX_PCT = 100

/**
 * The chip trigger. Deliberately a real <button>: the global
 * `@media (pointer: coarse)` rule in globals.css gives every button a 44px
 * hit area via ::after, so a 20px-tall chip is still touchable without
 * growing the row on phones.
 */
const chipClass =
  'inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground ring-1 ring-transparent transition-[color,background-color,box-shadow] duration-150 motion-reduce:transition-none hover:bg-secondary/70 hover:ring-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60'

function parsePct(raw: string): number | null {
  const value = Number(raw)
  if (!Number.isInteger(value) || value < MIN_PCT || value > MAX_PCT) return null
  return value
}

/**
 * Rebuilds a person's totals from their breakdown after an optimistic edit,
 * through the same summarizeAllocations the server uses — so the ">100 is
 * over" threshold has exactly one definition and the optimistic row can't
 * disagree with the row that replaces it on refresh.
 */
function withBreakdown(person: UserCapacity, breakdown: CapacityBreakdownEntry[]): UserCapacity {
  const [summary] = summarizeAllocations(
    breakdown.map((entry) => ({ userId: person.user.id, allocationPct: entry.allocationPct })),
  )
  return {
    ...person,
    breakdown,
    totalPct: summary?.totalPct ?? 0,
    overallocated: summary?.overallocated ?? false,
  }
}

function mapPerson(
  rows: UserCapacity[],
  userId: string,
  next: (breakdown: CapacityBreakdownEntry[]) => CapacityBreakdownEntry[],
): UserCapacity[] {
  return rows.map((person) =>
    person.user.id === userId ? withBreakdown(person, next(person.breakdown)) : person,
  )
}

/** Reads the over-allocation warning out of whichever action was run. */
function warningOf(data: unknown): string | undefined {
  if (data && typeof data === 'object' && 'warning' in data) {
    const { warning } = data as { warning?: unknown }
    if (typeof warning === 'string') return warning
  }
  return undefined
}

export function CapacityHeatEditable({
  capacities,
  apps,
}: {
  capacities: UserCapacity[]
  apps: AssignableApp[]
}) {
  const router = useRouter()
  const [serverRows, setServerRows] = useState(capacities)
  const [rows, setRows] = useState(capacities)
  const [isPending, startTransition] = useTransition()

  // Adjusting state while rendering, the documented React pattern — not an
  // effect. `capacities` only gets a new identity when the server re-renders
  // (i.e. after our own router.refresh()), and at that point the server list
  // is authoritative and must replace whatever the optimistic edit left
  // behind. Comparing against the last-seen props rather than resetting on
  // every render is what lets the optimistic state survive in between.
  if (serverRows !== capacities) {
    setServerRows(capacities)
    setRows(capacities)
  }

  // Re-sorted from the optimistic rows, so a person who tips over 100%
  // floats to the top the moment the edit is applied rather than after the
  // refresh lands.
  const sorted = useMemo(() => sortCapacities(rows), [rows])
  const overCount = sorted.filter((person) => person.overallocated).length

  function commit(
    optimistic: (current: UserCapacity[]) => UserCapacity[],
    run: () => Promise<ActionResult<unknown>>,
    successMessage: string,
  ) {
    const snapshot = rows
    setRows(optimistic(rows))
    startTransition(async () => {
      try {
        const res = await run()
        if (!res.ok) {
          setRows(snapshot)
          toast.error(res.error)
          return
        }
        const warning = warningOf(res.data)
        if (warning) toast.warning(warning)
        else toast.success(successMessage)
        // Replaces the optimistic guess with the server's truth — and pulls
        // in the real assignmentId for a row that was just created.
        router.refresh()
      } catch {
        // A throw (DB outage, network) is not `{ ok: false }`; without this
        // the row would keep the optimistic value forever and the admin
        // would think it saved.
        setRows(snapshot)
        toast.error('Something went wrong — try again')
      }
    })
  }

  function handleUpdate(person: UserCapacity, entry: CapacityBreakdownEntry, allocationPct: number) {
    if (!entry.assignmentId) return
    const assignmentId = entry.assignmentId
    commit(
      (current) =>
        mapPerson(current, person.user.id, (breakdown) =>
          breakdown.map((row) => (row.appId === entry.appId ? { ...row, allocationPct } : row)),
        ),
      // Only the key that changed is sent: a partial update must not
      // re-assert the role the admin never touched.
      () => updateAssignment(assignmentId, { allocationPct }),
      `${person.user.name} · ${entry.appName} at ${formatPct(allocationPct)}`,
    )
  }

  function handleRemove(person: UserCapacity, entry: CapacityBreakdownEntry) {
    if (!entry.assignmentId) return
    const assignmentId = entry.assignmentId
    commit(
      (current) =>
        mapPerson(current, person.user.id, (breakdown) =>
          breakdown.filter((row) => row.appId !== entry.appId),
        ),
      () => removeAssignment(assignmentId),
      `${person.user.name} removed from ${entry.appName}`,
    )
  }

  function handleAssign(
    person: UserCapacity,
    app: AssignableApp,
    role: string,
    allocationPct: number,
  ) {
    commit(
      (current) =>
        mapPerson(current, person.user.id, (breakdown) => [
          ...breakdown,
          {
            appId: app.id,
            appName: app.name,
            slug: app.slug,
            role,
            allocationPct,
            // No id until the server answers; the chip renders read-only
            // for that beat rather than offering an edit that can't run.
            assignmentId: null,
          },
        ]),
      () => assignUser({ userId: person.user.id, appId: app.id, role, allocationPct }),
      `${person.user.name} added to ${app.name}`,
    )
  }

  return (
    <CapacityCard count={sorted.length} overCount={overCount}>
      {sorted.length === 0 ? (
        <CapacityEmpty
          title="Nobody in the pack yet."
          hint="Add people and assign them to apps to see capacity here."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {sorted.map((person) => (
            <li key={person.user.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <PersonAvatar person={person} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <PersonHeading person={person} />
                <div className="flex flex-wrap items-center gap-1.5">
                  {person.breakdown.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No app assignments</span>
                  ) : (
                    person.breakdown.map((entry) => (
                      <ChipEditor
                        key={entry.appId}
                        person={person}
                        entry={entry}
                        busy={isPending}
                        onSave={(pct) => handleUpdate(person, entry, pct)}
                        onRemove={() => handleRemove(person, entry)}
                      />
                    ))
                  )}
                  <AssignPopover
                    person={person}
                    apps={apps}
                    busy={isPending}
                    onAssign={(app, role, pct) => handleAssign(person, app, role, pct)}
                  />
                </div>
                <CapacityBar totalPct={person.totalPct} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </CapacityCard>
  )
}

function ChipEditor({
  person,
  entry,
  busy,
  onSave,
  onRemove,
}: {
  person: UserCapacity
  entry: CapacityBreakdownEntry
  busy: boolean
  onSave: (allocationPct: number) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(String(entry.allocationPct))
  const [confirming, setConfirming] = useState(false)
  const inputId = `alloc-${person.user.id}-${entry.appId}`

  // A chip with no live assignment row (an optimistic insert still in
  // flight) has nothing the actions can target — show it, don't offer to
  // edit it.
  if (!entry.assignmentId) {
    return (
      <span className={cn(chipClass, 'opacity-60')} aria-live="polite">
        {entry.appName} <span className={PCT_CLASS}>{formatPct(entry.allocationPct)}</span>
      </span>
    )
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    // Resync from props on every open change, never only on close: this
    // component is keyed by appId and survives the refresh, so resetting on
    // close would restore the pre-save value and the next save would revert
    // the edit (same trap as AssignDialog.handleOpenChange).
    setValue(String(entry.allocationPct))
    setConfirming(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const pct = parsePct(value)
    if (pct === null) {
      toast.error(`Allocation must be a whole number between ${MIN_PCT} and ${MAX_PCT}`)
      return
    }
    if (pct === entry.allocationPct) {
      handleOpenChange(false)
      return
    }
    handleOpenChange(false)
    onSave(pct)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            disabled={busy}
            className={chipClass}
            aria-label={`Edit ${person.user.name}'s allocation on ${entry.appName}, currently ${formatPct(entry.allocationPct)}`}
          />
        }
      >
        {entry.appName} <span className={PCT_CLASS}>{formatPct(entry.allocationPct)}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <PopoverHeader>
          <PopoverTitle>{entry.appName}</PopoverTitle>
          <PopoverDescription>
            {person.user.name} · {entry.role}
          </PopoverDescription>
        </PopoverHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={inputId}>Allocation %</Label>
            <div className="flex items-center gap-2">
              <Input
                id={inputId}
                type="number"
                inputMode="numeric"
                min={MIN_PCT}
                max={MAX_PCT}
                step={5}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className={cn(PCT_CLASS, 'pointer-coarse:min-h-11')}
                autoFocus
                required
              />
              <Button type="submit" size="sm" disabled={busy}>
                Save
              </Button>
            </div>
          </div>
          {confirming ? (
            <div className="flex items-center justify-between gap-2 rounded-md bg-destructive/10 px-2 py-1.5">
              <span className="text-xs text-destructive">
                Remove from {entry.appName}?
              </span>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="xs" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="xs"
                  disabled={busy}
                  onClick={() => {
                    handleOpenChange(false)
                    onRemove()
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={busy}
              className="self-start text-muted-foreground hover:text-destructive"
              onClick={() => setConfirming(true)}
            >
              <Trash2 aria-hidden /> Remove from app
            </Button>
          )}
        </form>
      </PopoverContent>
    </Popover>
  )
}

function AssignPopover({
  person,
  apps,
  busy,
  onAssign,
}: {
  person: UserCapacity
  apps: AssignableApp[]
  busy: boolean
  onAssign: (app: AssignableApp, role: string, allocationPct: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [appId, setAppId] = useState('')
  const [role, setRole] = useState('')
  const [value, setValue] = useState('')

  // The unique (userId, appId) index would reject a duplicate anyway; not
  // offering it is friendlier than surfacing "Already assigned to this app".
  const available = useMemo(
    () => apps.filter((app) => !person.breakdown.some((entry) => entry.appId === app.id)),
    [apps, person.breakdown],
  )

  function handleOpenChange(next: boolean) {
    setOpen(next)
    setAppId('')
    setRole('')
    setValue('')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const app = available.find((candidate) => candidate.id === appId)
    if (!app) {
      toast.error('Pick an app first')
      return
    }
    const pct = parsePct(value)
    if (pct === null) {
      toast.error(`Allocation must be a whole number between ${MIN_PCT} and ${MAX_PCT}`)
      return
    }
    if (role.trim().length < 2) {
      toast.error('Role needs at least 2 characters')
      return
    }
    handleOpenChange(false)
    onAssign(app, role.trim(), pct)
  }

  if (available.length === 0) return null

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            disabled={busy}
            className={cn(
              chipClass,
              'bg-transparent text-muted-foreground ring-border ring-dashed hover:text-foreground hover:ring-ring/60',
            )}
            aria-label={`Assign ${person.user.name} to an app`}
          />
        }
      >
        <Plus className="size-3" aria-hidden /> Assign
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <PopoverHeader>
          <PopoverTitle>Assign to app</PopoverTitle>
          <PopoverDescription>{person.user.name}</PopoverDescription>
        </PopoverHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`assign-app-${person.user.id}`}>App</Label>
            <Select value={appId} onValueChange={(next) => setAppId(next ?? '')}>
              <SelectTrigger id={`assign-app-${person.user.id}`} className="w-full">
                {/* The Select's value is the id, so without an explicit label
                    mapping the trigger renders a raw UUID. */}
                <SelectValue placeholder="Pick an app">
                  {(current: string) =>
                    available.find((app) => app.id === current)?.name ?? 'Pick an app'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {available.map((app) => (
                  <SelectItem key={app.id} value={app.id}>
                    {app.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`assign-role-${person.user.id}`}>Role</Label>
            <Input
              id={`assign-role-${person.user.id}`}
              value={role}
              onChange={(event) => setRole(event.target.value)}
              minLength={2}
              maxLength={40}
              placeholder="Engineer, Designer, PM…"
              list={`assign-role-options-${person.user.id}`}
              className="pointer-coarse:min-h-11"
              required
            />
            <datalist id={`assign-role-options-${person.user.id}`}>
              {JOB_ROLES.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`assign-pct-${person.user.id}`}>Allocation %</Label>
            <Input
              id={`assign-pct-${person.user.id}`}
              type="number"
              inputMode="numeric"
              min={MIN_PCT}
              max={MAX_PCT}
              step={5}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="25"
              className={cn(PCT_CLASS, 'pointer-coarse:min-h-11')}
              required
            />
          </div>
          <Button type="submit" size="sm" disabled={busy} className="self-end">
            Assign
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
