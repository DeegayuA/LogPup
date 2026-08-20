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
import { Label } from '@/components/ui/label'
import { JOB_ROLES } from '@/lib/job-roles'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { assignUser, updateAssignment } from '@/features/people/actions'
import type { ActiveUser, TeamMember } from '@/features/people/queries'

export function AssignDialog({
  appId,
  activeUsers,
  assignment,
  trigger,
}: {
  appId: string
  activeUsers: ActiveUser[]
  assignment?: TeamMember
  trigger: ReactElement
}) {
  const isEdit = Boolean(assignment)
  const submitLabel = isEdit ? 'Save changes' : 'Add member'
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [userId, setUserId] = useState(assignment?.userId ?? '')
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
  const totalPct = typeof selected?.totalPct === 'number' ? selected.totalPct : null
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

  function resetForm() {
    setUserId(assignment?.userId ?? '')
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
          : await assignUser({ appId, userId, role, allocationPct: allocation })

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
          <DialogTitle>{isEdit ? 'Edit assignment' : 'Add member'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Update ${assignment?.name}'s role and allocation on this app.`
              : 'Assign a team member to this app.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isEdit ? null : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assign-user">Member</Label>
              <Select value={userId} onValueChange={(value) => pickMember(value ?? '')}>
                <SelectTrigger id="assign-user" className="w-full">
                  {/* Explicit label mapping — the raw id is the Select's `value`,
                      so without this the trigger falls back to rendering that id
                      (a UUID) instead of the person's name. */}
                  <SelectValue placeholder="Select a person">
                    {(value: string) =>
                      value ? (activeUsers.find((user) => user.id === value)?.name ?? 'Select a person') : 'Select a person'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {activeUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Button type="submit" disabled={isPending || (!isEdit && !userId)}>
              {isPending ? 'Saving…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
