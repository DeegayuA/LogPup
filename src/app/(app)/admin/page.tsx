import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { StatTile } from '@/components/ui/stat-tile'
import { ADMIN_SECTION_ICONS } from '@/components/shell/nav-items'
import { AiAdoptionCard } from '@/features/admin/components/ai-adoption-card'
import { listAllUsers } from '@/features/admin/queries'
import { getTrash } from '@/features/admin/trash-queries'
import { visibleSections } from '@/features/admin/sections'
import { countPendingApprovals } from '@/features/admin/approval-queries'
import { approvalTotal } from '@/features/admin/approval-badge'
import { loadActor } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'
import { MeetingLoadAdminCard } from '@/features/meeting-load/components/meeting-load-admin-card'
import {
  getAcceptanceByKind, getAllSuggestionsForAdmin, getDismissedDecisions,
  getObservedChangesForAdmin,
} from '@/features/meeting-load/admin-queries'
import { cn } from '@/lib/utils'

/**
 * The admin area's front door: what needs a decision, then where everything is.
 *
 * REDESIGNED WHEN THE SECOND SIDEBAR WENT AWAY. The sections used to be listed
 * in a nav beside this page, so Overview could be three counters and two
 * cards. With that nav folded into the main sidebar's Manage block, the
 * DESKTOP sidebar carries the list — but a page called Overview that no longer
 * describes what the area contains is a worse front door than it was, and the
 * descriptions on ADMIN_SECTIONS existed with nowhere to render them.
 *
 * So the page is now two things in order:
 *
 *   1. WHAT IS WAITING. One line, at the top, sized to the decision. Nothing
 *      here is inventory — a count somebody cannot act on is a decoration, and
 *      "people: 24" has never once changed what an admin did next.
 *   2. WHERE EVERYTHING IS. Every section this seat may open, with the
 *      sentence that says what it is for. Capability-filtered by the same
 *      visibleSections() the sidebar and the route guards use, so the three
 *      cannot disagree about who sees what.
 *
 * The slower aggregate cards keep their own boundaries below.
 */
export default async function AdminOverviewPage() {
  const actor = await loadActor()
  if (!actor || !can(actor, 'admin.view')) notFound()

  const [allUsers, trashGroups, approvals] = await Promise.all([
    can(actor, 'user.view.detail') ? listAllUsers() : Promise.resolve([]),
    can(actor, 'trash.view') ? getTrash() : Promise.resolve([]),
    // The same three gated reads the sidebar badge counts, deduped by cache()
    // within this render — so the number here and the number in the sidebar
    // are the same number, not two answers to the same question.
    countPendingApprovals(actor),
  ])

  const activeUserCount = allUsers.filter((u) => u.active).length
  const waiting = approvalTotal(approvals)
  const trashCount = trashGroups.reduce((sum, group) => sum + group.totalCount, 0)

  // Overview is where the reader already is; listing it as a destination is a
  // link to this page from this page.
  const sections = visibleSections(actor).filter((section) => section.href !== '/admin')

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3" aria-label="Waiting on a decision">
        {waiting > 0 ? (
          <Link
            href="/admin/approvals"
            className="group flex items-center gap-4 rounded-2xl border border-chart-1/30 bg-chart-1/5 p-5 outline-none transition-[background-color,border-color] duration-150 hover:bg-chart-1/10 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
          >
            <span className="font-mono text-3xl font-bold tabular-nums text-foreground">
              {waiting}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold">
                {waiting === 1 ? 'One thing is' : 'Things are'} waiting on a decision
              </span>
              {/* The breakdown, so the number is accountable. Only the kinds
                  that are actually non-zero — a list of zeroes reads as noise
                  around the one figure that matters. */}
              <span className="truncate text-xs text-muted-foreground">
                {[
                  approvals.users > 0 &&
                    `${approvals.users} ${approvals.users === 1 ? 'signup' : 'signups'}`,
                  approvals.requests > 0 &&
                    `${approvals.requests} change ${approvals.requests === 1 ? 'request' : 'requests'}`,
                  approvals.absences > 0 &&
                    `${approvals.absences} leave ${approvals.absences === 1 ? 'request' : 'requests'}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <ArrowRight
              aria-hidden
              className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
            />
          </Link>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-5">
            <p className="text-sm font-medium">Nothing is waiting on you.</p>
            <p className="text-xs text-muted-foreground">
              Signups, leave and change requests all land in Approvals. When one arrives it shows
              up here, and beside Approvals in the sidebar.
            </p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-label="Admin sections">
        <h2 className="font-mono text-2xs font-bold tracking-widest text-muted-foreground uppercase">
          Everything you can manage
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => {
            const Icon = ADMIN_SECTION_ICONS[section.href]
            const count = section.href === '/admin/approvals' ? waiting : null
            return (
              <li key={section.href}>
                <Link
                  href={section.href}
                  className={cn(
                    'group flex h-full flex-col gap-1 rounded-2xl border p-4 outline-none transition-[background-color,border-color] duration-150 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                    section.danger
                      ? // Never hue alone: it also carries the word
                        // "Irreversible" in its own description, and the
                        // destructive tone on the title.
                        'border-destructive/30 bg-destructive/5 hover:bg-destructive/10'
                      : 'border-border/70 bg-card/60 hover:border-border hover:bg-card',
                  )}
                >
                  <span className="flex items-center gap-2">
                    {Icon ? (
                      <Icon
                        className={cn(
                          'size-4 shrink-0',
                          section.danger ? 'text-destructive' : 'text-muted-foreground',
                        )}
                      />
                    ) : null}
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        section.danger && 'text-destructive',
                      )}
                    >
                      {section.label}
                    </span>
                    {count !== null && count > 0 ? (
                      <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 font-mono text-2xs font-semibold tabular-nums text-primary-foreground">
                        {count}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">{section.description}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Inventory, deliberately BELOW the two sections above and smaller than
          it used to be. These are facts about the workspace rather than things
          asking for a decision, and putting them first is what made the old
          page read as a dashboard nobody acted on. */}
      <section className="flex flex-col gap-3" aria-label="Workspace at a glance">
        <h2 className="font-mono text-2xs font-bold tracking-widest text-muted-foreground uppercase">
          At a glance
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatTile
            label="Active people"
            value={activeUserCount}
            href="/admin/people"
            meta={`of ${allUsers.length} approved`}
          />
          <StatTile label="In the trash" value={trashCount} href="/admin/trash" meta="restorable" />
        </div>
      </section>

      {/* Its own boundary: the adoption card aggregates 30 days of activity —
          the slowest read on the page — and used to gate the first paint of
          everything above it. */}
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
