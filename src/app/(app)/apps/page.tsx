import { PawPrint } from 'lucide-react'
import { auth } from '@/lib/auth'
import { listApps } from '@/features/apps/queries'
import { AppCard } from '@/features/apps/components/app-card'
import { AppFormDialog } from '@/features/apps/components/app-form-dialog'

export default async function AppsPage() {
  const [session, apps] = await Promise.all([auth(), listApps()])
  const isAdmin = session?.user?.role === 'admin'

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-3">
            <h1 className="font-heading text-2xl font-bold tracking-tight">Apps</h1>
            <span className="font-mono text-sm text-muted-foreground">{apps.length}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Every product the team is building, at a glance.
          </p>
        </div>
        {isAdmin ? <AppFormDialog /> : null}
      </div>
      {apps.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-12 text-center">
          <PawPrint aria-hidden className="size-8 text-muted-foreground/60" />
          <p className="font-heading font-semibold">No apps in the kennel yet.</p>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? 'Hit New app above to give LogPup something to watch.'
              : 'An admin can add the first app for the pack.'}
          </p>
        </div>
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
