import { beforeEach, describe, expect, it, vi } from 'vitest'
import { userAiPrefs } from '@/db/schema'

// setAiFeatureModel is the server-side guard on the model picker: the
// dropdown only ever offers FALLBACK_MODEL_CHOICES[feature.kind], but a caller could
// still hand this action any string, so the action itself must refuse a
// model that cannot serve the feature's kind. Same mocked-action idiom as
// src/features/sprints/actions.test.ts.
const { authMock, upsertSpy } = vi.hoisted(() => ({
  authMock: vi.fn(),
  upsertSpy: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

/**
 * The db mock is reachable so one case can hand discovery a key row. Most
 * cases want NO key: no key means no discovery, so they run against the
 * static fallback catalog, which is what they are about.
 */
const { dbMock, fetchMock } = vi.hoisted(() => ({
  dbMock: {} as Record<string, unknown>,
  fetchMock: vi.fn(),
}))

/** A key row shaped the way orderKeysForRotation and decryptSecret want one. */
const KEY_ROW = {
  userId: 'user-1',
  shared: false,
  lastUsedAt: null,
  active: true,
  encryptedKey: 'encrypted',
}

vi.mock('@/lib/crypto', () => ({ decryptSecret: () => 'AIza-not-a-real-key' }))
vi.stubGlobal('fetch', fetchMock)

vi.mock('@/db', () => ({
  db: Object.assign(dbMock, {
    select: () => ({ from: () => ({ where: async () => [] }) }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoUpdate: async (arg: { target: unknown; set: Record<string, unknown> }) => {
          upsertSpy(table, values, arg.set)
          return undefined
        },
      }),
    }),
  }),
}))

const { setAiFeatureModel } = await import('./actions')
const { resetModelCatalogCache } = await import('./model-discovery')

describe('setAiFeatureModel', () => {
  beforeEach(() => {
    upsertSpy.mockClear()
    authMock.mockReset()
    authMock.mockResolvedValue({ user: { id: 'user-1' } })
    // The discovered catalog is cached process-wide. Without this, one case's
    // fetch answers the next one's question.
    resetModelCatalogCache()
    fetchMock.mockReset()
  })

  it('accepts a model that only exists because Google says it does', async () => {
    // THE POINT OF THE WHOLE FEATURE. `gemini-9.9-ultra` is named nowhere in
    // this repository. It is accepted because discovery found it, which is
    // exactly what has to happen the day Google ships a model and nobody here
    // has edited a file.
    const keyed = { select: () => ({ from: () => ({ where: async () => [KEY_ROW] }) }) }
    Object.assign(dbMock, keyed)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          {
            name: 'models/gemini-9.9-ultra',
            displayName: 'Gemini 9.9 Ultra',
            supportedGenerationMethods: ['generateContent'],
          },
        ],
      }),
    })

    const res = await setAiFeatureModel('worklog-draft', 'gemini-9.9-ultra')
    expect(res.ok).toBe(true)
    expect(upsertSpy).toHaveBeenCalledTimes(1)

    Object.assign(dbMock, { select: () => ({ from: () => ({ where: async () => [] }) }) })
  })

  it('no longer accepts Gemini 2.5, which this workspace has moved off', async () => {
    // The model was in the hand-written catalog until discovery replaced it.
    // With no key on file the fallback list is what answers, and 2.5 is not
    // on it any more.
    const res = await setAiFeatureModel('worklog-draft', 'gemini-2.5-flash')
    expect(res.ok).toBe(false)
    expect(upsertSpy).not.toHaveBeenCalled()
  })

  it('rejects a model from the wrong kind', async () => {
    // worklog-draft is `text`; TTS models can never serve it.
    const res = await setAiFeatureModel('worklog-draft', 'gemini-3.1-flash-tts-preview')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/cannot serve/i)
    expect(upsertSpy).not.toHaveBeenCalled()
  })

  it('rejects a model from the wrong kind even for a live feature', async () => {
    // live-captions is `live`; a text model can never serve it.
    const res = await setAiFeatureModel('live-captions', 'gemini-3.6-flash')
    expect(res.ok).toBe(false)
    expect(upsertSpy).not.toHaveBeenCalled()
  })

  it('accepts a model that matches the feature kind', async () => {
    const res = await setAiFeatureModel('worklog-draft', 'gemini-3.6-flash')
    expect(res.ok).toBe(true)
    expect(upsertSpy).toHaveBeenCalledTimes(1)
    const [table, values, set] = upsertSpy.mock.calls[0]
    expect(table).toBe(userAiPrefs)
    expect(values).toMatchObject({
      userId: 'user-1',
      feature: 'worklog-draft',
      enabled: true,
      model: 'gemini-3.6-flash',
    })
    // The UPDATE branch must never touch `enabled` — only `model` and
    // `updatedAt` — so picking a model can neither silently disable a
    // feature nor silently re-enable one the user turned off.
    expect(set).not.toHaveProperty('enabled')
    expect(set).toMatchObject({ model: 'gemini-3.6-flash' })
  })

  it('accepts null to reset to the default chain', async () => {
    const res = await setAiFeatureModel('worklog-draft', null)
    expect(res.ok).toBe(true)
    const [, , set] = upsertSpy.mock.calls[0]
    expect(set).toMatchObject({ model: null })
  })

  it('rejects an unknown feature id', async () => {
    // @ts-expect-error deliberately off-type to exercise the runtime guard
    const res = await setAiFeatureModel('not-a-real-feature', 'gemini-3.6-flash')
    expect(res.ok).toBe(false)
  })

  it('requires sign-in', async () => {
    authMock.mockResolvedValue(null)
    const res = await setAiFeatureModel('worklog-draft', 'gemini-3.6-flash')
    expect(res.ok).toBe(false)
    expect(upsertSpy).not.toHaveBeenCalled()
  })
})
