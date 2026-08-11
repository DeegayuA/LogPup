import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { geminiKeys } from '@/db/schema'
import { decryptSecret } from '@/lib/crypto'
import { MAX_ATTEMPTS, backoffDelayMs, shouldRetry, sleep } from '@/features/gemini/retry'
import { shouldUseInlineAudio } from '@/features/gemini/audio-strategy'

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
type ModelAttemptResult =
  | { ok: true; text: string }
  | { ok: false; kind: 'auth' | 'quota' | 'overloaded' | 'bad'; message: string }

/**
 * Calls generateContent for one (key, model) pair, retrying in-place on
 * RETRIABLE failures (502/503/504/429, network/timeout) per the policy in
 * retry.ts. `maxAttempts` defaults to the full policy cap; the model
 * fallback pass in callGemini passes 1 for a single last-resort attempt
 * rather than a whole second retry cycle (see call site).
 */
async function callModelWithRetry(
  apiKey: string,
  model: string,
  parts: GeminiPart[],
  responseJson: boolean | undefined,
  keyLabel: string,
  maxAttempts: number = MAX_ATTEMPTS,
): Promise<ModelAttemptResult> {
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
          ...(responseJson ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
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
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
      }
      const text = json.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
      if (!text) {
        return { ok: false, kind: 'bad', message: 'Gemini returned an empty response' }
      }
      return { ok: true, text }
    }

    retryAfter = res.headers.get('retry-after')

    // 401/403 are never retried (see retry.ts) — a bad/unauthorized key
    // fails identically every time, so classify immediately as 'auth'.
    if (res.status === 401 || res.status === 403) {
      return { ok: false, kind: 'auth', message: `Key "${keyLabel}" got HTTP ${res.status}` }
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
 * Calls generateContent with the user's own keys, rolling across active keys
 * least-recently-used first so free-tier rate limits spread out.
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
  opts?: { model?: string; responseJson?: boolean },
): Promise<{ text: string; model: string }> {
  const models = opts?.model ? [opts.model] : GEMINI_MODEL_FALLBACK_ORDER
  const keys = await db
    .select()
    .from(geminiKeys)
    .where(and(eq(geminiKeys.userId, userId), eq(geminiKeys.active, true)))
    .orderBy(sql`${geminiKeys.lastUsedAt} ASC NULLS FIRST`)

  if (keys.length === 0) {
    throw new GeminiError('NO_KEYS', 'No active Gemini API keys — add one in Profile.')
  }

  // Tracks *why* every key ultimately failed, so the final error message is
  // accurate: a key problem (bad/expired/quota-exhausted key) gets a
  // different, more actionable message than every model being overloaded.
  let sawAuthFailure = false
  let sawTransientBusy = false

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
        opts?.responseJson,
        key.label,
        maxAttempts,
      )

      if (result.ok) {
        await db
          .update(geminiKeys)
          .set({ lastUsedAt: new Date(), failCount: 0 })
          .where(eq(geminiKeys.id, key.id))
        return { text: result.text, model }
      }

      if (result.kind === 'bad') {
        // Non-retriable, not key- or model-specific (malformed request,
        // empty response) — no other key or model would fare better.
        throw new GeminiError('BAD_RESPONSE', result.message)
      }

      if (result.kind === 'auth' || result.kind === 'quota') {
        sawAuthFailure = true
        await db
          .update(geminiKeys)
          .set({ failCount: sql`${geminiKeys.failCount} + 1`, lastUsedAt: new Date() })
          .where(eq(geminiKeys.id, key.id))
        // Key-specific failure — no model on this key will do better.
        // Break out of the model loop and roll to the next key.
        break
      }

      // result.kind === 'overloaded' — fall through to try the next model
      // in GEMINI_MODEL_FALLBACK_ORDER (still this key). If this was
      // already the last model, the loop ends and we roll to the next key
      // below without touching failCount: the key itself isn't at fault.
      sawTransientBusy = true
    }
  }

  if (sawAuthFailure) {
    throw new GeminiError(
      'AUTH_FAILED',
      'Your Gemini key was rejected or has hit its usage limit — check Profile → Gemini API keys.',
    )
  }
  if (sawTransientBusy) {
    throw new GeminiError(
      'TRANSIENT_BUSY',
      'All Gemini models are busy right now — your recording is saved, try Analyze again in a minute.',
    )
  }
  throw new GeminiError(
    'ALL_KEYS_FAILED',
    'Could not reach Gemini with any saved key — check Profile → Gemini API keys or try again shortly.',
  )
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
  opts?: { model?: string; responseJson?: boolean },
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
  opts?: { model?: string; responseJson?: boolean },
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
