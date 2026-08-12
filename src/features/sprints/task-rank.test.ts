import { describe, it, expect } from 'vitest'
import {
  RANK_GAP,
  compareRanked,
  needsRebalance,
  neighboursAt,
  planInsert,
  rankBetween,
  rankForAppend,
  rebalance,
  type Ranked,
} from './task-rank'

const list = (...ranks: number[]): Ranked[] =>
  ranks.map((sortOrder, index) => ({ id: `t${index}`, sortOrder }))

describe('rankBetween', () => {
  it('opens an empty column at the gap', () => expect(rankBetween(null, null)).toBe(RANK_GAP))
  it('steps a gap below the head', () => expect(rankBetween(null, 100)).toBe(100 - RANK_GAP))
  it('steps a gap above the tail', () => expect(rankBetween(100, null)).toBe(100 + RANK_GAP))
  it('takes the midpoint between neighbours', () => expect(rankBetween(0, 1024)).toBe(512))
  it('splits a fractional gap', () => expect(rankBetween(1, 2)).toBe(1.5))
  it('stays strictly between its neighbours', () => {
    const mid = rankBetween(1024, 1025)
    expect(mid).toBeGreaterThan(1024)
    expect(mid).toBeLessThan(1025)
  })
})

describe('needsRebalance', () => {
  it('is false at an open head', () => expect(needsRebalance(null, 5)).toBe(false))
  it('is false at an open tail', () => expect(needsRebalance(5, null)).toBe(false))
  it('is false for a healthy gap', () => expect(needsRebalance(0, 1024)).toBe(false))
  // The single most common case in this database: every task created outside
  // the board lands on the column default of 0.
  it('is true when neighbours tie', () => expect(needsRebalance(0, 0)).toBe(true))
  it('is true when neighbours are inverted', () => expect(needsRebalance(10, 5)).toBe(true))
  it('is true below the epsilon', () => expect(needsRebalance(1, 1 + 1e-9)).toBe(true))
})

describe('neighboursAt', () => {
  it('reads both neighbours mid-list', () =>
    expect(neighboursAt(list(10, 20, 30), 1)).toEqual({ before: 10, after: 20 }))
  it('reads an open head', () =>
    expect(neighboursAt(list(10, 20), 0)).toEqual({ before: null, after: 10 }))
  it('reads an open tail', () =>
    expect(neighboursAt(list(10, 20), 2)).toEqual({ before: 20, after: null }))
  it('clamps an index past the end', () =>
    expect(neighboursAt(list(10, 20), 99)).toEqual({ before: 20, after: null }))
  it('clamps a negative index', () =>
    expect(neighboursAt(list(10, 20), -3)).toEqual({ before: null, after: 10 }))
  it('reports an empty column as fully open', () =>
    expect(neighboursAt([], 0)).toEqual({ before: null, after: null }))
})

describe('rebalance', () => {
  it('re-spreads in the order given', () =>
    expect(rebalance(list(0, 0, 0)).map((r) => r.sortOrder)).toEqual([1024, 2048, 3072]))
  it('keeps ids attached to their new rank', () =>
    expect(rebalance(list(9, 9))).toEqual([
      { id: 't0', sortOrder: 1024 },
      { id: 't1', sortOrder: 2048 },
    ]))
})

describe('planInsert', () => {
  it('takes the one-row path when there is room', () =>
    expect(planInsert(list(0, 1024), 1, 'moved')).toEqual({ kind: 'rank', sortOrder: 512 }))

  it('takes the one-row path at an open end', () =>
    expect(planInsert(list(1024), 1, 'moved')).toEqual({ kind: 'rank', sortOrder: 2048 }))

  it('rebalances a column of tied defaults', () => {
    const plan = planInsert(list(0, 0, 0), 1, 'moved')
    expect(plan.kind).toBe('rebalance')
    if (plan.kind !== 'rebalance') return
    expect(plan.writes.map((w) => w.id)).toEqual(['t0', 'moved', 't1', 't2'])
    expect(plan.writes.map((w) => w.sortOrder)).toEqual([1024, 2048, 3072, 4096])
    // The moved card's own rank is lifted out of the plan for the caller's
    // optimistic update.
    expect(plan.sortOrder).toBe(2048)
  })

  it('rebalances into a strictly increasing, collision-free column', () => {
    const plan = planInsert(list(0, 0, 0, 0), 2, 'moved')
    if (plan.kind !== 'rebalance') throw new Error('expected a rebalance')
    const ranks = plan.writes.map((w) => w.sortOrder)
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    expect(new Set(ranks).size).toBe(ranks.length)
  })

  it('still takes the one-row path to the head of a tied column', () => {
    // before is null at the head, so there is unlimited room below every
    // existing rank — no reason to rewrite three other rows to get there.
    const plan = planInsert(list(0, 0, 0), 0, 'moved')
    expect(plan.kind).toBe('rank')
    expect(plan.sortOrder).toBeLessThan(0)
  })

  it('still takes the one-row path to the tail of a tied column', () => {
    const plan = planInsert(list(0, 0, 0), 3, 'moved')
    expect(plan.kind).toBe('rank')
    expect(plan.sortOrder).toBeGreaterThan(0)
  })

  it('survives ~60 successive inserts at the same spot', () => {
    // The precision-exhaustion scenario the rebalance exists for: always drop
    // between the first two cards. Without the guard the midpoint eventually
    // collapses onto its neighbour and the order goes non-deterministic.
    let column = list(0, 1024 * 4)
    for (let i = 0; i < 60; i += 1) {
      const plan = planInsert(column, 1, `m${i}`)
      const next =
        plan.kind === 'rebalance'
          ? plan.writes
          : [column[0], { id: `m${i}`, sortOrder: plan.sortOrder }, ...column.slice(1)]
      const ranks = next.map((r) => r.sortOrder)
      for (let j = 1; j < ranks.length; j += 1) expect(ranks[j]).toBeGreaterThan(ranks[j - 1])
      column = next
    }
    expect(column).toHaveLength(62)
  })
})

describe('rankForAppend', () => {
  it('opens an empty column at the gap', () => expect(rankForAppend([])).toBe(RANK_GAP))
  it('steps past the largest existing rank regardless of input order', () =>
    expect(rankForAppend([2048, 0, 1024])).toBe(2048 + RANK_GAP))
})

describe('compareRanked', () => {
  const at = (sortOrder: number, ms: number, id: string) => ({
    sortOrder,
    createdAt: new Date(ms),
    id,
  })

  it('orders by rank first', () =>
    expect(compareRanked(at(1, 100, 'b'), at(2, 0, 'a'))).toBeLessThan(0))
  it('breaks a rank tie by creation time', () =>
    expect(compareRanked(at(0, 100, 'b'), at(0, 200, 'a'))).toBeLessThan(0))
  it('breaks a full tie by id, so the order never wobbles', () =>
    expect(compareRanked(at(0, 100, 'a'), at(0, 100, 'b'))).toBeLessThan(0))
  it('is a total order over an all-defaults column', () => {
    const rows = [at(0, 100, 'c'), at(0, 100, 'a'), at(0, 50, 'z'), at(0, 100, 'b')]
    expect([...rows].sort(compareRanked).map((r) => r.id)).toEqual(['z', 'a', 'b', 'c'])
  })
})
