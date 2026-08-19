'use client'

import { useState, useTransition } from 'react'
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
import { applyHandover } from '@/features/people/handover-actions'
import type { HandoverGroup } from '@/features/people/handover-queries'

const UNASSIGNED = '__none__'

/**
 * Two modes, because both are real: most handovers go to one person, and the
 * ones that do not are usually a split of allocations rather than of
 * everything.
 *
 * Nothing writes until Confirm. The preview below the controls is the whole
 * point — an operator should see every row that will change before any of them
 * does.
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
  const [isPending, startTransition] = useTransition()
  const [lastWorkingDay, setLastWorkingDay] = useState('')
  const [successorByGroup, setSuccessorByGroup] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)

  const nameOf = (id: string) => successors.find((s) => s.id === id)?.name ?? 'nobody'
  const unassigned = groups.filter((g) => (successorByGroup[g.group] ?? UNASSIGNED) === UNASSIGNED)

  function submit() {
    if (!lastWorkingDay) {
      toast.error('Set their last working day first — it is what stops their coverage.')
      return
    }
    startTransition(async () => {
      const taskSuccessor = successorByGroup.tasks
      const roleSuccessor = successorByGroup.app_roles
      const res = await applyHandover({
        leaverId,
        lastWorkingDay,
        taskSuccessorId: taskSuccessor && taskSuccessor !== UNASSIGNED ? taskSuccessor : null,
        allocations: [],
        appRoles: (groups.find((g) => g.group === 'app_roles')?.items ?? []).map((item) => ({
          historyId: item.id,
          appId: item.appId!,
          role: item.label.endsWith('lead') ? ('lead' as const) : ('pm' as const),
          successorId: roleSuccessor && roleSuccessor !== UNASSIGNED ? roleSuccessor : null,
        })),
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Moved ${res.data.moved} items`)
      setConfirming(false)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Who takes it on</CardTitle>
        <CardDescription>
          Leave a group unassigned if nobody should inherit it — that is a choice, and the
          summary will say so rather than skipping it quietly.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <label className="flex max-w-xs flex-col gap-1">
          <span className="text-2xs text-muted-foreground">Last working day</span>
          <Input
            type="date"
            value={lastWorkingDay}
            onChange={(e) => setLastWorkingDay(e.target.value)}
            aria-label={`Last working day for ${leaverName}`}
          />
          <span className="text-2xs text-muted-foreground">
            Their work schedule closes the day after, so they stop accruing missing days.
          </span>
        </label>

        <ul className="flex flex-col gap-3">
          {groups.map((group) => (
            <li key={group.group} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
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
                <SelectTrigger size="sm" className="min-w-48" aria-label={`Successor for ${group.label}`}>
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

        {confirming ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <p className="text-sm font-medium">This will move:</p>
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {groups.map((g) => (
                <li key={g.group}>
                  {g.items.length} × {g.label} →{' '}
                  {(successorByGroup[g.group] ?? UNASSIGNED) === UNASSIGNED
                    ? 'nobody'
                    : nameOf(successorByGroup[g.group])}
                </li>
              ))}
            </ul>
            {unassigned.length > 0 && (
              <p className="text-sm text-warning">
                {unassigned.length} {unassigned.length === 1 ? 'group stays' : 'groups stay'}{' '}
                unassigned. Nobody will pick that work up.
              </p>
            )}
            <div className="flex gap-2">
              <Button onClick={submit} disabled={isPending}>
                {isPending ? 'Moving…' : 'Confirm handover'}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={isPending}>
                Back
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button onClick={() => setConfirming(true)}>Preview handover</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
