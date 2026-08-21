import { Suspense } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { listApps } from '@/features/apps/queries'
import { listActiveUsers } from '@/features/people/queries'
import { getMeetingLoadSuggestions } from '@/features/meetings/load-actions'
import { LoadBoard } from '@/features/meetings/components/load-board'

export const metadata = { title: 'Meeting load' }

/**
 * The suggestion queue for the meeting-load engine.
 *
 * ONE ROUTE FOR ALL SIX RULES, not one per rule. R6 COVER-TOGETHER is the only
 * card on it today because it is the only rule that needs no recording
 * pipeline — it reads open follow-ups and committed deadlines, rows that exist
 * on every workspace whether or not anybody has ever recorded a meeting. R1-R5
 * arrive here later with no new plumbing.
 *
 * SUSPENSE-SPLIT so the controls render before the data: the header and its
 * definition sentence are static and have nothing to wait for, while the sweep
 * behind the board is a batch of aggregate reads. Drawing the header first
 * means the page does not rearrange itself when they land.
 */
export default function MeetingLoadPage() {
  return (
    <div className="relative flex flex-1 flex-col gap-6 p-6 md:p-8">
      <div
        className="pointer-events-none absolute -top-40 right-1/4 -z-10 h-[450px] w-[600px] rounded-full bg-primary/8 blur-3xl"
        aria-hidden
      />

      <PageHeader
        title="Meeting load"
        description="Open items that need the same people, and could be one conversation instead of several. Every card is a question — accepting one opens the meeting form, it never invites anybody."
        actions={
          <Button variant="outline" render={<Link href="/meetings" />}>
            Back to meetings
          </Button>
        }
      />

      <Suspense fallback={<BoardSkeleton />}>
        <Board />
      </Suspense>
    </div>
  )
}

async function Board() {
  const [result, apps, activeUsers] = await Promise.all([
    getMeetingLoadSuggestions(),
    listApps(),
    listActiveUsers(),
  ])

  // Not a thrown error: "you may not read this" is an answer, and a page that
  // crashed would say the same thing far less clearly.
  if (!result.ok) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-border/80 bg-card/40 p-6">
        <p className="inline-flex items-center gap-2 font-medium">
          <TriangleAlert aria-hidden className="size-4 text-muted-foreground" />
          {result.error}
        </p>
        <p className="text-sm text-muted-foreground">
          These cards lay out named people’s open work across every project at once, so they
          are for whoever runs a project.
        </p>
      </div>
    )
  }

  return (
    <LoadBoard
      suggestions={result.data.suggestions}
      apps={apps.map((app) => ({ id: app.id, name: app.name }))}
      activeUsers={activeUsers}
      dismissedCount={result.data.dismissedCount}
    />
  )
}

function BoardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      {[0, 1].map((card) => (
        <div key={card} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-80" />
              <Skeleton className="h-3.5 w-64" />
            </div>
            <Skeleton className="h-8 w-32" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-4 w-2/3" />
            ))}
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4].map((chip) => (
              <Skeleton key={chip} className="h-5 w-20 rounded-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
