// Pure, unit-testable pieces of change-detected screen keyframe capture: the
// perceptual hash used to decide whether the shared screen actually changed,
// the keep/skip decision, and the downscale dimension math for the frame
// that gets uploaded. Kept free of DOM/canvas/network calls on purpose, same
// as recording-segments.ts and audio-strategy.ts — the client capture hook
// (use-screen-keyframes.ts) and the server upload action (ai-actions.ts)
// both import these to decide what to do, not how to draw a frame or talk to
// Blob storage.
//
// Why keyframes instead of recording the screen: a full 720p screen
// recording runs ~450-900 MB/hour — against the ~14 MB/hour the segmented
// audio path already costs (see the bitrate comment in meeting-intel.tsx),
// that's a 30-60x jump for video Gemini would mostly never need to look at.
// Sampling periodically and keeping only frames that perceptually changed
// (a new slide, a diagram, a code diff) gets the "what was on screen"
// context Gemini needs for a fraction of the cost — see the README-style
// cost comment near MAX_KEYFRAMES_PER_MEETING below for the actual numbers.

/**
 * How often the capture hook looks at the current video frame to decide
 * whether it's worth keeping. Screen content (slides, diagrams, shared
 * code) doesn't meaningfully change faster than this in practice — a
 * shorter interval would mostly just sample the same slide again and burn
 * CPU/GC on canvas draws that get thrown away by the hash comparison below.
 */
export const SAMPLE_INTERVAL_MS = 10_000

// --- Perceptual hash: dHash (difference hash) -----------------------------
//
// Chosen over aHash (average hash) because it compares each pixel to its
// NEIGHBOR's brightness (a gradient) rather than to the image's global
// average. A screen share's average brightness drifts for reasons that have
// nothing to do with the content actually changing — a video thumbnail
// playing in the corner, a progress bar animating, a cursor blinking, minor
// JPEG/codec noise from the capture pipeline itself. aHash would flag all of
// those as "the screen changed"; dHash only reacts to edges/structure moving
// around, which is a much closer proxy for "is there something new to read
// here" (a slide advance, a diagram redraw, a code diff).
//
// Grid: the classic, well-studied dHash uses a 9x8 grayscale thumbnail (9
// columns so each of the 8 rows yields 8 adjacent-pixel comparisons -> a
// 64-bit hash). Kept at that canonical size rather than a larger thumbnail:
// more pixels would make the hash sensitive to exactly the kind of noise
// (compression artifacts, sub-pixel font rendering differences) it's meant
// to ignore, without meaningfully improving "did the slide change"
// detection — 64 bits of gradient signal is already far more resolution
// than a keep/skip decision needs.

/** Width of the grayscale thumbnail the hash is computed from (one column
 *  more than HASH_HEIGHT's row width, since dHash compares each pixel to
 *  its immediate right neighbor — see computeDHash). */
export const HASH_WIDTH = 9
export const HASH_HEIGHT = 8
/** Total bits in one dHash: HASH_HEIGHT rows * (HASH_WIDTH - 1) comparisons per row. */
export const HASH_BITS = HASH_HEIGHT * (HASH_WIDTH - 1)

/**
 * Computes a dHash from an already-extracted grayscale pixel array
 * (row-major, length must be HASH_WIDTH * HASH_HEIGHT, values 0-255).
 * Extracting those pixels from a canvas is the caller's job (DOM-dependent,
 * hence not here) — this function is pure so it can be fed synthetic pixel
 * arrays in tests without touching a canvas at all.
 *
 * Each bit is `true` when a pixel is brighter than the pixel immediately to
 * its right, `false` otherwise — the same rule applied consistently is what
 * makes two renders of the same image produce the identical hash (see the
 * "stable/deterministic" test) while a genuinely different image flips a
 * large fraction of the bits.
 */
export function computeDHash(pixels: number[]): boolean[] {
  if (pixels.length !== HASH_WIDTH * HASH_HEIGHT) {
    throw new Error(`computeDHash expects ${HASH_WIDTH * HASH_HEIGHT} pixels, got ${pixels.length}`)
  }
  const bits: boolean[] = []
  for (let row = 0; row < HASH_HEIGHT; row += 1) {
    for (let col = 0; col < HASH_WIDTH - 1; col += 1) {
      const left = pixels[row * HASH_WIDTH + col]
      const right = pixels[row * HASH_WIDTH + col + 1]
      bits.push(left > right)
    }
  }
  return bits
}

