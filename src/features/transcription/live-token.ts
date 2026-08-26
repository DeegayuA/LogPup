// Server-side minting of Gemini Live ephemeral tokens.
//
// SECURITY: this module is the only place a user's decrypted Gemini key touches
// the Live feature, and the key never leaves this process. The browser receives
// an ephemeral token instead: single-use, short-lived, and pinned by
// `bidiGenerateContentSetup` to one model and one config, so it cannot be
// replayed against generateContent to spend the rest of the user's quota.
//
// Must only ever be imported from server code (`actions.ts`). There is no
// `server-only` package in this project to enforce that at build time, so the
// import graph is the guard — do not import this from a 'use client' module.

import { and, eq, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { geminiKeys } from '@/db/schema'
import { decryptSecret } from '@/lib/crypto'
import { GeminiError } from '@/features/gemini/client'
import { orderKeysForRotation } from '@/features/gemini/rotation'
import { recordAiUsage } from '@/features/gemini/usage'
import { MAX_ATTEMPTS, backoffDelayMs, shouldRetry, sleep } from '@/features/gemini/retry'
import { AUDIO_TOKENS_PER_SECOND } from '@/features/transcription/session-budget'
import { LIVE_MODEL_FALLBACK_ORDER, buildAuthTokenRequest } from './live-protocol'

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
  | {
      ok: false
      kind: 'auth' | 'quota' | 'overloaded' | 'bad' | 'no-identity'
      message: string
      /**
       * Raw upstream body, truncated. Logged, never shown — it carries the
       * only machine-readable statement of WHY a key was refused
       * (PERMISSION_DENIED vs API_KEY_INVALID vs SERVICE_DISABLED), which is
       * the difference between "add billing" and "paste a new key". The
       * user-facing sentence cannot say which, so without this the whole
       * diagnosis of a Live failure was one generic sentence.
       */
      detail?: string
    }

/**
 * One key's attempt at minting, with the project's standard retry policy
 * (retry.ts) applied in place. Classification matches callGemini's so the
 * outer rotation loop behaves identically to every other Gemini call path.
 */
async function mintWithKey(
  apiKey: string,
  keyLabel: string,
  model: string,
  resumptionHandle?: string | null,
): Promise<MintAttempt> {
  let attempt = 0

  while (true) {
    attempt += 1

    let res: Response
    try {
      res = await fetch(AUTH_TOKENS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
        // Pinning model + config (buildAuthTokenRequest) is what makes the
        // token safe to hand to a browser: it can open exactly the
        // transcription session we designed and nothing else.
        body: JSON.stringify(
          buildAuthTokenRequest({
            model,
            nowMs: Date.now(),
            tokenTtlMs: TOKEN_TTL_MS,
            newSessionTtlMs: NEW_SESSION_TTL_MS,
            resumptionHandle,
          }),
        ),
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

    if (shouldRetry(res.status, attempt, MAX_ATTEMPTS)) {
      await sleep(backoffDelayMs(attempt, res.headers.get('retry-after')))
      continue
    }

    const body = await res.text().catch(() => '')
    return classifyMintFailure(res.status, body, keyLabel)
  }
}

/**
 * What the auth_tokens endpoint's status codes ACTUALLY mean.
 *
 * Established by probing the live endpoint, not by reading the docs page —
 * whose own curl example sends `liveConnectConstraints` and is rejected with a
 * 400 before the key is ever looked at. The mapping is not the conventional
 * REST one, and getting it wrong sends people to fix the wrong thing:
 *
 *   403 PERMISSION_DENIED  — NO IDENTITY REACHED GOOGLE. "Method doesn't allow
 *                            unregistered callers." This is OUR bug: a blank
 *                            or unsent x-goog-api-key. It is NOT evidence the
 *                            key is bad, and blaming the user's key for it is
 *                            how a header bug gets misfiled as a billing
 *                            problem for weeks.
 *   400 API_KEY_INVALID    — the key really is bad. Note the status: a
 *                            rejected key answers 400 here, NOT 401/403.
 *   400 FAILED_PRECONDITION— billing/region, not the key itself.
 *   429                    — quota. The only status that means "come back
 *                            later" for a key that is otherwise fine.
 *   5xx                    — upstream.
 *   400 anything else      — model or payload: a renamed preview, or a field
 *                            name this build got wrong.
 */
export function classifyMintFailure(
  status: number,
  body: string,
  keyLabel: string,
): Extract<MintAttempt, { ok: false }> {
  const detail = body.slice(0, 300)
  const reason = /"reason"\s*:\s*"([A-Z_]+)"/.exec(body)?.[1] ?? ''
  const rpcStatus = /"status"\s*:\s*"([A-Z_]+)"/.exec(body)?.[1] ?? ''

  if (status === 429) {
    return { ok: false, kind: 'quota', message: `Key "${keyLabel}" is quota-limited (429)`, detail }
  }
  if (status >= 500) {
    return { ok: false, kind: 'overloaded', message: `Live token service busy (${status})`, detail }
  }
  if (status === 403) {
    return {
      ok: false,
      kind: 'no-identity',
      message: `The mint for key "${keyLabel}" carried no API key`,
      detail,
    }
  }
  if (status === 401 || reason === 'API_KEY_INVALID' || rpcStatus === 'UNAUTHENTICATED') {
    return { ok: false, kind: 'auth', message: `Key "${keyLabel}" was rejected (${status})`, detail }
  }
  if (rpcStatus === 'FAILED_PRECONDITION') {
    return {
      ok: false,
      kind: 'auth',
      message: `Key "${keyLabel}" needs billing or is region-blocked`,
      detail,
    }
  }
  return { ok: false, kind: 'bad', message: `Token mint failed ${status}: ${detail}`, detail }
}

/**
 * Records a blocked-call ledger row and returns the error unchanged, so every
 * throw site in mintLiveToken can wrap its GeminiError in one call:
 * `throw recordFailure(userId, models, err)` — the same shape as
 * callGeminiCore's helper in client.ts, with the feature slug fixed because
 * this path only ever serves Live.
 *
 * Without it `live.session` would be the one slug whose call count meant
 * "successes only" while every other slug counts attempts: a user permanently
 * locked out of Live by a 403 would read as "not used" in Settings and the
 * adoption panel — indistinguishable from someone who never tried it — while
 * that same user's blocked worklog drafts were counted.
 */
function recordFailure(
  userId: string,
  models: readonly string[],
  error: GeminiError,
): GeminiError {
  recordAiUsage({
    userId,
    feature: 'live.session',
    model: models[0] ?? 'unknown',
    status: error.code,
  })
  return error
}

/**
 * Mints an ephemeral Live token, rolling across the caller's own active keys
 * least-recently-used first (never-used before used), then org-shared keys
 * owned by others, LRU again — same ordering as callGeminiCore, via
 * orderKeysForRotation — with the same failCount/lastUsedAt bookkeeping so a
 * key that is failing here is also deprioritised for ordinary Gemini calls.
 *
 * Model fallback: each key walks the chain (by default LIVE_MODEL_FALLBACK_ORDER
 * — primary Live preview, then the older 2.5 native-audio preview; `opts.models`
 * overrides it wholesale, same `models`-beats-`model` precedence as
 * resolveModelChain in gemini/client.ts). A mint the endpoint rejects outright
 * ('bad' — the model was renamed/retired, or this project has no access to
 * that preview) or reports overloaded falls through to the next model on the
 * SAME key; only key-level failures (auth/quota) rotate to the next key. The
 * minted token stays pinned to exactly one model — the chain exists so a
 * retired primary can never hard-fail the whole feature.
 */
export async function mintLiveToken(
  userId: string,
  opts?: {
    model?: string
    models?: readonly string[]
    /** Present when this mint is for a reconnect — pinned into the token so the
     * constrained setup matches the frame the client will send. */
    resumptionHandle?: string | null
  },
): Promise<MintedLiveToken> {
  const models =
    opts?.models && opts.models.length > 0
      ? opts.models
      : opts?.model
        ? [opts.model]
        : LIVE_MODEL_FALLBACK_ORDER

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
      userId,
      models,
      new GeminiError(
        'NO_KEYS',
        'No active Gemini API keys — add one in Profile (or ask a teammate to share one).',
      ),
    )
  }

  let sawAuthFailure = false
  let sawTransientBusy = false
  // Google refused the request as an UNREGISTERED CALLER. Tracked separately
  // from auth because the remedy is the opposite: nothing the user can do to
  // their keys fixes it.
  let sawNoIdentity = false

  // Remembered so the terminal error can say something specific when every
  // (key, model) pair failed with a non-retriable mint rejection.
  let lastBadMessage: string | null = null
  // Ditto for auth: the upstream reason behind the last 401/403, logged (never
  // shown) so a support question about "no Live API access" has an answer.
  let lastAuthDetail: string | null = null

  for (const key of keys) {
    let apiKey: string
    try {
      apiKey = decryptSecret(key.encryptedKey)
    } catch {
      continue // corrupted row — nothing to bump, try the next key
    }

    // A key that decrypts to nothing is the most likely way the mint ends up
    // sending no credential at all, which Google answers with a 403 that reads
    // as "your key was rejected". Caught here so it is named as what it is: a
    // broken stored key, not a Gemini entitlement problem.
    if (apiKey.trim().length === 0) {
      console.error(`[live-token] key "${key.label}" decrypted to an empty string — skipping it`)
      continue
    }

    // Set when a model on THIS key answered 401/403/429. Only meaningful once
    // every model has been tried — see the auth/quota branch below.
    let keyLevelFailure = false

    for (const model of models) {
      const result = await mintWithKey(apiKey, key.label, model, opts?.resumptionHandle)

      if (result.ok) {
        await db
          .update(geminiKeys)
          .set({ lastUsedAt: new Date(), failCount: 0 })
          .where(eq(geminiKeys.id, key.id))
        // ESTIMATED, not measured: the Live socket runs browser-side, so the
        // server's only handle on its usage is "one token ≈ one ≤10-minute
        // session slice" at the session-budget rate. Every UI that surfaces
        // live.session rows must say "approximately".
        recordAiUsage({
          userId,
          keyId: key.id,
          keyOwnerId: key.userId,
          keyLast4: key.last4,
          feature: 'live.session',
          model,
          inputTokens: AUDIO_TOKENS_PER_SECOND * (TOKEN_TTL_MS / 1000),
          outputTokens: 0,
          status: 'ok',
        })
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

      if (result.kind === 'no-identity') {
        // Deliberately does NOT set keyLevelFailure: the key was never
        // presented, so nothing was learned about it. Bumping failCount here
        // would mark every key in the pool as failing over a bug in this file.
        sawNoIdentity = true
        if (result.detail) lastAuthDetail = result.detail
        continue
      }

      if (result.kind === 'auth' || result.kind === 'quota') {
        // NOT key-level on the spot — the same correction client.ts already
        // carries for callGeminiCore, which this function claims parity with
        // and did not have.
        //
        // Gemini gates access and rate-limits PER MODEL. A 403 from a project
        // without access to the primary Live preview says nothing about the
        // secondary one — and SECONDARY_LIVE_MODEL exists precisely because
        // free-tier keys have had it longer (see live-protocol.ts). Breaking
        // here made that second rung of the fallback ladder unreachable on
        // exactly the failure it was built for: a perfectly good free-tier key
        // reported "…is out of quota, or has no Live API access" two seconds
        // into every recording, and never once tried the model that works.
        //
        // The bookkeeping is deferred, not dropped: if no model on this key
        // succeeds, failCount is bumped once after the loop.
        keyLevelFailure = true
        if (result.detail) lastAuthDetail = result.detail
        continue
      }

      // 'overloaded' — try the next model on this key.
      sawTransientBusy = true
    }

    // Every model on this key was refused with an auth/quota error, so the key
    // really is the problem — bumped here, ONCE, rather than once per model.
    //
    // A key that minted on ANY model must never land here. failCount is what
    // readiness.ts thresholds on (FAILING_KEY_THRESHOLD = 3), so blaming a key
    // for a model-level 403 made three recording attempts enough to turn every
    // readiness surface into "all Gemini keys available to you keep failing" —
    // while meeting-intel, worklog drafts and read-aloud were still working on
    // that same key.
    if (keyLevelFailure) {
      sawAuthFailure = true
      await db
        .update(geminiKeys)
        .set({ failCount: sql`${geminiKeys.failCount} + 1`, lastUsedAt: new Date() })
        .where(eq(geminiKeys.id, key.id))
    }
  }

  // EVERYTHING learned about why, emitted before whichever terminal branch
  // wins — deliberately NOT inside one of them.
  //
  // The branches are ordered by what to TELL THE USER (auth, then busy, then
  // bad), which is the opposite of the order by what a developer can ACT on.
  // A 400 is a protocol regression somebody can fix; a 403 is a key the user
  // must replace. When `lastBadMessage` was only read inside the BAD_RESPONSE
  // branch, a realistic BYOK pool — one key without Live access answering 403,
  // plus a real 400 — reported "your key was rejected" AND logged nothing at
  // all about the 400. That is precisely how the `liveConnectConstraints`
  // field-name regression stayed invisible: the one actionable signal was
  // ranked last, behind the two that blame the user.
  //
  // Bodies are logged, never shown: they carry endpoint paths and project ids,
  // and they mean nothing to the person sitting in the meeting.
  if (lastBadMessage) {
    console.error('[live-token] a model rejected the mint outright:', lastBadMessage)
  }
  if (lastAuthDetail) {
    console.error('[live-token] a key was refused; upstream reason:', lastAuthDetail)
  }

  // Ranked ABOVE auth on purpose: if the request never carried a key, nothing
  // downstream learned anything about the user's keys, and telling them to go
  // check Profile sends them to fix something that was never broken.
  if (sawNoIdentity) {
    console.error(
      '[live-token] auth_tokens refused the request as an unregistered caller. '
        + 'The API key header did not reach Google — this is a bug on our side, not the user\'s key.',
    )
    throw recordFailure(
      userId,
      models,
      new GeminiError(
        'BAD_RESPONSE',
        'Live transcription could not authenticate with Google — that is a problem on our side, not your key. Recording continues without it.',
      ),
    )
  }

  if (sawAuthFailure) {
    // This — not ALL_KEYS_FAILED — is where the realistic "nothing worked"
    // outcome exits, so it is the branch that has to name the shared pool.
    // ALL_KEYS_FAILED below is only reachable when EVERY key fails to
    // DECRYPT; a caller running on a teammate's shared key that hit its Live
    // quota lands here, and telling them THEIR key was rejected sends them to
    // a Profile page that may hold no keys at all, with no path to the real
    // cause.
    throw recordFailure(
      userId,
      models,
      new GeminiError(
        'AUTH_FAILED',
        usedSharedPool
          ? "Your key and your team's shared keys were all rejected, are out of quota, or have no Live API access — check Profile → Gemini API keys, or ask the teammate who shared a key to check theirs. Live transcription is off, recording continues."
          : 'Your Gemini key was rejected, is out of quota, or has no Live API access — live transcription is off, recording continues.',
      ),
    )
  }
  if (sawTransientBusy) {
    throw recordFailure(
      userId,
      models,
      new GeminiError(
        'TRANSIENT_BUSY',
        'Gemini Live is busy right now — recording continues without live transcription.',
      ),
    )
  }
  if (lastBadMessage) {
    // Already logged above, unconditionally — see the emitter. What the user
    // needs here is that the recording is unaffected and that this is not
    // something retrying will fix.
    throw recordFailure(
      userId,
      models,
      new GeminiError(
        'BAD_RESPONSE',
        'Gemini Live isn’t available for this key’s project — recording continues without live transcription.',
      ),
    )
  }
  // Only reachable when every key failed to DECRYPT (the loop `continue`s past
  // a corrupted row without setting any of the flags above), which is why the
  // shared-pool distinction that matters to users lives on AUTH_FAILED.
  throw recordFailure(
    userId,
    models,
    new GeminiError(
      'ALL_KEYS_FAILED',
      usedSharedPool
        ? 'Could not reach Gemini Live with any saved or org-shared key — recording continues without live transcription.'
        : 'Could not reach Gemini Live with any saved key — recording continues without live transcription.',
    ),
  )
}
