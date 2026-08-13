import { activityParams, type ActivityParamState } from '@/features/activity/filters'

/**
 * The two things /activity's chrome needs and the feed rows can't compute for
 * themselves: what slice the reader is currently looking at, and where a
 * one-click filter on a row should point.
 *
 * Both are pure and both go through `activityParams` (filters.ts), the one
 * query-string builder the filter bar and the Load-more link already share, so
 * a fourth family of links cannot drift from the other three.
 */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/**
 * `2026-08-13` → `Aug 13`. Deliberately string arithmetic rather than
 * `new Date(iso)`: a `Date` here would be parsed as UTC midnight and formatted
 * in the SERVER's zone (UTC on Vercel), which is one more place for the
 * product's Asia/Colombo day to drift by a day. An ISO calendar day already IS
 * the answer; it only needs spelling out. Anything malformed passes through
 * verbatim rather than becoming a wrong-but-plausible date.
 */
export function isoDayLabel(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return iso
  const month = MONTHS[Number(match[2]) - 1]
  if (!month) return iso
  return `${month} ${Number(match[3])}`
}

/**
 * The header's live answer to "what am I looking at" — the sentence under the
 * h1. Every row on the page is conditional on the active filters, so the page
 * has to say which ones those are rather than leaving the reader to infer it
 * from a filter bar they may have arrived at via a shared link.
 *
 * Names, not ids: the caller resolves `person`/`app` against the same lists
 * that populate the filter bar, and falls back to nothing when an id matches
 * no row (a hand-edited URL) — the same degrade-to-unfiltered spirit the Zod
 * schema uses.
 */
export function describeActivityFilters(input: {
  personName?: string
  entityType?: string
  appName?: string
  from?: string
  to?: string
  q?: string
}): string {
  // The head is "Changes" or "task changes"; the tail is every other clause.
  // Tracked apart from the clause list because the head is ALWAYS present — a
  // lone type filter narrows the page while leaving the tail empty, and
  // counting clauses would misread that as "nothing filtered".
  const tail: string[] = []

  if (input.personName) tail.push(`by ${input.personName}`)
  if (input.appName) tail.push(`in ${input.appName}`)
  if (input.q) tail.push(`matching “${input.q}”`)

  if (input.from && input.to) {
    tail.push(
      input.from === input.to
        ? `on ${isoDayLabel(input.from)}`
        : `between ${isoDayLabel(input.from)} and ${isoDayLabel(input.to)}`,
    )
  } else if (input.from) {
    tail.push(`since ${isoDayLabel(input.from)}`)
  } else if (input.to) {
    tail.push(`up to ${isoDayLabel(input.to)}`)
  }

  // Nothing narrowed at all: say what the page IS, not a bare "Changes".
  if (!input.entityType && tail.length === 0) {
    return 'Every change across the team, newest first.'
  }

  const head = input.entityType ? `${input.entityType} changes` : 'Changes'
  return `${[head, ...tail].join(' ')}, newest first.`
}

/**
 * The href behind a row's actor / entity-type / app affordance and behind a
 * day marker.
 *
 * Two rules, both of which the filter bar already follows and which a
 * hand-rolled `?person=…` link would quietly break:
 *
 * - Every OTHER active filter is kept, so clicking through narrows rather than
 *   restarting. That is what makes the feed a drill-down instrument instead of
 *   four independent shortcuts.
 * - The `before` cursor is DROPPED. Page two of the old question is not a page
 *   of the new one.
 */
export function activityFilterHref(
  current: ActivityParamState,
  patch: Partial<ActivityParamState>,
): string {
  const params = activityParams({ ...current, ...patch }).toString()
  return params ? `/activity?${params}` : '/activity'
}
