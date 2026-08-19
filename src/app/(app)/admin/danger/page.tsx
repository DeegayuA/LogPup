import { notFound } from 'next/navigation'
import { TriangleAlert } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DbClearButton } from '@/features/admin/components/db-clear-button'
import { loadActor } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'

/**
 * Superadmin only, and on its own route on purpose.
 *
 * Structural separation, not just a red heading: an irreversible control that
 * shares a scroll with everyday tools is one mis-click from a workspace with
 * no data. Reaching this needs a deliberate navigation.
 */
export default async function AdminDangerPage() {
  const actor = await loadActor()
  if (!actor || !can(actor, 'danger.dbclear')) notFound()

  const dbClearEnabled = process.env.ENABLE_DB_CLEAR === '1'

  return (
    <Card className="ring-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TriangleAlert aria-hidden className="size-4 text-destructive" />
          Clear database
        </CardTitle>
        <CardDescription>
          Permanently deletes all apps, assignments, sprints, tasks, meetings and work
          logs for the whole workspace. Users are kept. This cannot be undone, and it
          does not go to Trash.
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
            Disabled. Set{' '}
            <span className="font-mono text-xs text-foreground">ENABLE_DB_CLEAR=1</span> to
            enable it (testing only).
          </p>
        )}
      </CardContent>
    </Card>
  )
}
