/**
 * Row ordering for the dashboard capacity heat list: overallocated rows
 * float to the top, then each group is sorted by totalPct descending.
 * Pure and non-mutating so it can be unit-tested independent of the DB
 * query shape or any rendering.
 */
export function sortCapacities<T extends { totalPct: number; overallocated: boolean }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    if (a.overallocated !== b.overallocated) return a.overallocated ? -1 : 1
    return b.totalPct - a.totalPct
  })
}
