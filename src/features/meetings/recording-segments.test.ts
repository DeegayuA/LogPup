import { describe, expect, it } from 'vitest'
import {
  SEGMENT_BYTE_SOFT_CAP,
  SEGMENT_TARGET_MS,
  concatenateSegments,
  shouldCutSegment,
} from './recording-segments'

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
