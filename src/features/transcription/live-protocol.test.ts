import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LIVE_MODEL,
  TRANSCRIPTION_SYSTEM_INSTRUCTION,
  buildAudioMessage,
  buildAuthTokenRequest,
  buildSetupMessage,
  liveSocketUrl,
  parseDurationMs,
  parseServerEvent,
} from './live-protocol'

describe('liveSocketUrl', () => {
  it('uses the constrained v1alpha endpoint with an access_token param', () => {
    // Getting any of these three wrong (v1beta, BidiGenerateContent, ?key=)
    // fails only at runtime against a real token, so pin them here.
    const url = liveSocketUrl('tok')
    expect(url).toContain('v1alpha')
    expect(url).toContain('BidiGenerateContentConstrained')
    expect(url).toContain('access_token=tok')
    expect(url).not.toContain('key=tok')
  })

  it('percent-encodes a token containing URL-significant characters', () => {
    expect(liveSocketUrl('a/b+c=d')).toContain('access_token=a%2Fb%2Bc%3Dd')
  })
})

describe('buildSetupMessage', () => {
  const setup = () => buildSetupMessage().setup as Record<string, unknown>

  it('prefixes the model with models/', () => {
    expect(setup().model).toBe(`models/${DEFAULT_LIVE_MODEL}`)
  })

  it('enables input audio transcription — without it the socket emits nothing we want', () => {
    expect(setup().inputAudioTranscription).toEqual({})
  })

  it('disables automatic activity detection so the model never takes a turn', () => {
    // This is what turns a conversational API into a pure transcriber and keeps
    // output tokens at ~zero, which is what makes it viable on a free key.
    expect(setup().realtimeInputConfig).toEqual({
      automaticActivityDetection: { disabled: true },
    })
  })

  it('requests TEXT rather than AUDIO responses', () => {
    expect(setup().generationConfig).toEqual({ responseModalities: ['TEXT'] })
  })

  it('enables context window compression to lift the 15-minute session cap', () => {
    expect(setup().contextWindowCompression).toEqual({ slidingWindow: {} })
  })

  it('carries the Sinhala/English code-switching instruction', () => {
    const instruction = setup().systemInstruction as { parts: { text: string }[] }
    expect(instruction.parts[0].text).toBe(TRANSCRIPTION_SYSTEM_INSTRUCTION)
    expect(instruction.parts[0].text).toContain('CODE-SWITCH')
    expect(instruction.parts[0].text).toContain('සිංහල')
  })

  it('requests a fresh session when no resumption handle is held', () => {
    expect(setup().sessionResumption).toEqual({})
  })

  it('passes a resumption handle through when reconnecting', () => {
    const withHandle = buildSetupMessage({ resumptionHandle: 'h-1' }).setup as Record<string, unknown>
    expect(withHandle.sessionResumption).toEqual({ handle: 'h-1' })
  })

  it('honours a model override', () => {
    const custom = buildSetupMessage({ model: 'other-model' }).setup as Record<string, unknown>
    expect(custom.model).toBe('models/other-model')
  })
})

describe('buildAuthTokenRequest', () => {
  const NOW = Date.parse('2026-08-22T10:00:00.000Z')
  const request = () =>
    buildAuthTokenRequest({
      model: 'gemini-3.1-flash-live-preview',
      nowMs: NOW,
      tokenTtlMs: 600_000,
      newSessionTtlMs: 120_000,
    })

  it('pins the setup under bidiGenerateContentSetup — the REST field name', () => {
    // The SDK spells this `liveConnectConstraints`, but that name exists only
    // inside @google/genai: the raw v1beta/auth_tokens endpoint rejects it with
    // 400 `Unknown name "liveConnectConstraints"` before even checking the API
    // key, which took Live down for every key and every model at once.
    const body = request()
    expect(body.bidiGenerateContentSetup).toBeDefined()
    expect(body).not.toHaveProperty('liveConnectConstraints')
  })

  it('pins the exact setup message the socket will send', () => {
    expect(request().bidiGenerateContentSetup).toEqual(
      buildSetupMessage({ model: 'gemini-3.1-flash-live-preview' }).setup,
    )
  })

  it('is single-use with both expiry horizons as RFC 3339 timestamps', () => {
    const body = request()
    expect(body.uses).toBe(1)
    expect(body.expireTime).toBe('2026-08-22T10:10:00.000Z')
    expect(body.newSessionExpireTime).toBe('2026-08-22T10:02:00.000Z')
  })

  it('pins the resumption handle so a reconnect mint matches the frame the client sends', () => {
    // Tokens are re-minted per socket. On reconnect the client's setup frame
    // carries the resumption handle — the pinned config must say the same
    // thing, or a strict constraint check would kill every ~10-minute rollover.
    const body = buildAuthTokenRequest({
      model: 'm',
      nowMs: NOW,
      tokenTtlMs: 600_000,
      newSessionTtlMs: 120_000,
      resumptionHandle: 'h-9',
    })
    const setup = body.bidiGenerateContentSetup as Record<string, unknown>
    expect(setup.sessionResumption).toEqual({ handle: 'h-9' })
  })
})

