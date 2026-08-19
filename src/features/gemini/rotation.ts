/**
 * Key order for one Gemini call: the caller's own active keys first
 * (least-recently-used first, never-used before used — the same LRU the
 * per-user pool has always run), then org-shared keys owned by others,
 * LRU again. Own keys first means a caller with working keys never spends
 * a teammate's shared quota; the pool is the fallback, not the default.
 * Pure so the ordering is testable without a database.
 */
export function orderKeysForRotation<
  K extends { userId: string; shared: boolean; lastUsedAt: Date | null },
>(callerId: string, rows: K[]): K[] {
  const lru = (a: K, b: K) => {
    if (a.lastUsedAt === null && b.lastUsedAt === null) return 0
    if (a.lastUsedAt === null) return -1
    if (b.lastUsedAt === null) return 1
    return a.lastUsedAt.getTime() - b.lastUsedAt.getTime()
  }
  const own = rows.filter((r) => r.userId === callerId).sort(lru)
  const pool = rows.filter((r) => r.userId !== callerId && r.shared).sort(lru)
  return [...own, ...pool]
}
