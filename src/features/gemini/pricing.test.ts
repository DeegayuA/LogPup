import { describe, expect, it } from 'vitest'
import { estimateCostUsd, formatUsd, priceForModel } from '@/features/gemini/pricing'

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
