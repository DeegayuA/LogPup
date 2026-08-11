import { describe, it, expect } from 'vitest'
import {
  allocationTotalSeries,
  buildAllocationTimeline,
  buildHistoryEntry,
  capacityAsOf,
  describeAllocationChange,
  selectRowsAsOf,
  type ChangeKind,
  type HistoryRow,
} from './allocation-history'

const JAN = new Date('2026-01-01T00:00:00.000Z')
const FEB = new Date('2026-02-01T00:00:00.000Z')
const MAR = new Date('2026-03-01T00:00:00.000Z')
const APR = new Date('2026-04-01T00:00:00.000Z')

function row(over: Partial<HistoryRow> = {}): HistoryRow {
  return {
    userId: 'u1',
    appId: 'a1',
    appName: 'Alpha',
    slug: 'alpha',
    role: 'Engineer',
    allocationPct: 50,
    changeKind: 'assigned',
    effectiveFrom: JAN,
    effectiveTo: null,
    ...over,
  }
}

describe('selectRowsAsOf', () => {
  it('picks the row open at the date', () => {
    const open = row({ effectiveFrom: JAN, effectiveTo: null })
    expect(selectRowsAsOf([open], MAR)).toEqual([open])
  })

  it('excludes a row closed before the date', () => {
    const closed = row({ effectiveFrom: JAN, effectiveTo: FEB })
    expect(selectRowsAsOf([closed], MAR)).toEqual([])
  })

  it('excludes a row opened after the date', () => {
    const later = row({ effectiveFrom: MAR, effectiveTo: null })
    expect(selectRowsAsOf([later], FEB)).toEqual([])
  })

  it('picks exactly one row at the instant one supersedes another', () => {
    // The abutting pair a single change writes: same timestamp on both sides.
    const before = row({ allocationPct: 40, effectiveFrom: JAN, effectiveTo: FEB })
    const after = row({ allocationPct: 60, effectiveFrom: FEB, effectiveTo: null })
    expect(selectRowsAsOf([before, after], FEB)).toEqual([after])
  })

  it('includes a row on its own start instant and excludes it on its end instant', () => {
    const bounded = row({ effectiveFrom: FEB, effectiveTo: MAR })
    expect(selectRowsAsOf([bounded], FEB)).toEqual([bounded])
    expect(selectRowsAsOf([bounded], MAR)).toEqual([])
  })

  it('returns nothing for a date before any history exists', () => {
    expect(selectRowsAsOf([row({ effectiveFrom: FEB })], JAN)).toEqual([])
  })

  it('handles empty input', () => {
    expect(selectRowsAsOf([], MAR)).toEqual([])
  })
})

describe('capacityAsOf', () => {
  it('sums multiple apps for one person', () => {
    const rows = [
      row({ appId: 'a1', appName: 'Alpha', slug: 'alpha', allocationPct: 60 }),
      row({ appId: 'a2', appName: 'Beta', slug: 'beta', allocationPct: 30 }),
    ]
    const [person] = capacityAsOf(rows, MAR)
    expect(person.totalPct).toBe(90)
    expect(person.overallocated).toBe(false)
    expect(person.breakdown.map((b) => b.appName)).toEqual(['Alpha', 'Beta'])
  })

  it('flags over 100 across apps', () => {
    const rows = [
      row({ appId: 'a1', allocationPct: 80 }),
      row({ appId: 'a2', appName: 'Beta', slug: 'beta', allocationPct: 50 }),
    ]
    expect(capacityAsOf(rows, MAR)[0]).toMatchObject({ totalPct: 130, overallocated: true })
  })

  it('drops to zero once a removal tombstone is in force', () => {
    const rows = [
      row({ allocationPct: 100, effectiveFrom: JAN, effectiveTo: FEB }),
      row({ allocationPct: 0, changeKind: 'removed', effectiveFrom: FEB, effectiveTo: null }),
    ]
    const [before] = capacityAsOf(rows, new Date('2026-01-15T00:00:00.000Z'))
    expect(before.totalPct).toBe(100)

    const [after] = capacityAsOf(rows, MAR)
    expect(after.totalPct).toBe(0)
    // The tombstone must never render as an app chip.
    expect(after.breakdown).toEqual([])
    // …but the person is still present in the result, at 0%.
    expect(after.userId).toBe('u1')
  })

  it('keeps the other apps when one is removed', () => {
    const rows = [
      row({ appId: 'a1', allocationPct: 60, effectiveFrom: JAN, effectiveTo: FEB }),
      row({
        appId: 'a1',
        allocationPct: 0,
        changeKind: 'removed',
        effectiveFrom: FEB,
        effectiveTo: null,
      }),
      row({ appId: 'a2', appName: 'Beta', slug: 'beta', allocationPct: 25 }),
    ]
    const [person] = capacityAsOf(rows, MAR)
    expect(person.totalPct).toBe(25)
    expect(person.breakdown.map((b) => b.appId)).toEqual(['a2'])
  })

  it('reflects an update, not the superseded value', () => {
    const rows = [
      row({ allocationPct: 40, effectiveFrom: JAN, effectiveTo: MAR }),
      row({ allocationPct: 90, changeKind: 'updated', effectiveFrom: MAR, effectiveTo: null }),
    ]
    expect(capacityAsOf(rows, FEB)[0].totalPct).toBe(40)
    expect(capacityAsOf(rows, APR)[0].totalPct).toBe(90)
  })

  it('separates people', () => {
    const rows = [
      row({ userId: 'u1', allocationPct: 50 }),
      row({ userId: 'u2', appId: 'a2', appName: 'Beta', slug: 'beta', allocationPct: 20 }),
    ]
    const byUser = Object.fromEntries(capacityAsOf(rows, MAR).map((c) => [c.userId, c.totalPct]))
    expect(byUser).toEqual({ u1: 50, u2: 20 })
  })

  it('orders the breakdown by allocation descending', () => {
    const rows = [
      row({ appId: 'a1', appName: 'Alpha', allocationPct: 10 }),
      row({ appId: 'a2', appName: 'Beta', slug: 'beta', allocationPct: 70 }),
    ]
    expect(capacityAsOf(rows, MAR)[0].breakdown.map((b) => b.allocationPct)).toEqual([70, 10])
  })

  it('returns an empty list for a date before any history', () => {
    expect(capacityAsOf([row({ effectiveFrom: MAR })], JAN)).toEqual([])
  })

  it('handles empty input', () => {
    expect(capacityAsOf([], MAR)).toEqual([])
  })
})

