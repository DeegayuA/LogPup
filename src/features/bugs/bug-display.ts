/**
 * How a bug's severity and status READ. Pure, dependency-free, and unit
 * tested — no drizzle, no React, nothing that needs a database or a DOM.
 *
 * The two value lists are written out here rather than derived from the pg
 * enums in db/schema.ts, for the same reason activity/types.ts writes its
 * entity types out: importing the schema would drag drizzle into every
 * component that wants to print the word "Critical". bug-display.test.ts
 * closes the drift that opens by comparing both lists against
 * `bugSeverity.enumValues` / `bugStatus.enumValues` — element for element,
 * IN ORDER, because the order is load-bearing (see below).
 *
 * ORDER IS THE DECLARATION ORDER OF THE PG ENUM, ON PURPOSE. Postgres sorts
 * an enum by declaration, so `order by severity desc` puts critical first and
 * `order by status asc` puts open first without a CASE expression or a join
 * to a lookup table (features/apps/search-providers.ts leans on the same
 * property for app status). Reversing a list here to make a dropdown read
 * nicer would silently change what those queries mean, so the display orders
 * are DERIVED below instead.
 */

/** Declaration order: least bad first. Mirrors `bug_severity` in schema.ts. */
export const BUG_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
export type BugSeverity = (typeof BUG_SEVERITIES)[number]

/** Declaration order, which is also the lifecycle. Mirrors `bug_status`. */
export const BUG_STATUSES = ['open', 'triaged', 'in_progress', 'resolved', 'closed'] as const
export type BugStatus = (typeof BUG_STATUSES)[number]

/**
 * Worst first — how a person picks a severity and how a filter row reads.
 * Derived rather than typed out a second time: two hand-written orders drift,
 * and the one that drifts is always the one no query is testing.
 */
export const SEVERITIES_WORST_FIRST: readonly BugSeverity[] = [...BUG_SEVERITIES].reverse()

/**
 * The statuses that mean "this is still somebody's problem".
 *
 * The tab badge, the per-app counts and the triage queue all ask this same
 * question, and they must ask it the same way — a count that includes
 * `resolved` beside a list that excludes it is a number nobody trusts twice.
 */
export const OPEN_BUG_STATUSES: readonly BugStatus[] = ['open', 'triaged', 'in_progress']

export function isOpenBugStatus(status: BugStatus): boolean {
  return OPEN_BUG_STATUSES.includes(status)
}

/**
 * Statuses that mean the bug is finished with, and so carry a `resolved_at`.
 * The complement of OPEN_BUG_STATUSES, derived for the same reason as above.
 */
export const SETTLED_BUG_STATUSES: readonly BugStatus[] = BUG_STATUSES.filter(
  (status) => !OPEN_BUG_STATUSES.includes(status),
)

export function isSettledBugStatus(status: BugStatus): boolean {
  return !isOpenBugStatus(status)
}

const SEVERITY_LABELS: Record<BugSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

const STATUS_LABELS: Record<BugStatus, string> = {
  open: 'Open',
  triaged: 'Triaged',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

export function bugSeverityLabel(severity: BugSeverity): string {
  return SEVERITY_LABELS[severity]
}

export function bugStatusLabel(status: BugStatus): string {
  return STATUS_LABELS[status]
}

/**
 * A subset of the variants ui/badge.tsx offers. Named locally rather than
 * imported from the badge, which would pull cva and Base UI into a module the
 * node tests import; passing one of these to <Badge variant=…> is what proves
 * the subset is still real, and tsc does that at every call site.
 */
export type BugBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost'

/**
 * VARIANT IS WEIGHT, NOT IDENTITY. Both ladders below descend from loud to
 * quiet, so a list of bugs reads as a shape before it reads as words — the
 * critical row is visibly the critical row from across the desk. The label
 * carries the identity; two values sharing a variant (triaged and in
 * progress) is deliberate, because they are the same amount of "someone has
 * this" and inventing a colour to separate them would spend the loudest
 * treatment on the smallest distinction.
 */
const SEVERITY_VARIANTS: Record<BugSeverity, BugBadgeVariant> = {
  critical: 'destructive',
  high: 'default',
  medium: 'secondary',
  low: 'outline',
}

const STATUS_VARIANTS: Record<BugStatus, BugBadgeVariant> = {
  // The loudest status is the one nobody has looked at yet. That is the whole
  // question a reporter asks, per the `bug_status` comment in schema.ts.
  open: 'default',
  triaged: 'secondary',
  in_progress: 'secondary',
  resolved: 'outline',
  closed: 'ghost',
}

export function bugSeverityBadgeVariant(severity: BugSeverity): BugBadgeVariant {
  return SEVERITY_VARIANTS[severity]
}

export function bugStatusBadgeVariant(status: BugStatus): BugBadgeVariant {
  return STATUS_VARIANTS[status]
}
