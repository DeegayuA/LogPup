import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * mintLiveToken had NO tests, and that is exactly how the bug below survived:
 * every other layer of the Live path (protocol framing, PCM, the transcript
 * buffer, the session budget) is covered, so a green suite read as a healthy
 * feature while the one function that decides whether Live starts at all was
 * never exercised.
 *
 * These tests drive the mint through mocked HTTP + db so the (key, model)
 * walk can be asserted directly. Nothing here talks to Google or Postgres.
 */

const { fetchMock, selectRows, updates } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  selectRows: { current: [] as Record<string, unknown>[] },
  updates: [] as { set: Record<string, unknown> }[],
}))

vi.stubGlobal('fetch', fetchMock)
vi.mock('@/lib/crypto', () => ({ decryptSecret: (v: string) => (v === '' ? '' : `plain:${v}`) }))
vi.mock('@/features/gemini/usage', () => ({ recordAiUsage: vi.fn() }))

// Real backoff decisions, no real waiting: a 429 walks the full retry
// schedule, and three real sleeps would make this file take ~7 seconds.
vi.mock('@/features/gemini/retry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/gemini/retry')>()),
  sleep: () => Promise.resolve(),
}))

vi.mock('@/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: async () => selectRows.current }) }),
    update: () => ({
      set: (set: Record<string, unknown>) => ({
        where: async () => {
          updates.push({ set })
        },
      }),
    }),
  },
}))

const { mintLiveToken } = await import('./live-token')
const { DEFAULT_LIVE_MODEL, SECONDARY_LIVE_MODEL } = await import('./live-protocol')

function key(overrides: Record<string, unknown> = {}) {
  return {
    id: 'key-1',
    userId: 'user-1',
    label: 'Deeghayu free key',
    last4: '1234',
    encryptedKey: 'enc',
    active: true,
    shared: false,
    lastUsedAt: null,
    failCount: 0,
    ...overrides,
  }
}

/** A non-ok mint response, shaped like Google's google.rpc.Status envelope. */
function refuse(status: number, body: string) {
  return { ok: false, status, headers: { get: () => null }, text: async () => body }
}

const QUOTA_BODY = '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'
const NO_IDENTITY_BODY =
  '{"error":{"code":403,"status":"PERMISSION_DENIED","message":"Method doesn\'t allow unregistered callers"}}'
const BAD_KEY_BODY =
  '{"error":{"code":400,"status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}'

