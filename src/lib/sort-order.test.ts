import { describe, it, expect } from 'vitest'
import { SORT_GAP, sortOrderForIndex, type SortOrdered } from './sort-order'

function items(...sortOrders: number[]): SortOrdered[] {
  return sortOrders.map((sortOrder) => ({ sortOrder }))
}

describe('sortOrderForIndex', () => {
  it('gives the only item in an empty list SORT_GAP', () => {
    expect(sortOrderForIndex([], 0)).toBe(SORT_GAP)
  })

  it('places an item before everything else, below the first sortOrder', () => {
    const neighbors = items(1024, 2048)
    expect(sortOrderForIndex(neighbors, 0)).toBe(1024 - SORT_GAP)
  })

  it('places an item after everything else, above the last sortOrder', () => {
    const neighbors = items(1024, 2048)
    expect(sortOrderForIndex(neighbors, 2)).toBe(2048 + SORT_GAP)
  })

  it('finds the real midpoint when there is room between neighbors', () => {
    const neighbors = items(1024, 2048)
    expect(sortOrderForIndex(neighbors, 1)).toBe(1536)
  })

  it('finds a midpoint even with a smaller gap, as long as one exists', () => {
    const neighbors = items(10, 14)
    expect(sortOrderForIndex(neighbors, 1)).toBe(12)
  })

  // Midpoint exhaustion: adjacent integers 1 apart have no integer strictly
  // between them, so Math.floor((before+after)/2) collapses onto one of the
  // neighbors themselves. That must NOT return a duplicate sortOrder — the
  // (index + 1) * SORT_GAP fallback kicks in instead.
  it('falls back to a fresh SORT_GAP slot when neighbors are adjacent integers', () => {
    const neighbors = items(10, 11)
    const result = sortOrderForIndex(neighbors, 1)
    expect(result).toBe(2 * SORT_GAP)
    expect(result).not.toBe(10)
    expect(result).not.toBe(11)
  })

  // Same exhaustion case, but neighbors are numerically equal (e.g. two rows
  // that both still carry the DB default of 0) — before === after leaves no
  // room at all.
  it('falls back to a fresh SORT_GAP slot when neighbors share a sortOrder', () => {
    const neighbors = items(0, 0)
    const result = sortOrderForIndex(neighbors, 1)
    expect(result).toBe(2 * SORT_GAP)
  })

  it('falls back correctly for a later index than 1 when exhausted', () => {
    const neighbors = items(0, 5, 5, 5, 20)
    const result = sortOrderForIndex(neighbors, 3)
    expect(result).toBe(4 * SORT_GAP)
  })
})
