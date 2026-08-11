import { PawPrint } from 'lucide-react'
import { auth } from '@/lib/auth'
import { listApps } from '@/features/apps/queries'
import { AppsBrowser } from '@/features/apps/components/apps-browser'
import { AppFormDialog } from '@/features/apps/components/app-form-dialog'

export default async function AppsPage(props: { searchParams: Promise<{ new?: string }> }) {
  const [{ new: newParam }, session, apps] = await Promise.all([
    props.searchParams,
    auth(),
    listApps(),
  ])
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
        {isAdmin ? <AppFormDialog defaultOpen={newParam === '1'} /> : null}
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
        <AppsBrowser apps={apps} />
      )}
    </div>
  )
}
