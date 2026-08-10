export type AllocationRow = { userId: string; allocationPct: number }
export type CapacitySummary = { userId: string; totalPct: number; overallocated: boolean }

export function summarizeAllocations(rows: AllocationRow[]): CapacitySummary[] {
  const totals = new Map<string, number>()
  for (const r of rows) totals.set(r.userId, (totals.get(r.userId) ?? 0) + r.allocationPct)
  return [...totals.entries()].map(([userId, totalPct]) => ({
    userId, totalPct, overallocated: totalPct > 100,
  }))
}
