'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { commitSprintScope } from '@/features/sprints/actions'
import { planLoad } from '@/features/sprints/sprint-metrics'

/**
 * Sprint planning's headline: "Capacity 80 · Committed 72". The bar is the
 * commitment (or, before one is locked, today's scope) as a share of
 * capacity; over capacity is spelled out in words, never colour alone.
 */

const STATE_TEXT = {
  unset: 'No capacity set — add one in the sprint’s Edit dialog on the Roadmap.',
  under: 'Room for more work.',
  full: 'Planned to capacity.',
  over: 'Over capacity — more is planned than the team can finish.',
} as const

export function SprintPlanCard({
  sprintId,
  capacity,
  committed,
  committedAt,
  scope,
  canManage,
}: {
  sprintId: string
  capacity: number | null
  committed: number | null
  committedAt: Date | null
  scope: number
  canManage: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const plan = planLoad(capacity, committed, scope)
  const width = plan.load === null ? 0 : Math.min(100, Math.round(plan.load * 100))

  function lockIn() {
    startTransition(async () => {
      try {
        const res = await commitSprintScope(sprintId)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(`Committed to ${res.data.committedPoints} points`)
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-labelledby="sprint-plan-heading">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 id="sprint-plan-heading" className="font-heading text-sm font-semibold">Planning</h3>
          <p className="text-sm tabular-nums">
            <span className="text-muted-foreground">Capacity</span> {capacity ?? '—'}
            <span className="mx-2 text-muted-foreground">·</span>
            <span className="text-muted-foreground">{plan.plannedIs === 'committed' ? 'Committed' : 'Planned so far'}</span>{' '}
            {plan.planned}
            {plan.plannedIs === 'committed' && scope !== plan.planned ? (
              <>
                <span className="mx-2 text-muted-foreground">·</span>
                <span className="text-muted-foreground">In sprint now</span> {scope}
              </>
            ) : null}
            <span className="text-muted-foreground"> pts</span>
          </p>
        </div>
        {canManage ? (
          <Button size="sm" variant="outline" disabled={isPending} onClick={lockIn}>
            {committed === null ? 'Lock in commitment' : 'Re-commit'}
          </Button>
        ) : null}
      </div>
      {plan.load !== null ? (
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="meter"
          aria-label="Planned against capacity"
          aria-valuemin={0}
          aria-valuemax={capacity ?? 0}
          aria-valuenow={plan.planned}
        >
          <div
            className={cn('h-full rounded-full', plan.state === 'over' ? 'bg-destructive' : 'bg-primary')}
            style={{ width: `${width}%` }}
          />
        </div>
      ) : null}
      <p className={cn('text-2xs', plan.state === 'over' ? 'text-destructive' : 'text-muted-foreground')}>
        {STATE_TEXT[plan.state]}
        {committedAt ? ` Committed ${format(committedAt, 'MMM d')}.` : ' Lock in the commitment when planning is done; it is also taken when the sprint starts.'}
      </p>
    </section>
  )
}
