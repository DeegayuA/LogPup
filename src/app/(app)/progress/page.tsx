import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FolderKanban, SearchX, UserX, Users, Activity, Layers } from 'lucide-react'
import { getSession } from '@/lib/session'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { loadActor } from '@/features/auth/actor'
import { effectiveGrant } from '@/features/auth/capabilities'
import { resolveWorkDay } from '@/features/worklog/worklog-day'
import {
  parseProgressParams,
  progressHref,
  resolveProgressWindow,
  type ProgressParams,
  type RawProgressParams,
} from '@/features/worklog/progress-params'
import {
  getProgressApps,
  getProgressMatrix,
  listProgressAppOptions,
  type ProgressScope,
} from '@/features/worklog/progress-queries'
import { ProgressFilters } from '@/features/worklog/components/progress-filters'
import {
  ProgressAppsLane,
  ProgressAppsLaneSkeleton,
} from '@/features/worklog/components/progress-apps-lane'
import {
  ProgressMatrix,
  ProgressMatrixSkeleton,
} from '@/features/worklog/components/progress-matrix'

export const metadata = { title: 'Progress — Studio Ops' }

export default async function ProgressPage(props: {
  searchParams: Promise<RawProgressParams>
}) {
  const session = await getSession()
  if (!session?.user) return null

  const actor = await loadActor()
  if (!actor) {
    return (
      <div className="flex flex-1 flex-col p-6 md:p-8">
        <EmptyState
          icon={UserX}
          title="This account is deactivated"
          description="Progress is read through your seat, and a deactivated account holds none. Talk to an admin if this looks wrong."
        />
      </div>
    )
  }

  const grant = effectiveGrant(actor.role, actor.employmentType, 'worklog.view')
  if (grant !== 'all' && grant !== 'scoped') redirect('/worklog')

  const scope: ProgressScope = grant === 'all' ? 'all' : actor.scopeAppIds

  const appGrant = effectiveGrant(actor.role, actor.employmentType, 'app.view')
  const appScope: ProgressScope =
    appGrant === 'all' ? 'all' : appGrant === 'scoped' ? actor.scopeAppIds : new Set()

  const header = (
    <PageHeader
      title="Studio Progress"
      description="Who did what, where, and how far — each person's days beside each app's sprint."
    />
  )

  if (scope !== 'all' && scope.size === 0) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
        {header}
        <EmptyState
          icon={FolderKanban}
          title="No projects assigned yet"
          description="Progress is scoped to your projects, and you don't hold any — ask an admin to put you on one, and this page fills in from there."
          action={
            <Button variant="outline" size="sm" render={<Link href="/worklog" />}>
              Your own work log
            </Button>
          }
        />
      </div>
    )
  }

  const raw = await props.searchParams
  const parsed = parseProgressParams(raw)
  const today = resolveWorkDay(new Date())

  const appOptions = await listProgressAppOptions(appScope)
  const appId =
    parsed.app && appOptions.some((app) => app.id === parsed.app) ? parsed.app : null
  const params: ProgressParams = { ...parsed, app: appId }
  const window = resolveProgressWindow(params, today)

  return (
    <div className="relative flex flex-1 flex-col gap-6 p-6 md:p-8">
      {/* Decorative only, and clipped HERE rather than on the page root:
          `overflow-hidden` on the root makes it the nearest scroll container,
          which silently stops `position: sticky` for its descendants — and
          this page's matrix has a sticky person column. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="pointer-events-none absolute -top-40 right-1/3 -z-10 h-[400px] w-[500px] rounded-full bg-primary/8 blur-3xl"
        aria-hidden
      />
      </div>

      {header}

      {/* Filter Controls Bar */}
      <div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-xs backdrop-blur-sm">
        <ProgressFilters params={params} window={window} apps={appOptions} />
      </div>

      {/* People Matrix Section */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/40 p-5 shadow-xs backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="size-4" />
            </div>
            <div>
              <h2 className="font-heading text-sm font-bold text-foreground">People, Day by Day</h2>
              <p className="text-2xs text-muted-foreground">
                Self-scored plan progress vs. scheduled working days, holidays, and approved leaves.
              </p>
            </div>
          </div>
        </div>
        <Suspense fallback={<ProgressMatrixSkeleton />}>
          <MatrixSection params={params} scope={scope} actorId={actor.id} window={window} today={today} />
        </Suspense>
      </section>

      {/* Apps and Sprints Section */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/40 p-5 shadow-xs backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-chart-1/10 text-chart-1">
              <Layers className="size-4" />
            </div>
            <div>
              <h2 className="font-heading text-sm font-bold text-foreground">Apps &amp; Sprint Velocity</h2>
              <p className="text-2xs text-muted-foreground">
                Active sprints, open bug backlogs, and recent deployments across your products.
              </p>
            </div>
          </div>
        </div>
        <Suspense fallback={<ProgressAppsLaneSkeleton />}>
          <AppsSection params={params} appScope={appScope} detailScope={scope} />
        </Suspense>
      </section>
    </div>
  )
}

async function MatrixSection({
  params,
  scope,
  actorId,
  window,
  today,
}: {
  params: ProgressParams
  scope: ProgressScope
  actorId: string
  window: { from: string; to: string }
  today: string
}) {
  const data = await getProgressMatrix({
    scope,
    actorId,
    appId: params.app,
    q: params.q,
    from: window.from,
    to: window.to,
    today,
  })

  if (data.people.length === 0) {
    const filtered = params.q !== '' || params.app !== null
    return (
      <EmptyState
        icon={filtered ? SearchX : Users}
        title={filtered ? 'Nobody matches those filters' : 'Nobody to show yet'}
        description={
          filtered
            ? 'Clear the name filter or pick another app.'
            : 'People appear here once they hold an assignment on a project you can see.'
        }
        action={
          filtered ? (
            <Button
              variant="outline"
              size="sm"
              render={<Link href={progressHref(params, { q: '', app: null })} />}
            >
              Clear filters
            </Button>
          ) : undefined
        }
      />
    )
  }

  return <ProgressMatrix data={data} today={today} />
}

async function AppsSection({
  params,
  appScope,
  detailScope,
}: {
  params: ProgressParams
  appScope: ProgressScope
  detailScope: ProgressScope
}) {
  const apps = await getProgressApps({ appScope, detailScope, appId: params.app })

  if (apps.length === 0) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="No apps to show"
        description={
          params.app
            ? 'That app is not visible to you any more — clear the filter.'
            : 'Apps appear here as soon as one you can see exists.'
        }
        action={
          params.app ? (
            <Button
              variant="outline"
              size="sm"
              render={<Link href={progressHref(params, { app: null })} />}
            >
              Show every app
            </Button>
          ) : undefined
        }
      />
    )
  }

  return <ProgressAppsLane apps={apps} />
}
