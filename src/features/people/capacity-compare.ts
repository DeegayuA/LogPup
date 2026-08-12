// Turning two capacity snapshots into the things a manager actually decides
// on: who moved, who is drowning, where the team's load sits, and which apps
// are absorbing it.
//
// Pure and clock-free — every function takes already-resolved snapshots, so
// it is unit-tested without a database (capacity-compare.test.ts). The query
// layer (getCapacityHistoryOverview in queries.ts) does the fetching; this
// file decides what the numbers MEAN.

import { NEAR_CAPACITY_PCT } from '@/features/people/components/capacity-bar'
import type { ChangeKind, HistoryRow, TimelineRow } from '@/features/people/allocation-history'

/** The per-person shape both snapshots arrive in (a slice of UserCapacity). */
export type CapacitySnapshotEntry = {
  userId: string
  name: string
  totalPct: number
  breakdown: { appId: string; appName: string; slug: string; allocationPct: number }[]
}

export type CapacityDelta = {
  userId: string
  name: string
  /** Load on the compared-FROM date. */
  fromPct: number
  /** Load on the as-of date. */
  toPct: number
  /** toPct - fromPct. Negative means the person was freed up. */
  deltaPct: number
  /** Apps they carry now but did not on the from-date. */
  addedApps: string[]
  /** Apps they carried on the from-date but no longer do. */
  droppedApps: string[]
}

/**
 * Person-by-person movement between two snapshots.
 *
 * Union of both rosters, not just the later one: someone who was carrying
 * 80% and now appears nowhere is exactly the case a comparison exists to
 * surface, and dropping them would silently report the team as lighter with
 * no explanation. Sorted by the SIZE of the move (largest first) because
 * "what changed most" is the question; ties break by name for stability.
 */
export function compareCapacities(
  from: CapacitySnapshotEntry[],
  to: CapacitySnapshotEntry[],
): CapacityDelta[] {
  const fromById = new Map(from.map((entry) => [entry.userId, entry]))
  const toById = new Map(to.map((entry) => [entry.userId, entry]))
  const userIds = [...new Set([...fromById.keys(), ...toById.keys()])]

  return userIds
    .map((userId) => {
      const before = fromById.get(userId)
      const after = toById.get(userId)
      const beforeApps = new Set((before?.breakdown ?? []).map((row) => row.appId))
      const afterApps = new Set((after?.breakdown ?? []).map((row) => row.appId))
      const fromPct = before?.totalPct ?? 0
      const toPct = after?.totalPct ?? 0

      return {
        userId,
        // Prefer the later name — it is the current one; fall back for
        // someone who has since left the roster.
        name: after?.name ?? before?.name ?? 'Unknown',
        fromPct,
        toPct,
        deltaPct: toPct - fromPct,
        addedApps: (after?.breakdown ?? [])
          .filter((row) => !beforeApps.has(row.appId))
          .map((row) => row.appName),
        droppedApps: (before?.breakdown ?? [])
          .filter((row) => !afterApps.has(row.appId))
          .map((row) => row.appName),
      }
    })
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct) || a.name.localeCompare(b.name))
}

/** Someone whose load, apps, or both actually moved between the two dates. */
export function hasMovement(delta: CapacityDelta): boolean {
  return delta.deltaPct !== 0 || delta.addedApps.length > 0 || delta.droppedApps.length > 0
}

export type TeamLoadStats = {
  /** People on the roster at the as-of date. */
  headcount: number
  /** How many are over 100%. */
  overCount: number
  /** How many are at/over the near-capacity line but not over it. */
  nearCount: number
  /** How many carry nothing at all — the bench. */
  idleCount: number
  /** Mean load across the roster, rounded. */
  avgPct: number
  /** Sum of everyone's load. */
  totalPct: number
  /**
   * Unused capacity, counting only people under 100% — an over-allocated
   * person's excess is a problem to fix, never headroom to spend, so letting
   * it net off against someone else's free time would hide both facts.
   */
  headroomPct: number
}

export function teamLoadStats(entries: CapacitySnapshotEntry[]): TeamLoadStats {
  const headcount = entries.length
  const totalPct = entries.reduce((sum, entry) => sum + entry.totalPct, 0)
  return {
    headcount,
    overCount: entries.filter((entry) => entry.totalPct > 100).length,
    nearCount: entries.filter(
      (entry) => entry.totalPct >= NEAR_CAPACITY_PCT && entry.totalPct <= 100,
    ).length,
    idleCount: entries.filter((entry) => entry.totalPct === 0).length,
    avgPct: headcount === 0 ? 0 : Math.round(totalPct / headcount),
    totalPct,
    headroomPct: entries.reduce((sum, entry) => sum + Math.max(0, 100 - entry.totalPct), 0),
  }
}

export type AppLoadRow = {
  appId: string
  appName: string
  slug: string
  /** How many people are allocated to this app on the as-of date. */
  headcount: number
  /** Sum of their allocation percentages — "how many people-equivalents". */
  totalPct: number
  /** Names, in descending allocation order, for a compact "who" line. */
  people: { userId: string; name: string; allocationPct: number }[]
}

/**
 * The same snapshot pivoted by app: where the team's effort was actually
 * going on that date. Ordered by total effort, because "which app is eating
 * the team" is the decision this answers.
 */
