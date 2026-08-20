import Link from 'next/link'
import { formatDistanceToNowStrict } from 'date-fns'
import { TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  BUG_STATUSES,
  SEVERITIES_WORST_FIRST,
  bugSeverityBadgeVariant,
  bugSeverityLabel,
  bugStatusBadgeVariant,
  bugStatusLabel,
  type BugSeverity,
  type BugStatus,
} from '@/features/bugs/bug-display'
import type { BugFilters } from '@/features/bugs/report-input'
import type { BugQueueRow, BugRow } from '@/features/bugs/queries'
import { BugTriageControls } from '@/features/bugs/components/bug-triage-controls'
import { DeleteBugButton } from '@/features/bugs/components/delete-bug-button'

/**
 * The body of the Bugs tab, and of the admin triage queue — one component, so
 * the two surfaces cannot drift into disagreeing about what a bug looks like.
 *
 * A SERVER component. Everything interactive on a row (the three triage
 * selects, the delete confirm) is its own client island, so reading a hundred
 * bug reports costs the browser nothing but the rows it can act on.
 *
 * `canTriage` and `canDelete` are PREDICATES rather than booleans because the
 * queue spans projects and both capabilities are scoped: a manager triages the
 * bugs on the projects they run and reads the rest. Handing the component one
 * flag for the whole list would either hide controls they hold or offer
 * controls the server will refuse.
 *
 * All three states are here — empty, loading (the skeleton below), error —
 * because a list that only knows how to render rows makes each caller invent
 * the other two, and they invent them differently.
 */

/**
 * A row from either surface. The project fields are optional because the
 * app's own tab already knows which project it is looking at and does not pay
 * to join it back onto every row.
 */
type BugListRow = BugRow & Partial<Pick<BugQueueRow, 'appId' | 'appName' | 'appSlug'>>

