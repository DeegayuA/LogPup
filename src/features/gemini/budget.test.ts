import { describe, expect, it } from 'vitest'

import {
  BUDGET_WARN_FRACTION,
  DEFAULT_AI_BUDGET_USD,
  budgetLadderStep,
  budgetMonth,
  budgetState,
  isOverBudget,
  overBudgetMessage,
  warnBudgetMessage,
} from './budget'

const at = (spentUsd: number, budgetUsd = DEFAULT_AI_BUDGET_USD, unpricedCalls = 0) =>
  budgetState({ spentUsd, budgetUsd, unpricedCalls })

describe('the three states', () => {
  it('is ok below the warning line', () => {
    expect(at(0).state).toBe('ok')
    expect(at(8.99).state).toBe('ok')
  })

  it('warns AT the line, not past it', () => {
    // A threshold that only fires above itself never fires at exactly 9.00,
    // which is the one value a test would use and a person would hit.
    expect(at(DEFAULT_AI_BUDGET_USD * BUDGET_WARN_FRACTION).state).toBe('warn')
    expect(at(9.5).state).toBe('warn')
  })

  it('cuts off AT the budget, not past it', () => {
    expect(at(10).state).toBe('over')
    expect(at(10.01).state).toBe('over')
    expect(isOverBudget(at(10))).toBe(true)
    expect(isOverBudget(at(9.99))).toBe(false)
  })

  it('scales to whatever an admin assigned, not just the default', () => {
    expect(at(45, 50).state).toBe('warn')
    expect(at(50, 50).state).toBe('over')
    expect(at(44, 50).state).toBe('ok')
  })
})

describe('a budget of zero', () => {
  it('is NO AI, never unlimited', () => {
    // The arithmetic this guards: 0/0 is NaN and n/0 is Infinity, and both
    // compare false against every threshold — which is how a cap of nothing
    // silently becomes a cap of everything.
    expect(at(0, 0).state).toBe('over')
    expect(at(5, 0).state).toBe('over')
    expect(at(0, -3).state).toBe('over')
    expect(Number.isFinite(at(0, 0).fraction)).toBe(true)
  })

  it('says who can fix it rather than just refusing', () => {
    expect(overBudgetMessage(at(0, 0))).toContain('An admin can set one')
  })
})

describe('what cannot be seen', () => {
  it('carries unpriced calls through rather than dropping them', () => {
    // priceForModel returns null for a model pricing.ts has never heard of,
    // and discovery now offers models newer than that table. Those calls cost
    // real money and estimate to nothing.
    const budget = at(4, 10, 12)
    expect(budget.unpricedCalls).toBe(12)
    expect(budget.hasBlindSpot).toBe(true)
  })

  it('admits the figure is incomplete, in both messages', () => {
    expect(warnBudgetMessage(at(9, 10, 3))).toContain('could not be priced')
    expect(overBudgetMessage(at(10, 10, 3))).toContain('no published rate')
  })

  it('claims nothing extra when everything was priced', () => {
    expect(at(9, 10, 0).hasBlindSpot).toBe(false)
    expect(warnBudgetMessage(at(9, 10, 0))).not.toContain('could not be priced')
  })
})

describe('the numbers people act on', () => {
  it('reports what is LEFT, and never a negative amount', () => {
    expect(at(9, 10).remainingUsd).toBeCloseTo(1)
    expect(at(14, 10).remainingUsd).toBe(0)
  })

  it('does not clamp the fraction, because overspend is worth knowing', () => {
    expect(at(14, 10).fraction).toBeCloseTo(1.4)
  })

  it('tells somebody at 90% what they have left to decide with', () => {
    expect(warnBudgetMessage(at(9, 10))).toContain('$1.00')
  })
})

describe('the warning ladder', () => {
  it('has a rung for each threshold and none below them', () => {
    expect(budgetLadderStep(at(1))).toBeNull()
    expect(budgetLadderStep(at(9))).toBe('90')
    expect(budgetLadderStep(at(10))).toBe('100')
  })

  it('is armed by the month, so a new month re-arms it', () => {
    // The dedupe key's arming fact. Same month, same key, nothing written;
    // new month, new key, the warning fires again.
    expect(budgetMonth('2026-08-22')).toBe('2026-08')
    expect(budgetMonth('2026-09-01')).toBe('2026-09')
  })
})

describe('nonsense in', () => {
  it('does not become an unlimited budget', () => {
    expect(budgetState({ spentUsd: NaN, budgetUsd: 10, unpricedCalls: 0 }).spentUsd).toBe(0)
    expect(budgetState({ spentUsd: 5, budgetUsd: NaN, unpricedCalls: 0 }).state).toBe('over')
    expect(budgetState({ spentUsd: -5, budgetUsd: 10, unpricedCalls: -2 }).spentUsd).toBe(0)
  })
})
