import { describe, expect, it } from 'vitest'
import {
  AI_FEATURES,
  estimatePerUseCostUsd,
  featureForSlug,
  MODEL_CHOICES,
  type AiFeatureEstimate,
  type FeatureKind,
} from '@/features/gemini/ai-features'
import { resolvePrefs } from '@/features/gemini/prefs'
import { estimateCostUsd, priceForModel } from '@/features/gemini/pricing'

// Google's catalog marks these shut down. Offering one in a picker offers a
// guaranteed, undiagnosable permanent failure — they must never appear in
// AI_FEATURES estimates or in any MODEL_CHOICES list.
const SHUT_DOWN_MODEL_IDS = [
  'gemini-3.1-flash-lite-preview',
  'gemini-3-pro-preview',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
]

describe('AI_FEATURES registry', () => {
  it('maps every slug to exactly one feature', () => {
    const seen = new Map<string, string>()
    for (const f of AI_FEATURES) {
      for (const slug of f.slugs) {
        expect(seen.has(slug), `slug ${slug} claimed by ${seen.get(slug)} and ${f.id}`).toBe(false)
        seen.set(slug, f.id)
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(10)
  })

  it('featureForSlug resolves a known slug', () => {
    expect(featureForSlug('worklog.draft').id).toBe('worklog-draft')
  })

  it('every estimate uses a model the pricing table knows', () => {
    for (const f of AI_FEATURES) {
      expect(
        priceForModel(f.estimate.tokens.model, new Date('2026-08-19')),
        `estimate model for ${f.id} has no price`,
      ).not.toBeNull()
    }
  })

  it('every feature has a kind', () => {
    for (const f of AI_FEATURES) {
      expect(['text', 'tts', 'live']).toContain(f.kind)
    }
  })

  it("no shut-down model appears in any feature's estimate", () => {
    for (const f of AI_FEATURES) {
      expect(
        SHUT_DOWN_MODEL_IDS,
        `${f.id}'s estimate model "${f.estimate.tokens.model}" is shut down`,
      ).not.toContain(f.estimate.tokens.model)
    }
  })
})

describe('estimatePerUseCostUsd', () => {
  const AT = new Date('2026-08-19')
  const estimateFor = (id: string): AiFeatureEstimate => {
    const feature = AI_FEATURES.find((f) => f.id === id)
    if (!feature) throw new Error(`no such feature: ${id}`)
    return feature.estimate
  }

  it('reprices the whole shape for a feature whose choice governs every call', () => {
    const estimate = estimateFor('worklog-draft')
    expect(estimate.chosenModelApplies).toBeUndefined()
    expect(estimatePerUseCostUsd(estimate, 'gemini-2.5-pro', AT)).toBe(
      estimateCostUsd({ ...estimate.tokens, model: 'gemini-2.5-pro', at: AT }),
    )
  })

  // The defect this guards: meeting-intel's per-use figure is printed
  // directly above a note promising that per-segment transcription is NOT
  // repriced with the write-up. Pricing the whole 120k/12k shape on the
  // chosen model doubled the row and made the card contradict itself.
  it('reprices meeting-intel by less than a naive whole-shape reprice', () => {
    const estimate = estimateFor('meeting-intel')
    const base = estimatePerUseCostUsd(estimate, null, AT)
    const split = estimatePerUseCostUsd(estimate, 'gemini-2.5-pro', AT)
    const naive = estimateCostUsd({ ...estimate.tokens, model: 'gemini-2.5-pro', at: AT })
    expect(base).not.toBeNull()
    expect(split).not.toBeNull()
    expect(naive).not.toBeNull()
    // A dearer model still costs more than the default — the split reprices
    // the synthesis pass, it does not ignore the choice.
    expect(split!).toBeGreaterThan(base!)
    // …but by strictly less than repricing the segment calls too would.
    expect(split! - base!).toBeLessThan(naive! - base!)
    expect(split!).toBeLessThan(naive!)
  })

  it('leaves the default-model figure untouched by the split', () => {
    const estimate = estimateFor('meeting-intel')
    expect(estimatePerUseCostUsd(estimate, null, AT)).toBe(
      estimateCostUsd({ ...estimate.tokens, at: AT }),
    )
  })

  it('returns null rather than a partial sum when the chosen model has no price', () => {
    // gemini-3.1-flash-lite is deliberately unpriced (pricing.ts) — half of a
    // blended figure would read as a real, cheap number.
    expect(estimatePerUseCostUsd(estimateFor('meeting-intel'), 'gemini-3.1-flash-lite', AT)).toBeNull()
  })

  it('never lets a sub-shape exceed the shape it is carved out of', () => {
    for (const f of AI_FEATURES) {
      const estimate: AiFeatureEstimate = f.estimate
      const sub = estimate.chosenModelApplies
      if (!sub) continue
      expect(sub.inputTokens, `${f.id} sub-shape input exceeds the whole`).toBeLessThanOrEqual(
        estimate.tokens.inputTokens,
      )
      expect(sub.outputTokens, `${f.id} sub-shape output exceeds the whole`).toBeLessThanOrEqual(
        estimate.tokens.outputTokens,
      )
    }
  })
})

describe('MODEL_CHOICES', () => {
  const KINDS: FeatureKind[] = ['text', 'tts', 'live']

  it('has a non-empty list for every kind', () => {
    for (const kind of KINDS) {
      expect(MODEL_CHOICES[kind].length).toBeGreaterThan(0)
    }
  })

  it('has a non-empty list for every kind a feature actually uses', () => {
    const kindsInUse = new Set(AI_FEATURES.map((f) => f.kind))
    for (const kind of kindsInUse) {
      expect(MODEL_CHOICES[kind].length).toBeGreaterThan(0)
    }
  })

  it('never lists the same model id under two different kinds', () => {
    const seen = new Map<string, FeatureKind>()
    for (const kind of KINDS) {
      for (const choice of MODEL_CHOICES[kind]) {
        expect(seen.has(choice.id), `"${choice.id}" appears in both ${seen.get(choice.id)} and ${kind}`).toBe(
          false,
        )
        seen.set(choice.id, kind)
      }
    }
  })

  it('never lists a shut-down model', () => {
    for (const kind of KINDS) {
      for (const choice of MODEL_CHOICES[kind]) {
        expect(SHUT_DOWN_MODEL_IDS, `${kind} lists shut-down model "${choice.id}"`).not.toContain(choice.id)
      }
    }
  })

  // Every listed id must resolve a real decision: either PRICE_TABLE prices
  // it, or it is named here as deliberately price-unknown (never a fabricated
  // figure). Adding a new model to the catalog without pricing it OR
  // whitelisting it here is a failing test, not a silent gap.
  const DELIBERATELY_UNPRICED = new Set([
    'gemini-3.1-flash-lite',
    'gemini-2.5-pro-preview-tts',
    'gemini-3.5-live-translate-preview',
  ])

  it('prices every model, or names it as deliberately unpriced', () => {
    for (const kind of KINDS) {
      for (const choice of MODEL_CHOICES[kind]) {
        const priced = priceForModel(choice.id, new Date('2026-08-19')) !== null
        expect(
          priced || DELIBERATELY_UNPRICED.has(choice.id),
          `"${choice.id}" has no PRICE_TABLE row and is not in DELIBERATELY_UNPRICED`,
        ).toBe(true)
      }
    }
  })

  it("does not carry a stale entry in DELIBERATELY_UNPRICED for a model that's now priced", () => {
    for (const id of DELIBERATELY_UNPRICED) {
      expect(priceForModel(id, new Date('2026-08-19')), `"${id}" is priced now — drop it from the allowlist`).toBeNull()
    }
  })
})

describe('resolvePrefs', () => {
  it('defaults every feature to enabled with no model chosen when no rows exist', () => {
    const prefs = resolvePrefs([])
    for (const f of AI_FEATURES) expect(prefs[f.id]).toEqual({ enabled: true, model: null })
  })

  it('a stored row wins; unknown stored ids are ignored', () => {
    const prefs = resolvePrefs([
      { feature: 'worklog-draft', enabled: false, model: null },
      { feature: 'meeting-intel', enabled: true, model: 'gemini-2.5-pro' },
      { feature: 'retired-feature', enabled: false, model: null },
    ])
    expect(prefs['worklog-draft']).toEqual({ enabled: false, model: null })
    expect(prefs['meeting-intel']).toEqual({ enabled: true, model: 'gemini-2.5-pro' })
    expect(prefs['sprint-draft']).toEqual({ enabled: true, model: null })
  })
})
