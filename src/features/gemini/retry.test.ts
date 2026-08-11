import { describe, expect, it } from 'vitest'
import {
  BACKOFF_MULTIPLIER,
  BASE_DELAY_MS,
  JITTER_RATIO,
  MAX_ATTEMPTS,
  backoffDelayMs,
  shouldRetry,
} from './retry'

describe('shouldRetry', () => {
  it('retries a 503 up to the attempt cap, then gives up', () => {
    // Attempts 1..MAX_ATTEMPTS-1 having just failed should still retry;
    // the attempt that reaches the cap should not.
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
      expect(shouldRetry(503, attempt)).toBe(true)
    }
    expect(shouldRetry(503, MAX_ATTEMPTS)).toBe(false)
  })

  it('retries 502, 504, and 429 the same as 503', () => {
    for (const status of [502, 504, 429]) {
      expect(shouldRetry(status, 1)).toBe(true)
    }
  })

  it('retries a network-level failure (status null)', () => {
    expect(shouldRetry(null, 1)).toBe(true)
    expect(shouldRetry(null, MAX_ATTEMPTS)).toBe(false)
  })

  it('never retries 400 (bad request)', () => {
    expect(shouldRetry(400, 1)).toBe(false)
  })

  it('never retries 401 (bad key)', () => {
    expect(shouldRetry(401, 1)).toBe(false)
  })

  it('never retries 403 (forbidden)', () => {
    expect(shouldRetry(403, 1)).toBe(false)
  })

  it('never retries 404 (not found)', () => {
    expect(shouldRetry(404, 1)).toBe(false)
  })

  it('honors a custom, lower maxAttempts (e.g. the single-shot model-fallback pass)', () => {
    expect(shouldRetry(503, 1, 1)).toBe(false)
  })
})

describe('backoffDelayMs', () => {
  it('honors a numeric Retry-After header over the computed backoff', () => {
    expect(backoffDelayMs(1, '2')).toBe(2000)
    expect(backoffDelayMs(3, '10')).toBe(10_000)
  })

  it('honors an HTTP-date Retry-After header', () => {
    const future = new Date(Date.now() + 5000).toUTCString()
    const delay = backoffDelayMs(1, future)
    // Allow slack for the wall-clock time that elapses during the test run.
    expect(delay).toBeGreaterThan(3000)
    expect(delay).toBeLessThanOrEqual(5500)
  })

  it('clamps a past HTTP-date Retry-After to zero rather than going negative', () => {
    const past = new Date(Date.now() - 5000).toUTCString()
    expect(backoffDelayMs(1, past)).toBe(0)
  })

  it('ignores an unparseable Retry-After and falls back to computed backoff', () => {
    const delay = backoffDelayMs(1, 'not-a-valid-header', () => 0.5)
    expect(delay).toBe(BASE_DELAY_MS) // randomFn=0.5 -> zero jitter
  })

  it('falls back to exponential backoff with no header, at zero jitter (randomFn=0.5)', () => {
    expect(backoffDelayMs(1, undefined, () => 0.5)).toBe(BASE_DELAY_MS)
    expect(backoffDelayMs(2, undefined, () => 0.5)).toBe(BASE_DELAY_MS * BACKOFF_MULTIPLIER)
    expect(backoffDelayMs(3, undefined, () => 0.5)).toBe(BASE_DELAY_MS * BACKOFF_MULTIPLIER ** 2)
  })

  it('keeps jitter within +/-JITTER_RATIO of the exponential value, across the random range', () => {
    const exponential = BASE_DELAY_MS * BACKOFF_MULTIPLIER ** (2 - 1) // attempt=2
    const min = exponential * (1 - JITTER_RATIO)
    const max = exponential * (1 + JITTER_RATIO)
    for (const randomValue of [0, 0.25, 0.5, 0.75, 0.999]) {
      const delay = backoffDelayMs(2, undefined, () => randomValue)
      expect(delay).toBeGreaterThanOrEqual(Math.floor(min))
      expect(delay).toBeLessThanOrEqual(Math.ceil(max))
    }
  })

  it('never returns a negative delay', () => {
    expect(backoffDelayMs(1, undefined, () => 0)).toBeGreaterThanOrEqual(0)
  })
})
