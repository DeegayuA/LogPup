import { describe, expect, it } from 'vitest'
import {
  SEGMENT_BYTE_SOFT_CAP,
  SEGMENT_TARGET_MS,
  SEGMENT_UPLOAD_ATTEMPTS,
  concatenateSegments,
  isRetriableSegmentError,
  segmentRetryDelayMs,
  shouldCutSegment,
} from './recording-segments'

describe('segmentRetryDelayMs', () => {
  it('backs off exponentially from one second', () => {
    expect(segmentRetryDelayMs(1)).toBe(1000)
    expect(segmentRetryDelayMs(2)).toBe(3000)
    expect(segmentRetryDelayMs(3)).toBe(9000)
  })

  it('never returns a negative or sub-second delay for a bad attempt number', () => {
    expect(segmentRetryDelayMs(0)).toBe(1000)
    expect(segmentRetryDelayMs(-5)).toBe(1000)
  })

  it('finishes every retry inside a window a person would wait through', () => {
    let total = 0
    for (let attempt = 1; attempt < SEGMENT_UPLOAD_ATTEMPTS; attempt += 1) {
      total += segmentRetryDelayMs(attempt)
    }
    expect(total).toBeLessThanOrEqual(15_000)
  })
})

describe('isRetriableSegmentError', () => {
  it('retries transient transport and upstream failures', () => {
    expect(isRetriableSegmentError('Could not reach the server (Failed to fetch)')).toBe(true)
    expect(isRetriableSegmentError('All Gemini models are busy right now')).toBe(true)
    expect(isRetriableSegmentError('Gemini returned a malformed transcript for this segment')).toBe(
      true,
    )
    expect(isRetriableSegmentError('Could not reach the database just now')).toBe(true)
  })

  it('does not retry failures that are permanent by construction', () => {
    // Same bytes next time — the size check rejects it identically.
    expect(
      isRetriableSegmentError('Segment 3 came out unexpectedly large — try recording again'),
    ).toBe(false)
    // Permissions do not change between attempts.
    expect(isRetriableSegmentError('Only admins or the meeting creator can record analysis')).toBe(
      false,
    )
    expect(isRetriableSegmentError('No audio received for segment 2')).toBe(false)
    // A missing table stays missing until a person applies the migration —
    // this is the failure that originally presented as an endlessly
    // retryable "Upload failed — try again".
    expect(
      isRetriableSegmentError(
        'LogPup’s database is missing a table this feature needs — a pending migration has not been applied. Your audio is still here; ask an admin to run the migrations, then retry.',
      ),
    ).toBe(false)
  })
})

describe('shouldCutSegment', () => {
  it('does not cut before either threshold is reached', () => {
    expect(shouldCutSegment(SEGMENT_TARGET_MS - 1, SEGMENT_BYTE_SOFT_CAP - 1)).toBe(false)
  })

  it('cuts once the duration target is reached, even with few bytes', () => {
    expect(shouldCutSegment(SEGMENT_TARGET_MS, 100)).toBe(true)
  })

  it('cuts once the duration target is exceeded', () => {
    expect(shouldCutSegment(SEGMENT_TARGET_MS + 1, 100)).toBe(true)
  })

  it('cuts early once the byte safety cap is reached, even under the duration target', () => {
    expect(shouldCutSegment(1000, SEGMENT_BYTE_SOFT_CAP)).toBe(true)
  })

  it('cuts early once the byte safety cap is exceeded', () => {
    expect(shouldCutSegment(1000, SEGMENT_BYTE_SOFT_CAP + 1)).toBe(true)
  })

  it('treats zero elapsed/zero bytes as not-yet (a segment that just started)', () => {
    expect(shouldCutSegment(0, 0)).toBe(false)
  })
})

describe('concatenateSegments', () => {
  it('returns empty text and no gaps for an empty input', () => {
    expect(concatenateSegments([])).toEqual({ text: '', missingIndices: [] })
  })

  it('orders by index, not by array/arrival order', () => {
    const { text, missingIndices } = concatenateSegments([
      { index: 2, transcript: 'third' },
      { index: 0, transcript: 'first' },
      { index: 1, transcript: 'second' },
    ])
    expect(missingIndices).toEqual([])
    const firstAt = text.indexOf('first')
    const secondAt = text.indexOf('second')
    const thirdAt = text.indexOf('third')
    expect(firstAt).toBeGreaterThanOrEqual(0)
    expect(firstAt).toBeLessThan(secondAt)
    expect(secondAt).toBeLessThan(thirdAt)
  })

  it('reports a gap rather than silently skipping a missing index', () => {
    const { text, missingIndices } = concatenateSegments([
      { index: 0, transcript: 'first' },
      { index: 2, transcript: 'third' },
    ])
    expect(missingIndices).toEqual([1])
    expect(text).toContain('segment 2 (missing')
    expect(text).toContain('first')
    expect(text).toContain('third')
  })

  it('reports every gap when several indices are missing', () => {
    const { missingIndices } = concatenateSegments([
      { index: 0, transcript: 'first' },
      { index: 4, transcript: 'last' },
    ])
    expect(missingIndices).toEqual([1, 2, 3])
  })

  it('handles a single segment with no gaps', () => {
    const { text, missingIndices } = concatenateSegments([{ index: 0, transcript: 'only' }])
    expect(missingIndices).toEqual([])
    expect(text).toContain('only')
    expect(text).toContain('segment 1')
  })

  it('is stable when the same index appears twice (last write wins, no duplicate output)', () => {
    const { text } = concatenateSegments([
      { index: 0, transcript: 'stale' },
      { index: 0, transcript: 'fresh' },
    ])
    expect(text).toContain('fresh')
    expect(text).not.toContain('stale')
    expect(text.match(/segment 1/g)?.length).toBe(1)
  })
})