export function BugList({
  bugs,
  error = null,
  emptyHint,
  filters,
  filterHrefFor,
  canTriage,
  canDelete,
  assignableUsers = [],
  showApp = false,
}: {
  bugs: readonly BugListRow[]
  /** Set when the query itself failed. Rows and error are mutually exclusive. */
  error?: string | null
  emptyHint: string
  /** Omit both of these to render without a filter row (the triage queue). */
  filters?: BugFilters
  filterHrefFor?: (patch: { status?: BugStatus; severity?: BugSeverity }) => string
  canTriage?: (bug: BugListRow) => boolean
  canDelete?: (bug: BugListRow) => boolean
  assignableUsers?: readonly { id: string; name: string }[]
  /** Print the project on each row. On by default nowhere: the app's own tab
   *  already knows which project it is. */
  showApp?: boolean
}) {
  if (error) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
      >
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">Could not load the bugs</p>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {filters && filterHrefFor ? (
        <BugFilterBar filters={filters} hrefFor={filterHrefFor} />
      ) : null}

      {bugs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <p className="font-heading text-base font-semibold">Nothing broken here</p>
          <p className="max-w-sm text-sm text-muted-foreground">{emptyHint}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {bugs.map((bug) => (
            <li key={bug.id}>
              <article className="flex flex-col gap-2 rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-heading text-sm font-semibold">{bug.title}</h3>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <Badge variant={bugSeverityBadgeVariant(bug.severity)}>
                      {bugSeverityLabel(bug.severity)}
                    </Badge>
                    <Badge variant={bugStatusBadgeVariant(bug.status)}>
                      {bugStatusLabel(bug.status)}
                    </Badge>
                  </div>
                </div>

                <p className="text-sm break-words whitespace-pre-wrap text-muted-foreground">
                  {bug.description}
                </p>

                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted-foreground">
                  {showApp && bug.appName && bug.appSlug ? (
                    <>
                      <Link
                        href={`/apps/${bug.appSlug}?tab=bugs`}
                        className="rounded-sm font-medium text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {bug.appName}
                      </Link>
                      <span aria-hidden>·</span>
                    </>
                  ) : null}
                  <span>{bug.reportedByName ?? 'Someone no longer here'}</span>
                  <span aria-hidden>·</span>
                  <time dateTime={bug.createdAt.toISOString()}>
                    {formatDistanceToNowStrict(bug.createdAt, { addSuffix: true })}
                  </time>
                  {bug.pagePath ? (
                    <>
                      <span aria-hidden>·</span>
                      {/* The route the reporter was on, captured for them. A
                          link, because the first thing a triager does is go
                          stand where the reporter was standing. */}
                      <Link
                        href={bug.pagePath}
                        className="rounded-sm font-mono break-all underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {bug.pagePath}
                      </Link>
                    </>
                  ) : null}
                  {bug.assignedToName ? (
                    <>
                      <span aria-hidden>·</span>
                      <span>with {bug.assignedToName}</span>
                    </>
                  ) : null}
                </p>

                {canTriage?.(bug) || canDelete?.(bug) ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                    {canTriage?.(bug) ? (
                      <BugTriageControls
                        bugId={bug.id}
                        status={bug.status}
                        severity={bug.severity}
                        assignedToId={bug.assignedToId}
                        assignableUsers={assignableUsers}
                      />
                    ) : (
                      <span />
                    )}
                    {canDelete?.(bug) ? <DeleteBugButton bugId={bug.id} title={bug.title} /> : null}
                  </div>
                ) : null}
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Status and severity, as links.
 *
 * Links rather than a client filter for the reason tabs.ts gives about the
 * sections themselves: the server renders exactly one narrowed list, the URL
 * is shareable, the back button works, and there is no second copy of "which
 * filter is on". `aria-current="page"` is the right announcement for the one
 * you are looking at.
 */
function BugFilterBar({
  filters,
  hrefFor,
}: {
  filters: BugFilters
  hrefFor: (patch: { status?: BugStatus; severity?: BugSeverity }) => string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FilterRow label="Status">
        <FilterChip href={hrefFor({ status: undefined })} active={!filters.status}>
          All
        </FilterChip>
        {BUG_STATUSES.map((status) => (
          <FilterChip
            key={status}
            href={hrefFor({ status })}
            active={filters.status === status}
          >
            {bugStatusLabel(status)}
          </FilterChip>
        ))}
      </FilterRow>
      <FilterRow label="Severity">
        <FilterChip href={hrefFor({ severity: undefined })} active={!filters.severity}>
          All
        </FilterChip>
        {SEVERITIES_WORST_FIRST.map((severity) => (
          <FilterChip
            key={severity}
            href={hrefFor({ severity })}
            active={filters.severity === severity}
          >
            {bugSeverityLabel(severity)}
          </FilterChip>
        ))}
      </FilterRow>
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // Scrolls rather than wraps, for the same reason AppTabNav does: at 375px
    // six chips wrap to three rows and stop reading as one control.
    <nav aria-label={`Filter by ${label.toLowerCase()}`} className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-2xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1 overflow-x-auto">{children}</div>
    </nav>
  )
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'shrink-0 rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap outline-none',
        'transition-colors duration-150 motion-reduce:transition-none',
        'focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-transparent bg-secondary font-medium text-secondary-foreground'
          : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}

const shimmer = 'animate-pulse rounded-md bg-muted motion-reduce:animate-none'

/**
 * Shaped like what is coming: a filter row, then cards with a title, two
 * badges, a couple of lines of report and a meta line. A spinner would say
 * "wait"; this says "a list of bugs is arriving", which is the difference the
 * repo's states rule is after.
 */
export function BugListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="sr-only" role="status">
        Loading bugs
      </span>
      <div className="flex items-center gap-1">
        <div className={`${shimmer} h-5 w-14`} />
        <div className={`${shimmer} h-5 w-16`} />
        <div className={`${shimmer} h-5 w-20`} />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <div className={`${shimmer} h-4 w-56 max-w-full`} />
              <div className="flex shrink-0 gap-1.5">
                <div className={`${shimmer} h-5 w-16 rounded-4xl`} />
                <div className={`${shimmer} h-5 w-14 rounded-4xl`} />
              </div>
            </div>
            <div className={`${shimmer} h-3.5 w-full`} />
            <div className={`${shimmer} h-3.5 w-3/5`} />
            <div className={`${shimmer} h-3 w-40`} />
          </div>
        ))}
      </div>
    </div>
  )
}
