import type { ReactNode } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowDown, ArrowUp, ChevronRight, FileSearch, Info, PawPrint } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { activityPhraseParts } from '@/features/activity/format'
import {
  AUDIT_SORT_KEYS,
  AUDIT_SORT_LABELS,
  auditDepthNotice,
  auditEmptyKind,
  auditHref,
  auditPageCount,
  auditRangeLabel,
  auditSortHref,
  clearAuditFiltersHref,
  groupAuditByDay,
  hasAuditFilters,
  shouldGroupAuditByDay,
  type AuditParamState,
  type AuditSortKey,
} from '@/features/admin/audit-filters'
import type { AuditEntry, AuditPage } from '@/features/admin/audit-queries'
import { formatBusinessDayMonth, formatBusinessTime } from '@/features/people/format-instant'

/**
 * The audit trail's reading surface.
 *
 * Server-rendered end to end. Every affordance here is a link or a native
 * `<details>` — a log line never changes after the fact, and the filter state
 * lives in the URL, so there is nothing on this surface worth shipping
 * JavaScript for. (The filter BAR is a client component; it is the only part
 * that has to hold a draft while you type.)
 *
 * WHY THIS IS NOT A <table>. Sortable columns imply one, and a table is what
 * this was reaching for — but an audit row's payload is a sentence plus a JSON
 * blob, and columns force both into ellipses at exactly the width most people
 * read it at. The sort controls are therefore an explicit header strip and the
 * rows are a day-grouped list, which stays legible at 375px with no horizontal
 * page scroll and no second mobile layout to keep in sync. Sorting is still
 * URL state, still keyboard reachable, still three whitelisted keys.
 */

/** Focus ring shared by every link here, matching the UI primitives. */
const FOCUS = 'rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

/**
 * A one-click filter built from a row's own words. Hover is DOTTED, the same
 * distinction /activity draws: this link narrows the page you are on, while a
 * subject link leaves it, and the reader should be able to tell before the
 * click. Never colour alone.
 */
function FilterLink({
  href,
  label,
  className,
  children,
}: {
  href: string
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`${FOCUS} underline-offset-2 hover:underline hover:decoration-dotted ${className ?? ''}`}
    >
      {children}
    </Link>
  )
}

/**
 * The sort strip. Three links, one per whitelisted key; pressing the active
 * one flips its direction, pressing another adopts that key's natural default
 * (see nextAuditDir).
 *
 * `aria-current` marks the active key and the accessible name spells out the
 * direction the link would produce, so the control announces what it DOES
 * rather than what it is named — the arrow alone is meaningless to a screen
 * reader and, on its own, is information carried by shape.
 */
