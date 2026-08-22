'use client'

import { useState, useTransition, type FormEvent, type ReactElement } from 'react'
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
import { SearchSelect } from '@/components/ui/search-select'
import { Label } from '@/components/ui/label'
import { JOB_ROLES } from '@/lib/job-roles'
import { assignUser, updateAssignment } from '@/features/people/actions'
import type { AssignableApp, ActiveUser, TeamMember } from '@/features/people/queries'

/**
 * The allocation form, from either end.
 *
 * ONE DIALOG, TWO DIRECTIONS. A project's Team panel fixes the app and picks a
 * person; a person's Workload card fixes the person and picks a project. It is
 * the same row in `assignments` either way, the same action, and the same
 * headroom arithmetic — so it is one component with the picker swapped, not
 * two that will drift about what a legal allocation is.
 *
 * Which end is fixed is decided by WHICH SIDE WAS GIVEN. `appId` present means
 * pick a person; `userId` present means pick a project. Editing needs neither
 * picker, because both ends are already settled.
 */
type AssignSubject =
  /** Fixed app, choose the person — the project's Team panel. */
  | { appId: string; activeUsers: ActiveUser[]; userId?: never; apps?: never }
  /** Fixed person, choose the project — the person's Workload card. */
  | { userId: string; apps: AssignableApp[]; appId?: never; activeUsers?: never }

