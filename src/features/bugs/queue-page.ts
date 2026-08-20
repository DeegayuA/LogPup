/**
 * How one page of the triage queue is selected: the filters, the keyset walk,
 * and the size of a page.
 *
 * PURE and DB-free — it composes drizzle conditions and returns them, so the
 * composition rules are testable without a database, exactly as
 * src/features/activity/filters.ts is for the activity trail.
 *
 * WHY THE FILTERS MOVED INTO SQL. The queue narrowed by status and severity IN
 * MEMORY, over the capped page, which was defensible only while the cap was
 * the whole story: filtering what was fetched changed nothing about which rows
 * existed. Paging past the cap breaks that in two ways at once — page two of a
 * filtered queue would be drawn from rows the filter never saw, and a filter
 * matching nothing in the first hundred would report "nothing broken here"
 * while the matches sat on page three. Once a list pages, its filters belong
 * where its rows are chosen.
 */

import { and, eq, inArray, lt, lte, or, type SQL } from 'drizzle-orm'
import { liveBugReports } from '@/db/live'
import { OPEN_BUG_STATUSES } from '@/features/bugs/bug-display'
import type { BugFilters } from '@/features/bugs/report-input'
import type { KeysetCursor } from '@/lib/keyset-cursor'

/**
 * One page of the queue, everywhere a page is fetched: the page's first render
 * and the load-more action must agree, or the keyset walk skips or repeats
 * rows at every seam.
 */
export const TRIAGE_PAGE_SIZE = 50

/**
 * The WHERE for one page of the triage queue.
 *
 * The status filter NARROWS the open set rather than replacing it: this
 * surface is "what has come in and is not finished with", so a request for
 * `resolved` here would be a filter for rows the queue is defined not to
 * contain. `parseBugFilters` already rejects a status outside the enum; this
 * intersection is what stops a valid-but-closed one widening the queue's
 * meaning.
 */
export function triageQueueConditions(
  filters: BugFilters = {},
  cursor?: KeysetCursor,
): SQL | undefined {
  const statuses = filters.status
    ? OPEN_BUG_STATUSES.filter((status) => status === filters.status)
    : [...OPEN_BUG_STATUSES]

  const parts: (SQL | undefined)[] = [
    // An empty array is `false` in SQL, which is the right answer: asking the
    // open queue for a closed status matches nothing.
    inArray(liveBugReports.status, statuses),
    filters.severity ? eq(liveBugReports.severity, filters.severity) : undefined,
    // Keyset pagination: at-or-older than the cursor's millisecond, with id as
    // the tiebreaker inside it.
    //
    // `lte`, NOT `lt`, and this is the whole subtlety — the same one
    // activity/filters.ts documents. created_at is timestamptz filled by
    // now(), but a JS Date carries only milliseconds, so a cursor round-trips
    // FLOORED: a boundary row stored at 12:00:00.123456 encodes as …123. Under
    // a strict `lt`, every row in [.123000, .123456) — genuinely older, never
    // yet shown — is skipped forever. Widening to `lte` keeps that millisecond
    // in play, and `lt(id)` stops the boundary row repeating.
    cursor
      ? or(
          lt(liveBugReports.createdAt, cursor.createdAt),
          and(lte(liveBugReports.createdAt, cursor.createdAt), lt(liveBugReports.id, cursor.id)),
        )
      : undefined,
  ]

  const present = parts.filter((part): part is SQL => part !== undefined)
  return present.length === 0 ? undefined : and(...present)
}
