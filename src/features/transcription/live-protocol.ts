// Wire protocol for the Gemini Live API (BidiGenerateContent over WebSocket).
//
// Pure message construction + parsing, deliberately separated from the socket
// itself (live-client.ts) so the protocol can be unit-tested without a network,
// a browser, or a Gemini key.

/** Built-in model, used when no override is configured. */
export const FALLBACK_LIVE_MODEL = 'gemini-3.1-flash-live-preview'

/**
 * Live model in use. Overridable via NEXT_PUBLIC_GEMINI_LIVE_MODEL because Live
 * models are all still Preview and Google renames/retires them on short notice —
 * a model rename should not require an app code change.
 *
 * The env var is spelled out literally rather than looked up dynamically:
 * Next.js inlines NEXT_PUBLIC_* by textual substitution at build time, so a
 * computed key would silently be undefined in the browser bundle.
 */
export const DEFAULT_LIVE_MODEL =
  process.env.NEXT_PUBLIC_GEMINI_LIVE_MODEL || FALLBACK_LIVE_MODEL

/**
 * Second-choice Live model: the 2.5-family native-audio Live preview. Older
 * generation, but it has been available to free-tier keys longer than the
 * 3.1 preview and supports the same transcription-only setup — the "API key
 * failed, use another system" rung between the primary Live model and the
 * Web Speech fallback.
 */
export const SECONDARY_LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025'

/**
 * Live model chain, best first, deduped in case NEXT_PUBLIC_GEMINI_LIVE_MODEL
 * is set to the secondary model itself. mintLiveToken walks this per key:
 * a model the key's project cannot mint for falls through to the next model
 * before the next key is tried.
 */
export const LIVE_MODEL_FALLBACK_ORDER: readonly string[] = [
  ...new Set([DEFAULT_LIVE_MODEL, SECONDARY_LIVE_MODEL]),
]

/** API version the Live socket connects on when nothing overrides it. */
export const FALLBACK_LIVE_WS_VERSION = 'v1beta'

/**
 * API version for the ephemeral-token WebSocket.
 *
 * READ THIS FIRST IF LIVE STOPS CONNECTING. The mint succeeds and then the
 * socket closes? Set NEXT_PUBLIC_GEMINI_LIVE_WS_VERSION=v1alpha and try again
 * before touching anything else. The evidence genuinely points both ways:
 *
 *   v1beta  — Google's ephemeral-token guide states "If you are using
 *             ephemeral tokens, you need to connect to the v1beta endpoint."
 *             This is the documented route, so it is the default.
 *   v1alpha — Google's OWN browser sample for ephemeral tokens
 *             (gemini-live-api-examples, frontend/geminilive.js) still
 *             connects on v1alpha, and both SDKs still print "The SDK's
 *             ephemeral token support is in v1alpha only".
 *
 * Both routes resolve today, which is why running on v1alpha looked fine for
 * as long as it did. The documented one wins the default because an
 * undocumented route is the one that disappears without a deprecation notice —
 * but the disagreement is real, so this is a switch rather than a constant.
 *
 * Spelled out literally, like the model override above: Next.js inlines
 * NEXT_PUBLIC_* by textual substitution at build time, so a computed lookup
 * would be undefined in the browser bundle.
 */
export const LIVE_WS_VERSION =
  process.env.NEXT_PUBLIC_GEMINI_LIVE_WS_VERSION || FALLBACK_LIVE_WS_VERSION

/**
 * Ephemeral-token WebSocket endpoint. It differs from the API-key endpoint in
 * three ways that are all easy to get wrong: the service method is
 * **BidiGenerateContentConstrained** (not BidiGenerateContent), the credential
 * goes in `access_token` (not `key`), and the version is the one above.
 */
export const LIVE_WS_ENDPOINT =
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${LIVE_WS_VERSION}.GenerativeService.BidiGenerateContentConstrained`

export function liveSocketUrl(ephemeralToken: string): string {
  return `${LIVE_WS_ENDPOINT}?access_token=${encodeURIComponent(ephemeralToken)}`
}

/**
 * System instruction for transcription. The code-switching framing here is
 * deliberately carried over from the post-hoc analysis prompt in
 * `src/features/meetings/ai-actions.ts` (the "transcribe each phrase in
 * whichever language it was ACTUALLY spoken in" rules), so the live transcript
 * and the final minutes describe language the same way instead of disagreeing.
 */
export const TRANSCRIPTION_SYSTEM_INSTRUCTION = `You are silently transcribing a Sri Lankan team meeting in real time. Never speak, never answer, never comment — you only transcribe.

