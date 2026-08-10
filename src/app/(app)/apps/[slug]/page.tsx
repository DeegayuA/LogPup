import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { auth } from '@/lib/auth'
import { Badge } from '@/components/ui/badge'
import { getAppBySlug } from '@/features/apps/queries'
import { getTeamForApp, listActiveUsers } from '@/features/people/queries'
import { AppTabs } from '@/features/apps/components/app-tabs'
import { AppFormDialog } from '@/features/apps/components/app-form-dialog'
import { TeamPanel } from '@/features/people/components/team-panel'

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

export default async function AppDetailPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  const app = await getAppBySlug(slug)
  if (!app) notFound()

  const [session, team, activeUsers] = await Promise.all([
    auth(),
    getTeamForApp(app.id),
    listActiveUsers(),
  ])
  const isAdmin = session?.user?.role === 'admin'
  const lead = app.leadId ? activeUsers.find((user) => user.id === app.leadId) : undefined

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
        board={<p className="text-sm text-muted-foreground">Sprint board arrives soon</p>}
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
