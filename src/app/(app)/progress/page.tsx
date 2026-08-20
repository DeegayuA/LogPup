import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FolderKanban, SearchX, UserX, Users } from 'lucide-react'
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

export const metadata = { title: 'Progress' }

/**
 * "Each person, app, sprint, time, work progress" — read-only, per role.
 *
 * The gate is the capability matrix and nothing newer: `worklog.view` at
 * 'all' (admin, superadmin, auditor) shows everyone; at 'scoped' (manager,
 * editor) it shows the people sharing the actor's scoped apps — the scope set
 * `loadActor` already resolved from the relation `scopeSourceFor` names. At
 * 'own' (member) the answer already has a page, /worklog, so the member is
 * sent there rather than shown a matrix of one.
 *
 * The apps lane runs on `app.view`, which reaches FURTHER for a manager than
 * their worklog scope does — those extra apps get the same card without the
 * per-person row. A partial tier from existing grants, no new capability.
 */
export default async function ProgressPage(props: {
  searchParams: Promise<RawProgressParams>
}) {
  const session = await getSession()
  if (!session?.user) return null

  // The (app) layout already bounces deactivated sessions to /deactivated,
  // but the actor is the authority (see loadActor: no Actor means every
  // `can()` answers no) — so the null case is designed, not assumed away.
  const actor = await loadActor()
  if (!actor) {
    return (
      <div className="flex flex-1 flex-col p-6">
        <EmptyState
          icon={UserX}
          title="This account is deactivated"
          description="Progress is read through your seat, and a deactivated account holds none. Talk to an admin if this looks wrong."
        />
      </div>
    )
  }

  const grant = effectiveGrant(actor.role, actor.employmentType, 'worklog.view')
  // A member's own progress already has a home; no grant at all has nothing
  // to see here either way.
  if (grant !== 'all' && grant !== 'scoped') redirect('/worklog')

  const scope: ProgressScope = grant === 'all' ? 'all' : actor.scopeAppIds

  const appGrant = effectiveGrant(actor.role, actor.employmentType, 'app.view')
  const appScope: ProgressScope =
    appGrant === 'all' ? 'all' : appGrant === 'scoped' ? actor.scopeAppIds : new Set()

  const header = (
    <PageHeader
      title="Progress"
      description="Who did what, where, and how far — each person's days beside each app's sprint."
    />
  )

  // A scoped seat with no projects has an empty universe: say so with the
  // next action instead of rendering a matrix of nobody.
  if (scope !== 'all' && scope.size === 0) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
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

  // One thin read before the controls render: the app Select needs its
  // options, and it must not wait behind the portfolio's aggregate queries.
  const appOptions = await listProgressAppOptions(appScope)
  // An app id the viewer cannot see degrades to "all apps" — the same
  // parse-totally rule every URL param on this page follows.
  const appId =
    parsed.app && appOptions.some((app) => app.id === parsed.app) ? parsed.app : null
  const params: ProgressParams = { ...parsed, app: appId }
  const window = resolveProgressWindow(params, today)

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {header}

      {/* Only the DATA waits. The header and every control render from the
          URL alone (people/history's rule), so changing the window never
          blanks the control that changed it. */}
      <ProgressFilters params={params} window={window} apps={appOptions} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-heading text-sm font-semibold">People, day by day</h2>
          <p className="text-2xs text-muted-foreground">
            Each cell is one person&rsquo;s own account of a day; percentages are self-scored
            against what they planned — days, never hours. Expected days follow each
            person&rsquo;s schedule, holidays and approved leave.
          </p>
        </div>
        <Suspense fallback={<ProgressMatrixSkeleton />}>
          <MatrixSection params={params} scope={scope} actorId={actor.id} window={window} today={today} />
        </Suspense>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-heading text-sm font-semibold">Apps and sprints</h2>
          <p className="text-2xs text-muted-foreground">
            The running sprint, the open bug backlog, and when anything last happened — full
            team detail on your own projects.
          </p>
        </div>
        <Suspense fallback={<ProgressAppsLaneSkeleton />}>
          <AppsSection params={params} appScope={appScope} detailScope={scope} />
        </Suspense>
      </section>
    </div>
  )
}

/**
 * Everything behind the matrix queries — split out so the page renders
 * without awaiting them, and so a failure here surfaces through the route's
 * error boundary without taking the apps lane down with it structurally.
 */
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

/** The apps lane's data zone — same split, same reasoning. */
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
