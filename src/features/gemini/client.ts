import { and, eq, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { geminiKeys } from '@/db/schema'
import { decryptSecret } from '@/lib/crypto'
import { MAX_ATTEMPTS, backoffDelayMs, shouldRetry, sleep } from '@/features/gemini/retry'
import { shouldUseInlineAudio } from '@/features/gemini/audio-strategy'
import { orderKeysForRotation } from '@/features/gemini/rotation'
import { recordAiUsage } from '@/features/gemini/usage'
import type { AiCallSlug } from '@/features/gemini/ai-features'

// Pinned to an explicit version rather than a moving "-latest" alias so model
// behaviour (and the prompts tuned against it) stays stable until deliberately bumped.
export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash'
// Fallback covers two cases: the primary being persistently overloaded (503
// after exhausting retries), and the pinned version being retired or unavailable
// on a given key's project — the moving alias always resolves to a live flash
// model, so a version pin can never hard-fail the whole feature.
export const FALLBACK_GEMINI_MODEL = 'gemini-flash-latest'
export const GEMINI_MODEL_FALLBACK_ORDER: readonly string[] = [
  DEFAULT_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
]

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export type GeminiErrorCode =
  | 'NO_KEYS'
  | 'TRANSIENT_BUSY'
  | 'AUTH_FAILED'
  | 'BAD_RESPONSE'
  | 'ALL_KEYS_FAILED'

export class GeminiError extends Error {
  code: GeminiErrorCode
  constructor(code: GeminiErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { fileData: { mimeType: string; fileUri: string } }

// Either a fixed set of parts, or a builder invoked with the specific API key
// about to be used. The builder form exists for audio uploaded via the Files
// API (see uploadAudioFile below): an uploaded file is scoped to the API
// key/project that uploaded it, so if callGemini rolls to a different key
// after a failure, the part has to be rebuilt (re-uploaded) under that key —
// a plain fixed-parts array can't express that.
type GeminiPartsInput = GeminiPart[] | ((apiKey: string) => Promise<GeminiPart[]>)

export async function hasGeminiKeys(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: geminiKeys.id })
    .from(geminiKeys)
    .where(and(eq(geminiKeys.userId, userId), eq(geminiKeys.active, true)))
    .limit(1)
  return Boolean(row)
}

/** Cheap credential check — lists one model, costs no tokens. */
export async function validateGeminiKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/models?pageSize=1`, {
      headers: { 'X-goog-api-key': apiKey },
    })
    return res.ok
  } catch {
    return false
  }
}

// Result of a single (key, model) call, after that call's own retry loop
// has been exhausted. `kind` classifies the failure for the outer loop in
// callGemini: 'auth' and 'quota' mean "this key is the problem, try the
// next one"; 'overloaded' means "this model is the problem, try the
// fallback model (same key) before rotating keys"; 'bad' is a non-retriable,
// non-key-specific failure (malformed request, empty response) that stops
// the whole call immediately — trying another key or model won't help.
type ModelAttemptResult<T> =
  | { ok: true; value: T; usage: { inputTokens: number; outputTokens: number } }
  | { ok: false; kind: 'auth' | 'quota' | 'overloaded' | 'missing' | 'bad'; message: string }

/** Raw generateContent response shape — extractors pull what they need out of it. */
type GenerateContentResponse = {
  candidates?: {
    content?: { parts?: { text?: string; inlineData?: { mimeType?: string; data?: string } }[] }
  }[]
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    thoughtsTokenCount?: number
  }
}

/**
 * Pulls the caller's payload out of a 200 response. Returning null means
 * "well-formed HTTP but nothing usable in it" — mapped to the same
 * non-retriable 'bad' failure an empty text response has always been.
 */
type ResponseExtractor<T> = (json: GenerateContentResponse) => T | null

/** The original behaviour: concatenate every text part of the first candidate. */
const extractText: ResponseExtractor<string> = (json) => {
  const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('')
  return text ? text : null
}

export type GeminiSpeechAudio = { audioBase64: string; mimeType: string }

/** For TTS calls: the first inline audio blob of the first candidate. */
const extractInlineAudio: ResponseExtractor<GeminiSpeechAudio> = (json) => {
  for (const part of json.candidates?.[0]?.content?.parts ?? []) {
    const data = part.inlineData?.data
    if (typeof data === 'string' && data.length > 0) {
      return { audioBase64: data, mimeType: part.inlineData?.mimeType || 'audio/pcm' }
    }
  }
  return null
}

/**
 * Calls generateContent for one (key, model) pair, retrying in-place on
 * RETRIABLE failures (502/503/504/429, network/timeout) per the policy in
 * retry.ts. `maxAttempts` defaults to the full policy cap; the model
 * fallback pass in callGemini passes 1 for a single last-resort attempt
 * rather than a whole second retry cycle (see call site).
 */
async function callModelWithRetry<T>(
  apiKey: string,
  model: string,
  parts: GeminiPart[],
  generationConfig: Record<string, unknown> | undefined,
  extract: ResponseExtractor<T>,
  keyLabel: string,
  maxAttempts: number = MAX_ATTEMPTS,
): Promise<ModelAttemptResult<T>> {
  let attempt = 0
  let retryAfter: string | null = null

  while (true) {
    attempt += 1

    let res: Response
    try {
      res = await fetch(`${API_BASE}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts }],
          ...(generationConfig ? { generationConfig } : {}),
        }),
      })
    } catch (networkError) {
      const message = networkError instanceof Error ? networkError.message : 'network error'
      if (shouldRetry(null, attempt, maxAttempts)) {
        await sleep(backoffDelayMs(attempt, null))
        continue
      }
      return { ok: false, kind: 'overloaded', message: `Network error calling Gemini: ${message}` }
    }

    if (res.ok) {
      const json = (await res.json()) as GenerateContentResponse
      const value = extract(json)
      if (value === null) {
        return { ok: false, kind: 'bad', message: 'Gemini returned an empty response' }
      }
      return {
        ok: true,
        value,
        usage: {
          inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
          // Gemini 3.x thinking models bill reasoning tokens separately via
          // thoughtsTokenCount, which is NOT folded into candidatesTokenCount —
          // they're still output the caller pays for, so they belong in the
          // same total. Dropping this "simplification" undercounts every
          // dollar figure the usage ledger reports for a thinking-capable chain.
          outputTokens:
            (json.usageMetadata?.candidatesTokenCount ?? 0) +
            (json.usageMetadata?.thoughtsTokenCount ?? 0),
        },
      }
    }

    retryAfter = res.headers.get('retry-after')

    // 401/403 are never retried (see retry.ts) — a bad/unauthorized key
    // fails identically every time, so classify immediately as 'auth'.
    if (res.status === 401 || res.status === 403) {
      return { ok: false, kind: 'auth', message: `Key "${keyLabel}" got HTTP ${res.status}` }
    }

    // 404 means THIS MODEL does not exist for this key's project — a renamed
    // or retired preview, or a model the project has no access to. That is
    // precisely what the fallback chain exists for, so it must not fall
    // through to the 'bad' branch below, which aborts the whole call and
    // would take every remaining model with it. Preview models (Live, TTS)
    // get renamed on short notice, so this is the common case, not a corner.
    if (res.status === 404) {
      return {
        ok: false,
        kind: 'missing',
        message: `Gemini model "${model}" is unavailable on this key (HTTP 404)`,
      }
    }

    if (shouldRetry(res.status, attempt, maxAttempts)) {
      await sleep(backoffDelayMs(attempt, retryAfter))
      continue
    }

    if (res.status === 429) {
      return {
        ok: false,
        kind: 'quota',
        message: `Key "${keyLabel}" still rate/quota-limited (429) after ${attempt} attempt(s)`,
      }
    }
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      return {
        ok: false,
        kind: 'overloaded',
        message: `Gemini model "${model}" overloaded (HTTP ${res.status}) after ${attempt} attempt(s)`,
      }
    }

    const body = await res.text().catch(() => '')
    return { ok: false, kind: 'bad', message: `Gemini error ${res.status}: ${body.slice(0, 300)}` }
  }
}

