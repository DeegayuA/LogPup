import { describe, expect, it } from 'vitest'
import { formatElapsed, localSpend, meterView, type MeterInput } from './ai-meter'

/** 2026-08-21, comfortably inside the current rate rows in pricing.ts. */
const AT = new Date('2026-08-21T12:00:00Z')

const input = (over: Partial<MeterInput> = {}): MeterInput => ({
  featureLabel: 'Daily briefing',
  model: 'gemini-3.6-flash',
  phase: 'running',
  elapsedMs: 4_000,
  estimateLabel: 'per briefing',
  keyTier: 'free',
  at: AT,
  ...over,
})

describe('while the call is in flight', () => {
  it('reports no tokens and no cost, because neither exists yet', () => {
    // The whole reason this module exists: usageMetadata arrives WITH the
    // response, so anything shown before that is invented.
    const view = meterView(input())
    expect(view.tokens).toBeNull()
    expect(view.costUsd).toBeNull()
  })

  it('ignores usage handed to it during a running phase', () => {
    // Defensive on purpose. A caller passing counts for a call that has not
    // returned is guessing, and trusting them would launder the guess into
    // something the UI renders as measured.
    const view = meterView(input({ usage: { inputTokens: 999, outputTokens: 999 } }))
    expect(view.tokens).toBeNull()
  })

  it('shows the feature estimate, which is the honest live figure', () => {
    expect(meterView(input()).estimateLabel).toBe('per briefing')
  })

  it('is marked indicative even with no cost, because the estimate is a guess', () => {
    expect(meterView(input()).indicative).toBe(true)
  })
})

describe('once the response has returned', () => {
  const done = input({ phase: 'done', usage: { inputTokens: 30_000, outputTokens: 2_000 } })

  it('reports the real counts and their total', () => {
    expect(meterView(done).tokens).toEqual({ input: 30_000, output: 2_000, total: 32_000 })
  })

  it('prices them against the instant given, not a constant', () => {
    // Rates are effective-dated — some models carry a promotional row with an
    // `until` — so a price must always be resolved against a moment.
    const cost = meterView(done).costUsd
    expect(cost).not.toBeNull()
    expect(cost).toBeGreaterThan(0)
  })

  it('drops the estimate once real numbers exist', () => {
    // Showing a guess beside a measurement invites averaging two things that
    // are not the same kind of claim.
    expect(meterView(done).estimateLabel).toBeNull()
  })

  it('returns null cost — never zero — for a model with no published rate', () => {
    // Zero reads as "this was free", a different and far more comforting claim
    // than "we do not know what this cost".
    const view = meterView(
      input({
        phase: 'done',
        model: 'gemini-9.9-imaginary',
        usage: { inputTokens: 10, outputTokens: 10 },
      }),
    )
    expect(view.tokens).not.toBeNull()
    expect(view.costUsd).toBeNull()
  })

  it('returns null cost when the model is unknown entirely', () => {
    const view = meterView(
      input({ phase: 'done', model: null, usage: { inputTokens: 10, outputTokens: 10 } }),
    )
    expect(view.costUsd).toBeNull()
  })
})

describe('who pays', () => {
  it('says free-tier for a free key', () => {
    expect(meterView(input({ keyTier: 'free' })).billing).toBe('free-tier')
  })

  it('says billed-to-key-owner for a paid key — there is no unlimited', () => {
    expect(meterView(input({ keyTier: 'paid' })).billing).toBe('billed-to-key-owner')
  })
})

describe('elapsed time', () => {
  it('reads in seconds under a minute', () => {
    expect(formatElapsed(0)).toBe('0s')
    expect(formatElapsed(4_400)).toBe('4s')
  })

  it('pads the seconds past a minute so the width does not jump', () => {
    expect(formatElapsed(65_000)).toBe('1m 05s')
    expect(formatElapsed(600_000)).toBe('10m 00s')
  })

  it('never renders a negative duration from a clock skew', () => {
    expect(formatElapsed(-5_000)).toBe('0s')
  })
})

describe('local spend', () => {
  it('sums calls and tokens actually recorded here', () => {
    expect(
      localSpend([
        { inputTokens: 100, outputTokens: 50 },
        { inputTokens: 200, outputTokens: 25 },
      ]),
    ).toEqual({ calls: 2, tokens: 375 })
  })

  it('offers no denominator, because the app cannot observe the limit', () => {
    // Google enforces the free tier per project, per minute and per day, with
    // no endpoint for what remains. A progress bar needs a denominator it can
    // defend; this returns a numerator and says so.
    const spend = localSpend([])
    expect(spend).toEqual({ calls: 0, tokens: 0 })
    expect(Object.keys(spend).sort()).toEqual(['calls', 'tokens'])
  })
})