export function appLoadRows(entries: CapacitySnapshotEntry[]): AppLoadRow[] {
  const byApp = new Map<string, AppLoadRow>()
  for (const entry of entries) {
    for (const row of entry.breakdown) {
      let app = byApp.get(row.appId)
      if (!app) {
        app = {
          appId: row.appId,
          appName: row.appName,
          slug: row.slug,
          headcount: 0,
          totalPct: 0,
          people: [],
        }
        byApp.set(row.appId, app)
      }
      app.headcount += 1
      app.totalPct += row.allocationPct
      app.people.push({ userId: entry.userId, name: entry.name, allocationPct: row.allocationPct })
    }
  }
  for (const app of byApp.values()) {
    app.people.sort((a, b) => b.allocationPct - a.allocationPct || a.name.localeCompare(b.name))
  }
  return [...byApp.values()].sort(
    (a, b) => b.totalPct - a.totalPct || a.appName.localeCompare(b.appName),
  )
}

export type TeamChangeRow = TimelineRow & { userId: string; userName: string | null }
export type TeamChangeEntry = TeamChangeRow & {
  previousPct: number | null
  previousRole: string | null
}

/**
 * The team-wide equivalent of buildAllocationTimeline: newest-first changes,
 * each annotated with what it replaced.
 *
 * The difference that matters is the key. buildAllocationTimeline scopes
 * "before" per APP, which is right on one person's page — every row there is
 * theirs. Across the whole team, two people on the same app interleave, so
 * app-only scoping would report one person's 40% as the predecessor of the
 * other's 60% and render "40% → 60%" about a change that never happened.
 * Here the predecessor is the previous change to the same (person, app).
 */
export function annotateTeamChanges(rows: TeamChangeRow[]): TeamChangeEntry[] {
  const ascending = [...rows].sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime())
  const last = new Map<string, { allocationPct: number; role: string }>()
  const annotated = ascending.map((row) => {
    const key = `${row.userId}:${row.appId}`
    const previous = last.get(key) ?? null
    last.set(key, { allocationPct: row.allocationPct, role: row.role })
    return {
      ...row,
      previousPct: previous?.allocationPct ?? null,
      previousRole: previous?.role ?? null,
    }
  })
  return annotated.reverse()
}

export type ChurnCounts = { assigned: number; updated: number; removed: number; total: number }

/** How much reshuffling happened in the window — one number per kind. */
export function churnCounts(changes: { changeKind: ChangeKind }[]): ChurnCounts {
  const counts = { assigned: 0, updated: 0, removed: 0, total: changes.length }
  for (const change of changes) counts[change.changeKind] += 1
  return counts
}

/**
 * Continuous stretches where a person was over 100%, within [from, to].
 *
 * This is the fact a point-in-time capacity page cannot tell you: not "they
 * are over today" but "they have been over for eleven days" — the difference
 * between a busy week and a staffing problem. Computed by walking every
 * instant the team's allocations changed and asking, at each, who was over,
 * so a stretch that survives several unrelated edits stays ONE stretch.
 */
export type OverloadStretch = {
  userId: string
  start: Date
  /** Null while still over at the window's end — i.e. ongoing. */
  end: Date | null
  days: number
  /** The highest total reached during the stretch. */
  peakPct: number
}

export function overloadStretches(rows: HistoryRow[], from: Date, to: Date): OverloadStretch[] {
  // Every instant that could change someone's total, clamped to the window,
  // plus the window's own start so a stretch already running when the window
  // opens is measured from the edge rather than missed entirely.
  const instants = [
    from.getTime(),
    ...rows
      .map((row) => row.effectiveFrom.getTime())
      .filter((time) => time > from.getTime() && time <= to.getTime()),
  ]
  const uniqueInstants = [...new Set(instants)].sort((a, b) => a - b)

  const open = new Map<string, { start: Date; peakPct: number }>()
  const closed: OverloadStretch[] = []

  for (const time of uniqueInstants) {
    const at = new Date(time)
    const totals = totalsAt(rows, at)

    for (const [userId, total] of totals) {
      const current = open.get(userId)
      if (total > 100) {
        if (current) current.peakPct = Math.max(current.peakPct, total)
        else open.set(userId, { start: at, peakPct: total })
      } else if (current) {
        closed.push({
          userId,
          start: current.start,
          end: at,
          days: daysBetween(current.start, at),
          peakPct: current.peakPct,
        })
        open.delete(userId)
      }
    }
    // Someone who vanished from `totals` entirely is no longer over capacity
    // — close their stretch too rather than leave it open forever.
    for (const [userId, current] of open) {
      if (!totals.has(userId)) {
        closed.push({
          userId,
          start: current.start,
          end: at,
          days: daysBetween(current.start, at),
          peakPct: current.peakPct,
        })
        open.delete(userId)
      }
    }
  }

  for (const [userId, current] of open) {
    closed.push({
      userId,
      start: current.start,
      end: null,
      days: daysBetween(current.start, to),
      peakPct: current.peakPct,
    })
  }

  return closed.sort((a, b) => b.days - a.days || b.peakPct - a.peakPct)
}

function totalsAt(rows: HistoryRow[], at: Date): Map<string, number> {
  const time = at.getTime()
  const totals = new Map<string, number>()
  for (const row of rows) {
    if (row.effectiveFrom.getTime() > time) continue
    if (row.effectiveTo !== null && row.effectiveTo.getTime() <= time) continue
    if (row.changeKind === 'removed') {
      // A tombstone still means "this person is present in the data at 0 for
      // this app" — represent them, so a fully-removed person reads as a real
      // 0 rather than an absence the caller has to interpret.
      if (!totals.has(row.userId)) totals.set(row.userId, 0)
      continue
    }
    totals.set(row.userId, (totals.get(row.userId) ?? 0) + row.allocationPct)
  }
  return totals
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Whole days between two instants, floored, never negative. */
export function daysBetween(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY))
}
