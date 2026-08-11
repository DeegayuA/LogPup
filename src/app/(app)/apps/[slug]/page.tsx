import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { auth } from '@/lib/auth'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getAppBySlug, listApps, listDistinctTechTags } from '@/features/apps/queries'
import { getTeamForApp, listActiveUsers } from '@/features/people/queries'
import { getBoard, getSprintsForApp } from '@/features/sprints/queries'
import { getMeetingsForApp } from '@/features/meetings/queries'
import { AppTabs } from '@/features/apps/components/app-tabs'
import { AppFormDialog } from '@/features/apps/components/app-form-dialog'
import { TeamPanel } from '@/features/people/components/team-panel'
import { AppComments } from '@/features/apps/components/app-comments'
import { listAppComments } from '@/features/apps/comment-queries'
import { SprintSwitcher } from '@/features/sprints/components/sprint-switcher'
import { SprintFormDialog } from '@/features/sprints/components/sprint-form-dialog'
import { SprintStatusSelect } from '@/features/sprints/components/sprint-status-select'
import { Board } from '@/features/sprints/components/board'
import { Roadmap } from '@/features/sprints/components/roadmap'
import { ExportButton } from '@/features/notion/components/export-button'
import { MeetingForm } from '@/features/meetings/components/meeting-form'
import { MeetingList } from '@/features/meetings/components/meeting-list'

const STATUS_DOT: Record<'active' | 'paused' | 'archived', string> = {
  active: 'bg-primary',
  paused: 'bg-chart-1',
  archived: 'bg-muted-foreground/60',
}

const STATUS_LABEL: Record<keyof typeof STATUS_DOT, string> = {
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
}

const SPRINT_STATUS_LABEL: Record<'planned' | 'active' | 'done', string> = {
  planned: 'Planned',
  active: 'Active',
  done: 'Done',
}

const SPRINT_STATUS_VARIANT: Record<'planned' | 'active' | 'done', 'outline' | 'default' | 'secondary'> = {
  planned: 'outline',
  active: 'default',
  done: 'secondary',
}

// Plain YYYY-MM-DD strings from the `date` column must not be handed to
// `new Date()` directly — that parses as UTC midnight and can render as the
// previous day in negative-offset timezones. Anchoring to local noon avoids
// the shift while keeping the display date correct.
function formatSprintDate(isoDate: string): string {
  return format(new Date(`${isoDate}T12:00:00`), 'MMM d, yyyy')
}

