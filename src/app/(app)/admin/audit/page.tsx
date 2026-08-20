import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  auditQueryString,
  hasAuditFilters,
  parseAuditParams,
  type AuditParamState,
  type RawSearchParams,
} from '@/features/admin/audit-filters'
import { countAuditTrail, listAuditFacets, listAuditTrail } from '@/features/admin/audit-queries'
import { AuditFilterBar } from '@/features/admin/components/audit-filter-bar'
import {
  AuditControlsSkeleton,
  AuditTrailSkeleton,
} from '@/features/admin/components/audit-skeleton'
import { AuditTrail } from '@/features/admin/components/audit-trail'
import { loadActor } from '@/features/auth/actor'
import { can, type Actor } from '@/features/auth/capabilities'

/**
 * The compliance read of activity_log: unfiltered by default, trashed rows
 * included, self-approvals visible and isolatable. Distinct from /activity,
 * which is the shared feed every signed-in person sees.
 *
 * Redesigned 2026-08-20 from a bare 100-row list into an instrument:
 *
 *   1. Search, actor/type/verb/date filters and sort, all in the URL
 *      (audit-filters.ts) — so a filtered view is a link a reviewer can paste
 *      into a finding, and a refresh does not lose the question.
 *   2. Narrowing happens in SQL over the whole table, never by filtering a
 *      page in JS. Paging is bounded and the bound is always stated.
 *   3. The rows are day-grouped and each one opens onto the record behind it
 *      (ids, exact instant, metadata payload) — the evidence, not a summary
 *      of it.
 *
 * THREE independent waits, not one. The header is instant; the controls stream
 * behind two cheap selectDistinct queries; the trail streams behind its own
 * paged read. Sharing one boundary is what makes a filter change blank the
 * control you just used.
 */
export default async function AdminAuditPage(props: {
  searchParams: Promise<RawSearchParams>
}) {
  const actor = await loadActor()
  // The section's own guard, on top of the admin layout's. `audit.view` is
  // 'all' for superadmin, admin and auditor and 'scoped' for a manager — and a
  // scoped grant asked without a resource fails closed, which is the intended
  // answer: there is no per-app slice of an audit that is still an audit.
  if (!actor || !can(actor, 'audit.view')) notFound()

  const state = parseAuditParams(await props.searchParams)

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Audit trail</CardTitle>
        <CardDescription>
          Every recorded change, with who made it and when. Self-approvals are marked — a
          request signed by the person who filed it is legitimate for a superadmin and
          worth finding in a review.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Suspense fallback={<AuditControlsSkeleton />}>
          <AuditControls actor={actor} state={state} />
        </Suspense>

        {/* Keyed by the whole question, so changing a filter re-suspends into
            the skeleton instead of leaving the previous answer on screen under
            a new filter bar — on an audit surface, rows that do not match the
            controls above them are worse than a wait. */}
        <Suspense key={`trail-${auditQueryString(state)}`} fallback={<AuditTrailSkeleton />}>
          <AuditTrailSection actor={actor} state={state} />
        </Suspense>
      </CardContent>
    </Card>
  )
}

/**
 * The filter bar and its option lists.
 *
 * The lists come from the TRAIL, not from the live roster: a deactivated
 * teammate still owns rows here and is exactly who a review reaches for the
 * filter to find. See listAuditFacets.
 */
async function AuditControls({ actor, state }: { actor: Actor; state: AuditParamState }) {
  const facets = await listAuditFacets(actor)
  return <AuditFilterBar facets={facets} current={state} />
}

async function AuditTrailSection({ actor, state }: { actor: Actor; state: AuditParamState }) {
  const result = await listAuditTrail(actor, state)

  // Asked ONLY when the filters matched NOTHING AT ALL — not merely when this
  // page is empty, which also happens on a stale `?page=` and is its own,
  // differently-worded state. "Nothing recorded yet" and "nothing matches
  // these filters" are different facts, and only the second deserves a
  // clear-filters button. The common path never pays for this query.
  const unfilteredTotal =
    result.total === 0 && hasAuditFilters(state) ? await countAuditTrail(actor) : null

  return (
    <AuditTrail result={result} state={state} now={new Date()} unfilteredTotal={unfilteredTotal} />
  )
}
