'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BUG_STATUSES,
  SEVERITIES_WORST_FIRST,
  bugSeverityLabel,
  bugStatusLabel,
  type BugSeverity,
  type BugStatus,
} from '@/features/bugs/bug-display'
import { triageBug } from '@/features/bugs/actions'

/**
 * Status, severity and assignee for one bug — the whole of triage.
 *
 * Rendered ONLY where the viewer holds `bug.triage` on this bug's project.
 * That is a decluttering decision, not the enforcement: triageBug re-asks the
 * capability on every call, scoped to the app, exactly as
 * features/admin/actions.ts says about its own UI.
 *
 * Three selects rather than a form with a Save button: each is one decision,
 * a triager makes several of them per minute, and a save step turns "this is
 * critical" into two interactions and a chance to lose the change by
 * navigating away.
 *
 * UNASSIGNED IS A VALUE, NOT AN ABSENT ONE. Base UI's Select cannot round-trip
 * `null` through its string value, so the sentinel below stands in for it and
 * is translated back at the boundary — without it, "unassign" is a state the
 * control can display but never send.
 */

const UNASSIGNED = '__unassigned__'

export function BugTriageControls({
  bugId,
  status,
  severity,
  assignedToId,
  assignableUsers,
}: {
  bugId: string
  status: BugStatus
  severity: BugSeverity
  assignedToId: string | null
  assignableUsers: readonly { id: string; name: string }[]
}) {
  const [pending, startTriaging] = useTransition()

  function apply(change: Parameters<typeof triageBug>[0], done: string) {
    startTriaging(async () => {
      try {
        const res = await triageBug(change)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(done)
      } catch {
        // A server action can reject as well as resolve with `{ ok: false }`.
        // Unguarded, the select sits showing a value that was never saved.
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pending ? (
        <Loader2 aria-hidden className="size-3.5 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" />
      ) : null}
      <Select
        value={status}
        disabled={pending}
        onValueChange={(value) => {
          if (!value || value === status) return
          const next = value as BugStatus
          apply({ bugId, status: next }, `Status set to ${bugStatusLabel(next)}`)
        }}
      >
        <SelectTrigger size="sm" className="w-36" aria-label="Bug status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BUG_STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              {bugStatusLabel(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={severity}
        disabled={pending}
        onValueChange={(value) => {
          if (!value || value === severity) return
          const next = value as BugSeverity
          apply({ bugId, severity: next }, `Severity set to ${bugSeverityLabel(next)}`)
        }}
      >
        <SelectTrigger size="sm" className="w-32" aria-label="Bug severity">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SEVERITIES_WORST_FIRST.map((value) => (
            <SelectItem key={value} value={value}>
              {bugSeverityLabel(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={assignedToId ?? UNASSIGNED}
        disabled={pending}
        onValueChange={(value) => {
          if (!value) return
          const next = value === UNASSIGNED ? null : value
          if (next === assignedToId) return
          apply(
            { bugId, assignedTo: next },
            next
              ? `Assigned to ${assignableUsers.find((user) => user.id === next)?.name ?? 'someone'}`
              : 'Unassigned',
          )
        }}
        /* The trigger renders the ITEM matching the value, so a select whose
           items are built from a list must be given that list — otherwise the
           trigger falls back to printing the raw uuid at rest. */
        items={[
          { value: UNASSIGNED, label: 'Unassigned' },
          ...assignableUsers.map((user) => ({ value: user.id, label: user.name })),
        ]}
      >
        <SelectTrigger size="sm" className="w-44" aria-label="Bug assignee">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
          {assignableUsers.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
