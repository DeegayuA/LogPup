import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatTile } from '@/components/ui/stat-tile'
import { AiAdoptionCard } from '@/features/admin/components/ai-adoption-card'
import { listAllUsers, listPendingUsers } from '@/features/admin/queries'
import { getTrash } from '@/features/admin/trash-queries'
import { listPendingAbsences } from '@/features/worklog/absence-queries'
import { loadActor } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'
import { MeetingLoadAdminCard } from '@/features/meeting-load/components/meeting-load-admin-card'
import {
  getAcceptanceByKind, getAllSuggestionsForAdmin, getDismissedDecisions,
  getObservedChangesForAdmin,
} from '@/features/meeting-load/admin-queries'

/**
 * Org health at a glance, and what is waiting on somebody.
 *
 * Every tile links to the section that acts on it — a count you cannot act on
 * is a decoration. Nothing here renders a bare percentage: coverage figures
 * come from CoverageFigure, which cannot produce one.
 */
export default async function AdminOverviewPage() {
  const actor = await loadActor()
  if (!actor || !can(actor, 'admin.view')) notFound()

  const [pendingUsers, allUsers, pendingAbsences, trashGroups] = await Promise.all([
    can(actor, 'user.approve') ? listPendingUsers() : Promise.resolve([]),
    can(actor, 'user.view.detail') ? listAllUsers() : Promise.resolve([]),
    listPendingAbsences(actor),
    can(actor, 'trash.view') ? getTrash() : Promise.resolve([]),
  ])

  const activeUserCount = allUsers.filter((u) => u.active).length
  const waiting = pendingUsers.length + pendingAbsences.length
  const trashCount = trashGroups.reduce((sum, g) => sum + g.totalCount, 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Waiting on someone"
          value={waiting}
          href="/admin/approvals"
          tone={waiting > 0 ? 'attention' : 'default'}
          meta={`${pendingUsers.length} signups · ${pendingAbsences.length} leave`}
        />
        <StatTile
          label="Active people"
          value={activeUserCount}
          href="/admin/people"
          meta={`of ${allUsers.length} approved`}
        />
        <StatTile label="In the trash" value={trashCount} href="/admin/trash" meta="restorable" />
      </div>

      {waiting === 0 && (
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="text-base">
              Nothing is waiting on you
            </CardTitle>
            <CardDescription>
              Signups, leave requests and change requests all land in Approvals. When one
              arrives it shows up here with its age.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Its own boundary: the adoption card aggregates 30 days of activity —
          the slowest read on the page — and used to gate the first paint of
          the stat tiles above it, the fastest content here. */}
      <Suspense fallback={<AdoptionSkeleton />}>
        <AiAdoptionCard activeUserCount={activeUserCount} />
      </Suspense>

      {/* Behind the same notFound() gate as everything else on this page. This
          is the ONE place trim-invite may render with names — every other
          surface is built on reads that cannot supply them. */}
      <Suspense fallback={<AdoptionSkeleton />}>
        <MeetingLoad />
      </Suspense>
    </div>
  )
}

async function MeetingLoad() {
  const now = new Date()
  const [suggestions, dismissed, observed, acceptance] = await Promise.all([
    getAllSuggestionsForAdmin(now),
    getDismissedDecisions(),
    getObservedChangesForAdmin(now),
    getAcceptanceByKind(),
  ])
  return (
    <MeetingLoadAdminCard
      suggestions={suggestions}
      dismissed={dismissed}
      observed={observed}
      acceptance={acceptance}
    />
  )
}

/** Shaped like the adoption card: title row, description, a table of rows. */
function AdoptionSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <span className="sr-only" role="status">
        Loading AI feature adoption…
      </span>
      <div aria-hidden className="flex flex-col gap-2">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div aria-hidden className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="ml-auto h-5 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
