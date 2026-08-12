import { describe, expect, it } from 'vitest'
import type { HistoryRow } from '@/features/people/allocation-history'
import {
  appLoadRows,
  churnCounts,
  compareCapacities,
  daysBetween,
  hasMovement,
  overloadStretches,
  teamLoadStats,
  type CapacitySnapshotEntry,
} from './capacity-compare'

const app = (appId: string, allocationPct: number) => ({
  appId,
  appName: appId.toUpperCase(),
  slug: appId,
  allocationPct,
})

const person = (
  userId: string,
  name: string,
  breakdown: CapacitySnapshotEntry['breakdown'],
): CapacitySnapshotEntry => ({
  userId,
  name,
  totalPct: breakdown.reduce((sum, row) => sum + row.allocationPct, 0),
  breakdown,
})

describe('compareCapacities', () => {
  it('reports the load move and which apps came and went', () => {
    const before = [person('u1', 'Anu', [app('alpha', 40)])]
    const after = [person('u1', 'Anu', [app('beta', 60), app('gamma', 30)])]

    const [delta] = compareCapacities(before, after)
    expect(delta).toMatchObject({
      userId: 'u1',
      fromPct: 40,
      toPct: 90,
      deltaPct: 50,
      addedApps: ['BETA', 'GAMMA'],
      droppedApps: ['ALPHA'],
    })
  })

  it('keeps someone who disappeared from the later snapshot', () => {
    // The whole reason to compare: a person carrying 80% who is now absent is
    // a real change, not a row to drop.
    const deltas = compareCapacities([person('u1', 'Anu', [app('alpha', 80)])], [])
    expect(deltas).toHaveLength(1)
    expect(deltas[0]).toMatchObject({ name: 'Anu', fromPct: 80, toPct: 0, deltaPct: -80 })
    expect(deltas[0].droppedApps).toEqual(['ALPHA'])
  })

  it('sorts by the size of the move, not its direction', () => {
    const before = [
      person('u1', 'Anu', [app('alpha', 10)]),
      person('u2', 'Bim', [app('alpha', 90)]),
      person('u3', 'Cha', [app('alpha', 50)]),
    ]
    const after = [
      person('u1', 'Anu', [app('alpha', 30)]), // +20
      person('u2', 'Bim', [app('alpha', 20)]), // -70
      person('u3', 'Cha', [app('alpha', 50)]), // 0
    ]
    expect(compareCapacities(before, after).map((d) => d.name)).toEqual(['Bim', 'Anu', 'Cha'])
  })

  it('flags movement for an app swap that nets to zero percent', () => {
    const before = [person('u1', 'Anu', [app('alpha', 50)])]
    const after = [person('u1', 'Anu', [app('beta', 50)])]
    const [delta] = compareCapacities(before, after)
    expect(delta.deltaPct).toBe(0)
    expect(hasMovement(delta)).toBe(true)
  })

  it('reports no movement when nothing changed', () => {
    const same = [person('u1', 'Anu', [app('alpha', 50)])]
    expect(hasMovement(compareCapacities(same, same)[0])).toBe(false)
  })
})

describe('teamLoadStats', () => {
  it('counts the bands and never nets overload against headroom', () => {
    const stats = teamLoadStats([
      person('u1', 'Anu', [app('alpha', 130)]), // over
      person('u2', 'Bim', [app('alpha', 80)]), // near
      person('u3', 'Cha', [app('alpha', 100)]), // near (at the line, not over)
      person('u4', 'Dil', []), // idle
    ])

    expect(stats).toMatchObject({
      headcount: 4,
      overCount: 1,
      nearCount: 2,
      idleCount: 1,
      totalPct: 310,
    })
    // 130 contributes NO headroom (not -30); 80→20, 100→0, 0→100.
    expect(stats.headroomPct).toBe(120)
    expect(stats.avgPct).toBe(78)
  })

  it('is safe on an empty roster', () => {
    expect(teamLoadStats([])).toMatchObject({ headcount: 0, avgPct: 0, headroomPct: 0 })
  })
})

describe('appLoadRows', () => {
  it('pivots people onto apps, heaviest app first', () => {
    const rows = appLoadRows([
      person('u1', 'Anu', [app('alpha', 60), app('beta', 40)]),
      person('u2', 'Bim', [app('alpha', 30)]),
    ])

    expect(rows.map((row) => [row.appName, row.headcount, row.totalPct])).toEqual([
      ['ALPHA', 2, 90],
      ['BETA', 1, 40],
    ])
    expect(rows[0].people.map((p) => p.name)).toEqual(['Anu', 'Bim'])
  })
})

describe('churnCounts', () => {
  it('counts each kind and the total', () => {
    expect(
      churnCounts([
        { changeKind: 'assigned' },
        { changeKind: 'updated' },
        { changeKind: 'updated' },
        { changeKind: 'removed' },
      ]),
    ).toEqual({ assigned: 1, updated: 2, removed: 1, total: 4 })
  })
})

describe('overloadStretches', () => {
  const day = (n: number) => new Date(Date.UTC(2026, 0, n))
  const row = (
    userId: string,
    allocationPct: number,
    from: number,
    to: number | null,
    appId = 'alpha',
  ): HistoryRow => ({
    userId,
    appId,
    appName: appId.toUpperCase(),
    slug: appId,
    role: 'Dev',
    allocationPct,
    changeKind: 'assigned',
    effectiveFrom: day(from),
    effectiveTo: to === null ? null : day(to),
  })

  it('measures one continuous stretch across unrelated edits', () => {
    // Over from the 5th (120%), still over on the 10th when a second app is
    // added (140%) — one stretch, not two.
    const rows = [row('u1', 120, 5, null), row('u1', 20, 10, null, 'beta')]
    const [stretch] = overloadStretches(rows, day(1), day(20))

    expect(stretch).toMatchObject({ userId: 'u1', end: null, peakPct: 140 })
    expect(stretch.start.getTime()).toBe(day(5).getTime())
    expect(stretch.days).toBe(15)
  })

  it('closes the stretch when the load drops back', () => {
    const rows = [row('u1', 130, 5, 9), row('u1', 60, 9, null)]
    const [stretch] = overloadStretches(rows, day(1), day(20))
    expect(stretch.end?.getTime()).toBe(day(9).getTime())
    expect(stretch.days).toBe(4)
  })

  it('closes the stretch when every allocation is removed', () => {
    const rows: HistoryRow[] = [
      row('u1', 130, 5, 9),
      { ...row('u1', 0, 9, null), changeKind: 'removed' },
    ]
    const [stretch] = overloadStretches(rows, day(1), day(20))
    expect(stretch.end?.getTime()).toBe(day(9).getTime())
  })

  it('measures a stretch already running when the window opens from the window edge', () => {
    const rows = [row('u1', 150, 1, null)]
    const [stretch] = overloadStretches(rows, day(10), day(20))
    expect(stretch.start.getTime()).toBe(day(10).getTime())
    expect(stretch.days).toBe(10)
  })

  it('returns nothing when nobody goes over', () => {
    expect(overloadStretches([row('u1', 100, 5, null)], day(1), day(20))).toEqual([])
  })
})

describe('daysBetween', () => {
  it('floors to whole days and never goes negative', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    expect(daysBetween(start, new Date('2026-01-04T23:00:00Z'))).toBe(3)
    expect(daysBetween(start, new Date('2025-12-01T00:00:00Z'))).toBe(0)
  })
})
