import { describe, expect, it } from 'vitest'
import {
  summarizeAdoption,
  summarizeUsage,
  totalsFor,
  type AdoptionAggRow,
  type UsageAggRow,
} from '@/features/gemini/usage-summary'
import { AI_FEATURES } from '@/features/gemini/ai-features'

const AT = new Date('2026-08-19')

/** A successful call on the viewer's own free key — the ordinary case. */
function row(over: Partial<UsageAggRow> & Pick<UsageAggRow, 'feature' | 'model'>): UsageAggRow {
  return {
    keyTier: 'free',
    isOwnKey: true,
    ok: true,
    calls: 1,
    inputTokens: 0,
    outputTokens: 0,
    ...over,
  }
}

describe('summarizeUsage', () => {
  it('rolls slugs up to display features and prices per model', () => {
    const rows = [
      row({ feature: 'worklog.draft', model: 'gemini-3.6-flash', calls: 4, inputTokens: 8_000, outputTokens: 800 }),
      row({ feature: 'meeting.segment', model: 'gemini-3.6-flash', calls: 12, inputTokens: 120_000, outputTokens: 6_000 }),
      row({ feature: 'meeting.synthesis', model: 'gemini-3.1-pro-preview', calls: 1, inputTokens: 50_000, outputTokens: 4_000 }),
    ]
    const meeting = summarizeUsage(rows, AT).find((s) => s.featureId === 'meeting-intel')!
    expect(meeting.calls).toBe(13)
    expect(meeting.tokens).toBe(180_000)
    expect(meeting.valueUsd).toBeGreaterThan(0)
    expect(meeting.paidChargeUsd).toBe(0)
  })

  it('charges a paid-tier row the viewer owns', () => {
    const [s] = summarizeUsage(
      [row({ feature: 'worklog.draft', model: 'gemini-3.6-flash', keyTier: 'paid', isOwnKey: true, inputTokens: 1_000_000 })],
      AT,
    )
    expect(s.paidChargeUsd).toBeCloseTo(0.75, 10)
    expect(s.valueUsd).toBeCloseTo(0.75, 10)
  })

  it('does NOT charge an identical paid-tier row served by a teammate’s shared key', () => {
    // Same key tier, same tokens — only the owner differs. Google invoices the
    // teammate, so this viewer's "Charged" must stay $0 while the indicative
    // value still shows what the work was worth.
    const [s] = summarizeUsage(
      [row({ feature: 'worklog.draft', model: 'gemini-3.6-flash', keyTier: 'paid', isOwnKey: false, inputTokens: 1_000_000 })],
      AT,
    )
    expect(s.paidChargeUsd).toBe(0)
    expect(s.valueUsd).toBeCloseTo(0.75, 10)
  })

  it('ignores retired slugs and reports unknown-price calls instead of pricing them at zero', () => {
    const summaries = summarizeUsage(
      [
        row({ feature: 'retired.slug', model: 'gemini-3.6-flash', inputTokens: 10, outputTokens: 10 }),
        row({ feature: 'worklog.draft', model: 'renamed-preview-model', calls: 2, inputTokens: 10, outputTokens: 10 }),
      ],
      AT,
    )
    const wl = summaries.find((s) => s.featureId === 'worklog-draft')!
    expect(wl.calls).toBe(2)
    expect(wl.tokens).toBe(20)
    expect(wl.valueUsd).toBe(0)
    expect(wl.unpricedCalls).toBe(2)
  })

  it('never charges an unpriced model on a paid key — unknown is not free', () => {
    const [s] = summarizeUsage(
      [row({ feature: 'worklog.draft', model: 'renamed-preview-model', keyTier: 'paid', isOwnKey: true, inputTokens: 1_000_000 })],
      AT,
    )
    expect(s.paidChargeUsd).toBe(0)
    expect(s.valueUsd).toBe(0)
    expect(s.unpricedCalls).toBe(1)
  })

  it('counts blocked calls as failures, never as usage', () => {
    const [s] = summarizeUsage(
      [
        row({ feature: 'meeting.segment', model: 'gemini-3.6-flash', ok: false, calls: 6, isOwnKey: false, keyTier: null }),
        row({ feature: 'meeting.segment', model: 'gemini-3.6-flash', inputTokens: 1_000, outputTokens: 100 }),
      ],
      AT,
    )
    expect(s.calls).toBe(1)
    expect(s.failedCalls).toBe(6)
    expect(s.tokens).toBe(1_100)
  })

  it('a feature that only ever failed reports zero calls and zero value', () => {
    const [s] = summarizeUsage(
      [row({ feature: 'meeting.segment', model: 'gemini-3.6-flash', ok: false, calls: 6, keyTier: null, isOwnKey: false })],
      AT,
    )
    expect(s.calls).toBe(0)
    expect(s.tokens).toBe(0)
    expect(s.valueUsd).toBe(0)
    expect(s.paidChargeUsd).toBe(0)
    expect(s.failedCalls).toBe(6)
  })
})

