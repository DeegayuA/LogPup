// In-memory sliding-window rate limiter, keyed by an arbitrary string (e.g. email).
// State lives in a single process-local Map. That is an acceptable tradeoff here:
// LogPup runs as a single-instance internal tool (no serverless/multi-region
// scale-out), so there is exactly one process to hold this state, and it resets
// on restart/redeploy. Do NOT reuse this module for a multi-instance or
// public-facing deployment without an external store (e.g. Redis) instead.
//
// ACCEPTED RISK: in-memory per-instance — on serverless scale-out lockout
// weakens; move to durable store (e.g. Upstash/DB) before external exposure.

export const LOCKOUT_MESSAGE = 'Too many attempts — try again later'

// Thrown by callers (e.g. the password provider's authorize()) when a key is
// currently blocked, so upstream error handling can surface LOCKOUT_MESSAGE
// distinctly from a plain invalid-credentials failure.
export class RateLimitError extends Error {}

export interface RateLimiterOptions {
  windowMs?: number
  maxAttempts?: number
  /** Injectable clock for deterministic tests — no real timers required. */
  now?: () => number
}

export interface RateLimiter {
  isBlocked(key: string): boolean
  recordFailure(key: string): void
  reset(key: string): void
}

const DEFAULT_WINDOW_MS = 15 * 60 * 1000
const DEFAULT_MAX_ATTEMPTS = 5

export function createRateLimiter(options: RateLimiterOptions = {}): RateLimiter {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const now = options.now ?? Date.now
  const attempts = new Map<string, number[]>()

  // Prunes timestamps outside the sliding window and persists the pruned list,
  // so old entries don't linger in memory forever.
  function recent(key: string): number[] {
    const nowMs = now()
    const timestamps = (attempts.get(key) ?? []).filter((t) => nowMs - t < windowMs)
    attempts.set(key, timestamps)
    return timestamps
  }

  return {
    isBlocked(key) {
      return recent(key).length >= maxAttempts
    },
    recordFailure(key) {
      const timestamps = recent(key)
      timestamps.push(now())
      attempts.set(key, timestamps)
    },
    reset(key) {
      attempts.delete(key)
    },
  }
}

// Module-level singleton used by the password credentials provider's authorize().
export const loginRateLimiter = createRateLimiter()
