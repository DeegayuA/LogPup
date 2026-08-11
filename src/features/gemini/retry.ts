// Retry/backoff decision logic for transient Gemini API failures.
//
// Kept dependency-free and pure (no fetch, no db, no timers actually firing)
// so it can be unit-tested without mocking network calls — see retry.test.ts.

/** Attempts per (key, model) combination: 1 initial try + up to 3 retries. */
export const MAX_ATTEMPTS = 4

/** First retry waits ~1s; each subsequent retry doubles (1s, 2s, 4s, ...). */
export const BASE_DELAY_MS = 1000
export const BACKOFF_MULTIPLIER = 2

/** +/-25% random jitter applied to every computed delay, so a spike of
 * concurrent requests doesn't all retry in lockstep against Google. */
export const JITTER_RATIO = 0.25

/**
 * HTTP statuses worth retrying: transient upstream overload (502/503/504)
 * or rate limiting (429). 400/401/403/404 are deliberately excluded — a bad
 * request or a bad/unauthorized key won't succeed on retry, so retrying
 * just burns time and (for a real key) quota.
 */
export const RETRIABLE_STATUSES: ReadonlySet<number> = new Set([429, 502, 503, 504])

/**
 * Whether a failed attempt should be retried.
 *
 * @param status HTTP status of the failed response, or `null` for a
 *   network-level failure (fetch rejected — timeout, DNS, connection reset;
 *   no HTTP response was ever received). Network failures are treated as
 *   retriable, same as a 503.
 * @param attempt 1-based number of the attempt that just failed.
 * @param maxAttempts Ceiling on total attempts (including the first).
 *   Defaults to {@link MAX_ATTEMPTS}; callers doing a single last-resort
 *   attempt (e.g. the model-fallback pass in client.ts) can pass 1.
 */
export function shouldRetry(
  status: number | null,
  attempt: number,
  maxAttempts: number = MAX_ATTEMPTS,
): boolean {
  if (attempt >= maxAttempts) return false
  if (status === null) return true
  return RETRIABLE_STATUSES.has(status)
}

/**
 * Delay in milliseconds before the next attempt.
 *
 * Honors a `Retry-After` response header when the server sent one (either
 * delta-seconds or an HTTP-date), taking priority over the computed
 * exponential value. Otherwise computes `BASE_DELAY_MS * BACKOFF_MULTIPLIER
 * ^ (attempt - 1)` and applies +/-{@link JITTER_RATIO} random jitter.
 *
 * @param attempt 1-based number of the attempt that just failed (so
 *   attempt=1 is the delay before the first retry).
 * @param retryAfterHeader Raw `Retry-After` header value, if the upstream
 *   response included one.
 * @param randomFn Source of randomness for jitter, in [0, 1). Defaults to
 *   `Math.random`; tests inject a fixed function to assert bounds instead
 *   of a nondeterministic exact value.
 */
export function backoffDelayMs(
  attempt: number,
  retryAfterHeader?: string | null,
  randomFn: () => number = Math.random,
): number {
  const fromHeader = parseRetryAfterMs(retryAfterHeader)
  if (fromHeader !== null) return fromHeader

  const exponential = BASE_DELAY_MS * BACKOFF_MULTIPLIER ** (attempt - 1)
  const jitterSpread = exponential * JITTER_RATIO
  // randomFn() in [0, 1) maps to jitter in [-jitterSpread, +jitterSpread).
  const jitter = (randomFn() * 2 - 1) * jitterSpread
  return Math.max(0, Math.round(exponential + jitter))
}

/** Parses a `Retry-After` header (delta-seconds or HTTP-date) into ms from
 * now, or `null` if absent/unparseable. Never negative. */
function parseRetryAfterMs(header?: string | null): number | null {
  if (!header) return null

  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000)

  const dateMs = Date.parse(header)
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now())

  return null
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
