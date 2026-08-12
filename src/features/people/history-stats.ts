import type { PersonStat } from '@/features/people/person-stats'
import type { ChurnCounts, OverloadStretch, TeamLoadStats } from '@/features/people/capacity-compare'

/**
 * The capacity-history page's stat strip, built from the window overview.
 *
 * Pure so the wording and the tone thresholds are testable — the tiles are
 * the first thing anyone reads on the page, and "is this number bad?" is a
 * decision, not formatting.
 *
 * Every tile states its own comparison in `meta`. A tile that says "6" and
 * nothing else is the snapshot problem this page exists to fix: six people
 * over capacity is a crisis if it was one last month and an improvement if
 * it was eleven.
 */
export type CapacityHistoryStatsInput = {
  stats: TeamLoadStats
  previousStats: TeamLoadStats
  churn: ChurnCounts
  overloads: Pick<OverloadStretch, 'days' | 'end'>[]
}

/** "+3", "−2", or "no change" — the phrasing every tile's meta shares. */
export function formatDelta(current: number, previous: number, unit = ''): string {
  const delta = current - previous
  if (delta === 0) return 'no change'
  return `${delta > 0 ? '+' : '−'}${Math.abs(delta)}${unit}`
}

export function buildCapacityHistoryStats(
  input: CapacityHistoryStatsInput,
  windowDays: number,
): PersonStat[] {
  const { stats, previousStats, churn, overloads } = input
  const ago = `${windowDays}d ago`
  const longestOverload = overloads.reduce((longest, stretch) => Math.max(longest, stretch.days), 0)
  const stillOver = overloads.filter((stretch) => stretch.end === null).length

  let overloadMeta = 'Nobody went over'
  if (stillOver > 0) overloadMeta = `${stillOver} still over right now`
  else if (longestOverload > 0) overloadMeta = 'Resolved within the window'

  let avgTone: PersonStat['tone'] = 'normal'
  // The team AVERAGE crossing 100 means the roster as a whole is
  // over-committed — a different and worse fact than one person being over.
  if (stats.avgPct > 100) avgTone = 'alert'
  else if (stats.avgPct >= 80) avgTone = 'warn'

  let overloadTone: PersonStat['tone'] = 'normal'
  if (longestOverload >= 14) overloadTone = 'alert'
  else if (longestOverload > 0) overloadTone = 'warn'

  return [
    {
      key: 'avg-load',
      label: 'Average load',
      value: stats.avgPct,
      suffix: '%',
      meta: `${formatDelta(stats.avgPct, previousStats.avgPct, '%')} vs ${ago}`,
      tone: avgTone,
    },
    {
      key: 'over',
      label: 'Over capacity',
      value: stats.overCount,
      meta: `${formatDelta(stats.overCount, previousStats.overCount)} vs ${ago}`,
      tone: stats.overCount > 0 ? 'alert' : 'normal',
    },
    {
      key: 'near',
      label: 'Near capacity',
      value: stats.nearCount,
      meta: `80–100% · ${formatDelta(stats.nearCount, previousStats.nearCount)} vs ${ago}`,
      tone: stats.nearCount > 0 ? 'warn' : 'normal',
    },
    {
      key: 'headroom',
      label: 'Headroom',
      value: stats.headroomPct,
      suffix: '%',
      // Expressed in people because that is the unit staffing decisions are
      // made in — 260% of spare capacity is "about two and a half people".
      meta: `≈ ${(stats.headroomPct / 100).toFixed(1)} people free · ${stats.idleCount} on the bench`,
      tone: 'normal',
    },
    {
      key: 'longest-overload',
      label: 'Longest overload',
      value: longestOverload,
      // 'd' rather than ' days': the suffix renders at text-lg immediately
      // after a text-2xl number, and a whole word there unbalances the tile
      // against its neighbours (which all carry '%' or nothing). The unit is
      // spelled out in the label + meta, which is where words belong.
      suffix: 'd',
      meta: overloadMeta,
      tone: overloadTone,
    },
    {
      key: 'churn',
      label: 'Allocation changes',
      value: churn.total,
      meta: `${churn.assigned} added · ${churn.updated} adjusted · ${churn.removed} removed`,
      tone: 'normal',
    },
  ]
}
