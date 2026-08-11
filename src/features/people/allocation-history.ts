import { summarizeAllocations } from '@/features/people/allocation'

export type ChangeKind = 'assigned' | 'updated' | 'removed'

/** The half-open interval a history row describes: [effectiveFrom, effectiveTo). */
export type HistoryInterval = {
  effectiveFrom: Date
  effectiveTo: Date | null
}

/** A history row as the queries hand it to the pure layer. */
export type HistoryRow = HistoryInterval & {
  userId: string
  appId: string
  appName: string
  slug: string
  role: string
  allocationPct: number
  changeKind: ChangeKind
}

export type CapacityAsOf = {
  userId: string
  totalPct: number
  overallocated: boolean
  breakdown: { appId: string; appName: string; slug: string; role: string; allocationPct: number }[]
}

/**
 * The rows in force at `at`, using the half-open interval [from, to).
 *
 * Half-open is what makes the boundary unambiguous: a change writes the
 * closing row's `effectiveTo` and the new row's `effectiveFrom` from ONE
 * timestamp, so at exactly that instant `to > at` is false for the old row
 * and `from <= at` is true for the new one — the successor wins, and never
 * both. A row still open (`effectiveTo === null`) is in force forever after
 * its start.
 *
 * Generic over the row type so the SQL layer can pre-filter with the same
 * predicate and still route its rows through this function (idempotent), and
 * so tests can use minimal fixtures.
 */
export function selectRowsAsOf<T extends HistoryInterval>(rows: T[], at: Date): T[] {
  const t = at.getTime()
  return rows.filter(
    (row) =>
      row.effectiveFrom.getTime() <= t &&
      (row.effectiveTo === null || row.effectiveTo.getTime() > t),
  )
}

/**
 * Per-user totals + app breakdown as the team stood at `at`.
 *
 * Tombstones ('removed', 0%) are in force like any other row — they are what
 * makes "this person had nothing on that date" a positive fact rather than an
 * absence — but they are dropped from `breakdown` so a removed app never
 * renders as a chip. They contribute 0 to the total either way.
 *
 * Only users that appear in `rows` are returned; the callers layer this over
 * the full roster so people with no history still show at 0%.
 */
export function capacityAsOf(rows: HistoryRow[], at: Date): CapacityAsOf[] {
  const live = selectRowsAsOf(rows, at).filter((row) => row.changeKind !== 'removed')

  const totals = new Map(
    summarizeAllocations(
      live.map((row) => ({ userId: row.userId, allocationPct: row.allocationPct })),
    ).map((summary) => [summary.userId, summary]),
  )

  // Every user touched by history is represented, including one whose only
  // in-force row is a tombstone — they belong in the list at 0%, not missing.
  const userIds = [...new Set(selectRowsAsOf(rows, at).map((row) => row.userId))]

  return userIds.map((userId) => {
    const summary = totals.get(userId)
    return {
      userId,
      totalPct: summary?.totalPct ?? 0,
      overallocated: summary?.overallocated ?? false,
      breakdown: live
        .filter((row) => row.userId === userId)
        .sort((a, b) => b.allocationPct - a.allocationPct || a.appName.localeCompare(b.appName))
        .map((row) => ({
          appId: row.appId,
          appName: row.appName,
          slug: row.slug,
          role: row.role,
          allocationPct: row.allocationPct,
        })),
    }
  })
}

export type HistoryEntryInput = {
  userId: string
  appId: string
  role: string
  allocationPct: number
  changeKind: ChangeKind
  changedBy: string
  at: Date
  note?: string | null
}

export type HistoryEntry = {
  userId: string
  appId: string
  role: string
  allocationPct: number
  changeKind: ChangeKind
  changedBy: string
  effectiveFrom: Date
  effectiveTo: null
  note: string | null
}

/**
 * Builds the row a change appends. Always opens a new interval
 * (`effectiveTo: null`) — closing the previous one is a separate statement in
 * the same batch, driven by the same `at`.
 *
 * A 'removed' entry is forced to 0% no matter what the caller passes: the
 * tombstone records that the person now carries nothing on this app, and
 * letting a stale non-zero percentage through would make every "as of" total
 * after the removal wrong.
 */
