import { describe, expect, it } from 'vitest'
import {
  AUDIO_TOKENS_PER_SECOND,
  IDLE_TIMEOUT_MS,
  MAX_SESSION_MS,
  autoStopReason,
  estimateAudioTokens,
  estimateCostUsd,
  formatCostEstimate,
  formatDuration,
  isApproachingCap,
} from './session-budget'

describe('estimateAudioTokens', () => {
  it('uses the published 25 tokens per second of audio', () => {
    expect(estimateAudioTokens(1)).toBe(AUDIO_TOKENS_PER_SECOND)
    expect(estimateAudioTokens(60)).toBe(1500)
    expect(estimateAudioTokens(3600)).toBe(90_000)
  })

  it('treats nonsense durations as zero', () => {
    for (const input of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(estimateAudioTokens(input)).toBe(0)
    }
  })
})

describe('estimateCostUsd', () => {
  it('prices an hour of audio at the published Live rate', () => {
    // 90,000 tokens at $3.00/1M = $0.27, which also matches the published
    // per-minute figure ($0.005/min x 60 = $0.30, same order).
    expect(estimateCostUsd(3600)).toBeCloseTo(0.27, 4)
  })

  it('scales linearly with duration', () => {
    expect(estimateCostUsd(1800)).toBeCloseTo(estimateCostUsd(3600) / 2, 6)
  })
})

describe('formatCostEstimate', () => {
  it('never renders a nonzero cost as $0.00', () => {
    // Showing "$0.00" before a metered recording would read as "this is free".
    expect(formatCostEstimate(0.0001)).toBe('<$0.01')
  })

  it('renders exact zero as zero', () => {
    expect(formatCostEstimate(0)).toBe('$0.00')
  })

  it('renders normal amounts to two decimals', () => {
    expect(formatCostEstimate(0.27)).toBe('$0.27')
  })
})

describe('autoStopReason', () => {
  it('keeps running during a normal, active session', () => {
    expect(autoStopReason({ elapsedMs: 60_000, msSinceLastTranscript: 1_000 })).toBeNull()
  })

  it('stops at the hard duration cap', () => {
    expect(
      autoStopReason({ elapsedMs: MAX_SESSION_MS, msSinceLastTranscript: 0 }),
    ).toBe('max-duration')
  })

  it('stops a silent session — the forgotten-tab guard', () => {
    expect(
      autoStopReason({ elapsedMs: 10_000, msSinceLastTranscript: IDLE_TIMEOUT_MS }),
    ).toBe('idle')
  })

  it('reports the duration cap when both conditions trip', () => {
    expect(
      autoStopReason({ elapsedMs: MAX_SESSION_MS, msSinceLastTranscript: IDLE_TIMEOUT_MS }),
    ).toBe('max-duration')
  })

  it('does not stop just under either threshold', () => {
    expect(
      autoStopReason({ elapsedMs: MAX_SESSION_MS - 1, msSinceLastTranscript: IDLE_TIMEOUT_MS - 1 }),
    ).toBeNull()
  })

  it('honours caller-supplied limits', () => {
    expect(
      autoStopReason({
        elapsedMs: 500,
        msSinceLastTranscript: 0,
        maxSessionMs: 400,
      }),
    ).toBe('max-duration')
  })
})

describe('isApproachingCap', () => {
  it('is quiet early in a session', () => {
    expect(isApproachingCap(0)).toBe(false)
  })

  it('warns in the final minutes', () => {
    expect(isApproachingCap(MAX_SESSION_MS - 60_000)).toBe(true)
  })

  it('stops warning once the cap is actually reached', () => {
    // At the cap the session stops; a warning then would be stale.
    expect(isApproachingCap(MAX_SESSION_MS)).toBe(false)
  })
})

describe('formatDuration', () => {
  it('formats under an hour as m:ss', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(65_000)).toBe('1:05')
  })

  it('formats past an hour as h:mm:ss', () => {
    expect(formatDuration(3_725_000)).toBe('1:02:05')
  })

  it('clamps negatives to zero', () => {
    expect(formatDuration(-1)).toBe('0:00')
  })
})
