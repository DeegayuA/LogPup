import { describe, expect, it } from 'vitest'

import {
  buildModelCatalog,
  classifyModel,
  labelFor,
  modelIdFrom,
  stabilityOf,
  versionOf,
  type RawGeminiModel,
} from './model-catalog'

/**
 * The classification rules, against the shapes `GET /v1beta/models` really
 * returns — including the ones that are not Gemini at all, because the same
 * endpoint lists Imagen, Veo, Gemma and the embedding models, and every one of
 * them would otherwise land in a picker whose choice goes to generateContent.
 */

const text = (name: string, displayName?: string): RawGeminiModel => ({
  name: `models/${name}`,
  ...(displayName === undefined ? {} : { displayName }),
  supportedGenerationMethods: ['generateContent', 'countTokens'],
})

describe('modelIdFrom', () => {
  it('drops the models/ prefix the API puts on every name', () => {
    expect(modelIdFrom('models/gemini-3.7-flash')).toBe('gemini-3.7-flash')
  })

  it('is empty for anything that is not a string, rather than throwing', () => {
    // The response is JSON from someone else's server. A missing name must
    // skip one model, not take down the whole picker.
    expect(modelIdFrom(undefined)).toBe('')
    expect(modelIdFrom(null)).toBe('')
    expect(modelIdFrom(42)).toBe('')
  })
})

describe('classifyModel', () => {
  it('puts an ordinary flash model in the text picker', () => {
    expect(classifyModel(text('gemini-3.7-flash'))).toBe('text')
  })

  it('routes text-to-speech by name, since it answers generateContent too', () => {
    expect(classifyModel(text('gemini-3.1-flash-tts-preview'))).toBe('tts')
  })

  it('routes the live models by capability', () => {
    expect(
      classifyModel({
        name: 'models/gemini-3.1-flash-live-preview',
        supportedGenerationMethods: ['bidiGenerateContent'],
      }),
    ).toBe('live')
  })

  it('still routes a live model whose method list arrives empty', () => {
    // New previews do occasionally come back with no methods listed at all.
    expect(classifyModel({ name: 'models/gemini-4-flash-native-audio' })).toBe('live')
  })

  it('turns down everything that is not a Gemini model', () => {
    expect(classifyModel(text('imagen-4.0-generate'))).toBeNull()
    expect(classifyModel(text('veo-3.0-generate'))).toBeNull()
    expect(classifyModel(text('gemma-3-27b-it'))).toBeNull()
    expect(classifyModel(text('lyria-realtime'))).toBeNull()
  })

  it('turns down a Gemini model that cannot answer generateContent', () => {
    expect(
      classifyModel({
        name: 'models/gemini-embedding-001',
        supportedGenerationMethods: ['embedContent'],
      }),
    ).toBeNull()
  })

  it('turns down image and video generation, which would return no text', () => {
    // These DO answer generateContent, so capability alone is not enough —
    // picked for a meeting write-up they come back with nothing to read.
    expect(classifyModel(text('gemini-2.0-flash-preview-image-generation'))).toBeNull()
  })
})

describe('stabilityOf', () => {
  it('reads the convention out of the id', () => {
    expect(stabilityOf('gemini-3.7-flash')).toBe('stable')
    expect(stabilityOf('gemini-3.1-pro-preview')).toBe('preview')
    expect(stabilityOf('gemini-2.0-flash-exp')).toBe('preview')
    expect(stabilityOf('gemini-flash-latest')).toBe('alias')
  })
})

describe('labelFor', () => {
  it("prefers Google's own display name, which is what people have read", () => {
    expect(labelFor(text('gemini-3.7-flash', 'Gemini 3.7 Flash'), 'gemini-3.7-flash')).toBe(
      'Gemini 3.7 Flash',
    )
  })

  it('makes a readable name out of the id when there is none', () => {
    // The case that matters: a model Google ships tomorrow. A row reading
    // "Gemini 4 Flash" beats a row reading nothing.
    expect(labelFor({ name: 'models/gemini-4-flash' }, 'gemini-4-flash')).toBe('Gemini 4 Flash')
  })

  it('ignores a display name that is only whitespace', () => {
    expect(labelFor({ name: 'models/gemini-4-flash', displayName: '   ' }, 'gemini-4-flash')).toBe(
      'Gemini 4 Flash',
    )
  })
})

