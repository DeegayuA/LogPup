/**
 * Fractional-midpoint sort-order math, shared by every drag-to-reorder
 * surface (sprint board columns, roadmap rows). `sortOrder` is always a
 * Postgres `integer` column, so arbitrary fractional indices are out — we
 * first try the classic fractional midpoint between the two neighbors an
 * item is dropped between, which works as long as there's at least a
 * 2-wide gap. Freshly-created rows all share the DB default of 0 though, so
 * that gap often doesn't exist yet; when it doesn't (or repeated
 * insertions have exhausted the room between two adjacent integers), we
 * fall back to a fresh `(index + 1) * SORT_GAP` slot. That's simple,
 * collision-free, and the remaining items in the list naturally regain
 * spacing the next time they're individually moved.
 *
 * Lifted verbatim (generalized to any `{ sortOrder }` item) from
 * `src/features/sprints/components/board.tsx` — the board and the roadmap
 * both need this exact strategy.
 */

// Spacing used when an item lands at either end of a list, or when the
// fractional-midpoint strategy runs out of integer room and needs a clean
// re-spread.
export const SORT_GAP = 1024

export type SortOrdered = { sortOrder: number }

export function sortOrderForIndex(neighbors: readonly SortOrdered[], index: number): number {
  const before = index > 0 ? neighbors[index - 1].sortOrder : null
  const after = index < neighbors.length ? neighbors[index].sortOrder : null

  if (before === null && after === null) return SORT_GAP
  if (before === null) return after! - SORT_GAP
  if (after === null) return before + SORT_GAP

  const mid = Math.floor((before + after) / 2)
  if (mid <= before || mid >= after) return (index + 1) * SORT_GAP
  return mid
}