Speakers routinely CODE-SWITCH between Sinhala and English — often mid-sentence, sometimes mid-phrase — and that is completely normal for this team, not an error to correct. Transcribe each phrase in whichever language it was ACTUALLY spoken in: Sinhala words in Sinhala script (සිංහල), English words in Latin script, on the same line, exactly as a bilingual person would write it down. Do NOT force-translate the whole thing into one language, and do NOT paraphrase Sinhala into English (or vice versa) just to make the transcript read as a single language — that would misrepresent what was actually said. Technical/product terms that Sinhala speakers commonly say untranslated (e.g. "sprint", "deploy", "bug", "PR", "server", app or feature names) must stay in English/Latin script even inside an otherwise-Sinhala sentence — never transliterate or translate them.`

export type SetupOptions = {
  model?: string
  /** Resumption handle from a previous session, if we are reconnecting. */
  resumptionHandle?: string | null
  systemInstruction?: string
}

/**
 * Builds the `setup` message that must be the first frame on every connection.
 *
 * Three choices here are load-bearing and non-obvious:
 *
 * 1. `inputAudioTranscription: {}` is what makes the server transcribe the
 *    USER's microphone audio and return it as `serverContent.inputTranscription`.
 *    Without it the socket is a voice chatbot and emits nothing we want.
 *
 * 2. `automaticActivityDetection.disabled: true` stops the server's VAD from
 *    deciding the user finished a turn. Because we then never send an
 *    `activityEnd`, the model never takes a turn at all — so it never generates
 *    a reply. That is what turns a conversational API into a pure transcriber,
 *    and it keeps output tokens at ~zero, which matters a lot on a free key.
 *
 * 3. `contextWindowCompression` lifts the hard 15-minute audio-only session cap
 *    to unlimited. Meetings run long; without this the session dies mid-meeting
 *    on a limit that has nothing to do with the ~10-minute socket lifetime.
 */
export function buildSetupMessage(opts: SetupOptions = {}): Record<string, unknown> {
  const setup: Record<string, unknown> = {
    model: `models/${opts.model ?? DEFAULT_LIVE_MODEL}`,
    generationConfig: {
      // TEXT (not AUDIO) so the model never synthesises speech. We also never
      // trigger a turn, so in practice nothing is generated either way — but
      // asking for TEXT means a stray turn costs text tokens, not audio tokens.
      responseModalities: ['TEXT'],
    },
    systemInstruction: {
      parts: [{ text: opts.systemInstruction ?? TRANSCRIPTION_SYSTEM_INSTRUCTION }],
    },
    inputAudioTranscription: {},
    realtimeInputConfig: {
      automaticActivityDetection: { disabled: true },
    },
    contextWindowCompression: { slidingWindow: {} },
    sessionResumption: opts.resumptionHandle
      ? { handle: opts.resumptionHandle }
      : {},
  }
  return { setup }
}

export type AuthTokenRequestOptions = {
  model: string
  /** Clock injected by the caller so this stays pure and testable. */
  nowMs: number
  tokenTtlMs: number
  newSessionTtlMs: number
  /**
   * Handle from the session being resumed, if this mint is for a reconnect.
   * MUST match what the client's setup frame will carry: the pinned config and
   * the frame are compared server-side, and tokens are re-minted per socket,
   * so there is never a reason for them to differ.
   */
  resumptionHandle?: string | null
}

/**
 * Builds the POST body for `v1beta/auth_tokens` (ephemeral token mint).
 *
 * The constraint field is `bidiGenerateContentSetup` — the raw REST name. The
 * @google/genai SDK spells the same thing `liveConnectConstraints`, but that
 * name exists only inside the SDK; the endpoint rejects it with
 * 400 `Unknown name "liveConnectConstraints" at 'auth_token'` BEFORE validating
 * the API key, so using it reads as "no key's project has Live access" when in
 * fact no request was ever considered. Pinning the exact setup message the
 * socket will send is what makes the token safe to hand to a browser: it can
 * open precisely the transcription session we designed and nothing else.
 */
export function buildAuthTokenRequest(opts: AuthTokenRequestOptions): Record<string, unknown> {
  return {
    uses: 1,
    expireTime: new Date(opts.nowMs + opts.tokenTtlMs).toISOString(),
    newSessionExpireTime: new Date(opts.nowMs + opts.newSessionTtlMs).toISOString(),
    bidiGenerateContentSetup: buildSetupMessage({
      model: opts.model,
      resumptionHandle: opts.resumptionHandle,
    }).setup,
  }
}

/** Wraps a base64 PCM chunk in the realtimeInput envelope Live expects. */
export function buildAudioMessage(base64Pcm: string, mimeType: string): Record<string, unknown> {
  return { realtimeInput: { audio: { data: base64Pcm, mimeType } } }
}

/**
 * Every server frame we care about, as a discriminated union. `unknown` covers
 * frames we deliberately ignore (tool calls, model turns) so the caller has a
 * total switch and new frame types can't silently do nothing surprising.
 */
export type LiveServerEvent =
  | { type: 'setupComplete' }
  /**
   * A transcription fragment. `endsTurn` is true when the SAME frame also
   * carried `turnComplete` — the server routinely closes a turn on the frame
   * that delivers its last words, and treating that as text-only would leave
   * the turn permanently in flight: nothing would ever be committed, so the
   * durable transcript (which reads committed text) would stay empty for the
   * whole meeting.
   */
  | { type: 'transcript'; text: string; endsTurn: boolean }
  | { type: 'turnComplete' }
  /** Server is about to close the socket; `timeLeftMs` may be null if unparseable. */
  | { type: 'goAway'; timeLeftMs: number | null }
  /** New resumption handle — store it, it's how we survive the ~10-min socket cap. */
  | { type: 'resumption'; handle: string | null; resumable: boolean }
  | { type: 'unknown' }

/**
 * Parses a raw server frame.
 *
 * Tolerant by design: an unrecognised or malformed frame returns `unknown`
 * rather than throwing, because throwing inside a WebSocket `onmessage` would
 * tear down a recording over a frame we never needed.
 */
export function parseServerEvent(raw: unknown): LiveServerEvent {
  if (typeof raw !== 'object' || raw === null) return { type: 'unknown' }
  const msg = raw as Record<string, unknown>

  if ('setupComplete' in msg) return { type: 'setupComplete' }

  if ('goAway' in msg) {
    const goAway = msg.goAway as Record<string, unknown> | null
    return { type: 'goAway', timeLeftMs: parseDurationMs(goAway?.timeLeft) }
  }

  if ('sessionResumptionUpdate' in msg) {
    const update = msg.sessionResumptionUpdate as Record<string, unknown> | null
    const handle = typeof update?.newHandle === 'string' ? update.newHandle : null
    return { type: 'resumption', handle, resumable: update?.resumable === true }
  }

  if ('serverContent' in msg) {
    const content = msg.serverContent as Record<string, unknown> | null
    const transcription = content?.inputTranscription as Record<string, unknown> | null
    const text = transcription?.text
    const endsTurn = content?.turnComplete === true
    // An empty-string transcript is a real frame but carries no information;
    // treating it as a transcript event would append nothing and churn React.
    if (typeof text === 'string' && text.length > 0) {
      return { type: 'transcript', text, endsTurn }
    }
    if (endsTurn) return { type: 'turnComplete' }
    return { type: 'unknown' }
  }

  return { type: 'unknown' }
}

/**
 * Parses a protobuf duration ("12s", "1.5s") or a plain number of seconds into
 * milliseconds. Returns null when absent or unparseable — callers must treat
 * null as "unknown time left" and reconnect promptly rather than assume a value.
 */
export function parseDurationMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 1000)
  if (typeof value !== 'string') return null
  const match = /^(-?\d+(?:\.\d+)?)s?$/.exec(value.trim())
  if (!match) return null
  const seconds = Number(match[1])
  if (!Number.isFinite(seconds)) return null
  return Math.round(seconds * 1000)
}
