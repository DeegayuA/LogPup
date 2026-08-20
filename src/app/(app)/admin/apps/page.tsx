import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AppsTable } from '@/features/admin/components/apps-table'
import { listApps } from '@/features/apps/queries'
import { listActiveUsers } from '@/features/people/queries'
import { loadActor } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'

export default async function AdminAppsPage() {
  const actor = await loadActor()
  if (!actor || !can(actor, 'app.edit')) notFound()

  const [allApps, activeUsers] = await Promise.all([listApps(), listActiveUsers()])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apps</CardTitle>
        <CardDescription>
          Reassign an app&apos;s PM or lead, archive it, or move it to Trash. Archived apps
          are shown muted. Recording someone as PM or lead here is also what gives a
          manager seat its reach — a job title typed into an assignment does not.
          Tick rows to act on several at once; a batch reports exactly what it skipped.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AppsTable apps={allApps} activeUsers={activeUsers} />
      </CardContent>
    </Card>
  )
}
