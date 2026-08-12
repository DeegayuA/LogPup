/**
 * Lane packing for a time grid: how several meetings that share the same slice
 * of a day divide the width of that day's column between them.
 *
 * THE PACKING RULE, stated once so the grid and its tests can never disagree:
 *
 *   1. Events are grouped into CONNECTED CLUSTERS. Two events are in the same
 *      cluster when they overlap, or when a chain of overlaps links them. An
 *      event that merely starts the instant another ends is NOT in its cluster
 *      — back-to-back meetings each keep the full column width, which is the
 *      whole point of distinguishing "adjacent" from "overlapping".
 *   2. Within a cluster, events are walked in start order and each is dropped
 *      into the FIRST LANE whose previous occupant has already finished.
 *   3. Every event in a cluster reports the SAME `laneCount` — the number of
 *      lanes that cluster ended up using, which for interval graphs is exactly
 *      the cluster's peak concurrency (first-fit greedy is provably optimal
 *      here, so there is no cleverer algorithm to reach for later).
 *
 * Rule 3 is the decision worth being explicit about, because it is the one
 * that has a defensible alternative. Take the chain A(09:00–10:00),
 * B(09:30–10:30), C(10:00–11:00): A and C do not overlap each other, but both
 * overlap B. This packing gives TWO lanes — A and C share lane 0, B takes lane
 * 1 — so all three render at half width. The alternative (width from each
 * event's own local concurrency) would render A and C at half width and B at
 * a third, producing a column whose event edges never line up. A uniform width
 * per cluster keeps those edges aligned down the column, which is what makes a
 * dense day readable at a glance; the cost is that A and C are narrower than
 * they strictly need to be. That trade is taken deliberately.
 *
 * Pure, and deliberately ignorant of pixels, dates and timezones — it sees
 * nothing but `{ id, startMs, endMs }`. Geometry lives in calendar-grid.ts.
 */

export type OverlapEvent = {
  id: string
  /** Epoch milliseconds. Callers clip to the day they are painting first. */
  startMs: number
  endMs: number
}

export type OverlapPlacement = {
  id: string
  /** 0-based column within the cluster. Left offset = lane / laneCount. */
  lane: number
  /** Lanes this event's cluster uses. Width = 1 / laneCount. Never 0. */
  laneCount: number
}

/**
 * Every event is treated as occupying at least this much time when deciding
 * whether it collides with a neighbour.
 *
 * Without it, a zero-length event (a 0-minute marker, or a corrupted row where
 * `endsAt === startsAt`) has no interior for a half-open interval test to find,
 * so it would collide with nothing, be given the full column width, and paint
 * straight over whatever meeting actually contains it. One millisecond is
 * enough to make it a real interval and far too small to make two genuinely
 * back-to-back meetings look like they overlap.
 */
const MIN_EXTENT_MS = 1

/**
 * The end instant used for every comparison below — never `endMs` directly.
 * This also normalises an inverted range (an `endsAt` before its `startsAt`,
 * which only a direct DB edit can produce) into a point rather than letting a
 * negative span quietly disable the overlap test.
 */
function effectiveEnd(event: OverlapEvent): number {
  return Math.max(event.endMs, event.startMs + MIN_EXTENT_MS)
}

/**
 * Lane and lane count for every event, in a stable order.
 *
 * Input order is irrelevant: events are sorted by (start, longest first, id)
 * before anything is decided, so two renders of the same data can never
 * disagree about which lane a meeting sits in. An event that hops columns
 * between renders reads as data changing when nothing did.
 *
 * "Longest first" on a tie means the meeting that covers the most of the
 * overlap takes lane 0 — the left-hand column, where the eye starts.
 *
 * The returned array is in that same sorted order (NOT input order); callers
 * key it by `id`.
 */
export function layoutOverlaps(events: readonly OverlapEvent[]): OverlapPlacement[] {
  const ordered = [...events].sort(
    (a, b) =>
      a.startMs - b.startMs ||
      effectiveEnd(b) - effectiveEnd(a) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )

  const placements: OverlapPlacement[] = []
  /** Index into `placements` where the cluster being built begins. */
  let clusterStart = 0
  /** Latest effective end anywhere in the open cluster — the cluster is closed
   *  by the first event that starts at or after it, since nothing is still
   *  running at that instant for a new event to chain onto. */
  let clusterEnd = Number.NEGATIVE_INFINITY
  /** Effective end of the event currently occupying each lane. */
  let laneEnds: number[] = []

  const closeCluster = () => {
    const laneCount = Math.max(laneEnds.length, 1)
    for (let i = clusterStart; i < placements.length; i += 1) {
      placements[i].laneCount = laneCount
    }
  }

  for (const event of ordered) {
    const end = effectiveEnd(event)

    if (event.startMs >= clusterEnd) {
      closeCluster()
      clusterStart = placements.length
      clusterEnd = Number.NEGATIVE_INFINITY
      laneEnds = []
    }

    // First lane already free at this event's start. A lane whose occupant
    // ends exactly when this one begins counts as free — that is the same
    // half-open rule that keeps back-to-back meetings out of one cluster.
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= event.startMs)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(end)
    } else {
      laneEnds[lane] = end
    }

    if (end > clusterEnd) clusterEnd = end
    // laneCount is a property of the whole cluster, so it is filled in by
    // closeCluster once the cluster's extent is known.
    placements.push({ id: event.id, lane, laneCount: 1 })
  }

  closeCluster()
  return placements
}

/** `layoutOverlaps` keyed by id — what a renderer actually wants. */
export function overlapMap(events: readonly OverlapEvent[]): Map<string, OverlapPlacement> {
  const map = new Map<string, OverlapPlacement>()
  for (const placement of layoutOverlaps(events)) map.set(placement.id, placement)
  return map
}

/**
 * Fractional left edge and width of an event's lane, as ratios of the day
 * column (0–1). Kept here rather than in the component so "half width, offset
 * by one half" is asserted in a test rather than eyeballed in a screenshot.
 */
export function laneFraction(placement: OverlapPlacement): { left: number; width: number } {
  const laneCount = Math.max(placement.laneCount, 1)
  return { left: placement.lane / laneCount, width: 1 / laneCount }
}
