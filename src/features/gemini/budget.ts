/**
 * The monthly AI spend cap: warn at 90%, refuse at 100%.
 *
 * PURE — numbers in, a state out. No db, no clock; the month and the spend are
 * gathered by the caller. Every threshold below is testable by value, which
 * matters more here than almost anywhere else in the product: this code's job
 * is to STOP somebody working, and a rounding error in it is a person locked
 * out of a feature they had budget for.
 *
 * ============================================================================
 * WHAT THE NUMBER IS, AND IS NOT
 * ============================================================================
 * It is tokens multiplied by list price. It is NOT a bill. Nobody here sees
 * Google's invoice, which is why `formatUsd` prefixes every figure in this
 * product with `≈`.
 *
 * That makes one failure mode structural rather than hypothetical:
 * `priceForModel` returns null for a model `pricing.ts` has never heard of, and
 * model discovery now offers models that did not exist when that table was
 * written. Those calls really happen, really cost money, and estimate to
 * NOTHING.
 *
 * So unpriced calls are COUNTED, carried through every figure here, and
 * reported in words. A cap that quietly let somebody past it on the one model
 * nobody had priced would be worse than no cap, because it would be trusted.
 * `spentUsd` is never described as a total — only as what could be priced.
 */

/**
 * What a seat gets per calendar month when nobody has said otherwise.
 *
 * Ten dollars is roughly a working month of flash-tier calls for one person,
 * which makes it a ceiling that catches a runaway loop rather than one that
 * interrupts ordinary work. An admin raises it per person.
 */
export const DEFAULT_AI_BUDGET_USD = 10

/** Where the warning fires. */
export const BUDGET_WARN_FRACTION = 0.9

export type BudgetInput = {
  /** Priced spend this month. Never a total — see the header. */
  spentUsd: number
  /** This seat's cap. Zero or negative means no AI at all. */
  budgetUsd: number
  /**
   * Calls this month whose model had no published rate.
   *
   * NOT a diagnostic. They are the part of the spend nothing can see, and a
   * figure that ignored them would be a claim rather than a measurement.
   */
  unpricedCalls: number
}

export type BudgetState = 'ok' | 'warn' | 'over'

export type Budget = {
  state: BudgetState
  spentUsd: number
  budgetUsd: number
  /** 0–1, clamped at neither end: 1.4 is a real and useful thing to know. */
  fraction: number
  /** Never negative — "how much is left" stops at nothing left. */
  remainingUsd: number
  unpricedCalls: number
  /** True when the priced figure is known to be incomplete. */
  hasBlindSpot: boolean
}

/**
 * Where this seat stands this month.
 *
 * A BUDGET OF ZERO IS "NO AI", NOT "UNLIMITED". The division would be Infinity
 * — or NaN at zero spend — and either one compares false against every
 * threshold below, which is the arithmetic by which a cap of nothing becomes a
 * cap of everything. Handled explicitly, first.
 */
export function budgetState(input: BudgetInput): Budget {
  const budgetUsd = Number.isFinite(input.budgetUsd) ? input.budgetUsd : 0
  const spentUsd = Number.isFinite(input.spentUsd) ? Math.max(0, input.spentUsd) : 0
  const unpricedCalls = Math.max(0, input.unpricedCalls)

  if (budgetUsd <= 0) {
    return {
      state: 'over',
      spentUsd,
      budgetUsd: 0,
      fraction: 1,
      remainingUsd: 0,
      unpricedCalls,
      hasBlindSpot: unpricedCalls > 0,
    }
  }

  const fraction = spentUsd / budgetUsd
  return {
    state: fraction >= 1 ? 'over' : fraction >= BUDGET_WARN_FRACTION ? 'warn' : 'ok',
    spentUsd,
    budgetUsd,
    fraction,
    remainingUsd: Math.max(0, budgetUsd - spentUsd),
    unpricedCalls,
    hasBlindSpot: unpricedCalls > 0,
  }
}

/** Whether a call may be made at all. */
export function isOverBudget(budget: Budget): boolean {
  return budget.state === 'over'
}

/**
 * Which rung of the warning ladder this is, or null.
 *
 * A STRING, because it becomes part of a notification dedupe key: the ladder
 * fires each rung once per person per month and never again. Re-running the
 * same check ten minutes later re-derives the same rung, conflicts, and writes
 * nothing — which is the whole reason the ladder mode exists.
 */
export function budgetLadderStep(budget: Budget): '90' | '100' | null {
  if (budget.state === 'over') return '100'
  if (budget.state === 'warn') return '90'
  return null
}

/** `2026-08` — the window a budget is spent against, and the ladder's arming fact. */
export function budgetMonth(todayIso: string): string {
  return todayIso.slice(0, 7)
}

/**
 * What the person is told when a call is refused.
 *
 * Says the number, the cap, and WHO CAN CHANGE IT. "You are over budget" with
 * no route out is a dead end somebody hits at 4pm with a meeting to write up.
 */
export function overBudgetMessage(budget: Budget): string {
  if (budget.budgetUsd <= 0) {
    return 'AI is switched off for your account — no monthly budget is assigned. An admin can set one.'
  }
  const blind = budget.hasBlindSpot
    ? ` (plus ${budget.unpricedCalls} ${budget.unpricedCalls === 1 ? 'call' : 'calls'} on models with no published rate)`
    : ''
  return (
    `You have used your AI budget for this month — about $${budget.spentUsd.toFixed(2)} `
    + `of $${budget.budgetUsd.toFixed(2)}${blind}. `
    + 'It resets on the 1st, or an admin can raise it.'
  )
}

/**
 * The 90% warning, in one sentence.
 *
 * Names what is LEFT rather than what is spent: somebody at 90% has to decide
 * what to spend the last tenth on, and "$1.04 left" is the number that decision
 * is made against.
 */
export function warnBudgetMessage(budget: Budget): string {
  const blind = budget.hasBlindSpot
    ? ` ${budget.unpricedCalls} ${budget.unpricedCalls === 1 ? 'call' : 'calls'} could not be priced, so the real figure is higher.`
    : ''
  return (
    `About $${budget.remainingUsd.toFixed(2)} of your $${budget.budgetUsd.toFixed(2)} AI budget `
    + `is left this month.${blind} AI stops when it runs out.`
  )
}