export default async function AppDetailPage(props: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sprint?: string; tab?: string }>
}) {
  const { slug } = await props.params
  const { sprint: sprintParam, tab: tabParam } = await props.searchParams
  const app = await getAppBySlug(slug)
  if (!app) notFound()

  const [session, team, activeUsers, sprints, appMeetings, allApps, comments, workspaceTechTags] =
    await Promise.all([
      auth(),
      getTeamForApp(app.id),
      listActiveUsers(),
      getSprintsForApp(app.id),
      getMeetingsForApp(app.id),
      listApps(),
      listAppComments(app.id),
      listDistinctTechTags(),
    ])
  const isAdmin = session?.user?.role === 'admin'
  const lead = app.leadId ? activeUsers.find((user) => user.id === app.leadId) : undefined

  // A `sprint=backlog` query param is a synthetic selection, not a real
  // sprint id: it maps to `getBoard(appId, null)`, which returns tasks that
  // aren't attached to any sprint.
  const isBacklog = sprintParam === 'backlog'
  const selectedSprint = isBacklog
    ? undefined
    : (sprintParam ? sprints.find((s) => s.id === sprintParam) : undefined) ??
      sprints.find((s) => s.status === 'active') ??
      sprints[0]
  const showBoard = isBacklog || Boolean(selectedSprint)
  const boardSprintId = isBacklog ? null : (selectedSprint?.id ?? null)
  const board = showBoard ? await getBoard(app.id, boardSprintId) : null

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-2xl font-bold tracking-tight">{app.name}</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            <span aria-hidden className={`size-1.5 rounded-full ${STATUS_DOT[app.status]}`} />
            {STATUS_LABEL[app.status]}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {lead ? <span>Lead: {lead.name}</span> : null}
          {app.repoUrl ? (
            <a
              href={app.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-sm outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Repo <ExternalLink className="size-3.5" />
            </a>
          ) : null}
          {app.techTags.length > 0 ? (
            <span className="flex flex-wrap items-center gap-1.5">
              {app.techTags.map((tag) => (
                <Badge key={tag} variant="outline" className="font-normal text-muted-foreground">
                  {tag}
                </Badge>
              ))}
            </span>
          ) : null}
        </div>
      </div>

      <AppTabs
        initialTab={tabParam}
        overview={
          <div className="flex flex-col gap-8">
            <TeamPanel appId={app.id} team={team} activeUsers={activeUsers} isAdmin={isAdmin} />
            <AppComments
              appId={app.id}
              comments={comments}
              users={activeUsers.map((u) => ({ id: u.id, name: u.name }))}
            />
          </div>
        }
        board={
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <SprintSwitcher
                  sprints={sprints}
                  selectedId={isBacklog ? '' : (selectedSprint?.id ?? '')}
                />
                <Link
                  href={
                    isBacklog ? `/apps/${slug}` : `/apps/${slug}?sprint=backlog`
                  }
                  className={cn(
                    buttonVariants({ variant: isBacklog ? 'default' : 'outline' }),
                  )}
                >
                  Backlog
                </Link>
              </div>
              <div className="flex items-center gap-2">
                <div id="board-export-slot">
                  {isAdmin && !isBacklog && selectedSprint ? (
                    <ExportButton sprintId={selectedSprint.id} />
                  ) : null}
                </div>
                {isAdmin ? <SprintFormDialog appId={app.id} /> : null}
              </div>
            </div>
            {!isBacklog && selectedSprint ? (
              <div className="flex flex-col gap-1 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-heading text-base font-semibold">{selectedSprint.name}</h2>
                  {isAdmin ? (
                    <SprintStatusSelect
                      sprintId={selectedSprint.id}
                      status={selectedSprint.status}
                    />
                  ) : (
                    <Badge variant={SPRINT_STATUS_VARIANT[selectedSprint.status]}>
                      {SPRINT_STATUS_LABEL[selectedSprint.status]}
                    </Badge>
                  )}
                </div>
                {selectedSprint.goal ? (
                  <p className="text-sm text-muted-foreground">{selectedSprint.goal}</p>
                ) : null}
                <p className="font-mono text-xs text-muted-foreground">
                  {formatSprintDate(selectedSprint.startDate)} –{' '}
                  {formatSprintDate(selectedSprint.endDate)}
                </p>
              </div>
            ) : null}
            {isBacklog ? (
              <p className="text-sm text-muted-foreground">
                Backlog — tasks not assigned to any sprint.
              </p>
            ) : null}
            {board && session?.user ? (
              <Board
                initialBoard={board}
                team={team.map((member) => ({ userId: member.userId, name: member.name }))}
                appId={app.id}
                sprintId={boardSprintId}
                currentUser={{ id: session.user.id, role: session.user.role }}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
                <p className="font-heading text-base font-semibold">Nothing to fetch here yet</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {isAdmin
                    ? 'This app has no sprints. Create the first one and LogPup will keep watch over the board.'
                    : 'No sprints planned for this app yet. LogPup is keeping an eye out — check back soon.'}
                </p>
                {isAdmin ? <SprintFormDialog appId={app.id} /> : null}
              </div>
            )}
          </div>
        }
        roadmap={<Roadmap sprints={sprints} slug={slug} />}
        meetings={
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <MeetingForm
                apps={allApps.map((a) => ({ id: a.id, name: a.name }))}
                activeUsers={activeUsers}
                defaultAppId={app.id}
                trigger={<Button size="sm">New meeting</Button>}
              />
            </div>
            <MeetingList
              meetings={appMeetings}
              currentUserId={session?.user?.id ?? ''}
              isAdmin={isAdmin}
              showAppBadge={false}
              users={activeUsers}
            />
          </div>
        }
        settings={
          isAdmin ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Update this app&apos;s details. Changes apply immediately.
              </p>
              <div>
                <AppFormDialog
                  appId={app.id}
                  initialValues={{
                    name: app.name,
                    description: app.description,
                    repoUrl: app.repoUrl,
                    techTags: app.techTags,
                    status: app.status,
                  }}
                  workspaceTechTags={workspaceTechTags}
                />
              </div>
            </div>
          ) : undefined
        }
      />
    </div>
  )
}