/**
 * Calls generateContent, rolling across active keys in this order: the
 * caller's own keys first (least-recently-used first, never-used before
 * used), then org-shared keys owned by teammates, same LRU rule — see
 * orderKeysForRotation. A caller with working keys of their own never
 * touches a teammate's shared quota; the pool is only reached once the
 * caller's own keys are exhausted, and this function writes THAT key's
 * failCount/lastUsedAt regardless of who owns it — a call can spend, and
 * report against, a teammate's free-tier allowance.
 *
 * Reliability layers, in order, for a transient upstream failure:
 *  1. Retry with backoff on the same (key, model) — see retry.ts.
 *  2. If the primary model is still overloaded after that, fall back to
 *     GEMINI_MODEL_FALLBACK_ORDER's next model, same key, one last attempt.
 *  3. If that key is exhausted (auth/quota failure, or every model
 *     overloaded), roll to the user's next active key and repeat.
 *
 * A key that answers 401/403, or 429 that persists through its retries,
 * gets its failCount bumped and the next key is tried — same bookkeeping
 * semantics as before this change (failCount+1 + lastUsedAt on failure,
 * failCount reset to 0 + lastUsedAt on success).
 */
export async function callGemini(
  userId: string,
  partsInput: GeminiPartsInput,
  opts: { model?: string; models?: readonly string[]; responseJson?: boolean; feature: AiCallSlug },
): Promise<{ text: string; model: string }> {
  const { value: text, model } = await callGeminiCore(
    userId,
    partsInput,
    resolveModelChain(opts),
    opts.responseJson ? { responseMimeType: 'application/json' } : undefined,
    extractText,
    opts.feature,
  )
  return { text, model }
}

