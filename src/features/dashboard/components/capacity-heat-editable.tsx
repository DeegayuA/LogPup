'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type RefObject,
} from 'react'
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
const PCT_HINT = `Allocation must be a whole number between ${MIN_PCT} and ${MAX_PCT}`

/**
 * The chip trigger. Deliberately a real <button>, and on coarse pointers it
 * grows to a real 44px box instead of relying on the global ::after hit slop
 * from globals.css.
 *
 * Why the exception: that rule expands the hit area ~12.5px beyond a control
 * in every direction without touching the visible box, which is right for a
 * toolbar but wrong here. These chips are ~19px tall and wrap at a ~25px
 * pitch, so two rows of them overlapped by ~19px — a tap in the top half of a
 * second-row chip opened the FIRST row's editor, pre-filled with another
 * app's percentage — and the slop also reached up over the person-name link.
 * `[&::after]:size-full` pins the hit area back to the visible box, and
 * min-h/min-w-11 make that box itself meet WCAG 2.5.8, so the target is both
 * big enough and exactly where it looks.
 */
const chipClass =
  'inline-flex items-center justify-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground ring-1 ring-transparent transition-[color,background-color,box-shadow] duration-150 motion-reduce:transition-none hover:bg-secondary/70 hover:ring-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-busy:ring-ring/40 disabled:pointer-events-none disabled:opacity-60 pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:px-2.5 pointer-coarse:[&::after]:size-full'

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
  const [serverRows, setServerRows] = useState(capacities)
  const [rows, setRows] = useState(capacities)
  const [isPending, startTransition] = useTransition()
  // ONE region, rendered unconditionally and never remounted. A live region
  // has to already be in the accessibility tree before the change it should
  // announce — putting aria-live on the optimistic chip itself announced
  // nothing at all in any major AT, because the node carrying it was the node
  // being inserted.
  const [status, setStatus] = useState('')

  // Adjusting state while rendering, the documented React pattern — not an
  // effect. `capacities` only gets a new identity when the server re-renders
  // (which the assignment actions trigger by revalidating — Next returns the
  // re-rendered payload in the action's own response), and at that point the
  // server list is authoritative and must replace whatever the optimistic edit
  // left behind. Comparing against the last-seen props rather than resetting on
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
    pendingMessage: string,
  ) {
    const snapshot = rows
    setRows(optimistic(rows))
    setStatus(pendingMessage)
    startTransition(async () => {
      try {
        const res = await run()
        if (!res.ok) {
          setRows(snapshot)
          setStatus(res.error)
          toast.error(res.error)
          return
        }
        const warning = warningOf(res.data)
        if (warning) toast.warning(warning)
        else toast.success(successMessage)
        setStatus(warning ?? successMessage)
        // Replaces the optimistic guess with the server's truth — and pulls
        // in the real assignmentId for a row that was just created.
      } catch {
        // A throw (DB outage, network) is not `{ ok: false }`; without this
        // the row would keep the optimistic value forever and the admin
        // would think it saved.
        setRows(snapshot)
        setStatus('Something went wrong — try again')
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
      `Saving ${person.user.name} on ${entry.appName} at ${formatPct(allocationPct)}…`,
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
      `Removing ${person.user.name} from ${entry.appName}…`,
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
      `Adding ${person.user.name} to ${app.name}…`,
    )
  }

  return (
    <CapacityCard count={sorted.length} overCount={overCount}>
      <span role="status" aria-live="polite" className="sr-only">
        {status}
      </span>
      {sorted.length === 0 ? (
        <CapacityEmpty
          title="Nobody in the pack yet."
          hint="Add people and assign them to apps to see capacity here."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {sorted.map((person) => (
            <PersonRow
              key={person.user.id}
              person={person}
              apps={apps}
              busy={isPending}
              onUpdate={(entry, pct) => handleUpdate(person, entry, pct)}
              onRemove={(entry) => handleRemove(person, entry)}
              onAssign={(app, role, pct) => handleAssign(person, app, role, pct)}
            />
          ))}
        </ul>
      )}
    </CapacityCard>
  )
}

/**
 * One person's row, and the anchor every popover in it returns focus to.
 *
 * Base UI returns focus to the trigger on close, which in all three flows
 * here is gone by the time it tries: a save leaves the trigger untabbable, a
 * removal unmounts it with the chip, and assigning the last app unmounts the
 * Assign button entirely. Focus landed on <body> and the next Tab restarted
 * from the top of the document. Pointing `finalFocus` at this <li> instead
 * lands on the row's first tabbable child (the person's name), which survives
 * every one of those mutations — and the tabIndex={-1} makes the row itself
 * the fallback if it ever has no tabbable child at all.
 */
function PersonRow({
  person,
  apps,
  busy,
  onUpdate,
  onRemove,
  onAssign,
}: {
  person: UserCapacity
  apps: AssignableApp[]
  busy: boolean
  onUpdate: (entry: CapacityBreakdownEntry, allocationPct: number) => void
  onRemove: (entry: CapacityBreakdownEntry) => void
  onAssign: (app: AssignableApp, role: string, allocationPct: number) => void
}) {
  const rowRef = useRef<HTMLLIElement>(null)

  return (
    <li
      ref={rowRef}
      tabIndex={-1}
      className="flex items-center gap-3 rounded-md py-3 outline-none first:pt-0 last:pb-0 focus-visible:ring-2 focus-visible:ring-ring/50"
    >
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
                busy={busy}
                finalFocus={rowRef}
                onSave={(pct) => onUpdate(entry, pct)}
                onRemove={() => onRemove(entry)}
              />
            ))
          )}
          <AssignPopover
            person={person}
            apps={apps}
            busy={busy}
            finalFocus={rowRef}
            onAssign={onAssign}
          />
        </div>
        <CapacityBar totalPct={person.totalPct} />
      </div>
    </li>
  )
}