function SortStrip({ state }: { state: AuditParamState }) {
  return (
    <div role="group" aria-label="Sort the audit trail" className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-xs text-muted-foreground">Sort</span>
      {AUDIT_SORT_KEYS.map((key: AuditSortKey) => {
        const active = state.sort === key
        const ascending = active && state.dir === 'asc'
        return (
          <Link
            key={key}
            href={auditSortHref(state, key)}
            aria-current={active ? 'true' : undefined}
            aria-label={
              active
                ? `Sorted by ${AUDIT_SORT_LABELS[key]}, ${ascending ? 'ascending' : 'descending'}. Activate to reverse.`
                : `Sort by ${AUDIT_SORT_LABELS[key]}`
            }
            className={`${FOCUS} inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors duration-150 ease-out motion-reduce:transition-none ${
              active
                ? 'border-border bg-muted font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {AUDIT_SORT_LABELS[key]}
            {active ? (
              ascending ? (
                <ArrowUp aria-hidden className="size-3" />
              ) : (
                <ArrowDown aria-hidden className="size-3" />
              )
            ) : null}
          </Link>
        )
      })}
    </div>
  )
}

/**
 * The app, as a filter — padding-based rather than the fixed-height `Badge`
 * primitive, because app names are user text and this UI is bilingual: Sinhala
 * renders taller than Latin and `Badge`'s `h-5 overflow-hidden` clips it.
 *
 * There is no app filter in this surface's param set (an audit is read across
 * the whole workspace, and the app column is null on most rows), so the chip
 * puts the name into the SEARCH instead — which is the filter that actually
 * covers both the live and the denormalised name.
 */
function AppChip({ row, state }: { row: AuditEntry; state: AuditParamState }) {
  if (!row.appName) return null
  // A change to the app ITSELF already names it as the subject; the chip would
  // print the same string twice in a row.
  if (row.appName === row.entityLabel) return null
  return (
    <FilterLink
      href={auditHref(state, { q: row.appName })}
      label={`Search the audit trail for ${row.appName}`}
      className="ml-1 inline-block rounded-md bg-muted px-1.5 py-px align-baseline text-2xs text-muted-foreground transition-colors duration-150 ease-out hover:bg-accent hover:text-accent-foreground motion-reduce:transition-none"
    >
      {row.appName}
    </FilterLink>
  )
}

/**
 * The mark this whole surface exists for: a request signed by the person who
 * filed it. Legitimate for a superadmin, and exactly what a review is looking
 * for — so it is a LINK that isolates every other one, not a decoration.
 *
 * Deliberately not the destructive surface (border-destructive/30 +
 * bg-destructive/5): that palette is reserved for things that destroy data,
 * and reading it here would tell a reviewer a legitimate signature is damage.
 */
function SelfApprovedChip({ state }: { state: AuditParamState }) {
  return (
    <FilterLink
      href={auditHref(state, { self: true })}
      label="Show only self-approved entries"
      className="ml-1 inline-flex items-baseline gap-1 rounded-md border border-border px-1.5 py-px align-baseline text-2xs text-muted-foreground transition-colors duration-150 ease-out hover:bg-accent hover:text-accent-foreground motion-reduce:transition-none"
    >
      self-approved
    </FilterLink>
  )
}

/** The entity, linked to itself when the write recorded a destination. */
function Subject({ row }: { row: AuditEntry }) {
  const label = row.entityLabel ?? '(unnamed)'
  if (!row.pagePath) return <span className="font-medium">{label}</span>
  return (
    <Link href={row.pagePath} className={`${FOCUS} font-medium underline-offset-2 hover:underline`}>
      {label}
    </Link>
  )
}

/**
 * The row's identifiers and its raw payload, behind a native disclosure.
 *
 * ALWAYS present, even when metadata is null: on an audit surface the exact
 * instant and the entity id ARE the evidence, and a row that only sometimes
 * offers them makes the reader wonder what was withheld on the others. The
 * summary carries no interactive descendants — the filter links live in the
 * sentence above it, and nesting a link inside a summary means one click both
 * navigates and toggles.
 */
function RowDetails({ row }: { row: AuditEntry }) {
  const metadata = row.metadata && Object.keys(row.metadata).length > 0 ? row.metadata : null
  return (
    <details className="group mt-0.5">
      <summary
        className={`${FOCUS} inline-flex cursor-pointer list-none items-center gap-1 py-0.5 text-2xs text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden`}
      >
        <ChevronRight
          aria-hidden
          className="size-3 shrink-0 transition-transform duration-150 ease-out group-open:rotate-90 motion-reduce:transition-none"
        />
        {metadata ? 'Record and payload' : 'Record'}
      </summary>
      <dl className="mt-1 ml-1.5 flex flex-col gap-1 border-l border-border pt-1 pl-3 text-2xs">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">Recorded</dt>
          <dd className="font-mono tabular-nums">{row.createdAt.toISOString()}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">Entity</dt>
          <dd className="font-mono break-all">
            {row.entityType} · {row.entityId}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">Actor</dt>
          <dd className="font-mono break-all">{row.actorId}</dd>
        </div>
        {row.pagePath ? (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground">Page</dt>
            <dd className="font-mono break-all">{row.pagePath}</dd>
          </div>
        ) : null}
        {metadata ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Payload</dt>
            <dd>
              {/* pre-WRAP, not a scroller: a before/after payload is the thing
                  a reviewer reads most carefully, and a horizontally scrolling
                  box at 375px hides half of it behind a gesture. */}
              <pre className="rounded-md bg-muted/60 p-2 font-mono text-2xs break-words whitespace-pre-wrap">
                {JSON.stringify(metadata, null, 2)}
              </pre>
            </dd>
          </div>
        ) : null}
      </dl>
    </details>
  )
}

/**
 * "Alex Perera updated task Fix login to In progress" — read as a sentence,
 * with the actor and the entity-type word each a one-click filter and the
 * entity itself a link to the thing that changed. The word already carries the
 * meaning and already sits where the eye is, so it is linked rather than
 * repeated as a chip.
 */
function AuditRow({
  row,
  state,
  withDate,
}: {
  row: AuditEntry
  state: AuditParamState
  /**
   * Print the DAY next to the clock time. Only the grouped view has a day
   * header to inherit a date from; sorted by actor or entity there is none,
   * and position carries no date either.
   */
  withDate: boolean
}) {
  const { verb, entityType } = activityPhraseParts(row)
  return (
    <li className="relative py-2 pl-5">
      <span
        aria-hidden
        className="absolute top-4 left-0 size-2 -translate-x-1/2 rounded-full bg-muted-foreground/50 ring-2 ring-background"
      />
      <div className="flex flex-col gap-x-3 gap-y-0.5 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm/6">
            <FilterLink
              href={auditHref(state, { actor: row.actorId })}
              label={`Filter the audit trail by ${row.actorName}`}
              className="font-medium"
            >
              {row.actorName}
            </FilterLink>{' '}
            <FilterLink
              href={auditHref(state, { verb: row.verb })}
              label={`Filter the audit trail by ${row.verb}`}
              className="text-muted-foreground"
            >
              {verb}
            </FilterLink>{' '}
            {entityType ? (
              <>
                <FilterLink
                  href={auditHref(state, { type: row.entityType })}
                  label={`Filter the audit trail by ${row.entityType} changes`}
                  className="text-muted-foreground"
                >
                  {entityType}
                </FilterLink>{' '}
              </>
            ) : null}
            <Subject row={row} />
            {row.detail ? <span className="text-muted-foreground"> {row.detail}</span> : null}
            <AppChip row={row} state={state} />
            {row.selfApproved ? <SelfApprovedChip state={state} /> : null}
          </p>
          <RowDetails row={row} />
        </div>
        {/* formatBusiness*, NOT date-fns format: this renders on the server,
            where format() resolves in the server's zone (UTC on Vercel) while
            the day header above it is bucketed in Asia/Colombo — so a 3 AM
            Colombo entry would file under "Today" and print "9:30 PM". */}
        <time
          dateTime={row.createdAt.toISOString()}
          className="shrink-0 font-mono text-2xs whitespace-nowrap tabular-nums text-muted-foreground sm:min-w-28 sm:text-right"
        >
          {withDate
            ? `${formatBusinessDayMonth(row.createdAt)} · ${formatBusinessTime(row.createdAt)}`
            : formatBusinessTime(row.createdAt)}
        </time>
      </div>
    </li>
  )
}

/** The day marker, and a way to keep only that day. */
function DayMarker({
  dayIso,
  relativeLabel,
  count,
  state,
}: {
  dayIso: string
  relativeLabel: string
  count: number
  state: AuditParamState
}) {
  // Midday, not midnight: `new Date('…T00:00:00')` parses as LOCAL time, and a
  // local midnight is not a real instant on a spring-forward day. Only the
  // weekday name comes from it; the date itself is printed from the ISO string,
  // which is already the Asia/Colombo answer.
  const weekday = format(new Date(`${dayIso}T12:00:00`), 'EEEE')
  return (
    <h3 className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5">
      <Link
        href={auditHref(state, { from: dayIso, to: dayIso })}
        aria-label={`Filter the audit trail to ${weekday} ${dayIso} only`}
        className={`${FOCUS} inline-flex items-baseline gap-2 underline-offset-4 hover:underline hover:decoration-dotted`}
      >
        <span className="text-xs font-semibold tracking-wide uppercase">
          {relativeLabel || weekday}
        </span>
        <span className="font-mono text-2xs tabular-nums text-muted-foreground">{dayIso}</span>
      </Link>
      <span className="font-mono text-2xs tabular-nums text-muted-foreground">
        {count} {count === 1 ? 'entry' : 'entries'}
      </span>
    </h3>
  )
}

/**
 * The three empty states — see auditEmptyKind. They are different facts, so
 * they get different sentences and different actions: only the filtered one
 * offers a clear, and only the past-the-end one offers a way back, because
 * only those two are something the reader can undo.
 */
const EMPTY_COPY = {
  'no-data': {
    title: 'Nothing recorded yet.',
    body: 'From now on, every change anyone makes — apps, tasks, meetings, people, approvals — is recorded here with who, what and when.',
  },
  'no-match': {
    title: 'Nothing matches these filters.',
    body: 'No entry in the trail answers all of those at once. Widen the date range, or start over.',
  },
  'past-end': {
    title: 'This page is past the end.',
    body: 'The trail matches plenty — just not this far down it. The link you followed points beyond the last page.',
  },
} as const

function AuditEmpty({
  state,
  matchingTotal,
  unfilteredTotal,
}: {
  state: AuditParamState
  matchingTotal: number
  unfilteredTotal: number | null
}) {
  const kind = auditEmptyKind({
    anyFilter: hasAuditFilters(state),
    unfilteredTotal,
    matchingTotal,
    page: state.page,
  })
  const copy = EMPTY_COPY[kind]
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-12 text-center">
      {kind === 'no-data' ? (
        <PawPrint aria-hidden className="size-7 text-muted-foreground/60" />
      ) : (
        <FileSearch aria-hidden className="size-7 text-muted-foreground/60" />
      )}
      <p className="font-heading font-semibold">{copy.title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{copy.body}</p>
      {kind === 'no-match' ? (
        <Button variant="outline" size="sm" render={<Link href={clearAuditFiltersHref(state)} />}>
          Clear all filters
        </Button>
      ) : null}
      {kind === 'past-end' ? (
        <Button variant="outline" size="sm" render={<Link href={auditHref(state, { page: 1 })} />}>
          Back to the first page
        </Button>
      ) : null}
    </div>
  )
}

/**
 * Older/Newer, plus where the reader is. Both ends render even when
 * unavailable — as a disabled button rather than a vanished one, so the
 * control does not move under the pointer between pages.
 */
function Pager({ state, total, pageSize }: { state: AuditParamState; total: number; pageSize: number }) {
  const pages = auditPageCount(total, pageSize)
  if (pages <= 1) return null
  const hasPrev = state.page > 1
  const hasNext = state.page < pages

  return (
    <nav aria-label="Audit trail pages" className="flex items-center justify-between gap-3">
      {hasPrev ? (
        <Button variant="outline" size="sm" render={<Link href={auditHref(state, { page: state.page - 1 })} />}>
          Newer
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Newer
        </Button>
      )}
      <span className="font-mono text-2xs tabular-nums text-muted-foreground">
        Page {state.page} of {pages}
      </span>
      {hasNext ? (
        <Button variant="outline" size="sm" render={<Link href={auditHref(state, { page: state.page + 1 })} />}>
          Older
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Older
        </Button>
      )}
    </nav>
  )
}

export function AuditTrail({
  result,
  state,
  now,
  unfilteredTotal,
}: {
  result: AuditPage
  state: AuditParamState
  /** Passed in so server render and tests agree on what "today" means. */
  now: Date
  /** Only asked for when the page came back empty — see auditEmptyKind. */
  unfilteredTotal: number | null
}) {
  const grouped = shouldGroupAuditByDay(state.sort)
  const depthNotice = auditDepthNotice(result.total)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SortStrip state={state} />
        {/* The bound, always stated. A bounded read that does not say it is
            bounded is indistinguishable from a complete one. */}
        <p role="status" className="font-mono text-2xs tabular-nums text-muted-foreground">
          {auditRangeLabel({
            page: result.page,
            shown: result.rows.length,
            total: result.total,
            pageSize: result.pageSize,
          })}
        </p>
      </div>

      {depthNotice ? (
        <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Info aria-hidden className="mt-px size-3.5 shrink-0" />
          {depthNotice}
        </p>
      ) : null}

      {result.rows.length === 0 ? (
        <AuditEmpty state={state} matchingTotal={result.total} unfilteredTotal={unfilteredTotal} />
      ) : grouped ? (
        <div className="flex flex-col gap-3">
          {groupAuditByDay(result.rows, now).map((group) => (
            <section key={group.dayIso} className="flex flex-col gap-1">
              <DayMarker
                dayIso={group.dayIso}
                relativeLabel={group.relativeLabel}
                count={group.rows.length}
                state={state}
              />
              <ol className="ml-2 flex flex-col border-l border-border">
                {group.rows.map((row) => (
                  <AuditRow key={row.id} row={row} state={state} withDate={false} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <ol className="ml-2 flex flex-col border-l border-border">
          {result.rows.map((row) => (
            <AuditRow key={row.id} row={row} state={state} withDate />
          ))}
        </ol>
      )}

      <Pager state={state} total={result.total} pageSize={result.pageSize} />
    </div>
  )
}