export function buildHistoryEntry(input: HistoryEntryInput): HistoryEntry {
  return {
    userId: input.userId,
    appId: input.appId,
    role: input.role,
    allocationPct: input.changeKind === 'removed' ? 0 : input.allocationPct,
    changeKind: input.changeKind,
    changedBy: input.changedBy,
    effectiveFrom: input.at,
    effectiveTo: null,
    note: input.note ?? null,
  }
}

export type TimelineRow = {
  id: string
  appId: string
  appName: string
  slug: string
  role: string
  allocationPct: number
  changeKind: ChangeKind
  effectiveFrom: Date
  changedByName: string | null
  note: string | null
}

export type TimelineEntry = TimelineRow & {
  /** The allocation this app was at immediately before, or null if it's the first. */
  previousPct: number | null
  previousRole: string | null
}

/**
 * Newest-first timeline with each entry annotated with what it replaced, so
 * the UI can say "40% → 60%" without a second query. "Before" is scoped per
 * app: the predecessor is the previous change to the SAME app, not whatever
 * happened to be the previous row overall.
 */
export function buildAllocationTimeline(rows: TimelineRow[]): TimelineEntry[] {
  const ascending = [...rows].sort(
    (a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime(),
  )
  const lastByApp = new Map<string, { allocationPct: number; role: string }>()
  const annotated = ascending.map((row) => {
    const previous = lastByApp.get(row.appId) ?? null
    lastByApp.set(row.appId, { allocationPct: row.allocationPct, role: row.role })
    return {
      ...row,
      previousPct: previous?.allocationPct ?? null,
      previousRole: previous?.role ?? null,
    }
  })
  return annotated.reverse()
}

/**
 * One line of plain English for a timeline entry — what actually changed,
 * not which columns were written.
 *
 * Keyed off changeKind first so a re-assignment after a removal reads
 * "Re-assigned at 60%" rather than the technically-true but baffling
 * "0% → 60%" that comparing against the tombstone would produce.
 */
export function describeAllocationChange(entry: {
  changeKind: ChangeKind
  role: string
  allocationPct: number
  previousPct: number | null
  previousRole: string | null
}): string {
  if (entry.changeKind === 'removed') {
    return entry.previousPct === null
      ? 'Removed from the app'
      : `Removed from the app — was ${entry.previousPct}%`
  }
  if (entry.changeKind === 'assigned') {
    const verb = entry.previousPct === null ? 'Assigned' : 'Re-assigned'
    return `${verb} at ${entry.allocationPct}% as ${entry.role}`
  }
  const changes: string[] = []
  if (entry.previousPct !== null && entry.previousPct !== entry.allocationPct) {
    changes.push(`${entry.previousPct}% → ${entry.allocationPct}%`)
  }
  if (entry.previousRole !== null && entry.previousRole !== entry.role) {
    changes.push(`${entry.previousRole} → ${entry.role}`)
  }
  // An update that resolved to the same values still happened and still gets
  // a row; saying so is better than rendering an empty line.
  return changes.length > 0 ? changes.join(' · ') : `Unchanged at ${entry.allocationPct}%`
}

export type TrendPoint = { at: Date; totalPct: number }

/**
 * Total allocation across all apps at each instant it changed — the series
 * behind the person trend. One point per distinct change instant (several
 * apps edited in the same batch collapse into a single point) and the total
 * is recomputed from every interval in force at that instant, so it is the
 * real total and not a running sum of deltas.
 */
/**
 * What the person page's history card renders. Declared here rather than in
 * queries.ts so the presentational components can type against it without
 * importing the query module (and with it the db client) at all.
 */
export type PersonAllocationHistoryView = {
  timeline: TimelineEntry[]
  trend: TrendPoint[]
}

export function allocationTotalSeries<T extends HistoryInterval & { allocationPct: number }>(
  rows: T[],
): TrendPoint[] {
  const instants = [...new Set(rows.map((row) => row.effectiveFrom.getTime()))].sort((a, b) => a - b)
  return instants.map((time) => {
    const at = new Date(time)
    const totalPct = selectRowsAsOf(rows, at).reduce((sum, row) => sum + row.allocationPct, 0)
    return { at, totalPct }
  })
}