describe('buildAudioMessage', () => {
  it('wraps the chunk in a realtimeInput envelope', () => {
    expect(buildAudioMessage('AAA', 'audio/pcm;rate=16000')).toEqual({
      realtimeInput: { audio: { data: 'AAA', mimeType: 'audio/pcm;rate=16000' } },
    })
  })
})

describe('parseServerEvent', () => {
  it('recognises setup completion', () => {
    expect(parseServerEvent({ setupComplete: {} })).toEqual({ type: 'setupComplete' })
  })

  it('extracts the user transcription from serverContent', () => {
    const event = parseServerEvent({
      serverContent: { inputTranscription: { text: 'ayubowan' } },
    })
    expect(event).toEqual({ type: 'transcript', text: 'ayubowan', endsTurn: false })
  })

  it('reports a turn that ends on the same frame as its last words', () => {
    // The server routinely closes a turn on the frame carrying its final
    // fragment. Reading that as text-only left the turn in flight forever, so
    // nothing was ever committed and the durable transcript — which is built
    // from committed text — stayed empty for the whole meeting.
    expect(
      parseServerEvent({
        serverContent: { inputTranscription: { text: 'ayubowan' }, turnComplete: true },
      }),
    ).toEqual({ type: 'transcript', text: 'ayubowan', endsTurn: true })
  })

  it('ignores an empty transcription rather than emitting a no-op update', () => {
    expect(parseServerEvent({ serverContent: { inputTranscription: { text: '' } } })).toEqual({
      type: 'unknown',
    })
  })

  it('does NOT treat the model output transcription as user speech', () => {
    // outputTranscription is the model talking. Mistaking it for the user would
    // inject invented text straight into the meeting minutes.
    expect(parseServerEvent({ serverContent: { outputTranscription: { text: 'hi' } } })).toEqual({
      type: 'unknown',
    })
  })

  it('recognises a turn boundary', () => {
    expect(parseServerEvent({ serverContent: { turnComplete: true } })).toEqual({
      type: 'turnComplete',
    })
  })

  it('parses a goAway with its remaining time', () => {
    expect(parseServerEvent({ goAway: { timeLeft: '12s' } })).toEqual({
      type: 'goAway',
      timeLeftMs: 12000,
    })
  })

  it('reports a goAway with unparseable time as unknown time left, not zero', () => {
    expect(parseServerEvent({ goAway: {} })).toEqual({ type: 'goAway', timeLeftMs: null })
  })

  it('captures a session resumption handle', () => {
    expect(
      parseServerEvent({ sessionResumptionUpdate: { newHandle: 'h-9', resumable: true } }),
    ).toEqual({ type: 'resumption', handle: 'h-9', resumable: true })
  })

  it('treats malformed and unknown frames as unknown instead of throwing', () => {
    // Throwing inside onmessage would tear down a recording over a frame we
    // never needed.
    for (const input of [null, undefined, 42, 'text', {}, { toolCall: {} }]) {
      expect(() => parseServerEvent(input)).not.toThrow()
      expect(parseServerEvent(input).type).toBe('unknown')
    }
  })
})

describe('parseDurationMs', () => {
  it('parses protobuf duration strings', () => {
    expect(parseDurationMs('5s')).toBe(5000)
    expect(parseDurationMs('1.5s')).toBe(1500)
    expect(parseDurationMs('7')).toBe(7000)
  })

  it('accepts a plain number of seconds', () => {
    expect(parseDurationMs(3)).toBe(3000)
  })

  it('returns null for anything unparseable', () => {
    for (const input of [null, undefined, '', 'soon', {}, Number.NaN]) {
      expect(parseDurationMs(input)).toBeNull()
    }
  })
})
