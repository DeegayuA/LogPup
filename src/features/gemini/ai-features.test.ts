import { describe, expect, it } from 'vitest'
import { AI_FEATURES, featureForSlug } from '@/features/gemini/ai-features'
import { resolvePrefs } from '@/features/gemini/prefs'
import { priceForModel } from '@/features/gemini/pricing'

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
})

describe('resolvePrefs', () => {
  it('defaults every feature to enabled when no rows exist', () => {
    const prefs = resolvePrefs([])
    for (const f of AI_FEATURES) expect(prefs[f.id]).toBe(true)
  })

  it('a stored false wins; unknown stored ids are ignored', () => {
    const prefs = resolvePrefs([
      { feature: 'worklog-draft', enabled: false },
      { feature: 'retired-feature', enabled: false },
    ])
    expect(prefs['worklog-draft']).toBe(false)
    expect(prefs['meeting-intel']).toBe(true)
  })
})
