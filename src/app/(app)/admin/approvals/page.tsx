import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PendingApprovalsCard } from '@/features/admin/components/pending-approvals-card'
import { listPendingUsers } from '@/features/admin/queries'
import { listPendingAbsences } from '@/features/worklog/absence-queries'
import { loadActor } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'

/**
 * One queue, three sources: signups, change requests, and leave.
 *
 * They are together because they are the same act — somebody is waiting on a
 * person with authority — and split across three screens is how a request sits
 * unanswered for a week.
 */
export default async function AdminApprovalsPage() {
  const actor = await loadActor()
  if (!actor || !can(actor, 'request.review')) notFound()

  const [pendingUsers, pendingAbsences] = await Promise.all([
    can(actor, 'user.approve') ? listPendingUsers() : Promise.resolve([]),
    listPendingAbsences(actor),
  ])

  const nothingWaiting = pendingUsers.length === 0 && pendingAbsences.length === 0

  return (
    <div className="flex flex-col gap-6">
      {can(actor, 'user.approve') && <PendingApprovalsCard users={pendingUsers} />}

      <Card>
        <CardHeader>
          <CardTitle>Leave requests</CardTitle>
          <CardDescription>
            Approving a request marks those days exempt, so they stop counting against
            the person&apos;s coverage. Until then the days still read as unlogged.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingAbsences.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No leave waiting on you.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {pendingAbsences.map((a) => (
                <li key={a.id} className="flex flex-col gap-0.5 text-sm">
                  <span className="font-medium">{a.userName}</span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {a.kind} · {a.startDate}
                    {a.endDate !== a.startDate && ` to ${a.endDate}`}
                  </span>
                  {a.reason && <span className="text-muted-foreground">{a.reason}</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {nothingWaiting && (
        <p className="text-sm text-muted-foreground">
          Nothing is waiting on you right now.
        </p>
      )}
    </div>
  )
}
