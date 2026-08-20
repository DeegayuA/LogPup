import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadActor } from '@/features/auth/actor'
import { can, type Actor } from '@/features/auth/capabilities'
import { listActiveUsers } from '@/features/people/queries'
import { OPEN_BUG_STATUSES } from '@/features/bugs/bug-display'
import { parseBugFilters, type BugFilters } from '@/features/bugs/report-input'
import { BugList, BugListSkeleton } from '@/features/bugs/components/bug-list'
import { getOpenBugCounts, listTriageQueue, TRIAGE_QUEUE_LIMIT } from '@/features/bugs/queries'

/**
 * The workspace triage queue: every open bug on every live project, newest
 * first.
 *
 * The guard runs before anything is fetched, and it runs again here even
 * though the admin layout already asked `admin.view` — that is the cheap
 * outer gate, not the enforcement point, exactly as the layout's own comment
 * says. `notFound()` rather than a refusal page, for the same reason: someone
 * probing this route must not learn it exists.
 *
 * The queue itself streams behind a <Suspense> boundary so the heading and
 * the guard land immediately and the three queries do not hold the page. The
 * skeleton is the list's own, so the wait is shaped like what is coming.
 *
 * Filters live in the URL (`bugStatus` / `bugSeverity`, the same params the
 * app tab uses) and narrow IN MEMORY over the fetched page: the queue query
 * is capped at TRIAGE_QUEUE_LIMIT rows, so filtering what was fetched changes
 * nothing about which rows exist to filter — SQL-level narrowing only starts
 * mattering alongside pagination past the cap, and both need the same query
 * change.
 */
export default async function AdminBugsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [actor, search] = await Promise.all([loadActor(), props.searchParams])
  if (!actor || !can(actor, 'bug.view')) notFound()

  const filters = parseBugFilters({ bugStatus: search.bugStatus, bugSeverity: search.bugSeverity })

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-semibold">Bugs</h2>
        <p className="text-sm text-muted-foreground">
          Everything reported and not yet finished with, newest first — the order that
          answers &ldquo;what has come in&rdquo;. Severity is a triage decision, so an
          untriaged queue sorted by it would be sorted by the column default.
        </p>
      </div>
      <Suspense
        // Keyed on the filters so switching one re-suspends into the skeleton
        // instead of holding yesterday's rows under a chip that says otherwise.
        key={`${filters.status ?? 'all'}-${filters.severity ?? 'all'}`}
        fallback={<BugListSkeleton rows={4} />}
      >
        <TriageQueue actor={actor} filters={filters} />
      </Suspense>
    </section>
  )
}

/**
 * The queue's URL with one filter changed. `bugFilterHref` in report-input.ts
 * writes the app tab's address; this writes the admin one — same params, so a
 * link that narrows either surface reads the same way.
 */
function queueFilterHref(
  current: BugFilters,
  patch: { status?: BugFilters['status']; severity?: BugFilters['severity'] },
): string {
  const params = new URLSearchParams()
  const next = { ...current, ...patch }
  if (next.status) params.set('bugStatus', next.status)
  if (next.severity) params.set('bugSeverity', next.severity)
  const query = params.toString()
  return query ? `/admin/bugs?${query}` : '/admin/bugs'
}

async function TriageQueue({ actor, filters }: { actor: Actor; filters: BugFilters }) {
  let bugs: Awaited<ReturnType<typeof listTriageQueue>> = []
  let counts: Awaited<ReturnType<typeof getOpenBugCounts>> = []
  let assignableUsers: { id: string; name: string }[] = []
  let error: string | null = null

  try {
    ;[bugs, counts, assignableUsers] = await Promise.all([
      listTriageQueue(),
      getOpenBugCounts(),
      // Only fetched because the triage controls need somewhere to assign to.
      // A viewer who can triage nothing here still pays for it — one ordered
      // read of the roster the rest of the admin area already makes.
      listActiveUsers(),
    ])
  } catch (cause) {
    console.error('[bugs] triage queue failed', cause)
    error = 'The queue could not be read. Refresh, and if it keeps happening tell an admin.'
  }

  const total = counts.reduce((sum, row) => sum + row.open, 0)

  // Narrowed over the fetched page — see the page comment for why this is in
  // memory rather than in SQL for now.
  const visible = bugs.filter(
    (bug) =>
      (!filters.status || bug.status === filters.status) &&
      (!filters.severity || bug.severity === filters.severity),
  )
  const filtered = Boolean(filters.status || filters.severity)

  return (
    <div className="flex flex-col gap-4">
      {!error && counts.length > 0 ? (
        // The breakdown is its own grouped count rather than a tally of the
        // rows below, because the list is capped: deriving it from what is
        // rendered would print a total that quietly stops being the total at
        // row one hundred and one.
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
          <p className="text-sm">
            {/* Mono/tabular like the per-project counts below — one treatment
                for the same kind of number in the same card. */}
            <span className="font-mono font-medium tabular-nums">{total}</span> open across{' '}
            <span className="font-mono font-medium tabular-nums">{counts.length}</span>{' '}
            {counts.length === 1 ? 'project' : 'projects'}
            {bugs.length >= TRIAGE_QUEUE_LIMIT ? `, showing the newest ${TRIAGE_QUEUE_LIMIT}` : ''}.
          </p>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-2xs text-muted-foreground">
            {counts.map((row) => (
              <li key={row.appId}>
                <Link
                  href={`/apps/${row.appSlug}?tab=bugs`}
                  className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {row.appName}{' '}
                  <span className="font-mono tabular-nums text-foreground">{row.open}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <BugList
        bugs={visible}
        error={error}
        filters={filters}
        filterHrefFor={(patch) => queueFilterHref(filters, patch)}
        // The queue only ever holds open rows, so only the open statuses get
        // chips — a Resolved chip here would be a filter that always answers
        // with nothing.
        statusChoices={OPEN_BUG_STATUSES}
        emptyHint={
          filtered
            ? 'No open bug in the newest page of the queue matches that filter. Clear it to see the rest.'
            : 'Nothing is open across the whole workspace. Either it is a good week or nobody is filing — the Bugs tab on any project is where reports start.'
        }
        showApp
        assignableUsers={assignableUsers}
        // Both scoped: a manager triages and deletes on the projects they run
        // and reads the rest. Asked per row rather than once for the list,
        // because the queue spans projects by definition.
        canTriage={(bug) => can(actor, 'bug.triage', { appId: bug.appId ?? null })}
        canDelete={(bug) => can(actor, 'bug.delete', { appId: bug.appId ?? null })}
      />
    </div>
  )
}