describe('buildHistoryEntry', () => {
  const base = {
    userId: 'u1',
    appId: 'a1',
    role: 'Engineer',
    allocationPct: 60,
    changedBy: 'admin-1',
    at: FEB,
  }

  it('opens an interval for an assignment', () => {
    expect(buildHistoryEntry({ ...base, changeKind: 'assigned' })).toEqual({
      userId: 'u1',
      appId: 'a1',
      role: 'Engineer',
      allocationPct: 60,
      changeKind: 'assigned',
      changedBy: 'admin-1',
      effectiveFrom: FEB,
      effectiveTo: null,
      note: null,
    })
  })

  it('carries the resulting values on an update', () => {
    expect(
      buildHistoryEntry({ ...base, allocationPct: 25, changeKind: 'updated' }),
    ).toMatchObject({ allocationPct: 25, changeKind: 'updated', effectiveTo: null })
  })

  it('forces a removal to 0% even when handed the old allocation', () => {
    expect(buildHistoryEntry({ ...base, allocationPct: 60, changeKind: 'removed' })).toMatchObject({
      allocationPct: 0,
      changeKind: 'removed',
      // The tombstone stays open — it IS the current state.
      effectiveTo: null,
      // The role is kept so the timeline can say what they were removed from.
      role: 'Engineer',
    })
  })

  it('keeps the note when one is given and normalises absence to null', () => {
    expect(buildHistoryEntry({ ...base, changeKind: 'assigned', note: 'backfill' }).note).toBe(
      'backfill',
    )
    expect(buildHistoryEntry({ ...base, changeKind: 'assigned' }).note).toBeNull()
  })

  it('always stamps effectiveFrom from the caller-supplied instant', () => {
    // Same Date object as the close statement uses — that is what makes the
    // intervals abut exactly.
    const kinds: ChangeKind[] = ['assigned', 'updated', 'removed']
    for (const changeKind of kinds) {
      expect(buildHistoryEntry({ ...base, changeKind }).effectiveFrom).toBe(FEB)
    }
  })
})

