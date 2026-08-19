import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { listAuditTrail } from '@/features/admin/audit-queries'
import { loadActor } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'

/**
 * The compliance read of activity_log: unfiltered, trashed rows included,
 * self-approvals visible. Distinct from /activity, which is the shared feed
 * every signed-in person sees.
 */
export default async function AdminAuditPage() {
  const actor = await loadActor()
  if (!actor || !can(actor, 'audit.view')) notFound()

  const entries = await listAuditTrail(actor)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit trail</CardTitle>
        <CardDescription>
          Every recorded change, newest first. Self-approvals are marked — a request
          signed by the person who filed it is legitimate for a superadmin and worth
          finding in a review.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-col gap-0.5 py-2 text-sm">
                <span>
                  <span className="font-medium">{e.actorName}</span>{' '}
                  <span className="text-muted-foreground">{e.verb}</span>{' '}
                  <span className="text-muted-foreground">{e.entityType}</span>{' '}
                  {e.entityLabel}
                </span>
                <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                  {e.at}
                  {e.selfApproved && ' · self-approved'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
