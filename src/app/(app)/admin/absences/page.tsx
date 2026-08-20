import { notFound } from 'next/navigation'
import { CalendarOff } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ApprovalActions } from '@/features/admin/components/approval-actions'
import { listRecentAbsences } from '@/features/worklog/absence-queries'
import { loadActor } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'

export default async function AdminAbsencesPage() {
  const actor = await loadActor()
  if (!actor || !can(actor, 'absence.view')) notFound()

  const absences = await listRecentAbsences(actor)

  // Same reach test the Approvals queue uses. A pending row an admin can see
  // RIGHT HERE used to require a trip to /admin/approvals and re-finding it —
  // the decision controls belong next to the fact. Own rows stay read-only
  // (nobody reviews their own; the server re-checks regardless).
  const canReview =
    can(actor, 'absence.approve', { appId: null }) || can(actor, 'absence.approve')

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Absences</CardTitle>
        <CardDescription>
          Leave, training, and days spent on another project — the 50 most recent
          filings, newest first. An approved absence makes those days exempt, so they
          never count against coverage — and a day the person logged anyway still counts
          as work, not leave.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {absences.length === 0 ? (
          <EmptyState
            icon={CalendarOff}
            title="No absences recorded."
            description="People file these from their work log. Approved ones exempt those days from coverage."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {absences.map((a) => {
              const pending = a.status === 'pending'
              return (
                <li key={a.id} className="flex flex-col gap-1.5 py-2 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    <span className="font-medium">{a.userName}</span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {a.kind} · {a.startDate}
                      {a.endDate !== a.startDate && ` to ${a.endDate}`} · {a.status}
                    </span>
                  </div>
                  {a.reason ? (
                    <span className="text-xs text-muted-foreground">{a.reason}</span>
                  ) : null}
                  {pending && canReview && a.userId !== actor.id ? (
                    <ApprovalActions id={a.id} kind="absence" />
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
