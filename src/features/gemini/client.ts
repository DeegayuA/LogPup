import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { geminiKeys } from '@/db/schema'
import { decryptSecret } from '@/lib/crypto'
import { MAX_ATTEMPTS, backoffDelayMs, shouldRetry, sleep } from '@/features/gemini/retry'

export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest'
// Fallback used only when the primary model is persistently overloaded
// (503 after exhausting retries) — gemini-flash-lite-latest is the
// cheaper/lighter sibling in the same "-latest" alias family, so it needs
// no separate model-availability handling and is likely to have separate
// capacity from the primary flash model during a demand spike.
export const FALLBACK_GEMINI_MODEL = 'gemini-flash-lite-latest'
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

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } }

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
  parts: GeminiPart[],
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
