'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
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
 * OPTIMISTIC, LIKE AiModelSelect. The chosen value shows the moment it is
 * picked and rolls back if the write fails — the selects used to sit showing
 * the stale server prop for the whole pending transition, which read as "it
 * didn't take". The server props are still the truth: when the revalidated
 * row arrives, the render-time sync below replaces whatever the optimistic
 * edit left behind (the documented adjust-state-while-rendering pattern
 * capacity-heat-editable uses, not an effect).
 *
 * UNASSIGNED IS A VALUE, NOT AN ABSENT ONE. Base UI's Select cannot round-trip
 * `null` through its string value, so the sentinel below stands in for it and
 * is translated back at the boundary — without it, "unassign" is a state the
 * control can display but never send.
 */

const UNASSIGNED = '__unassigned__'

type TriageState = {
  status: BugStatus
  severity: BugSeverity
  assignedToId: string | null
}

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
  const server: TriageState = { status, severity, assignedToId }
  const [seenServer, setSeenServer] = useState(server)
  const [local, setLocal] = useState(server)

  // New server truth replaces the optimistic state; in between, the
  // optimistic state survives re-renders.
  if (
    seenServer.status !== server.status ||
    seenServer.severity !== server.severity ||
    seenServer.assignedToId !== server.assignedToId
  ) {
    setSeenServer(server)
    setLocal(server)
  }

  function apply(
    optimistic: Partial<TriageState>,
    change: Parameters<typeof triageBug>[0],
    done: string,
  ) {
    const snapshot = local
    setLocal({ ...local, ...optimistic })
    startTriaging(async () => {
      try {
        const res = await triageBug(change)
        if (!res.ok) {
          setLocal(snapshot)
          toast.error(res.error)
          return
        }
        toast.success(done)
      } catch {
        // A server action can reject as well as resolve with `{ ok: false }`.
        // Unguarded, the select would keep showing a value that never saved.
        setLocal(snapshot)
        toast.error('Something went wrong — try again')
      }
    })
  }

  const assigneeName = local.assignedToId
    ? (assignableUsers.find((user) => user.id === local.assignedToId)?.name ?? 'Unassigned')
    : 'Unassigned'

  return (
    // A grid, not fixed widths: w-36/w-32/w-44 truncated long names and
    // wrapped into a ragged stack inside each card at 320px. Full-width
    // columns share the row evenly and each trigger truncates with a title.
    <div className="grid w-full min-w-0 flex-1 grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
      <span role="status" aria-live="polite" className="sr-only">
        {pending ? 'Saving triage change…' : ''}
      </span>
      <Select
        value={local.status}
        disabled={pending}
        onValueChange={(value) => {
          if (!value || value === local.status) return
          const next = value as BugStatus
          apply({ status: next }, { bugId, status: next }, `Status set to ${bugStatusLabel(next)}`)
        }}
      >
        <SelectTrigger
          size="sm"
          className="w-full min-w-0"
          aria-label="Bug status"
          title={bugStatusLabel(local.status)}
        >
          {/* Function child, so the closed trigger prints the label rather
              than String(value) — 'In progress', never 'in_progress'. */}
          <SelectValue>{(value: BugStatus) => bugStatusLabel(value)}</SelectValue>
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
        value={local.severity}
        disabled={pending}
        onValueChange={(value) => {
          if (!value || value === local.severity) return
          const next = value as BugSeverity
          apply(
            { severity: next },
            { bugId, severity: next },
            `Severity set to ${bugSeverityLabel(next)}`,
          )
        }}
      >
        <SelectTrigger
          size="sm"
          className="w-full min-w-0"
          aria-label="Bug severity"
          title={bugSeverityLabel(local.severity)}
        >
          <SelectValue>{(value: BugSeverity) => bugSeverityLabel(value)}</SelectValue>
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
        value={local.assignedToId ?? UNASSIGNED}
        disabled={pending}
        onValueChange={(value) => {
          if (!value) return
          const next = value === UNASSIGNED ? null : value
          if (next === local.assignedToId) return
          apply(
            { assignedToId: next },
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
        <SelectTrigger
          size="sm"
          className="w-full min-w-0"
          aria-label="Bug assignee"
          title={assigneeName}
        >
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
