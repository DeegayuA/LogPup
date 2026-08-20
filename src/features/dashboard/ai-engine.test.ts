import { describe, expect, it, vi } from 'vitest'
import { AI_FEATURES, type AiFeatureId } from '@/features/gemini/ai-features'

/**
 * Lets one test make a real feature look unrouted — the registry-drift case
 * that cannot be staged through the public API, because AI_FEATURES and
 * DEFAULT_CHAIN are both module constants.
 */
const drift = vi.hoisted(() => ({
  /** Features whose chain lookup throws — what defaultChainFor really does. */
  throwing: new Set<string>(),
  /** Features whose chain lookup returns undefined — the pre-guard shape. */
  undefined: new Set<string>(),
}))

vi.mock('@/features/gemini/model-choice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/gemini/model-choice')>()
  return {
    ...actual,
    resolveChain: (featureId: string, chosenModel: string | null) => {
      if (drift.throwing.has(featureId)) {
        throw new Error(`No default model chain for AI feature "${featureId}".`)
      }
      if (drift.undefined.has(featureId)) return undefined as unknown as readonly string[]
      return actual.resolveChain(featureId as AiFeatureId, chosenModel)
    },
  }
})
import type { AiPrefValue } from '@/features/gemini/prefs'
import type { FeatureUsageSummary } from '@/features/gemini/usage-summary'
import {
  aiEngineTotals,
  buildAiEngineRows,
  formatRate,
  formatTokenCount,
  modelFactsFor,
  sortAiEngineRows,
} from './ai-engine'

const AT = new Date('2026-08-20T00:00:00Z')

function prefsWith(overrides: Partial<Record<AiFeatureId, AiPrefValue>> = {}) {
  return Object.fromEntries(
    AI_FEATURES.map((f) => [f.id, overrides[f.id] ?? { enabled: true, model: null }]),
  ) as Record<AiFeatureId, AiPrefValue>
}

function usage(overrides: Partial<FeatureUsageSummary> & { featureId: AiFeatureId }): FeatureUsageSummary {
  return {
    calls: 0,
    failedCalls: 0,
    tokens: 0,
    valueUsd: 0,
    paidChargeUsd: 0,
    unpricedCalls: 0,
    ...overrides,
  }
}

