import { describe, it, expect } from 'vitest'
import { sortCapacities } from './sort-capacities'

describe('sortCapacities', () => {
  it('floats overallocated rows above higher non-overallocated totalPct', () => {
    const rows = [
      { totalPct: 95, overallocated: false },
      { totalPct: 110, overallocated: true },
    ]
    expect(sortCapacities(rows)).toEqual([
      { totalPct: 110, overallocated: true },
      { totalPct: 95, overallocated: false },
    ])
  })

  it('sorts the overallocated group by totalPct descending', () => {
    const rows = [
      { totalPct: 110, overallocated: true },
      { totalPct: 150, overallocated: true },
      { totalPct: 120, overallocated: true },
    ]
    expect(sortCapacities(rows)).toEqual([
      { totalPct: 150, overallocated: true },
      { totalPct: 120, overallocated: true },
      { totalPct: 110, overallocated: true },
    ])
  })

  it('sorts the normal group by totalPct descending', () => {
    const rows = [
      { totalPct: 40, overallocated: false },
      { totalPct: 80, overallocated: false },
      { totalPct: 60, overallocated: false },
    ]
    expect(sortCapacities(rows)).toEqual([
      { totalPct: 80, overallocated: false },
      { totalPct: 60, overallocated: false },
      { totalPct: 40, overallocated: false },
    ])
  })

  it('returns an empty array for empty input', () => {
    expect(sortCapacities([])).toEqual([])
  })

  it('does not mutate the input array', () => {
    const rows = [
      { totalPct: 40, overallocated: false },
      { totalPct: 110, overallocated: true },
    ]
    const copy = [...rows]
    sortCapacities(rows)
    expect(rows).toEqual(copy)
  })
})