function ChipEditor({
  person,
  entry,
  busy,
  finalFocus,
  onSave,
  onRemove,
}: {
  person: UserCapacity
  entry: CapacityBreakdownEntry
  busy: boolean
  finalFocus: RefObject<HTMLElement | null>
  onSave: (allocationPct: number) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(String(entry.allocationPct))
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const inputId = `alloc-${person.user.id}-${entry.appId}`
  const errorId = `${inputId}-error`
  const pctRef = useRef<HTMLInputElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const removeRef = useRef<HTMLButtonElement>(null)

  // The confirmation REPLACES the button that opened it, so without this the
  // element holding focus is destroyed and focus falls out of the dialog
  // entirely — a screen-reader user gets no announcement, no landmark, and
  // their next Enter can land on the destructive confirm.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus()
  }, [confirming])

  // A chip with no live assignment row (an optimistic insert still in
  // flight) has nothing the actions can target — show it, don't offer to
  // edit it. Full text contrast: dimming the whole chip to signal "in
  // flight" pushed 10px text under 4:1 against its own background, and it is
  // on screen for a whole server round-trip plus a refresh. The word
  // "saving" is what carries the state, and the persistent live region in
  // CapacityHeatEditable is what announces it.
  if (!entry.assignmentId) {
    return (
      <span className={cn(chipClass, 'ring-dashed ring-border')}>
        {entry.appName} <span className={PCT_CLASS}>{formatPct(entry.allocationPct)}</span>
        <span className="italic">saving…</span>
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
    setError(null)
    setConfirming(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const pct = parsePct(value)
    if (pct === null) {
      // Inline + aria-describedby + focus, not a toast: a toast renders in a
      // portal at the far end of the DOM with no programmatic link to the
      // control that is wrong, and auto-dismisses before a slow read-through
      // finds it.
      setError(PCT_HINT)
      pctRef.current?.focus()
      return
    }
    setError(null)
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
            // NOT `disabled`: a disabled button is not tabbable, and Base UI
            // resolves the focus-return target to the first TABBABLE element,
            // so disabling it for the length of the round-trip dropped focus
            // to <body> on every save. aria-busy says the same thing without
            // taking the element out of the tab order.
            aria-busy={busy}
            className={chipClass}
            aria-label={`Edit ${person.user.name}'s allocation on ${entry.appName}, currently ${formatPct(entry.allocationPct)}`}
          />
        }
      >
        {entry.appName} <span className={PCT_CLASS}>{formatPct(entry.allocationPct)}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64" finalFocus={finalFocus}>
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
                ref={pctRef}
                type="number"
                inputMode="numeric"
                min={MIN_PCT}
                max={MAX_PCT}
                // step 1, not 5: parsePct, the copy above and the server's
                // zod schema all accept any integer in range, so a step of 5
                // made the browser reject 33 with a native bubble naming
                // "the two nearest valid values" — a rule the product never
                // stated and the server does not enforce.
                step={1}
                value={value}
                onChange={(event) => {
                  setValue(event.target.value)
                  if (error) setError(null)
                }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                className={cn(PCT_CLASS, 'pointer-coarse:min-h-11')}
                autoFocus
                required
              />
              <Button type="submit" size="sm" disabled={busy}>
                Save
              </Button>
            </div>
            {error ? (
              <p id={errorId} role="alert" className="text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          {confirming ? (
            <div
              role="alertdialog"
              aria-label="Confirm removal"
              onKeyDown={(event) => {
                if (event.key !== 'Escape') return
                // Back out of the CONFIRMATION, not the whole popover. Base
                // UI listens for Escape on `document`; React's own listener
                // sits on the portal container below it, so stopping the
                // native event here is what keeps it from bubbling on.
                event.preventDefault()
                event.stopPropagation()
                event.nativeEvent.stopPropagation()
                setConfirming(false)
                removeRef.current?.focus()
              }}
              className="flex items-center justify-between gap-2 rounded-md bg-destructive/10 px-2 py-1.5"
            >
              <span className="text-xs text-destructive">
                Remove from {entry.appName}?
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  ref={cancelRef}
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setConfirming(false)
                    removeRef.current?.focus()
                  }}
                >
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
              ref={removeRef}
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
  finalFocus,
  onAssign,
}: {
  person: UserCapacity
  apps: AssignableApp[]
  busy: boolean
  finalFocus: RefObject<HTMLElement | null>
  onAssign: (app: AssignableApp, role: string, allocationPct: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [appId, setAppId] = useState('')
  const [role, setRole] = useState('')
  const [value, setValue] = useState('')
  const [errors, setErrors] = useState<{ app?: string; role?: string; pct?: string }>({})
  const fieldId = person.user.id
  const appTriggerRef = useRef<HTMLButtonElement>(null)
  const roleRef = useRef<HTMLInputElement>(null)
  const pctRef = useRef<HTMLInputElement>(null)

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
    setErrors({})
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const app = available.find((candidate) => candidate.id === appId)
    const pct = parsePct(value)
    const next: { app?: string; role?: string; pct?: string } = {}
    if (!app) next.app = 'Pick an app'
    if (role.trim().length < 2) next.role = 'Role needs at least 2 characters'
    if (pct === null) next.pct = PCT_HINT

    if (!app || pct === null || next.role) {
      // Every failure is reported ON the control that failed and focus moves
      // to the first one — a toast leaves the user with a form that silently
      // refuses to submit and no way to find out which field is at fault.
      setErrors(next)
      if (next.app) appTriggerRef.current?.focus()
      else if (next.role) roleRef.current?.focus()
      else pctRef.current?.focus()
      return
    }

    setErrors({})
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
            aria-busy={busy}
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
      <PopoverContent align="start" className="w-72" finalFocus={finalFocus}>
        <PopoverHeader>
          <PopoverTitle>Assign to app</PopoverTitle>
          <PopoverDescription>{person.user.name}</PopoverDescription>
        </PopoverHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`assign-app-${fieldId}`}>App</Label>
            <Select
              value={appId}
              onValueChange={(next) => {
                setAppId(next ?? '')
                if (errors.app) setErrors((current) => ({ ...current, app: undefined }))
              }}
            >
              {/* aria-required, not `required`: Base UI's Select satisfies a
                  native `required` through a hidden control, which a browser
                  cannot focus to report on — the form would refuse to submit
                  with nothing on screen. This marks the control required to
                  assistive tech and leaves the reporting to handleSubmit. */}
              <SelectTrigger
                id={`assign-app-${fieldId}`}
                ref={appTriggerRef}
                aria-required="true"
                aria-invalid={Boolean(errors.app)}
                aria-describedby={errors.app ? `assign-app-${fieldId}-error` : undefined}
                className="w-full"
              >
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
            {errors.app ? (
              <p
                id={`assign-app-${fieldId}-error`}
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.app}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`assign-role-${fieldId}`}>Role</Label>
            <Input
              id={`assign-role-${fieldId}`}
              ref={roleRef}
              value={role}
              onChange={(event) => {
                setRole(event.target.value)
                if (errors.role) setErrors((current) => ({ ...current, role: undefined }))
              }}
              minLength={2}
              maxLength={40}
              placeholder="Engineer, Designer, PM…"
              list={`assign-role-options-${fieldId}`}
              aria-invalid={Boolean(errors.role)}
              aria-describedby={errors.role ? `assign-role-${fieldId}-error` : undefined}
              className="pointer-coarse:min-h-11"
              required
            />
            <datalist id={`assign-role-options-${fieldId}`}>
              {JOB_ROLES.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            {errors.role ? (
              <p
                id={`assign-role-${fieldId}-error`}
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.role}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`assign-pct-${fieldId}`}>Allocation %</Label>
            <Input
              id={`assign-pct-${fieldId}`}
              ref={pctRef}
              type="number"
              inputMode="numeric"
              min={MIN_PCT}
              max={MAX_PCT}
              step={1}
              value={value}
              onChange={(event) => {
                setValue(event.target.value)
                if (errors.pct) setErrors((current) => ({ ...current, pct: undefined }))
              }}
              placeholder="25"
              aria-invalid={Boolean(errors.pct)}
              aria-describedby={errors.pct ? `assign-pct-${fieldId}-error` : undefined}
              className={cn(PCT_CLASS, 'pointer-coarse:min-h-11')}
              required
            />
            {errors.pct ? (
              <p
                id={`assign-pct-${fieldId}-error`}
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.pct}
              </p>
            ) : null}
          </div>
          <Button type="submit" size="sm" disabled={busy} className="self-end">
            Assign
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
