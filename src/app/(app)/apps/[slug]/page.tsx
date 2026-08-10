import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { auth } from '@/lib/auth'
import { Badge } from '@/components/ui/badge'
import { getAppBySlug } from '@/features/apps/queries'
import { getTeamForApp, listActiveUsers } from '@/features/people/queries'
import { getSprintsForApp } from '@/features/sprints/queries'
import { AppTabs } from '@/features/apps/components/app-tabs'
import { AppFormDialog } from '@/features/apps/components/app-form-dialog'
import { TeamPanel } from '@/features/people/components/team-panel'
import { SprintSwitcher } from '@/features/sprints/components/sprint-switcher'
import { SprintFormDialog } from '@/features/sprints/components/sprint-form-dialog'
import { SprintStatusSelect } from '@/features/sprints/components/sprint-status-select'

const STATUS_VARIANT = {
  active: 'default',
  paused: 'outline',
  archived: 'secondary',
} as const

const STATUS_LABEL: Record<keyof typeof STATUS_VARIANT, string> = {
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
  searchParams: Promise<{ sprint?: string }>
}) {
  const { slug } = await props.params
  const { sprint: sprintParam } = await props.searchParams
  const app = await getAppBySlug(slug)
  if (!app) notFound()

  const [session, team, activeUsers, sprints] = await Promise.all([
    auth(),
    getTeamForApp(app.id),
    listActiveUsers(),
    getSprintsForApp(app.id),
  ])
  const isAdmin = session?.user?.role === 'admin'
  const lead = app.leadId ? activeUsers.find((user) => user.id === app.leadId) : undefined

  const selectedSprint =
    (sprintParam ? sprints.find((s) => s.id === sprintParam) : undefined) ??
    sprints.find((s) => s.status === 'active') ??
    sprints[0]

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-xl font-medium">{app.name}</h1>
          <Badge variant={STATUS_VARIANT[app.status]}>{STATUS_LABEL[app.status]}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {lead ? <span>Lead: {lead.name}</span> : null}
          {app.repoUrl ? (
            <a
              href={app.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              Repo <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </div>
      </div>

      <AppTabs
        overview={
          <TeamPanel appId={app.id} team={team} activeUsers={activeUsers} isAdmin={isAdmin} />
        }
        board={
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SprintSwitcher sprints={sprints} selectedId={selectedSprint?.id ?? ''} />
              {isAdmin ? <SprintFormDialog appId={app.id} /> : null}
            </div>
            {selectedSprint ? (
              <div className="flex flex-col gap-2 rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-medium">{selectedSprint.name}</h2>
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
                <p className="text-sm text-muted-foreground">
                  {formatSprintDate(selectedSprint.startDate)} –{' '}
                  {formatSprintDate(selectedSprint.endDate)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No sprints yet.{isAdmin ? ' Create one to start planning.' : ''}
              </p>
            )}
            <p className="text-sm text-muted-foreground">Task board arrives in Task 12</p>
          </div>
        }
        meetings={<p className="text-sm text-muted-foreground">Meetings arrive soon</p>}
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
                />
              </div>
            </div>
          ) : undefined
        }
      />
    </div>
  )
}
