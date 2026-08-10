import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { DbClearButton } from '@/features/admin/components/db-clear-button'
import { UserTable } from '@/features/admin/components/user-table'
import { AppsTable } from '@/features/admin/components/apps-table'
import { listAllUsers } from '@/features/admin/queries'
import { listApps } from '@/features/apps/queries'
import { listActiveUsers } from '@/features/people/queries'

export default async function AdminPage() {
  const session = await auth()
  if (session?.user?.role !== 'admin') notFound()

  const dbClearEnabled = process.env.ENABLE_DB_CLEAR === '1'

  const [allUsers, allApps, activeUsers] = await Promise.all([
    listAllUsers(),
    listApps(),
    listActiveUsers(),
  ])

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="font-heading text-xl font-medium">Admin</h1>

      <div className="flex flex-col gap-2 rounded-lg border p-4">
        <p className="text-sm font-medium">Users</p>
        <p className="text-sm text-muted-foreground">
          Change a teammate&apos;s role or deactivate their account. You can&apos;t change your
          own role or active status here.
        </p>
        <div className="pt-1">
          <UserTable users={allUsers} currentUserId={session.user.id} />
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border p-4">
        <p className="text-sm font-medium">Apps</p>
        <p className="text-sm text-muted-foreground">
          Reassign an app&apos;s lead or archive it. Archived apps are shown muted below.
        </p>
        <div className="pt-1">
          <AppsTable apps={allApps} activeUsers={activeUsers} />
        </div>
      </div>

      <div className="flex max-w-lg flex-col gap-2 rounded-lg border p-4">
        <p className="text-sm font-medium">Database</p>
        {dbClearEnabled ? (
          <>
            <p className="text-sm text-muted-foreground">
              Wipes all business data (apps, assignments, sprints, tasks, meetings). Users are kept.
              Testing only — remove <span className="font-mono">ENABLE_DB_CLEAR</span> when done.
            </p>
            <div className="pt-1"><DbClearButton /></div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            The clear-database tool is disabled. Set <span className="font-mono">ENABLE_DB_CLEAR=1</span> to enable it (testing only).
          </p>
        )}
      </div>
    </div>
  )
}