describe('buildAiEngineRows', () => {
  it('lists every registered feature, used or not', () => {
    const rows = buildAiEngineRows({ prefs: prefsWith(), summaries: [], at: AT })
    expect(rows).toHaveLength(AI_FEATURES.length)
    expect(rows.every((r) => r.calls === 0)).toBe(true)
  })

  it('names the model each feature would actually call first', () => {
    const rows = buildAiEngineRows({ prefs: prefsWith(), summaries: [], at: AT })
    const byId = new Map(rows.map((r) => [r.featureId, r]))
    // Meeting intel leads on the Pro synthesis model; app metadata on Lite.
    expect(byId.get('meeting-intel')?.model).toBe('gemini-3.1-pro-preview')
    expect(byId.get('app-metadata')?.model).toBe('gemini-3.5-flash-lite')
    expect(byId.get('read-aloud')?.model).toBe('gemini-3.1-flash-tts-preview')
    // Every ROUTED row must have something behind it — a chain of one has no
    // fallback. Scoped to routed rows on purpose: AI_FEATURES is edited by
    // several sessions, and a feature registered ahead of its DEFAULT_CHAIN
    // entry is a real, recurring tree state. This assertion is about chain
    // DEPTH; letting an unrelated wiring gap fail it would make the test a
    // tripwire for other people's in-flight work rather than for its subject.
    expect(rows.filter((r) => r.model !== null).every((r) => r.fallbacks >= 1)).toBe(true)
  })

  it('puts a pinned model at the front and says it is pinned', () => {
    const rows = buildAiEngineRows({
      prefs: prefsWith({ 'worklog-draft': { enabled: true, model: 'gemini-2.5-flash-lite' } }),
      summaries: [],
      at: AT,
    })
    const row = rows.find((r) => r.featureId === 'worklog-draft')!
    expect(row.model).toBe('gemini-2.5-flash-lite')
    expect(row.pinned).toBe(true)
  })

  it('does not badge a pin that matches the default as an override', () => {
    const def = buildAiEngineRows({ prefs: prefsWith(), summaries: [], at: AT }).find(
      (r) => r.featureId === 'worklog-draft',
    )!
    const rows = buildAiEngineRows({
      prefs: prefsWith({ 'worklog-draft': { enabled: true, model: def.model } }),
      summaries: [],
      at: AT,
    })
    expect(rows.find((r) => r.featureId === 'worklog-draft')?.pinned).toBe(false)
  })

  it('carries a switched-off feature as off, not as unused', () => {
    const rows = buildAiEngineRows({
      prefs: prefsWith({ dictation: { enabled: false, model: null } }),
      summaries: [usage({ featureId: 'dictation', calls: 4, tokens: 900 })],
      at: AT,
    })
    const row = rows.find((r) => r.featureId === 'dictation')!
    expect(row.enabled).toBe(false)
    expect(row.calls).toBe(4)
  })

  it('keeps blocked attempts out of the call and token figures', () => {
    const rows = buildAiEngineRows({
      prefs: prefsWith(),
      summaries: [usage({ featureId: 'sprint-draft', calls: 0, failedCalls: 3 })],
      at: AT,
    })
    const row = rows.find((r) => r.featureId === 'sprint-draft')!
    expect(row.calls).toBe(0)
    expect(row.failedCalls).toBe(3)
    expect(row.tokens).toBe(0)
  })

  it('reports an unpublished price as null rather than free', () => {
    const rows = buildAiEngineRows({
      prefs: prefsWith({ dictation: { enabled: true, model: 'gemini-3.1-flash-lite' } }),
      summaries: [],
      at: AT,
    })
    const row = rows.find((r) => r.featureId === 'dictation')!
    expect(row.price).toBeNull()
    expect(row.perUseUsd).toBeNull()
    expect(formatRate(row.price)).toBeNull()
  })
})

describe('modelFactsFor', () => {
  it('labels a catalogued model and marks preview ids as preview', () => {
    expect(modelFactsFor('gemini-3.6-flash')).toEqual({
      label: 'Gemini 3.6 Flash',
      stability: 'stable',
    })
    expect(modelFactsFor('gemini-3.1-pro-preview').stability).toBe('preview')
    expect(modelFactsFor('gemini-flash-latest').stability).toBe('alias')
  })

  it('falls back to the raw id for a model no picker offers', () => {
    expect(modelFactsFor('gemini-9.9-imaginary')).toEqual({
      label: 'gemini-9.9-imaginary',
      stability: 'unlisted',
    })
  })
})

describe('sortAiEngineRows', () => {
  it('leads with what was actually used, most calls first', () => {
    const rows = buildAiEngineRows({
      prefs: prefsWith(),
      summaries: [
        usage({ featureId: 'app-metadata', calls: 2, tokens: 500 }),
        usage({ featureId: 'meeting-intel', calls: 9, tokens: 90_000 }),
      ],
      at: AT,
    })
    const sorted = sortAiEngineRows(rows)
    expect(sorted[0].featureId).toBe('meeting-intel')
    expect(sorted[1].featureId).toBe('app-metadata')
  })

  it('is stable across equal rows', () => {
    const rows = buildAiEngineRows({ prefs: prefsWith(), summaries: [], at: AT })
    expect(sortAiEngineRows(rows).map((r) => r.featureId)).toEqual(
      sortAiEngineRows(sortAiEngineRows(rows)).map((r) => r.featureId),
    )
  })
})

