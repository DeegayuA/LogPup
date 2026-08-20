import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getHandoverInventory } from '@/features/people/handover-queries'
import { listActiveUsers } from '@/features/people/queries'
import { loadActor } from '@/features/auth/actor'
import { HandoverForm } from '@/features/people/components/handover-form'

/**
 * Moving a departing person's open work to their successors.
 *
 * `params` is async in Next 15+ — it is a Promise here, not the synchronous
 * prop it was in 14 and earlier.
 */
export default async function HandoverPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const actor = await loadActor()
  if (!actor) notFound()

  const inventory = await getHandoverInventory(actor, id)
  // null means the capability said no. 404 rather than a refusal page, so
  // somebody without the seat cannot enumerate who is leaving.
  if (!inventory) notFound()

  const successors = (await listActiveUsers()).filter((u) => u.id !== id)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/people" className="text-2xs text-muted-foreground hover:underline">
          ← People
        </Link>
        <h2 className="font-heading text-lg font-semibold">
          Hand over {inventory.user.name}&apos;s work
        </h2>
        <p className="text-sm text-muted-foreground">
          {inventory.total === 0
            ? 'They hold no open work. You can deactivate their account safely.'
            : `${inventory.total} open ${inventory.total === 1 ? 'item' : 'items'} to move. Nothing is written until you confirm.`}
        </p>
      </div>

      {inventory.total > 0 && (
        <HandoverForm
          leaverId={inventory.user.id}
          leaverName={inventory.user.name}
          groups={inventory.groups}
          successors={successors.map((u) => ({ id: u.id, name: u.name }))}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-base">What stays with them</CardTitle>
          <CardDescription>
            These are not transferable, and the reason matters more than the rule.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-3">
            {inventory.nonTransferable.map((entry) => (
              <div key={entry.table} className="flex flex-col gap-0.5">
                <dt className="font-mono text-xs">{entry.table}</dt>
                <dd className="text-sm text-muted-foreground">{entry.reason}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