describe('totalsFor', () => {
  it('sums across features', () => {
    expect(
      totalsFor([
        { featureId: 'worklog-draft', calls: 2, failedCalls: 1, tokens: 100, valueUsd: 0.5, paidChargeUsd: 0, unpricedCalls: 0 },
        { featureId: 'dictation', calls: 3, failedCalls: 0, tokens: 200, valueUsd: 0.25, paidChargeUsd: 0.25, unpricedCalls: 2 },
      ]),
    ).toEqual({
      calls: 5,
      failedCalls: 1,
      tokens: 300,
      valueUsd: 0.75,
      paidChargeUsd: 0.25,
      unpricedCalls: 2,
    })
  })
})

describe('summarizeAdoption', () => {
  /** A successful group unless `ok: false` is passed. */
  function agg(over: Partial<AdoptionAggRow> & Pick<AdoptionAggRow, 'feature'>): AdoptionAggRow {
    return { ok: true, userCount: 0, calls: 0, lastUsedAt: null, ...over }
  }

  it('lists every registered feature, including ones nobody used', () => {
    const rows = summarizeAdoption([], 10)
    expect(rows).toHaveLength(AI_FEATURES.length)
    expect(rows.every((r) => r.verdict === 'unused' && r.users === 0)).toBe(true)
  })

  it('computes adoption share against the active user count', () => {
    const rows = summarizeAdoption(
      [agg({ feature: 'worklog.draft', userCount: 8, calls: 40, lastUsedAt: new Date('2026-08-18') })],
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
        agg({ feature: 'meeting.segment', userCount: 3, calls: 30, lastUsedAt: new Date('2026-08-18') }),
        agg({ feature: 'meeting.synthesis', userCount: 2, calls: 3, lastUsedAt: new Date('2026-08-19') }),
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
      [agg({ feature: 'sprint.draft', userCount: 1, calls: 2, lastUsedAt: new Date('2026-08-10') })],
      10,
    )
    expect(rows.find((r) => r.featureId === 'sprint-draft')!.verdict).toBe('partial')
  })

  it('treats a zero active-user count as 0% rather than dividing by zero', () => {
    const rows = summarizeAdoption([agg({ feature: 'worklog.draft' })], 0)
    expect(rows.find((r) => r.featureId === 'worklog-draft')!.adoptionPct).toBe(0)
  })

  it('reports a feature that failed for everybody as unused, not as most-used', () => {
    // Eight people press Analyze with no key on file: eight ledger rows, zero
    // meetings transcribed. Badging this "Used by most" is the exact inversion
    // the panel exists to prevent.
    const rows = summarizeAdoption(
      [agg({ feature: 'meeting.segment', ok: false, userCount: 8, calls: 8, lastUsedAt: new Date('2026-08-19') })],
      10,
    )
    const mi = rows.find((r) => r.featureId === 'meeting-intel')!
    expect(mi.users).toBe(0)
    expect(mi.calls).toBe(0)
    expect(mi.adoptionPct).toBe(0)
    expect(mi.verdict).toBe('unused')
    expect(mi.lastUsedAt).toBeNull()
    // Kept visible, just not as usage: "8 people, 8 attempts, 0 succeeded".
    expect(mi.failedUsers).toBe(8)
    expect(mi.failedCalls).toBe(8)
  })

  it('keeps successes and failures of the same feature apart', () => {
    const rows = summarizeAdoption(
      [
        agg({ feature: 'meeting.segment', userCount: 2, calls: 20, lastUsedAt: new Date('2026-08-18') }),
        agg({ feature: 'meeting.segment', ok: false, userCount: 5, calls: 6, lastUsedAt: new Date('2026-08-19') }),
        agg({ feature: 'meeting.synthesis', ok: false, userCount: 3, calls: 3, lastUsedAt: new Date('2026-08-19') }),
      ],
      10,
    )
    const mi = rows.find((r) => r.featureId === 'meeting-intel')!
    expect(mi.users).toBe(2)
    expect(mi.calls).toBe(20)
    expect(mi.failedUsers).toBe(5) // max across failure groups, never summed
    expect(mi.failedCalls).toBe(9)
    // "Last used" means last actually used — a failed attempt is not a use.
    expect(mi.lastUsedAt).toEqual(new Date('2026-08-18'))
  })
})
