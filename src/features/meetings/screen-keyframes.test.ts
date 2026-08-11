import { describe, expect, it } from 'vitest'
import {
  HASH_BITS,
  HASH_HEIGHT,
  HASH_WIDTH,
  KEYFRAME_DIFF_THRESHOLD,
  MAX_KEYFRAME_LONG_EDGE_PX,
  MAX_KEYFRAMES_PER_MEETING,
  computeDHash,
  computeDownscaledDimensions,
  formatCapturedAt,
  hammingDistance,
  shouldKeepFrame,
} from './screen-keyframes'

// A flat, mid-gray thumbnail — every pixel equal, so every adjacent
// comparison is "not brighter" (false). A legitimate, if boring, hash.
function flatPixels(value = 128): number[] {
  return new Array(HASH_WIDTH * HASH_HEIGHT).fill(value)
}

// A thumbnail with a hard left/right split (bright left half, dark right
// half) — a legitimate, non-flat image, used where the tests just need
// "some real hash" rather than a specific distance from flatPixels.
function splitPixels(): number[] {
  const pixels: number[] = []
  for (let row = 0; row < HASH_HEIGHT; row += 1) {
    for (let col = 0; col < HASH_WIDTH; col += 1) {
      pixels.push(col < HASH_WIDTH / 2 ? 240 : 15)
    }
  }
  return pixels
}

// Column-alternating bright/dark checkerboard — every adjacent pixel pair
// disagrees, so (unlike splitPixels, which only differs from flat at one
// boundary per row) this flips roughly half of every row's dHash bits.
// Used as the "clearly different pattern" case: a real slide/diagram change
// looks like this in dHash terms — lots of new edges, not one moved
// boundary — while flatPixels stands in for "the screen didn't change".
function checkerboardPixels(): number[] {
  const pixels: number[] = []
  for (let row = 0; row < HASH_HEIGHT; row += 1) {
    for (let col = 0; col < HASH_WIDTH; col += 1) {
      pixels.push(col % 2 === 0 ? 240 : 15)
    }
  }
  return pixels
}

describe('computeDHash', () => {
  it('produces a hash of the documented bit length', () => {
    expect(computeDHash(flatPixels())).toHaveLength(HASH_BITS)
  })

  it('is deterministic — same pixels in, same hash out, every time', () => {
    const pixels = splitPixels()
    const first = computeDHash(pixels)
    const second = computeDHash(pixels)
    expect(second).toEqual(first)
  })

  it('throws on a pixel array of the wrong size rather than silently misreading it', () => {
    expect(() => computeDHash([1, 2, 3])).toThrow()
  })
})

describe('hammingDistance', () => {
  it('is zero for identical hashes (identical images)', () => {
    const hash = computeDHash(splitPixels())
    expect(hammingDistance(hash, hash)).toBe(0)
  })

  it('is zero for two independently-hashed copies of the same image', () => {
    const a = computeDHash(splitPixels())
    const b = computeDHash(splitPixels())
    expect(hammingDistance(a, b)).toBe(0)
  })

  it('is above the keyframe threshold for a clearly different pattern', () => {
    const flat = computeDHash(flatPixels())
    const checkerboard = computeDHash(checkerboardPixels())
    expect(hammingDistance(flat, checkerboard)).toBeGreaterThan(KEYFRAME_DIFF_THRESHOLD)
  })

  it('throws when comparing hashes of different lengths', () => {
    expect(() => hammingDistance([true], [true, false])).toThrow()
  })
})

describe('shouldKeepFrame', () => {
  it('always keeps the first frame, even with zero distance', () => {
    expect(shouldKeepFrame(0, true, 0, MAX_KEYFRAMES_PER_MEETING)).toBe(true)
  })

  it('keeps a non-first frame whose distance is over the threshold', () => {
    expect(shouldKeepFrame(KEYFRAME_DIFF_THRESHOLD + 1, false, 5, MAX_KEYFRAMES_PER_MEETING)).toBe(true)
  })

  it('skips a non-first frame whose distance is at or under the threshold', () => {
    expect(shouldKeepFrame(KEYFRAME_DIFF_THRESHOLD, false, 5, MAX_KEYFRAMES_PER_MEETING)).toBe(false)
    expect(shouldKeepFrame(0, false, 5, MAX_KEYFRAMES_PER_MEETING)).toBe(false)
  })

  it('respects the cap — refuses even a maximally different frame once the cap is hit', () => {
    expect(shouldKeepFrame(64, false, MAX_KEYFRAMES_PER_MEETING, MAX_KEYFRAMES_PER_MEETING)).toBe(false)
  })

  it('respects the cap for the first frame too', () => {
    expect(shouldKeepFrame(0, true, MAX_KEYFRAMES_PER_MEETING, MAX_KEYFRAMES_PER_MEETING)).toBe(false)
  })

  it('keeps right up to (but not past) the cap boundary', () => {
    expect(shouldKeepFrame(64, false, MAX_KEYFRAMES_PER_MEETING - 1, MAX_KEYFRAMES_PER_MEETING)).toBe(true)
  })
})

describe('computeDownscaledDimensions', () => {
  it('never upscales — dimensions already under the cap pass through unchanged', () => {
    expect(computeDownscaledDimensions(800, 600, MAX_KEYFRAME_LONG_EDGE_PX)).toEqual({
      width: 800,
      height: 600,
    })
  })

  it('leaves dimensions exactly at the cap unchanged', () => {
    expect(computeDownscaledDimensions(1280, 720, 1280)).toEqual({ width: 1280, height: 720 })
  })

  it('clamps the long edge and preserves aspect ratio for a landscape frame', () => {
    const { width, height } = computeDownscaledDimensions(3840, 2160, 1280)
    expect(width).toBe(1280)
    // 2160/3840 * 1280 = 720
    expect(height).toBe(720)
  })

  it('clamps the long edge and preserves aspect ratio for a portrait frame', () => {
    const { width, height } = computeDownscaledDimensions(2160, 3840, 1280)
    expect(height).toBe(1280)
    expect(width).toBe(720)
  })

  it('treats a square frame symmetrically', () => {
    expect(computeDownscaledDimensions(2000, 2000, 1280)).toEqual({ width: 1280, height: 1280 })
  })
})

describe('formatCapturedAt', () => {
  it('formats zero as 0:00', () => {
    expect(formatCapturedAt(0)).toBe('0:00')
  })

  it('formats sub-minute offsets without an hour or leading-zero minute', () => {
    expect(formatCapturedAt(45_000)).toBe('0:45')
  })

  it('formats minutes and seconds', () => {
    expect(formatCapturedAt(125_000)).toBe('2:05')
  })

  it('formats past the hour mark with a padded H:MM:SS', () => {
    expect(formatCapturedAt(3_661_000)).toBe('1:01:01')
  })

  it('rounds to the nearest second rather than truncating', () => {
    expect(formatCapturedAt(59_600)).toBe('1:00')
  })
})
