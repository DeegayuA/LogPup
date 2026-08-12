// Server-side minting of Gemini Live ephemeral tokens.
//
// SECURITY: this module is the only place a user's decrypted Gemini key touches
// the Live feature, and the key never leaves this process. The browser receives
// an ephemeral token instead: single-use, short-lived, and pinned by
// `liveConnectConstraints` to one model and one config, so it cannot be replayed
// against generateContent to spend the rest of the user's quota.
//
// Must only ever be imported from server code (`actions.ts`). There is no
// `server-only` package in this project to enforce that at build time, so the
// import graph is the guard — do not import this from a 'use client' module.

import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { geminiKeys } from '@/db/schema'
import { decryptSecret } from '@/lib/crypto'
import { GeminiError } from '@/features/gemini/client'
import { MAX_ATTEMPTS, backoffDelayMs, shouldRetry, sleep } from '@/features/gemini/retry'
import { LIVE_MODEL_FALLBACK_ORDER, buildSetupMessage } from './live-protocol'

const AUTH_TOKENS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/auth_tokens'

/** How long a minted token stays usable. Kept short — it is re-minted per socket. */
export const TOKEN_TTL_MS = 10 * 60 * 1000

/**
 * How long the token may be used to *open* a session. Deliberately much shorter
 * than the token's own lifetime: it only has to survive the round trip from the
 * server action to the browser's WebSocket handshake.
 */
export const NEW_SESSION_TTL_MS = 2 * 60 * 1000

export type MintedLiveToken = {
  /** The opaque token name — used in place of an API key. Never a real key. */
  token: string
  model: string
  expiresAt: string
}

type MintAttempt =
  | { ok: true; token: string }
  | { ok: false; kind: 'auth' | 'quota' | 'overloaded' | 'bad'; message: string }

/**
 * One key's attempt at minting, with the project's standard retry policy
 * (retry.ts) applied in place. Classification matches callGemini's so the
 * outer rotation loop behaves identically to every other Gemini call path.
 */
async function mintWithKey(
  apiKey: string,
  keyLabel: string,
  model: string,
): Promise<MintAttempt> {
  const setup = buildSetupMessage({ model }).setup as Record<string, unknown>
  let attempt = 0

  while (true) {
    attempt += 1
    const now = Date.now()

    let res: Response
    try {
      res = await fetch(AUTH_TOKENS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
        body: JSON.stringify({
          uses: 1,
          expireTime: new Date(now + TOKEN_TTL_MS).toISOString(),
          newSessionExpireTime: new Date(now + NEW_SESSION_TTL_MS).toISOString(),
          // Pinning model + config is what makes the token safe to hand to a
          // browser: it can open exactly the transcription session we designed
          // and nothing else.
          liveConnectConstraints: { model: setup.model, config: setup },
        }),
      })
    } catch (networkError) {
      const message = networkError instanceof Error ? networkError.message : 'network error'
      if (shouldRetry(null, attempt, MAX_ATTEMPTS)) {
        await sleep(backoffDelayMs(attempt, null))
        continue
      }
      return { ok: false, kind: 'overloaded', message: `Network error minting token: ${message}` }
    }

    if (res.ok) {
      const json = (await res.json().catch(() => null)) as { name?: string } | null
      const name = json?.name
      if (typeof name !== 'string' || name.length === 0) {
        return { ok: false, kind: 'bad', message: 'Token endpoint returned no token name' }
      }
      return { ok: true, token: name }
    }

    if (res.status === 401 || res.status === 403) {
      // Also the signal that this key's tier has no Live access at all — the
      // caller turns a 403 into a permanent fallback rather than a retry.
      return { ok: false, kind: 'auth', message: `Key "${keyLabel}" got HTTP ${res.status}` }
    }

    if (shouldRetry(res.status, attempt, MAX_ATTEMPTS)) {
      await sleep(backoffDelayMs(attempt, res.headers.get('retry-after')))
      continue
    }

    if (res.status === 429) {
      return { ok: false, kind: 'quota', message: `Key "${keyLabel}" is quota-limited (429)` }
    }
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      return { ok: false, kind: 'overloaded', message: `Live token service busy (${res.status})` }
    }

    const body = await res.text().catch(() => '')
    return { ok: false, kind: 'bad', message: `Token mint failed ${res.status}: ${body.slice(0, 300)}` }
  }
}