/**
 * Hamming distance between two same-length bit arrays — the count of
 * positions where they disagree. 0 means identical hashes (and, in
 * practice, an unchanged screen); HASH_BITS means every bit flipped (a
 * maximally different image). shouldKeepFrame below compares this against
 * KEYFRAME_DIFF_THRESHOLD.
 */
export function hammingDistance(a: boolean[], b: boolean[]): number {
  if (a.length !== b.length) {
    throw new Error(`hammingDistance expects equal-length hashes (${a.length} vs ${b.length})`)
  }
  let distance = 0
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) distance += 1
  }
  return distance
}

/**
 * Minimum Hamming distance (out of HASH_BITS = 64) from the last KEPT
 * frame's hash before a new frame counts as "meaningfully changed". Widely
 * used dHash implementations treat single-digit bit differences as visually
 * near-identical (compression noise, a blinking cursor, a font hint
 * rounding differently) and treat anything past ~15% of the hash as a real
 * change; 10/64 (~15.6%) sits right at that line — comfortably past the
 * few-bit jitter a static slide produces, but well before the distance a
 * genuinely different slide/diagram/code view lands at.
 */
export const KEYFRAME_DIFF_THRESHOLD = 10

/**
 * Hard cap on kept keyframes for a single meeting — a client-side stop AND
 * (separately, see uploadMeetingKeyframe in ai-actions.ts) a server-enforced
 * one, since a client cap alone is not a real limit. At the 10s sample
 * interval above, even a meeting that hits this cap only does so because the
 * screen kept changing; a still/mostly-static share (the common case) keeps
 * far fewer. Bounding it here means the worst case is a fixed, known cost
 * per meeting (see the byte-size comment on MAX_KEYFRAME_BYTES in
 * ai-actions.ts for the actual MB figure) rather than an open-ended one for
 * a meeting that runs unusually long.
 */
export const MAX_KEYFRAMES_PER_MEETING = 60

/**
 * The keep/skip decision for one sampled frame. Order matters:
 *  1. The cap is absolute — once reached, nothing more is kept, regardless
 *     of how different the frame is.
 *  2. The very first frame of a meeting is always kept even though there is
 *     no prior hash to diff against — the opening screen (e.g. a shared
 *     agenda or starting slide) is meaningful context on its own.
 *  3. Otherwise, keep only if the hash distance clears the threshold.
 */
export function shouldKeepFrame(
  distance: number,
  isFirst: boolean,
  keptCount: number,
  max: number = MAX_KEYFRAMES_PER_MEETING,
): boolean {
  if (keptCount >= max) return false
  if (isFirst) return true
  return distance > KEYFRAME_DIFF_THRESHOLD
}

// --- Upload-frame downscale -------------------------------------------------

/**
 * Long-edge cap for the full frame that actually gets uploaded (distinct
 * from the tiny HASH_WIDTH x HASH_HEIGHT thumbnail used only for the diff
 * decision above). 1280px keeps a 1080p slide or a wide monitor legible
 * enough for Gemini to read on-screen text/code/diagrams from, while
 * keeping the JPEG a few hundred KB rather than multiple MB — see the
 * report's MB/hour figure for what that costs at the MAX_KEYFRAMES_PER_MEETING cap.
 */
export const MAX_KEYFRAME_LONG_EDGE_PX = 1280

/** JPEG quality for the uploaded frame — see the encode step in use-screen-keyframes.ts. */
export const KEYFRAME_JPEG_QUALITY = 0.7

/**
 * Downscaled dimensions for a captured frame, clamped so its LONG edge never
 * exceeds `maxLongEdge`. Preserves aspect ratio (both dimensions scaled by
 * the same factor) and never upscales — a frame already smaller than the
 * cap (e.g. a shared window, not a full monitor) is returned unchanged
 * rather than blown up and softened for no benefit.
 */
export function computeDownscaledDimensions(
  width: number,
  height: number,
  maxLongEdge: number = MAX_KEYFRAME_LONG_EDGE_PX,
): { width: number; height: number } {
  const longEdge = Math.max(width, height)
  if (longEdge <= maxLongEdge) return { width, height }
  const scale = maxLongEdge / longEdge
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/**
 * Formats a captured-at offset (ms from the start of the recording, per
 * meeting_screenshots.capturedAtMs) as "M:SS" (or "H:MM:SS" past an hour) —
 * shared by the filmstrip's timestamp caption (meeting-intel.tsx) and the
 * label attached to each image part in the final synthesis prompt
 * (finalizeMeetingRecording, ai-actions.ts), so the number a person sees
 * under a thumbnail is exactly the number the model was told.
 */
export function formatCapturedAt(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`
}
