// "Do I have enough left to record this meeting?" — answered honestly.
//
// Pure decision logic, separated from the key lookup (queries.ts) and the UI
// so the wording and the thresholds are testable.
//
// The honest answer is never "N tokens remaining": Google publishes no
// per-key balance to read, and free-tier limits are per-minute and per-day
// REQUEST counts they no longer publish either. What can be said truthfully
// is how many keys are active, how many are currently failing, and roughly
// what an hour of live transcription costs against them — which is the
// actual decision in front of the user ("start now, or add a key first").

import { AUDIO_TOKENS_PER_SECOND } from '@/features/transcription/session-budget'

/**
 * One key as the readiness check sees it — a slice of the geminiKeys row.
 *
 * A row here is any key the caller can actually transact on: their own, OR a
 * teammate's org-shared one that rotation will fall through to. Nothing in
 * this shape says which, and it must not: the copy below is read by someone
 * who can pause, fix or delete their own keys and can do NONE of those things
 * to a teammate's, so it never claims ownership of any of them.
 */
export type KeyHealth = {
  id: string
  label: string
  active: boolean
  /** Consecutive failures since the last success — see callGemini's bookkeeping. */
  failCount: number
  /** When this key was last tried, successfully or not. */
  lastUsedAt: Date | null
}

/**
 * How long a run of failures stays evidence of anything.
 *
 * failCount only resets on a SUCCESS, so a key exhausted yesterday keeps its
 * failures forever until something happens to spend a request on it — which
 * means a quota that reset overnight would still be reported as "out of
 * quota" the next morning, and the advice would be to add a key nobody
 * needs. Past this window the count is treated as stale rather than current:
 * the honest statement is "we don't know yet", and the very next real call
 * settles it.
 *
 * 12 hours because the free-tier limit that actually bites is a DAILY one.
 */
export const STALE_FAILURE_MS = 12 * 60 * 60 * 1000

/**
 * How many consecutive failures before a key is treated as "probably spent"
 * rather than "had a bad moment". callGemini bumps failCount on auth AND
 * quota failures and resets it to 0 on any success, so a key that has failed
 * this many times in a row without one success in between is either rejected
 * or out of quota — both of which mean "don't count on it".
 */
export const FAILING_KEY_THRESHOLD = 3

export type ReadinessLevel = 'ready' | 'degraded' | 'blocked'

export type RecordingReadiness = {
  level: ReadinessLevel
  /** Active keys that are not currently failing. */
  healthyCount: number
  /** Active keys that have failed FAILING_KEY_THRESHOLD times in a row. */
  failingCount: number
  /** One sentence, written for the person about to press record. */
  headline: string
  /** What to do about it, or null when there is nothing to do. */
  advice: string | null
}

export function assessRecordingReadiness(
  keys: KeyHealth[],
  now: Date = new Date(),
): RecordingReadiness {
  const active = keys.filter((key) => key.active)
  const failing = active.filter((key) => isCurrentlyFailing(key, now))
  const healthy = active.length - failing.length

  if (active.length === 0) {
    return {
      level: 'blocked',
      healthyCount: 0,
      failingCount: 0,
      // Deliberately not "recording will fail": it won't. The audio is
      // captured and kept locally either way — what is unavailable is the
      // transcription, and that can be run later.
      headline: 'No Gemini key is available to you, so nothing can be transcribed yet.',
      advice:
        'Add a key in Profile → Gemini API keys. Recording still works; you can transcribe afterwards.',
    }
  }

  if (healthy === 0) {
    return {
      level: 'blocked',
      healthyCount: 0,
      failingCount: failing.length,
      // The cause is deliberately a list, not a diagnosis: failCount cannot
      // tell a rejected key from an exhausted one from a project without
      // access to a model this build asks for. Naming one of them would send
      // people to fix the wrong thing.
      // Not "your keys": the pool can include a teammate's org-shared key,
      // which the reader cannot see, pause or fix (listGeminiKeys is
      // own-keys-only by design). "Available to you" is true either way.
      headline:
        failing.length === 1
          ? 'The only Gemini key available to you keeps failing — it may be rejected, out of quota, or missing access.'
          : `All ${failing.length} Gemini keys available to you keep failing — rejected, out of quota, or missing access.`,
      advice:
        'Add a key of your own, or wait for the daily quota to reset — a failing key may be a teammate’s shared one you cannot change. Recording still works.',
    }
  }

  if (failing.length > 0) {
    return {
      level: 'degraded',
      healthyCount: healthy,
      failingCount: failing.length,
      headline: `${healthy} of ${active.length} Gemini keys are working — ${failing.length} keep failing.`,
      advice: 'The working keys carry everything; the failing ones are tried last.',
    }
  }

  return {
    level: 'ready',
    healthyCount: healthy,
    failingCount: 0,
    headline:
      healthy === 1
        ? 'One Gemini key, working. Every AI feature shares its daily quota.'
        : `${healthy} Gemini keys, all working. Requests spread across them.`,
    advice: null,
  }
}

/**
 * Whether a key's failures are recent enough to still mean something. A key
 * that has not been touched since the window opened is reported as working:
 * the next real call is what settles it, and calling it "failing" on
 * yesterday's evidence sends people to buy a key they may not need.
 */
function isCurrentlyFailing(key: KeyHealth, now: Date): boolean {
  if (key.failCount < FAILING_KEY_THRESHOLD) return false
  if (!key.lastUsedAt) return false
  return now.getTime() - key.lastUsedAt.getTime() < STALE_FAILURE_MS
}

/**
 * An ORDER-OF-MAGNITUDE daily token allowance for one free-tier key.
 *
 * Not a published figure — Google stopped publishing free-tier limits (see
 * the streaming design spec). It exists only to separate "a normal meeting"
 * from "you are about to stream for four hours", and every UI that shows a
 * number derived from it must say approximately.
 */
export const INDICATIVE_DAILY_TOKEN_ALLOWANCE = 1_000_000

/** A recording's share of the indicative allowance across `keyCount` keys. */
export function estimateSessionShare(seconds: number, keyCount: number): number {
  if (keyCount <= 0 || seconds <= 0) return 0
  const tokens = seconds * AUDIO_TOKENS_PER_SECOND
  return tokens / (INDICATIVE_DAILY_TOKEN_ALLOWANCE * keyCount)
}

/** Hours of live transcription one key's indicative daily allowance covers. */
export function indicativeHoursPerKey(): number {
  return INDICATIVE_DAILY_TOKEN_ALLOWANCE / (AUDIO_TOKENS_PER_SECOND * 3600)
}