/**
 * The model chain one call walks: an explicit `models` chain wins, a pinned
 * `model` disables fallback entirely (unchanged semantics), and the default
 * stays GEMINI_MODEL_FALLBACK_ORDER. Task-specific chains live in models.ts —
 * this is just the resolution rule.
 */
function resolveModelChain(opts?: { model?: string; models?: readonly string[] }): readonly string[] {
  if (opts?.models && opts.models.length > 0) return opts.models
  if (opts?.model) return [opts.model]
  return GEMINI_MODEL_FALLBACK_ORDER
}

/**
 * Records a blocked-call ledger row and returns the error unchanged, so every
 * throw site in callGeminiCore can wrap its GeminiError in one call:
 * `throw recordFailure(feature, userId, models, err)`. A blocked call is
 * exactly the kind of event Settings and the adoption panel should count.
 */
function recordFailure(
  feature: AiCallSlug,
  userId: string,
  models: readonly string[],
  error: GeminiError,
): GeminiError {
  recordAiUsage({ userId, feature, model: models[0] ?? 'unknown', status: error.code })
  return error
}

/**
 * Generic core of every non-streaming Gemini call: key rotation, per-model
 * retry, model fallback, and failCount/lastUsedAt bookkeeping — with the
 * response payload abstracted behind `extract` so text calls (callGemini)
 * and audio-out TTS calls (callGeminiSpeech) share one reliability path
 * instead of growing a third copy of this loop (live-token.ts already has
 * the second, constrained by a different endpoint).
 */
