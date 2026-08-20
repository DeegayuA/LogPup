import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { TriangleAlert } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DbClearButton } from '@/features/admin/components/db-clear-button'
import { DangerAppResetCard } from '@/features/admin/components/danger-app-reset-card'
import { DangerBackupCard } from '@/features/admin/components/danger-backup-card'
import { DangerMeetingDeleteCard } from '@/features/admin/components/danger-meeting-delete-card'
import { DangerRecordingsCard } from '@/features/admin/components/danger-recordings-card'
import { DangerTrashEmptyCard } from '@/features/admin/components/danger-trash-empty-card'
import { loadDangerTargets } from '@/features/admin/danger-actions'
import { loadActor } from '@/features/auth/actor'
import { can, type Action, type Actor } from '@/features/auth/capabilities'

/**
 * Superadmin territory, and on its own route on purpose.
 *
 * Structural separation, not just a red heading: an irreversible control that
 * shares a scroll with everyday tools is one mis-click from a workspace with
 * no data. Reaching this needs a deliberate navigation.
 *
 * ORDERED BY BLAST RADIUS, most recoverable first. The export destroys
 * nothing and is the thing you run before anything else here; the meeting
 * delete lands in Trash; everything below the divider ends in rows no restore
 * brings back, narrowest first. Someone scrolling past a control has read a
 * strictly milder one already, which is the opposite of meeting the widest
 * delete at the top of the page.
 */

/** Any one of these makes the page worth rendering for this actor. */
const DANGER_PAGE_ACTIONS: readonly Action[] = [
  'danger.backup.export',
  'meeting.delete',
  'danger.app.reset',
  'danger.recordings.wipe',
  'danger.trash.empty',
  'danger.dbclear',
]

export default async function AdminDangerPage() {
  const actor = await loadActor()
  if (!actor || !DANGER_PAGE_ACTIONS.some((action) => can(actor, action))) notFound()

  const dbClearEnabled = process.env.ENABLE_DB_CLEAR === '1'

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        {/* h2, not h1 — the admin layout already renders the page's h1
            ("Admin"), and this section used to add a second one. */}
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
          <TriangleAlert aria-hidden className="size-4 text-destructive" />
          Danger zone
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Each control below says what it destroys and what it leaves standing, and asks
          you to type something only the thing in front of you can tell you. They are
          ordered by how much they take: recoverable first, unrecoverable last.
        </p>
      </header>

      {/* The reads behind these controls are a dozen queries; streaming them
          keeps the heading and the ordering readable while they land. */}
      <Suspense fallback={<DangerSkeleton />}>
        <DangerControls actor={actor} />
      </Suspense>

      {can(actor, 'danger.dbclear') && (
        <section className="flex flex-col gap-3">
          <h3 className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
            Testing tooling
          </h3>
          <Card className="ring-destructive/30">
            <CardHeader>
              <CardTitle as="h4" className="flex items-center gap-2">
                <TriangleAlert aria-hidden className="size-4 text-destructive" />
                Clear database
              </CardTitle>
              <CardDescription>
                Permanently deletes all apps, assignments, sprints, tasks, meetings and
                work logs for the whole workspace. Users are kept. This cannot be undone,
                and it does not go to Trash.
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
                  <span className="font-mono text-xs text-foreground">ENABLE_DB_CLEAR=1</span>{' '}
                  to enable it (testing only).
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  )
}

async function DangerControls({ actor }: { actor: Actor }) {
  const res = await loadDangerTargets()
  if (!res.ok) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-muted-foreground">
        Could not read what these controls would act on ({res.error}). Nothing here is
        safe to run without those numbers — reload the page.
      </p>
    )
  }
  const targets = res.data

  const recoverable = [
    can(actor, 'danger.backup.export') ? <DangerBackupCard key="backup" /> : null,
    can(actor, 'meeting.delete') ? (
      <DangerMeetingDeleteCard key="meeting" meetings={targets.meetings} />
    ) : null,
  ].filter(Boolean)

  const permanent = [
    can(actor, 'danger.app.reset') ? (
      <DangerAppResetCard key="reset" apps={targets.apps} />
    ) : null,
    can(actor, 'danger.recordings.wipe') ? (
      <DangerRecordingsCard key="recordings" keyframeCount={targets.keyframeCount} />
    ) : null,
    can(actor, 'danger.trash.empty') ? (
      <DangerTrashEmptyCard key="trash" trashCount={targets.trashCount} />
    ) : null,
  ].filter(Boolean)

  return (
    <>
      {recoverable.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
            Recoverable
          </h3>
          {recoverable}
        </section>
      )}
      {permanent.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-2xs font-medium tracking-wide text-destructive uppercase">
            Cannot be undone
          </h3>
          {permanent}
        </section>
      )}
    </>
  )
}

/** Skeleton, not a spinner: the page's shape is known before its numbers are. */
function DangerSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <span className="sr-only" role="status">
        Loading the danger zone controls
      </span>
      {[0, 1, 2].map((i) => (
        <div key={i} aria-hidden className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <Skeleton className="h-4 w-40 max-w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-9 w-36 max-w-full rounded-lg" />
        </div>
      ))}
    </div>
  )
}
