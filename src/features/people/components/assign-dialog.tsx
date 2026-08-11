'use client'

import { useState, useTransition, type FormEvent, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [userId, setUserId] = useState(assignment?.userId ?? '')
  const [role, setRole] = useState(assignment?.role ?? '')
  const [allocationPct, setAllocationPct] = useState(
    assignment ? String(assignment.allocationPct) : '',
  )

  function resetForm() {
    setUserId(assignment?.userId ?? '')
    setRole(assignment?.role ?? '')
    setAllocationPct(assignment ? String(assignment.allocationPct) : '')
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    // Resync from the latest props on every open change — never only on
    // close. The `useState` initializers above run once at mount and this
    // instance is keyed by a stable `assignmentId`, so resetting on close
    // would rewrite state from the pre-`router.refresh()` closure: reopening
    // would show the values from before the last save, and saving again
    // would silently revert it (see AppFormDialog.handleOpenChange).
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
        router.refresh()
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
              <Select value={userId} onValueChange={(value) => setUserId(value ?? '')}>
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
              onChange={(e) => setAllocationPct(e.target.value)}
              placeholder="60"
              className="font-mono"
              required
            />
            <p className="text-xs text-muted-foreground">5–100% of their time.</p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending || (!isEdit && !userId)}>
              {isPending ? 'Saving…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