async function callGeminiCore<T>(
  userId: string,
  partsInput: GeminiPartsInput,
  models: readonly string[],
  generationConfig: Record<string, unknown> | undefined,
  extract: ResponseExtractor<T>,
  feature: AiCallSlug,
): Promise<{ value: T; model: string }> {
  const rows = await db
    .select()
    .from(geminiKeys)
    .where(
      and(
        eq(geminiKeys.active, true),
        or(eq(geminiKeys.userId, userId), eq(geminiKeys.shared, true)),
      ),
    )
  // Own keys first (LRU), then org-shared keys (LRU) — a caller with
  // working keys of their own never drains a teammate's shared quota.
  const keys = orderKeysForRotation(userId, rows)
  const usedSharedPool = keys.some((key) => key.userId !== userId)

  if (keys.length === 0) {
    throw recordFailure(
      feature,
      userId,
      models,
      new GeminiError(
        'NO_KEYS',
        'No active Gemini API keys — add one in Profile (or ask a teammate to share one).',
      ),
    )
  }

  // Tracks *why* every key ultimately failed, so the final error message is
  // accurate: a key problem (bad/expired/quota-exhausted key) gets a
  // different, more actionable message than every model being overloaded.
  let sawAuthFailure = false
  let sawTransientBusy = false
  // Set when every model in the chain answered 404 — a retired/renamed
  // preview or one this project has no access to. Retrying that in a minute
  // will never help, so it must not be reported as "everything is busy".
  let missingModelMessage: string | null = null

  for (const key of keys) {
    let apiKey: string
    try {
      apiKey = decryptSecret(key.encryptedKey)
    } catch {
      continue // corrupted row — try the next key, nothing to bump here
    }

    let parts: GeminiPart[]
    try {
      parts = typeof partsInput === 'function' ? await partsInput(apiKey) : partsInput
    } catch {
      // Building the parts failed for this key (e.g. the Files API upload
      // below threw) — not evidence the key itself is bad, so don't bump
      // failCount; just try the next key the same way an overloaded model
      // would be treated.
      sawTransientBusy = true
      continue
    }

    // Set when a model on THIS key answered 401/403/429. Only meaningful
    // once every model has been tried — see the auth/quota branch below.
    let keyLevelFailure = false

    for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
      const model = models[modelIndex]
      const isFallbackPass = modelIndex > 0
      // The fallback model gets exactly one last-resort attempt (not a
      // full second retry cycle) — by the time we reach it, the primary
      // model has already burned through the full backoff schedule, so
      // stacking another full cycle would make a busy period feel very
      // slow to the user for little extra benefit.
      const maxAttempts = isFallbackPass ? 1 : MAX_ATTEMPTS
      const result = await callModelWithRetry(
        apiKey,
        model,
        parts,
        generationConfig,
        extract,
        key.label,
        maxAttempts,
      )

      if (result.ok) {
        await db
          .update(geminiKeys)
          .set({ lastUsedAt: new Date(), failCount: 0 })
          .where(eq(geminiKeys.id, key.id))
        recordAiUsage({
          userId,
          keyId: key.id,
          keyOwnerId: key.userId,
          keyLast4: key.last4,
          feature,
          model,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          status: 'ok',
        })
        return { value: result.value, model }
      }

      if (result.kind === 'bad') {
        // Non-retriable, not key- or model-specific (malformed request,
        // empty response) — no other key or model would fare better.
        throw recordFailure(feature, userId, models, new GeminiError('BAD_RESPONSE', result.message))
      }

      if (result.kind === 'auth' || result.kind === 'quota') {
        // NOT necessarily key-level, which is why this no longer abandons the
        // key on the spot. Gemini rate-limits PER MODEL, and the premium
        // tiers far harder than flash — so a 429, or a 403 from a project
        // without access to a preview model, on the FIRST entry of a
        // Pro-first chain says nothing about whether flash would work on the
        // same key. Breaking here meant one busy Pro model could fail a
        // meeting write-up outright for someone whose key was perfectly fine.
        //
        // The bookkeeping is deferred, not dropped: if no model on this key
        // succeeds, failCount is bumped once after the loop.
        keyLevelFailure = true
        continue
      }

      if (result.kind === 'missing') {
        // This model is gone, not busy — try the next model on this key.
        missingModelMessage = result.message
        continue
      }

      // result.kind === 'overloaded' — fall through to try the next model
      // in the chain (still this key). If this was already the last model,
      // the loop ends and we roll to the next key below without touching
      // failCount: the key itself isn't at fault.
      sawTransientBusy = true
    }

    // Every model on this key was refused with an auth/quota error, so the
    // key really is the problem — bump it here, once, rather than per model.
    if (keyLevelFailure) {
      sawAuthFailure = true
      await db
        .update(geminiKeys)
        .set({ failCount: sql`${geminiKeys.failCount} + 1`, lastUsedAt: new Date() })
        .where(eq(geminiKeys.id, key.id))
    }
  }

  if (sawAuthFailure) {
    throw recordFailure(
      feature,
      userId,
      models,
      new GeminiError(
        'AUTH_FAILED',
        usedSharedPool
          ? "Your key and your team's shared keys were all rejected or have hit their usage limit — check Profile → Gemini API keys, or ask the teammate who shared a key to check theirs."
          : 'Your Gemini key was rejected or has hit its usage limit — check Profile → Gemini API keys.',
      ),
    )
  }
  if (sawTransientBusy) {
    throw recordFailure(
      feature,
      userId,
      models,
      new GeminiError(
        'TRANSIENT_BUSY',
        usedSharedPool
          ? "All Gemini models are busy right now, on your key and your team's shared keys — your recording is saved, try Analyze again in a minute."
          : 'All Gemini models are busy right now — your recording is saved, try Analyze again in a minute.',
      ),
    )
  }
  if (missingModelMessage) {
    // Not transient and not the user's key: a model this build asks for no
    // longer exists. Says so plainly rather than inviting a retry that will
    // fail identically forever.
    throw recordFailure(
      feature,
      userId,
      models,
      new GeminiError(
        'BAD_RESPONSE',
        `${missingModelMessage} — LogPup needs its Gemini model list updated.`,
      ),
    )
  }
  throw recordFailure(
    feature,
    userId,
    models,
    new GeminiError(
      'ALL_KEYS_FAILED',
      usedSharedPool
        ? 'Could not reach Gemini with any saved or org-shared key — check Profile → Gemini API keys or try again shortly.'
        : 'Could not reach Gemini with any saved key — check Profile → Gemini API keys or try again shortly.',
    ),
  )
}