/**
 * Mints an ephemeral Live token using the user's own keys, rolling
 * least-recently-used first exactly as callGemini does, with the same
 * failCount/lastUsedAt bookkeeping so a key that is failing here is also
 * deprioritised for ordinary Gemini calls.
 *
 * Model fallback: each key walks LIVE_MODEL_FALLBACK_ORDER (primary Live
 * preview, then the older 2.5 native-audio preview). A mint the endpoint
 * rejects outright ('bad' — the model was renamed/retired, or this project
 * has no access to that preview) or reports overloaded falls through to the
 * next model on the SAME key; only key-level failures (auth/quota) rotate
 * to the next key. The minted token stays pinned to exactly one model — the
 * chain exists so a retired primary can never hard-fail the whole feature.
 */
export async function mintLiveToken(
  userId: string,
  opts?: { model?: string },
): Promise<MintedLiveToken> {
  const models = opts?.model ? [opts.model] : LIVE_MODEL_FALLBACK_ORDER

  const keys = await db
    .select()
    .from(geminiKeys)
    .where(and(eq(geminiKeys.userId, userId), eq(geminiKeys.active, true)))
    .orderBy(sql`${geminiKeys.lastUsedAt} ASC NULLS FIRST`)

  if (keys.length === 0) {
    throw new GeminiError('NO_KEYS', 'No active Gemini API keys — add one in Profile.')
  }

  let sawAuthFailure = false
  let sawTransientBusy = false

  // Remembered so the terminal error can say something specific when every
  // (key, model) pair failed with a non-retriable mint rejection.
  let lastBadMessage: string | null = null

  for (const key of keys) {
    let apiKey: string
    try {
      apiKey = decryptSecret(key.encryptedKey)
    } catch {
      continue // corrupted row — nothing to bump, try the next key
    }

    for (const model of models) {
      const result = await mintWithKey(apiKey, key.label, model)

      if (result.ok) {
        await db
          .update(geminiKeys)
          .set({ lastUsedAt: new Date(), failCount: 0 })
          .where(eq(geminiKeys.id, key.id))
        return {
          token: result.token,
          model,
          expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
        }
      }

      if (result.kind === 'bad') {
        // Unlike generateContent, a 'bad' mint is usually about the MODEL
        // (renamed/retired preview, or a project without access to it), so
        // it falls through to the next model on this same key instead of
        // aborting the whole mint. Only once every model has been refused
        // does it count against the terminal error below.
        lastBadMessage = result.message
        continue
      }

      if (result.kind === 'auth' || result.kind === 'quota') {
        sawAuthFailure = true
        await db
          .update(geminiKeys)
          .set({ failCount: sql`${geminiKeys.failCount} + 1`, lastUsedAt: new Date() })
          .where(eq(geminiKeys.id, key.id))
        break // key-level failure — no model on this key will do better
      }

      // 'overloaded' — try the next model on this key.
      sawTransientBusy = true
    }
  }

  if (sawAuthFailure) {
    throw new GeminiError(
      'AUTH_FAILED',
      'Your Gemini key was rejected, is out of quota, or has no Live API access — live transcription is off, recording continues.',
    )
  }
  if (sawTransientBusy) {
    throw new GeminiError(
      'TRANSIENT_BUSY',
      'Gemini Live is busy right now — recording continues without live transcription.',
    )
  }
  if (lastBadMessage) {
    throw new GeminiError('BAD_RESPONSE', lastBadMessage)
  }
  throw new GeminiError(
    'ALL_KEYS_FAILED',
    'Could not reach Gemini Live with any saved key — recording continues without live transcription.',
  )
}
