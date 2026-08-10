import { describe, it, expect } from 'vitest'
import { summarizeAllocations } from './allocation'

describe('summarizeAllocations', () => {
  it('sums per user and flags >100', () => {
    expect(summarizeAllocations([
      { userId: 'a', allocationPct: 60 },
      { userId: 'a', allocationPct: 50 },
      { userId: 'b', allocationPct: 40 },
    ])).toEqual([
      { userId: 'a', totalPct: 110, overallocated: true },
      { userId: 'b', totalPct: 40, overallocated: false },
    ])
  })
  it('exactly 100 is not overallocated', () => {
    expect(summarizeAllocations([{ userId: 'a', allocationPct: 100 }]))
      .toEqual([{ userId: 'a', totalPct: 100, overallocated: false }])
  })
  it('empty input → empty output', () => {
    expect(summarizeAllocations([])).toEqual([])
  })
})