export function AssignDialog({
  assignment,
  trigger,
  /**
   * What this person already carries elsewhere, for the headroom sentence.
   * Supplied by the person-side caller, which knows it; the app-side caller
   * reads it off activeUsers instead.
   */
  personTotalPct,
  ...subject
}: AssignSubject & {
  assignment?: TeamMember
  trigger: ReactElement
  personTotalPct?: number
}) {
  const appId = subject.appId
  const activeUsers = subject.activeUsers ?? []
  const apps = subject.apps ?? []
  /** True when the PROJECT is what has to be chosen. */
  const picksApp = subject.userId !== undefined
  const isEdit = Boolean(assignment)
  const submitLabel = isEdit ? 'Save changes' : 'Add member'
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [userId, setUserId] = useState(assignment?.userId ?? subject.userId ?? '')
  const [pickedAppId, setPickedAppId] = useState('')
  const [role, setRole] = useState(assignment?.role ?? '')
  const [allocationPct, setAllocationPct] = useState(
    assignment ? String(assignment.allocationPct) : '',
  )
  // Whether the operator has typed in the % field. Picking a member prefills
  // their remaining headroom, but a number somebody typed is never overwritten
  // by a later member switch.
  const [allocTouched, setAllocTouched] = useState(false)

  /**
   * The picked person's CURRENT load, from listActiveUsers' summed totals —
   * what turns the old blind-save-then-warn loop into information before the
   * save. In edit mode the ceiling excludes this assignment's own share, so
   * "fits within 100%" is about what the edit may grow to, not double-counted.
   */
  const selectedId = isEdit ? assignment!.userId : userId
  const selected = activeUsers.find((user) => user.id === selectedId)
  // Person-side: the caller already knows this person's load and hands it over,
  // because `apps` carries projects rather than people and there is nothing
  // here to look it up in.
  const totalPct = picksApp
    ? (personTotalPct ?? null)
    : typeof selected?.totalPct === 'number'
      ? selected.totalPct
      : null
  const elsewherePct =
    totalPct === null ? null : Math.max(0, totalPct - (assignment?.allocationPct ?? 0))
  const headroom = elsewherePct === null ? null : 100 - elsewherePct

  function pickMember(nextId: string) {
    setUserId(nextId)
    if (allocTouched || isEdit) return
    const next = activeUsers.find((user) => user.id === nextId)
    if (typeof next?.totalPct !== 'number') return
    const free = 100 - next.totalPct
    // Prefill only when a legal share fits — an over-loaded person gets the
    // sentence below the field instead of a number that cannot be saved.
    setAllocationPct(free >= 5 ? String(Math.min(free, 100)) : '')
  }

  function pickApp(nextId: string) {
    setPickedAppId(nextId)
    if (allocTouched || isEdit || totalPct === null) return
    const free = 100 - totalPct
    // Same rule as picking a person: prefill only when a legal share fits, so
    // an already-full person gets the sentence rather than an unsaveable number.
    setAllocationPct(free >= 5 ? String(Math.min(free, 100)) : '')
  }

  function resetForm() {
    setUserId(assignment?.userId ?? subject.userId ?? '')
    setPickedAppId('')
    setRole(assignment?.role ?? '')
    setAllocationPct(assignment ? String(assignment.allocationPct) : '')
    setAllocTouched(false)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    // Resync from the latest props on every open change — never only on
    // close. The `useState` initializers above run once at mount and this
    // instance is keyed by a stable `assignmentId`, so resetting on close
    // would rewrite state from a closure that predates the server re-render
    // the save already triggered (the action revalidates, and Next ships the
    // fresh payload back in the action's own response): reopening would show
    // the values from before the last save, and saving again would silently
    // revert it (see AppFormDialog.handleOpenChange).
    resetForm()
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      try {
        const allocation = Number(allocationPct)
        const res = assignment
          ? await updateAssignment(assignment.assignmentId, { role, allocationPct: allocation })
          : await assignUser({
              appId: picksApp ? pickedAppId : appId,
              userId,
              role,
              allocationPct: allocation,
            })

        if (!res.ok) {
          toast.error(res.error)
          return
        }
        if (res.data.warning) {
          toast.warning(res.data.warning)
        } else {
          toast.success(isEdit ? 'Assignment updated' : 'Member added')
        }
        handleOpenChange(false)
      } catch {
        // A thrown error (e.g. DB outage) is not `{ ok: false }` — without
        // this catch it's an unhandled rejection and Save silently does
        // nothing.
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit assignment' : picksApp ? 'Add to a project' : 'Add member'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Update ${assignment?.name}'s role and allocation on this app.`
              : picksApp
                ? 'Put this person on a project, and say how much of them it takes.'
                : 'Assign a team member to this app.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isEdit || !picksApp ? null : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assign-app">Project</Label>
              {/* Searchable for the same reason the people picker is: the
                  studio has more projects than fit a comfortable list, and the
                  name is the one thing the assigner already knows. */}
              <SearchSelect
                id="assign-app"
                value={pickedAppId}
                onValueChange={pickApp}
                options={apps.map((app) => ({ value: app.id, label: app.name }))}
                placeholder="Select a project"
                searchPlaceholder="Search projects…"
                emptyText="No project by that name."
              />
            </div>
          )}
          {isEdit || picksApp ? null : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assign-user">Member</Label>
              {/* Searchable: this is every active person in the studio, and the
                  name is the one thing the assigner already knows. Scrolling to
                  find someone you could have typed in two keystrokes is the
                  friction this removes. */}
              <SearchSelect
                id="assign-user"
                value={userId}
                onValueChange={pickMember}
                options={activeUsers.map((user) => ({ value: user.id, label: user.name }))}
                placeholder="Select a person"
                searchPlaceholder="Search people…"
                emptyText="Nobody by that name."
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assign-role">Role</Label>
            <Input
              id="assign-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              minLength={2}
              maxLength={40}
              placeholder="Engineer, Designer, PM…"
              list="assign-role-options"
              required
            />
            {/* Native datalist: curated software + engineering (EMC) roles,
                free text still allowed. */}
            <datalist id="assign-role-options">
              {JOB_ROLES.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assign-allocation">Allocation %</Label>
            <Input
              id="assign-allocation"
              type="number"
              inputMode="numeric"
              min={5}
              max={100}
              value={allocationPct}
              onChange={(e) => {
                setAllocTouched(true)
                setAllocationPct(e.target.value)
              }}
              placeholder="60"
              className="font-mono"
              required
            />
            {/* Current load + headroom, BEFORE the save — the over-allocation
                warning used to arrive only as a post-save toast. Words carry
                the state; the numbers are data, so they are mono/tabular. */}
            {headroom !== null && elsewherePct !== null ? (
              headroom <= 0 ? (
                <p className="text-xs text-warning">
                  Already at{' '}
                  <span className="font-mono tabular-nums">{elsewherePct}%</span>
                  {isEdit ? ' on their other apps' : ' across apps'} — anything{' '}
                  {isEdit ? 'kept here' : 'added'} puts them over capacity. Saving still works;
                  it just says so.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {isEdit ? 'On their other apps they are at ' : 'Currently at '}
                  <span className="font-mono tabular-nums">{elsewherePct}%</span>
                  {' — up to '}
                  <span className="font-mono tabular-nums">{Math.min(headroom, 100)}%</span>
                  {' fits within full capacity.'}
                </p>
              )
            ) : (
              <p className="text-xs text-muted-foreground">5–100% of their time.</p>
            )}
          </div>
          <DialogFooter>
            {/* An explicit way out — Esc and the X exist, but a footer with
                only a destructive-of-attention Save reads as a one-way door. */}
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            {/* Whichever end is being CHOSEN has to be chosen. Editing settles
                both, so neither gates it. */}
            <Button
              type="submit"
              disabled={isPending || (!isEdit && !(picksApp ? pickedAppId : userId))}
            >
              {isPending ? 'Saving…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
