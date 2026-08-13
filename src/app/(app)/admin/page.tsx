import { notFound } from 'next/navigation'
import { TriangleAlert } from 'lucide-react'
import { getSession } from '@/lib/session'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AddUserDialog } from '@/features/admin/components/add-user-dialog'
import { DbClearButton } from '@/features/admin/components/db-clear-button'
import { PendingApprovalsCard } from '@/features/admin/components/pending-approvals-card'
import { TrashCard } from '@/features/admin/components/trash-card'
import { UserTable } from '@/features/admin/components/user-table'
import { AppsTable } from '@/features/admin/components/apps-table'
import { listAllUsers, listPendingUsers } from '@/features/admin/queries'
import { getTrash } from '@/features/admin/trash-queries'
import { listApps } from '@/features/apps/queries'
import { listActiveUsers } from '@/features/people/queries'

export default async function AdminPage() {
  const session = await getSession()
  if (session?.user?.role !== 'admin') notFound()

  const dbClearEnabled = process.env.ENABLE_DB_CLEAR === '1'

  const [pendingUsers, allUsers, allApps, activeUsers, trashGroups] = await Promise.all([
    listPendingUsers(),
    listAllUsers(),
    listApps(),
    listActiveUsers(),
    getTrash(),
  ])

  const existingOrgTags = Array.from(new Set(allUsers.flatMap((u) => u.orgTags)))
    .sort((a, b) => a.localeCompare(b))

  return (
    <div className="flex flex-1 flex-col p-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Workspace-wide tools. These act on everyone&apos;s data — tread carefully.
          </p>
        </div>

        <PendingApprovalsCard users={pendingUsers} />

        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>
              Approved teammates only — pending self-signups are above, and a rejected
              account is gone from every list. Add teammates by email, tag their
              organization, change roles or deactivate accounts. You can&apos;t change
              your own role or active status here.
            </CardDescription>
            <CardAction>
              <AddUserDialog existingOrgTags={existingOrgTags} />
            </CardAction>
          </CardHeader>
          <CardContent>
            <UserTable users={allUsers} currentUserId={session.user.id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Apps</CardTitle>
            <CardDescription>
              Reassign an app&apos;s lead or archive it. Archived apps are shown muted below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AppsTable apps={allApps} activeUsers={activeUsers} />
          </CardContent>
        </Card>

        <TrashCard groups={trashGroups} />

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-sm font-semibold text-destructive">
            Danger zone
          </h2>

          <Card className="ring-destructive/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TriangleAlert aria-hidden className="size-4 text-destructive" />
                Clear database
              </CardTitle>
              <CardDescription>
                Permanently deletes all apps, assignments, sprints, tasks and meetings
                for the whole workspace. Users are kept. This cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dbClearEnabled ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">
                    Testing only — remove{' '}
                    <span className="font-mono text-xs text-foreground">ENABLE_DB_CLEAR</span>{' '}
                    from the environment when done.
                  </p>
                  <DbClearButton />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This tool is currently disabled. Set{' '}
                  <span className="font-mono text-xs text-foreground">ENABLE_DB_CLEAR=1</span>{' '}
                  to enable it (testing only).
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
