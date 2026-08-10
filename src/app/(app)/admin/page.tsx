import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { DbClearButton } from '@/features/admin/components/db-clear-button'

export default async function AdminPage() {
  const session = await auth()
  if (session?.user?.role !== 'admin') redirect('/')

  const dbClearEnabled = process.env.ENABLE_DB_CLEAR === '1'

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="font-heading text-xl font-medium">Admin</h1>

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