/**
 * Text-to-speech: generateContent with AUDIO response modality against the
 * TTS model chain. Returns base64 PCM (Gemini TTS emits 24kHz mono 16-bit —
 * see speech/wav.ts for the playable-WAV wrapping) plus the mimeType Gemini
 * declared. Same keys, same rotation, same failure taxonomy as callGemini —
 * a TTS-capable model chain is the only difference, so pass one from
 * models.ts (TTS_MODEL_FALLBACK_ORDER); there is no sensible default chain
 * here because DEFAULT_GEMINI_MODEL cannot speak.
 */
export async function callGeminiSpeech(
  userId: string,
  text: string,
  opts: { models: readonly string[]; voiceName?: string; feature: AiCallSlug },
): Promise<GeminiSpeechAudio & { model: string }> {
  const { value, model } = await callGeminiCore(
    userId,
    [{ text }],
    opts.models,
    {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: opts.voiceName ?? 'Kore' } },
      },
    },
    extractInlineAudio,
    opts.feature,
  )
  return { ...value, model }
}

const FILES_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const FILES_UPLOAD_URL = 'https://generativelanguage.googleapis.com/upload/v1beta/files'
// How long to wait for a just-uploaded file to leave PROCESSING state before
// giving up and using it anyway (generateContent will itself reject it if
// it's genuinely not ready). Audio (unlike video) is typically ACTIVE within
// a second or two, so this is a short poll, not a real wait loop.
const FILE_ACTIVE_POLL_ATTEMPTS = 5
const FILE_ACTIVE_POLL_DELAY_MS = 500

type GeminiFile = { name: string; uri: string; mimeType: string; state: string }

/**
 * Uploads bytes (audio or, since keyframes, images) to Gemini's Files API
 * and returns a { mimeType, fileUri } reference for a generateContent
 * `fileData` part — used instead of inlineData for anything over the inline
 * size ceiling (shouldUseInlineAudio, audio-strategy.ts; reused unchanged
 * for images, see buildImagePart below). Files uploaded this way expire
 * ~48h after upload (a fixed Gemini retention window, not configurable) — a
 * non-issue here since a segment/keyframe is referenced once, within
 * seconds of being uploaded, and never again.
 */
async function uploadFileToGemini(
  apiKey: string,
  bytes: Buffer,
  mimeType: string,
  displayName: string,
): Promise<{ mimeType: string; fileUri: string }> {
  const form = new FormData()
  form.append(
    'metadata',
    new Blob([JSON.stringify({ file: { displayName } })], {
      type: 'application/json',
    }),
  )
  form.append('file', new Blob([new Uint8Array(bytes)], { type: mimeType }))

  const uploadRes = await fetch(FILES_UPLOAD_URL, {
    method: 'POST',
    headers: { 'X-goog-api-key': apiKey, 'X-Goog-Upload-Protocol': 'multipart' },
    body: form,
  })
  if (!uploadRes.ok) {
    const body = await uploadRes.text().catch(() => '')
    throw new Error(`Gemini file upload failed (HTTP ${uploadRes.status}): ${body.slice(0, 300)}`)
  }
  const { file } = (await uploadRes.json()) as { file: GeminiFile }

  let current = file
  for (
    let attempt = 0;
    attempt < FILE_ACTIVE_POLL_ATTEMPTS && current.state === 'PROCESSING';
    attempt += 1
  ) {
    await sleep(FILE_ACTIVE_POLL_DELAY_MS)
    const statusRes = await fetch(`${FILES_API_BASE}/${current.name}`, {
      headers: { 'X-goog-api-key': apiKey },
    })
    if (!statusRes.ok) break // use whatever state we last had — generateContent is the real gate
    current = (await statusRes.json()) as GeminiFile
  }
  if (current.state === 'FAILED') {
    throw new Error('Gemini file upload finished processing but failed')
  }

  return { mimeType: current.mimeType || mimeType, fileUri: current.uri }
}