describe('buildAllocationTimeline', () => {
  const timelineRow = (over: Partial<Parameters<typeof buildAllocationTimeline>[0][number]>) => ({
    id: 'h1',
    appId: 'a1',
    appName: 'Alpha',
    slug: 'alpha',
    role: 'Engineer',
    allocationPct: 50,
    changeKind: 'assigned' as ChangeKind,
    effectiveFrom: JAN,
    changedByName: 'Ada',
    note: null,
    ...over,
  })

  it('returns newest first with the value each entry replaced', () => {
    const entries = buildAllocationTimeline([
      timelineRow({ id: 'h1', allocationPct: 40, effectiveFrom: JAN }),
      timelineRow({ id: 'h2', allocationPct: 70, effectiveFrom: FEB, changeKind: 'updated' }),
    ])
    expect(entries.map((e) => e.id)).toEqual(['h2', 'h1'])
    expect(entries[0]).toMatchObject({ allocationPct: 70, previousPct: 40 })
    expect(entries[1]).toMatchObject({ allocationPct: 40, previousPct: null })
  })

  it('scopes "previous" per app rather than to the previous row overall', () => {
    const entries = buildAllocationTimeline([
      timelineRow({ id: 'h1', appId: 'a1', allocationPct: 40, effectiveFrom: JAN }),
      timelineRow({ id: 'h2', appId: 'a2', allocationPct: 10, effectiveFrom: FEB }),
      timelineRow({ id: 'h3', appId: 'a1', allocationPct: 55, effectiveFrom: MAR }),
    ])
    expect(entries[0]).toMatchObject({ id: 'h3', previousPct: 40 })
    expect(entries[1]).toMatchObject({ id: 'h2', previousPct: null })
  })

  it('handles empty input', () => {
    expect(buildAllocationTimeline([])).toEqual([])
  })
})

describe('allocationTotalSeries', () => {
  it('gives the real total in force at each change instant', () => {
    const series = allocationTotalSeries([
      { allocationPct: 40, effectiveFrom: JAN, effectiveTo: MAR },
      { allocationPct: 20, effectiveFrom: FEB, effectiveTo: null },
      { allocationPct: 90, effectiveFrom: MAR, effectiveTo: null },
    ])
    expect(series).toEqual([
      { at: JAN, totalPct: 40 },
      { at: FEB, totalPct: 60 },
      { at: MAR, totalPct: 110 },
    ])
  })

  it('collapses changes made at the same instant into one point', () => {
    const series = allocationTotalSeries([
      { allocationPct: 30, effectiveFrom: FEB, effectiveTo: null },
      { allocationPct: 45, effectiveFrom: FEB, effectiveTo: null },
    ])
    expect(series).toEqual([{ at: FEB, totalPct: 75 }])
  })

  it('drops back to zero after a removal tombstone', () => {
    const series = allocationTotalSeries([
      { allocationPct: 100, effectiveFrom: JAN, effectiveTo: FEB },
      { allocationPct: 0, effectiveFrom: FEB, effectiveTo: null },
    ])
    expect(series.at(-1)).toEqual({ at: FEB, totalPct: 0 })
  })

  it('handles empty input', () => {
    expect(allocationTotalSeries([])).toEqual([])
  })
})

describe('describeAllocationChange', () => {
  it('describes a first assignment', () => {
    expect(
      describeAllocationChange({
        changeKind: 'assigned',
        role: 'Engineer',
        allocationPct: 60,
        previousPct: null,
        previousRole: null,
      }),
    ).toBe('Assigned at 60% as Engineer')
  })

  it('calls it a re-assignment when a tombstone precedes it, not "0% → 60%"', () => {
    expect(
      describeAllocationChange({
        changeKind: 'assigned',
        role: 'Engineer',
        allocationPct: 60,
        previousPct: 0,
        previousRole: 'Engineer',
      }),
    ).toBe('Re-assigned at 60% as Engineer')
  })

  it('describes an allocation change', () => {
    expect(
      describeAllocationChange({
        changeKind: 'updated',
        role: 'Engineer',
        allocationPct: 80,
        previousPct: 40,
        previousRole: 'Engineer',
      }),
    ).toBe('40% → 80%')
  })

  it('describes a role change, and both together', () => {
    expect(
      describeAllocationChange({
        changeKind: 'updated',
        role: 'Tech Lead',
        allocationPct: 40,
        previousPct: 40,
        previousRole: 'Engineer',
      }),
    ).toBe('Engineer → Tech Lead')
    expect(
      describeAllocationChange({
        changeKind: 'updated',
        role: 'Tech Lead',
        allocationPct: 90,
        previousPct: 40,
        previousRole: 'Engineer',
      }),
    ).toBe('40% → 90% · Engineer → Tech Lead')
  })

  it('describes a removal with what was lost', () => {
    expect(
      describeAllocationChange({
        changeKind: 'removed',
        role: 'Engineer',
        allocationPct: 0,
        previousPct: 35,
        previousRole: 'Engineer',
      }),
    ).toBe('Removed from the app — was 35%')
  })

  it('never renders an empty line for a no-op update', () => {
    expect(
      describeAllocationChange({
        changeKind: 'updated',
        role: 'Engineer',
        allocationPct: 40,
        previousPct: 40,
        previousRole: 'Engineer',
      }),
    ).toBe('Unchanged at 40%')
  })
})
