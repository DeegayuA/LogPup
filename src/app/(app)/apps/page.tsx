import { auth } from '@/lib/auth'
import { listApps } from '@/features/apps/queries'
import { AppCard } from '@/features/apps/components/app-card'
import { AppFormDialog } from '@/features/apps/components/app-form-dialog'

export default async function AppsPage() {
  const [session, apps] = await Promise.all([auth(), listApps()])
  const isAdmin = session?.user?.role === 'admin'

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-medium">Apps</h1>
        {isAdmin ? <AppFormDialog /> : null}
      </div>
      {apps.length === 0 ? (
        <p className="text-sm text-muted-foreground">No apps yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  )
}