/**
 * Builds the one audio GeminiPart for a generateContent call, choosing
 * inline vs Files API per shouldUseInlineAudio. Small helper, not exported —
 * callGeminiWithAudio is the public surface, and it's the only caller.
 */
async function buildAudioPart(
  apiKey: string,
  audioBytes: Buffer,
  mimeType: string,
): Promise<GeminiPart> {
  if (shouldUseInlineAudio(audioBytes.byteLength)) {
    return { inlineData: { mimeType, data: audioBytes.toString('base64') } }
  }
  const file = await uploadFileToGemini(apiKey, audioBytes, mimeType, 'meeting-audio-segment')
  return { fileData: file }
}

/**
 * Builds one image GeminiPart for a captured screen keyframe. Same
 * inline-vs-Files-API choice as audio, reused as-is (shouldUseInlineAudio)
 * rather than a separate image-specific threshold — the actual tradeoff it
 * encodes (base64 inflating the payload ~33% vs paying for an extra Files
 * API round trip) is about payload size, not content type. In practice this
 * branch is academic for keyframes: they're capped at 1MB server-side (see
 * MAX_KEYFRAME_BYTES in ai-actions.ts), comfortably under
 * INLINE_AUDIO_MAX_BYTES (4MB), so every keyframe goes inline.
 */
async function buildImagePart(
  apiKey: string,
  imageBytes: Buffer,
  mimeType: string,
): Promise<GeminiPart> {
  if (shouldUseInlineAudio(imageBytes.byteLength)) {
    return { inlineData: { mimeType, data: imageBytes.toString('base64') } }
  }
  const file = await uploadFileToGemini(apiKey, imageBytes, mimeType, 'meeting-screen-keyframe')
  return { fileData: file }
}

/**
 * callGemini, specialized for "some text parts plus one audio payload".
 * Handles the inline-vs-Files-API choice (and, for Files API, the upload)
 * per API key attempted — see GeminiPartsInput's builder form above for why
 * that has to happen inside the retry/rotation loop rather than once
 * up-front. Callers (analyzeMeetingAudio, transcribeSegment) never touch
 * inlineData/fileData directly.
 */
export async function callGeminiWithAudio(
  userId: string,
  textParts: { text: string }[],
  audioBytes: Buffer,
  mimeType: string,
  opts: { model?: string; models?: readonly string[]; responseJson?: boolean; feature: AiCallSlug },
): Promise<{ text: string; model: string }> {
  return callGemini(
    userId,
    async (apiKey) => [...textParts, await buildAudioPart(apiKey, audioBytes, mimeType)],
    opts,
  )
}

/** One image to attach to a callGeminiWithImages call — `label` is a short
 *  text part inserted immediately before the image itself (e.g. "Screen at
 *  12:34"), since generateContent has no other way to caption a part; it's
 *  what lets the model say which timestamp a screenshot came from. */
export type GeminiImageInput = { bytes: Buffer; mimeType: string; label: string }

/**
 * callGemini, specialized for "some text parts plus zero or more labelled
 * images" — used by finalizeMeetingRecording (ai-actions.ts) to hand the
 * kept screen keyframes to the final synthesis pass alongside the
 * transcript. Images are rebuilt per API key attempted, same reason as
 * buildAudioPart above (a Files-API upload is scoped to the key/project that
 * made it). Each image is preceded by its own `label` text part, in the
 * order given — callers are expected to pass images already sorted by
 * capture time so "in captured-at order" holds without this function
 * re-deriving it.
 */
export async function callGeminiWithImages(
  userId: string,
  textParts: { text: string }[],
  images: GeminiImageInput[],
  opts: { model?: string; models?: readonly string[]; responseJson?: boolean; feature: AiCallSlug },
): Promise<{ text: string; model: string }> {
  return callGemini(
    userId,
    async (apiKey) => {
      const imageParts: GeminiPart[] = []
      for (const image of images) {
        imageParts.push({ text: image.label })
        imageParts.push(await buildImagePart(apiKey, image.bytes, image.mimeType))
      }
      return [...textParts, ...imageParts]
    },
    opts,
  )
}