describe('versionOf', () => {
  it('reads the version so ordering is numeric, not alphabetical', () => {
    // The bug this exists for: '2.5' sorts above '3.7' as text, which would
    // put the oldest model at the top of every picker.
    expect(versionOf('gemini-3.7-flash')).toBe(3.7)
    expect(versionOf('gemini-2.5-flash')).toBe(2.5)
    expect(versionOf('gemini-4-flash')).toBe(4)
  })

  it('sorts an unversioned alias last', () => {
    expect(versionOf('gemini-flash-latest')).toBe(-1)
  })
})

describe('buildModelCatalog', () => {
  const RESPONSE: RawGeminiModel[] = [
    text('gemini-2.5-flash', 'Gemini 2.5 Flash'),
    text('gemini-4-flash', 'Gemini 4 Flash'),
    text('gemini-3.7-flash', 'Gemini 3.7 Flash'),
    { name: 'models/gemini-4-pro-preview', supportedGenerationMethods: ['generateContent'] },
    text('gemini-flash-latest', 'Gemini Flash (latest)'),
    text('gemini-4-flash-tts', 'Gemini 4 Flash TTS'),
    { name: 'models/gemini-4-flash-live', supportedGenerationMethods: ['bidiGenerateContent'] },
    text('imagen-4.0-generate', 'Imagen 4'),
    { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] },
  ]

  it('buckets each model into the picker that can actually call it', () => {
    const catalog = buildModelCatalog(RESPONSE)
    expect(catalog.text.map((choice) => choice.id)).toEqual([
      'gemini-4-flash',
      'gemini-4-pro-preview',
      'gemini-3.7-flash',
      'gemini-2.5-flash',
      'gemini-flash-latest',
    ])
    expect(catalog.tts.map((choice) => choice.id)).toEqual(['gemini-4-flash-tts'])
    expect(catalog.live.map((choice) => choice.id)).toEqual(['gemini-4-flash-live'])
  })

  it('orders newest first, stable ahead of preview, alias last', () => {
    const catalog = buildModelCatalog(RESPONSE)
    expect(catalog.text[0]?.id).toBe('gemini-4-flash')
    expect(catalog.text[1]?.id).toBe('gemini-4-pro-preview')
    expect(catalog.text.at(-1)?.id).toBe('gemini-flash-latest')
  })

  it('offers a model nobody has ever heard of — the whole point', () => {
    // A model Google ships after this code was written must appear with no
    // edit here. If this test ever needs updating to add one, the feature has
    // regressed to the hand-written list it replaced.
    const catalog = buildModelCatalog([text('gemini-9.9-ultra', 'Gemini 9.9 Ultra')])
    expect(catalog.text).toEqual([
      {
        id: 'gemini-9.9-ultra',
        label: 'Gemini 9.9 Ultra',
        stability: 'stable',
        freeTier: true,
      },
    ])
  })

  it('drops a retired model by it simply not being listed', () => {
    // The other half: a shut-down model is absent from the response, so it is
    // absent from the picker. No blocklist to keep up to date.
    const catalog = buildModelCatalog([text('gemini-4-flash')])
    expect(catalog.text.map((choice) => choice.id)).not.toContain('gemini-2.0-flash')
  })

  it('marks the known paid-only model, which discovery cannot tell us', () => {
    const catalog = buildModelCatalog([text('gemini-2.5-pro-preview-tts', 'Gemini 2.5 Pro TTS')])
    expect(catalog.tts[0]?.freeTier).toBe(false)
  })

  it('collapses a model listed twice across a page boundary', () => {
    const catalog = buildModelCatalog([
      text('gemini-4-flash', 'Gemini 4 Flash'),
      text('gemini-4-flash', 'Something else entirely'),
    ])
    expect(catalog.text).toHaveLength(1)
    // First wins, so a page boundary cannot change what a model is called.
    expect(catalog.text[0]?.label).toBe('Gemini 4 Flash')
  })

  it('survives a malformed response without emptying every picker', () => {
    const catalog = buildModelCatalog([
      {},
      { name: 42 },
      { name: 'models/gemini-4-flash', supportedGenerationMethods: ['generateContent'] },
    ])
    expect(catalog.text.map((choice) => choice.id)).toEqual(['gemini-4-flash'])
  })
})