describe('aiEngineTotals', () => {
  it('counts used, off, and distinct routed models', () => {
    const rows = buildAiEngineRows({
      prefs: prefsWith({ dictation: { enabled: false, model: null } }),
      summaries: [usage({ featureId: 'meeting-intel', calls: 3, tokens: 1_000 })],
      at: AT,
    })
    const totals = aiEngineTotals(rows)
    expect(totals.featuresTotal).toBe(AI_FEATURES.length)
    expect(totals.featuresUsed).toBe(1)
    expect(totals.featuresOff).toBe(1)
    expect(totals.modelsInUse).toBeGreaterThan(1)
    expect(totals.previewFeatures).toBeGreaterThan(0)
  })
})

describe('formatRate', () => {
  it('states both directions, trimmed', () => {
    expect(formatRate({ inputPer1M: 0.75, outputPer1M: 3.75 })).toBe(
      '$0.75 in / $3.75 out · 1M',
    )
    expect(formatRate({ inputPer1M: 1, outputPer1M: 20 })).toBe('$1 in / $20 out · 1M')
  })
})

describe('formatTokenCount', () => {
  it('shortens only once there is something to shorten', () => {
    expect(formatTokenCount(0)).toBe('0')
    expect(formatTokenCount(940)).toBe('940')
    expect(formatTokenCount(18_200)).toBe('18k')
    expect(formatTokenCount(1_450_000)).toBe('1.5M')
    // The mirror case, which a `(n / 1e6).toFixed(1)` implementation gets
    // right by luck while getting 1_450_000 wrong. Both must hold.
    expect(formatTokenCount(2_450_000)).toBe('2.5M')
    expect(formatTokenCount(1_440_000)).toBe('1.4M')
  })
})

describe('registry drift', () => {
  // The panel reports on EVERY registered feature, so one mis-wired feature
  // must cost the reader that row and nothing else. An AI action is right to
  // throw here; a dashboard is not.
  it.each([
    ['the chain lookup throws', 'throwing' as const],
    ['the chain lookup returns undefined', 'undefined' as const],
  ])('reports a feature as not routed when %s', (_label, shape) => {
    // Measured against a baseline rather than absolute counts, for the reason
    // above: the registry may already contain an unrouted feature that has
    // nothing to do with this test. What is being asserted is that injecting
    // drift adds exactly one more.
    const baseline = aiEngineTotals(
      buildAiEngineRows({ prefs: prefsWith(), summaries: [], at: AT }),
    )
    drift[shape].add('sprint-draft')
    try {
      const rows = buildAiEngineRows({ prefs: prefsWith(), summaries: [], at: AT })
      const row = rows.find((r) => r.featureId === 'sprint-draft')!
      expect(row.model).toBeNull()
      expect(row.modelLabel).toBe('Not routed')
      expect(row.price).toBeNull()
      expect(row.perUseUsd).toBeNull()
      expect(row.fallbacks).toBe(0)

      // Every other feature still resolves — that is the whole point: one
      // mis-wired row must not cost the reader the rest of the table.
      expect(rows).toHaveLength(AI_FEATURES.length)

      const totals = aiEngineTotals(rows)
      expect(totals.unroutedFeatures).toBe(baseline.unroutedFeatures + 1)
      // Not the same thing as an unpriceable model: this never reaches one, so
      // the unpriced count must not move.
      expect(totals.unpricedFeatures).toBe(baseline.unpricedFeatures)
    } finally {
      drift[shape].clear()
    }
  })

  it('does not badge an unrouted feature as a user override', () => {
    drift.throwing.add('sprint-draft')
    try {
      const rows = buildAiEngineRows({
        prefs: prefsWith({ 'sprint-draft': { enabled: true, model: 'gemini-2.5-flash' } }),
        summaries: [],
        at: AT,
      })
      // The pin is real, but it is not the reason this feature cannot run and
      // un-pinning it would not help. The row says "wiring gap, not a setting";
      // a Pinned badge beside that sends the reader to the wrong lever.
      const row = rows.find((r) => r.featureId === 'sprint-draft')!
      expect(row.model).toBeNull()
      expect(row.pinned).toBe(false)
    } finally {
      drift.throwing.clear()
    }
  })
})
