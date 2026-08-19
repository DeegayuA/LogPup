import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PendingApprovalsCard } from '@/features/admin/components/pending-approvals-card'
import { listPendingUsers } from '@/features/admin/queries'
import { getApprovalsInbox } from '@/features/admin/change-request-queries'
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

  const [pendingUsers, pendingAbsences, requests] = await Promise.all([
    can(actor, 'user.approve') ? listPendingUsers() : Promise.resolve([]),
    listPendingAbsences(actor),
    getApprovalsInbox(actor),
  ])

  const nothingWaiting =
    pendingUsers.length === 0 && pendingAbsences.length === 0 && requests.length === 0

  return (
    <div className="flex flex-col gap-6">
      {can(actor, 'user.approve') && <PendingApprovalsCard users={pendingUsers} />}

      <Card>
        <CardHeader>
          <CardTitle>Change requests</CardTitle>
          <CardDescription>
            Edits and deletes proposed by someone who could not make them directly.
            Approving applies the change and records your signature against it;
            rejecting leaves the target untouched.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No change requests waiting on you.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 py-3 text-sm">
                  <span>
                    <span className="font-medium">{r.requesterName}</span>{' '}
                    <span className="text-muted-foreground">wants to {r.operation}</span>{' '}
                    {r.entityLabel}
                    {/* A self-filed row is marked rather than hidden: it is
                        legitimate for a superadmin, and a reviewer should be
                        able to see that is what they are about to do. */}
                    {r.isSelf && (
                      <span className="ml-2 text-2xs text-warning">your own request</span>
                    )}
                  </span>
                  <span className="text-muted-foreground">{r.reason}</span>
                  <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                    {r.entityType} · filed {r.createdAt}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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
