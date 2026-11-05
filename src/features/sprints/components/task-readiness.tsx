'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  loadTaskReadiness,
  setProductApproval,
  setTaskReady,
  setTaskRisk,
  type TaskReadiness,
} from '@/features/sprints/readiness-actions'
import { RISK_LABEL, RISK_LEVELS, readinessScore, type RiskLevel } from '@/features/sprints/readiness'

/**
 * The task dialog's "Ready to start?" panel: the Definition of Ready checklist,
 * risk, product approval and the Ready switch. Loaded on open (it reads four
 * other tables) and saved immediately, like the other Breakdown sections.
 * Mount with `key={task.id}` so a task switch never shows the last one's state.
 *
 * The checklist reflects what is saved: criteria or an attachment added in
 * this same dialog show up the next time it is opened, or after "Recheck".
 */

const NO_RISK = 'none'

export function TaskReadiness({ taskId }: { taskId: string }) {
  const router = useRouter()
  const [data, setData] = useState<TaskReadiness | null>(null)
  const [failed, setFailed] = useState(false)
  const [isPending, startTransition] = useTransition()

  function load() {
    loadTaskReadiness(taskId)
      .then((res) => {
        if (res.ok) setData(res.data)
        else setFailed(true)
      })
      .catch(() => setFailed(true))
  }

  // Fetch on mount only; the key on the parent remounts per task.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [])

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      try {
        const res = await action()
        if (!res.ok) {
          toast.error(res.error ?? 'Something went wrong — try again')
          return
        }
        toast.success(success)
        load()
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  if (failed) return <p className="text-2xs text-muted-foreground">Couldn&apos;t load the readiness checklist.</p>
  if (!data) return <p className="text-2xs text-muted-foreground">Checking readiness…</p>

  const score = readinessScore(data.checks)
  const ready = data.readyAt !== null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>
          Ready to start?{' '}
          <span className="font-normal text-muted-foreground">
            ({score.met} of {score.total} checks met{ready ? ' · marked Ready' : ''})
          </span>
        </Label>
        <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={load}>
          Recheck
        </Button>
      </div>
      <ul className="grid gap-1 sm:grid-cols-2" aria-label="Definition of Ready">
        {data.checks.map((c) => (
          <li key={c.key} className="flex items-center gap-2 text-sm">
            <span aria-hidden className={c.met ? 'text-primary' : 'text-muted-foreground'}>
              {c.met ? '✓' : '○'}
            </span>
            <span className={c.met ? undefined : 'text-muted-foreground'}>{c.label}</span>
            <span className="sr-only">{c.met ? ', done' : ', not done'}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`risk-${taskId}`} className="text-2xs">Risk</Label>
          <Select
            value={data.risk ?? NO_RISK}
            disabled={!data.canEdit || isPending}
            onValueChange={(value) => {
              const next = value === NO_RISK || value === null ? null : (value as RiskLevel)
              run(() => setTaskRisk(taskId, next), next ? `${RISK_LABEL[next]} set` : 'Risk cleared')
            }}
          >
            <SelectTrigger id={`risk-${taskId}`} className="h-8 w-36">
              <SelectValue>
                {(value: string) => (value === NO_RISK ? 'Not assessed' : RISK_LABEL[value as RiskLevel])}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_RISK}>Not assessed</SelectItem>
              {RISK_LEVELS.map((r) => (
                <SelectItem key={r} value={r}>
                  {RISK_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {data.canApprove ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() =>
              run(
                () => setProductApproval(taskId, data.productApprovedAt === null),
                data.productApprovedAt === null ? 'Product approval given' : 'Product approval withdrawn',
              )
            }
          >
            {data.productApprovedAt === null ? 'Give product approval' : 'Withdraw approval'}
          </Button>
        ) : null}
        {data.canEdit ? (
          <Button
            type="button"
            size="sm"
            variant={ready ? 'outline' : 'default'}
            disabled={isPending}
            onClick={() => run(() => setTaskReady(taskId, !ready), ready ? 'Marked not ready' : 'Marked ready')}
          >
            {ready ? 'Mark not ready' : 'Mark ready'}
          </Button>
        ) : null}
      </div>
      {!ready && score.met < score.total && data.canEdit ? (
        <p className="text-2xs text-muted-foreground">
          You can still mark it ready — the team decides. Unticked checks stay visible on the refinement list.
        </p>
      ) : null}
    </div>
  )
}
