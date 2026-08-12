/**
 * Fractional ranking for board cards — the math behind `tasks.sort_order`
 * (a `double precision` column since migration 0020).
 *
 * WHY FRACTIONAL. A dense index (0,1,2,3…) makes every reorder an UPDATE of
 * every row below the insertion point: drop a card at the top of a 40-card
 * column and you write 40 rows. A fractional rank writes ONE row — the new
 * rank is simply the midpoint of the two neighbours it landed between. That
 * is the whole reason the column is a float; an `integer` column cannot hold
 * a midpoint once two neighbours are adjacent, which is exactly why the old
 * board code had a `(index + 1) * GAP` re-spread fallback that renumbered
 * the column anyway.
 *
 * WHY A REBALANCE STILL EXISTS. Halving a gap forever is not free: a double
 * carries ~15–17 significant digits, so after roughly 50 consecutive
 * insertions at the SAME spot the midpoint stops being strictly between its
 * neighbours and the ordering silently collapses into a tie. `planInsert`
 * detects that (and the far more common case in this database — neighbours
 * that already tie at the DB default of 0) and returns a rebalance plan for
 * the whole column instead of a single rank. That path is rare by
 * construction; it is not the hot path.
 *
 * WHY TIES ARE NORMAL HERE. `sort_order` defaults to 0 and at least one
 * writer outside this feature (the ⌘K quick-add in features/search) inserts
 * without a rank, so a freshly-seeded column can be entirely 0s. Every read
 * must therefore break ties deterministically — see `compareRanked`, and the
 * matching `ORDER BY sort_order, created_at, id` in queries.ts. Sorting on
 * the rank alone would hand back rows in whatever order Postgres felt like,
 * i.e. a board that reshuffles itself between renders.
 */

/** Spacing used at either end of a column and by a rebalance. Large enough
 *  that ~10 successive top-inserts still land on clean-ish numbers, small
 *  enough that a rebalanced column of 10k rows stays far from float range. */
export const RANK_GAP = 1024

/**
 * Smallest gap we are willing to split. Well above the point where doubles
 * actually fail (~1e-16 relative), because a rank that tiny is a signal the
 * column has been hammered at one spot and is better off re-spread than
 * pushed one halving closer to the cliff.
 */
export const RANK_EPSILON = 1e-6

export type Ranked = { id: string; sortOrder: number }

/**
 * The rank strictly between two neighbours. `null` means "no neighbour on
 * that side" — i.e. the head or the tail of the column — which steps a whole
 * RANK_GAP past the one neighbour that does exist so both ends keep room to
 * grow. Callers MUST consult `needsRebalance` first: this function assumes a
 * splittable gap and does not check for one.
 */
export function rankBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return RANK_GAP
  if (before === null) return after! - RANK_GAP
  if (after === null) return before + RANK_GAP
  return before + (after - before) / 2
}

/**
 * Whether the gap between two neighbours can still hold a distinct rank.
 * True (rebalance needed) when they tie, when they are inverted (data drift),
 * when the gap is below RANK_EPSILON, or when the midpoint has actually
 * collapsed onto an endpoint. An open end (null) never needs a rebalance —
 * there is always room outside the column.
 */
export function needsRebalance(before: number | null, after: number | null): boolean {
  if (before === null || after === null) return false
  const gap = after - before
  if (!(gap > 0)) return true
  if (gap < RANK_EPSILON) return true
  const mid = before + gap / 2
  return mid <= before || mid >= after
}

/**
 * The two neighbours a card would land between if inserted at `index` of
 * `list`. `list` must NOT contain the card being moved — a card is always
 * removed from its column before its destination index is computed, so that
 * "move down by one" doesn't mean "insert before yourself".
 */
export function neighboursAt(
  list: Ranked[],
  index: number,
): { before: number | null; after: number | null } {
  const clamped = Math.max(0, Math.min(index, list.length))
  return {
    before: clamped > 0 ? list[clamped - 1].sortOrder : null,
    after: clamped < list.length ? list[clamped].sortOrder : null,
  }
}

/** Evenly re-spreads a column: RANK_GAP, 2×RANK_GAP, 3×RANK_GAP… in the
 *  order given. The caller supplies the list ALREADY in its final visual
 *  order, moved card included. */
export function rebalance(list: Ranked[]): Ranked[] {
  return list.map((item, index) => ({ id: item.id, sortOrder: (index + 1) * RANK_GAP }))
}

/**
 * What it takes to put a card at `index` of `list` (the destination column
 * with the card removed).
 *
 * - `kind: 'rank'` — the common case: one row, one new rank.
 * - `kind: 'rebalance'` — the gap is unsplittable, so every row in the
 *   column gets a fresh rank. `writes` is the full new ordering INCLUDING
 *   the moved card, and `sortOrder` is the moved card's own new rank pulled
 *   out of it for convenience (the caller still needs it for its optimistic
 *   update).
 *
 * Returning a plan rather than performing the write keeps this module pure
 * and lets the server action decide how to batch it.
 */
export type InsertPlan =
  | { kind: 'rank'; sortOrder: number }
  | { kind: 'rebalance'; sortOrder: number; writes: Ranked[] }

export function planInsert(list: Ranked[], index: number, movedId: string): InsertPlan {
  const clamped = Math.max(0, Math.min(index, list.length))
  const { before, after } = neighboursAt(list, clamped)

  if (!needsRebalance(before, after)) {
    return { kind: 'rank', sortOrder: rankBetween(before, after) }
  }

  const ordered = [...list.slice(0, clamped), { id: movedId, sortOrder: 0 }, ...list.slice(clamped)]
  const writes = rebalance(ordered)
  const moved = writes.find((item) => item.id === movedId)
  // `movedId` was just spliced in, so this is unreachable — the fallback
  // exists only so the return type isn't `number | undefined`.
  return { kind: 'rebalance', sortOrder: moved?.sortOrder ?? RANK_GAP, writes }
}

/** The rank for a brand-new card appended to the end of a column. Takes the
 *  existing ranks (any order) rather than a sorted list so the server action
 *  can pass a raw `SELECT sort_order` straight in. */
export function rankForAppend(existing: number[]): number {
  if (existing.length === 0) return RANK_GAP
  return Math.max(...existing) + RANK_GAP
}

/**
 * The board's canonical ordering: rank, then creation time, then id. The last
 * two are not decoration — see the module header on why ties are the normal
 * case here. `id` is the final tiebreaker so two rows created in the same
 * millisecond still sort stably.
 */
export function compareRanked<T extends { sortOrder: number; createdAt: Date; id: string }>(
  a: T,
  b: T,
): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
  const byCreated = a.createdAt.getTime() - b.createdAt.getTime()
  if (byCreated !== 0) return byCreated
  return a.id.localeCompare(b.id)
}