/** A mint response for one model: refused unless the model is in `okFor`. */
function respondPerModel(okFor: string[], status = 429, body = QUOTA_BODY) {
  return async (_url: string, init: { body: string }) => {
    const sent = JSON.parse(init.body) as { bidiGenerateContentSetup: { model: string } }
    const model = sent.bidiGenerateContentSetup.model.replace(/^models\//, '')
    if (okFor.includes(model)) {
      return { ok: true, status: 200, json: async () => ({ name: `auth_tokens/for-${model}` }) }
    }
    return refuse(status, body)
  }
}

beforeEach(() => {
  fetchMock.mockReset()
  updates.length = 0
  selectRows.current = [key()]
})

describe('mintLiveToken model fallback across a per-model refusal', () => {
  it('falls through to the secondary Live model when the primary is rate-limited', async () => {
    // THE REPORTED BUG. Gemini rate-limits PER MODEL, and free-tier Live
    // limits are small — so the primary Live preview answering 429 while the
    // older native-audio preview is fine is an ordinary Tuesday, and
    // SECONDARY_LIVE_MODEL exists for exactly this.
    //
    // The mint used to `break` out of the model loop on the first quota/auth
    // failure, so the second rung of the ladder was unreachable on precisely
    // the failure it was built for. The user got
    // "…rejected, is out of quota, or has no Live API access" seconds into a
    // recording, having never tried the model that would have worked.
    fetchMock.mockImplementation(respondPerModel([SECONDARY_LIVE_MODEL]))

    const minted = await mintLiveToken('user-1')

    expect(minted.model).toBe(SECONDARY_LIVE_MODEL)
    expect(minted.token).toBe(`auth_tokens/for-${SECONDARY_LIVE_MODEL}`)
  })

  it('does not blame the key when only the primary model was refused', async () => {
    // A key that successfully mints on ANY model is a working key. Bumping
    // failCount here is what drives readiness.ts to report "all your Gemini
    // keys keep failing" across Settings while meeting-intel, worklog drafts
    // and read-aloud are all still working on that same key.
    fetchMock.mockImplementation(respondPerModel([SECONDARY_LIVE_MODEL]))

    await mintLiveToken('user-1')

    const bumps = updates.filter((u) => u.set.failCount !== 0)
    expect(bumps).toEqual([])
  })

  it('walks every model before rotating to the next key', async () => {
    fetchMock.mockImplementation(respondPerModel([SECONDARY_LIVE_MODEL]))

    await mintLiveToken('user-1')

    // Deduped in order: a 429 burns the full retry schedule on the primary
    // before the chain advances, so the raw call list repeats it. What this
    // asserts is the ORDER models were reached in, not the attempt count.
    const modelsTried = [
      ...new Set(
        fetchMock.mock.calls.map((call) => JSON.parse(call[1].body).bidiGenerateContentSetup.model),
      ),
    ]
    expect(modelsTried).toEqual([`models/${DEFAULT_LIVE_MODEL}`, `models/${SECONDARY_LIVE_MODEL}`])
  })
})

describe('mintLiveToken when nothing works', () => {
  it('bumps failCount exactly once per key, not once per model', async () => {
    // A genuinely rejected key. Note the status: auth_tokens answers a bad key
    // with 400 + API_KEY_INVALID, NOT 401/403 — the conventional mapping is
    // wrong for this endpoint.
    fetchMock.mockImplementation(respondPerModel([], 400, BAD_KEY_BODY))

    await expect(mintLiveToken('user-1')).rejects.toThrow(/rejected|quota|Live API access/)

    const bumps = updates.filter((u) => u.set.failCount !== 0)
    expect(bumps).toHaveLength(1)
  })

  it('rotates to the next key and mints there', async () => {
    selectRows.current = [
      key({ id: 'key-1', label: 'dead', encryptedKey: 'dead', lastUsedAt: new Date(1) }),
      key({ id: 'key-2', label: 'live', encryptedKey: 'good', lastUsedAt: new Date(2) }),
    ]
    fetchMock.mockImplementation(async (_url: string, init: { headers: Record<string, string>; body: string }) => {
      const usable = init.headers['X-goog-api-key'] === 'plain:good'
      const model = JSON.parse(init.body).bidiGenerateContentSetup.model.replace(/^models\//, '')
      if (usable && model === SECONDARY_LIVE_MODEL) {
        return { ok: true, status: 200, json: async () => ({ name: 'auth_tokens/second-key' }) }
      }
      return refuse(400, BAD_KEY_BODY)
    })

    const minted = await mintLiveToken('user-1')

    expect(minted.token).toBe('auth_tokens/second-key')
  })
})

describe('mintLiveToken diagnostics', () => {
  it('preserves the upstream reason instead of discarding the body', async () => {
    // A 401/403 body carries the only machine-readable statement of WHY
    // (PERMISSION_DENIED vs API_KEY_INVALID vs SERVICE_DISABLED). Throwing it
    // away is what left one generic sentence as the entire diagnosis of a
    // failure the user cannot otherwise investigate.
    const logged: unknown[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      logged.push(args.join(' '))
    })
    fetchMock.mockImplementation(respondPerModel([], 400, BAD_KEY_BODY))

    await expect(mintLiveToken('user-1')).rejects.toThrow()
    spy.mockRestore()

    expect(logged.join('\n')).toMatch(/API_KEY_INVALID/)
  })

  it('logs a protocol 400 even when another model also failed key-level', async () => {
    // THE MIXED-POOL CASE, which is the realistic one under BYOK. The terminal
    // branches are ordered by what to TELL THE USER (auth, then busy, then
    // bad); a developer needs the opposite order. While `lastBadMessage` was
    // only read inside the BAD_RESPONSE branch, one bad key in the pool was
    // enough to make a genuine protocol regression invisible AND to report it
    // as "your key was rejected".
    //
    // That is exactly how the `liveConnectConstraints` field-name bug hid: a
    // 400 that says "Unknown name ... Cannot find field" is the single most
    // actionable line in the whole failure, and it was being discarded.
    const logged: string[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      logged.push(args.join(' '))
    })
    fetchMock.mockImplementation(async (_url: string, init: { body: string }) => {
      const model = JSON.parse(init.body).bidiGenerateContentSetup.model.replace(/^models\//, '')
      if (model === DEFAULT_LIVE_MODEL) {
        return refuse(400, '{"error":{"message":"Unknown name \\"liveConnectConstraints\\""}}')
      }
      return refuse(400, BAD_KEY_BODY)
    })

    await expect(mintLiveToken('user-1')).rejects.toThrow()
    spy.mockRestore()

    expect(logged.join('\n')).toMatch(/liveConnectConstraints/)
  })
})


describe('a 403 is not the user\'s key', () => {
  it('reports our own missing credential as our problem, and does not blame any key', async () => {
    // Probing the real endpoint: 403 PERMISSION_DENIED at auth_tokens means
    // "Method doesn't allow unregistered callers" — NO identity reached
    // Google. It is not evidence about the key, because the key was never
    // presented. Reporting it as "your Gemini key was rejected" sends someone
    // to replace a perfectly good key over a bug in this file.
    fetchMock.mockImplementation(respondPerModel([], 403, NO_IDENTITY_BODY))

    await expect(mintLiveToken('user-1')).rejects.toThrow(/problem on our side, not your key/)

    const bumps = updates.filter((u) => u.set.failCount !== 0)
    expect(bumps).toEqual([])
  })

  it('still blames the key for a real API_KEY_INVALID', async () => {
    fetchMock.mockImplementation(respondPerModel([], 400, BAD_KEY_BODY))

    await expect(mintLiveToken('user-1')).rejects.toThrow(/rejected|quota|Live API access/)

    expect(updates.filter((u) => u.set.failCount !== 0)).toHaveLength(1)
  })
})

describe('a key that decrypts to nothing', () => {
  it('is skipped and named, rather than sent as a blank credential', async () => {
    // The likeliest way a mint ends up with no credential at all — and the
    // cause the 403 above would otherwise be misattributed to.
    const logged: string[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      logged.push(args.join(' '))
    })
    selectRows.current = [key({ encryptedKey: '' })]
    fetchMock.mockImplementation(respondPerModel([]))

    await expect(mintLiveToken('user-1')).rejects.toThrow()
    spy.mockRestore()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(logged.join('\n')).toMatch(/decrypted to an empty string/)
  })
})
