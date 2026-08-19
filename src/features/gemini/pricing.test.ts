import { describe, expect, it } from 'vitest'
import { estimateCostUsd, formatUsd, priceForModel } from '@/features/gemini/pricing'
import {
  ANALYSIS_MODELS,
  ASSISTANT_MODELS,
  LIVE_MODEL_FALLBACK_ORDER,
  QUICK_MODELS,
  SYNTHESIS_MODELS,
  TTS_MODEL_FALLBACK_ORDER,
} from '@/features/gemini/models'

describe('priceForModel', () => {
  it('resolves the 3.6 flash promo price before 2027', () => {
    expect(priceForModel('gemini-3.6-flash', new Date('2026-08-19'))).toEqual({
      inputPer1M: 0.75,
      outputPer1M: 3.75,
    })
  })

  it('resolves the 3.6 flash post-promo price from 2027-01-01', () => {
    expect(priceForModel('gemini-3.6-flash', new Date('2027-01-01T00:00:00Z'))).toEqual({
      inputPer1M: 1.5,
      outputPer1M: 7.5,
    })
  })

  it('returns null for a model it does not know — never invents a price', () => {
    expect(priceForModel('gemini-99-mystery', new Date('2026-08-19'))).toBeNull()
  })

  it('prices the moving flash alias like the pinned default', () => {
    expect(priceForModel('gemini-flash-latest', new Date('2026-08-19'))).toEqual({
      inputPer1M: 0.75,
      outputPer1M: 3.75,
    })
  })
})

describe('estimateCostUsd', () => {
  it('computes input + output cost per million tokens', () => {
    expect(
      estimateCostUsd({
        model: 'gemini-3.6-flash',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        at: new Date('2026-08-19'),
      }),
    ).toBeCloseTo(4.5, 10)
  })

  it('returns null for unknown models', () => {
    expect(
      estimateCostUsd({ model: 'nope', inputTokens: 10, outputTokens: 10, at: new Date('2026-08-19') }),
    ).toBeNull()
  })
})

// The registry's ESTIMATE models are guarded in ai-features.test.ts, but those
// are the models the cards ADVERTISE — not the ones the runtime actually calls.
// Every chain below is walked at runtime and every model it lands on is written
// to the ledger, so a model missing from PRICE_TABLE turns real spend into
// "unknown price" on Settings. Bumping a chain without adding its price here
// should fail this test, not ship silently.
describe('every routed model has a price', () => {
  const CHAINS: Record<string, readonly string[]> = {
    ANALYSIS_MODELS,
    SYNTHESIS_MODELS,
    QUICK_MODELS,
    ASSISTANT_MODELS,
    TTS_MODEL_FALLBACK_ORDER,
    LIVE_MODEL_FALLBACK_ORDER,
  }

  for (const [name, models] of Object.entries(CHAINS)) {
    it(`prices every model in ${name}`, () => {
      expect(models.length).toBeGreaterThan(0)
      for (const model of models) {
        expect(
          priceForModel(model, new Date('2026-08-19')),
          `${name} routes to "${model}", which PRICE_TABLE has no price for`,
        ).not.toBeNull()
      }
    })
  }
})

describe('formatUsd', () => {
  it('prefixes ≈ and keeps sub-cent amounts readable', () => {
    expect(formatUsd(0.00234)).toBe('≈$0.0023')
  })
  it('rounds ordinary amounts to cents', () => {
    expect(formatUsd(1.237)).toBe('≈$1.24')
  })
  it('shows a hard zero as $0.00 (still approximate-marked)', () => {
    expect(formatUsd(0)).toBe('≈$0.00')
  })
})
