import { redirect } from 'next/navigation'
import { TriangleAlert } from 'lucide-react'
import { auth } from '@/lib/auth'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DbClearButton } from '@/features/admin/components/db-clear-button'

export default async function AdminPage() {
  const session = await auth()
  if (session?.user?.role !== 'admin') redirect('/')

  const dbClearEnabled = process.env.ENABLE_DB_CLEAR === '1'

  return (
    <div className="flex flex-1 flex-col p-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Workspace-wide tools. These act on everyone&apos;s data — tread carefully.
          </p>
        </div>

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
