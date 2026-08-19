import { describe, expect, it } from 'vitest'
import { summarizeAdoption, summarizeUsage, totalsFor } from '@/features/gemini/usage-summary'
import { AI_FEATURES } from '@/features/gemini/ai-features'

const AT = new Date('2026-08-19')

describe('summarizeUsage', () => {
  it('rolls slugs up to display features and prices per model', () => {
    const rows = [
      { feature: 'worklog.draft', model: 'gemini-3.6-flash', keyTier: 'free', calls: 4, inputTokens: 8_000, outputTokens: 800 },
      { feature: 'meeting.segment', model: 'gemini-3.6-flash', keyTier: 'free', calls: 12, inputTokens: 120_000, outputTokens: 6_000 },
      { feature: 'meeting.synthesis', model: 'gemini-3.1-pro-preview', keyTier: 'free', calls: 1, inputTokens: 50_000, outputTokens: 4_000 },
    ]
    const meeting = summarizeUsage(rows, AT).find((s) => s.featureId === 'meeting-intel')!
    expect(meeting.calls).toBe(13)
    expect(meeting.tokens).toBe(180_000)
    expect(meeting.valueUsd).toBeGreaterThan(0)
    expect(meeting.paidChargeUsd).toBe(0)
  })

  it('counts paid-tier rows into paidChargeUsd', () => {
    const [s] = summarizeUsage(
      [{ feature: 'worklog.draft', model: 'gemini-3.6-flash', keyTier: 'paid', calls: 1, inputTokens: 1_000_000, outputTokens: 0 }],
      AT,
    )
    expect(s.paidChargeUsd).toBeCloseTo(0.75, 10)
    expect(s.valueUsd).toBeCloseTo(0.75, 10)
  })

  it('ignores retired slugs and prices unknown models at zero', () => {
    const summaries = summarizeUsage(
      [
        { feature: 'retired.slug', model: 'gemini-3.6-flash', keyTier: 'free', calls: 1, inputTokens: 10, outputTokens: 10 },
        { feature: 'worklog.draft', model: 'unknown-model', keyTier: 'free', calls: 2, inputTokens: 10, outputTokens: 10 },
      ],
      AT,
    )
    const wl = summaries.find((s) => s.featureId === 'worklog-draft')!
    expect(wl.calls).toBe(2)
    expect(wl.valueUsd).toBe(0)
  })
})

describe('totalsFor', () => {
  it('sums across features', () => {
    expect(
      totalsFor([
        { featureId: 'worklog-draft', calls: 2, tokens: 100, valueUsd: 0.5, paidChargeUsd: 0 },
        { featureId: 'dictation', calls: 3, tokens: 200, valueUsd: 0.25, paidChargeUsd: 0.25 },
      ]),
    ).toEqual({ calls: 5, tokens: 300, valueUsd: 0.75, paidChargeUsd: 0.25 })
  })
})

describe('summarizeAdoption', () => {
  it('lists every registered feature, including ones nobody used', () => {
    const rows = summarizeAdoption([], 10)
    expect(rows).toHaveLength(AI_FEATURES.length)
    expect(rows.every((r) => r.verdict === 'unused' && r.users === 0)).toBe(true)
  })

  it('computes adoption share against the active user count', () => {
    const rows = summarizeAdoption(
      [{ feature: 'worklog.draft', userCount: 8, calls: 40, lastUsedAt: new Date('2026-08-18') }],
      10,
    )
    const wl = rows.find((r) => r.featureId === 'worklog-draft')!
    expect(wl.users).toBe(8)
    expect(wl.adoptionPct).toBe(80)
    expect(wl.verdict).toBe('strong')
  })

  it('sums distinct-user counts across a feature’s slugs without double counting calls', () => {
    const rows = summarizeAdoption(
      [
        { feature: 'meeting.segment', userCount: 3, calls: 30, lastUsedAt: new Date('2026-08-18') },
        { feature: 'meeting.synthesis', userCount: 2, calls: 3, lastUsedAt: new Date('2026-08-19') },
      ],
      10,
    )
    const mi = rows.find((r) => r.featureId === 'meeting-intel')!
    expect(mi.calls).toBe(33)
    // Distinct users per slug cannot be summed — the max is the honest floor.
    expect(mi.users).toBe(3)
    expect(mi.lastUsedAt).toEqual(new Date('2026-08-19'))
  })

  it('marks a lightly-used feature partial, not strong', () => {
    const rows = summarizeAdoption(
      [{ feature: 'sprint.draft', userCount: 1, calls: 2, lastUsedAt: new Date('2026-08-10') }],
      10,
    )
    expect(rows.find((r) => r.featureId === 'sprint-draft')!.verdict).toBe('partial')
  })

  it('treats a zero active-user count as 0% rather than dividing by zero', () => {
    const rows = summarizeAdoption(
      [{ feature: 'worklog.draft', userCount: 0, calls: 0, lastUsedAt: null }],
      0,
    )
    expect(rows.find((r) => r.featureId === 'worklog-draft')!.adoptionPct).toBe(0)
  })
})
