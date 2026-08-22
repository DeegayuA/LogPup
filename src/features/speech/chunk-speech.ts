/**
 * Splits text into the pieces read-aloud actually synthesises.
 *
 * TWO problems, one fix. A whole summary sent as one TTS call returns the
 * entire clip as base64 inside a single Server Action response — roughly
 * 4.6MB for a 1,140-character summary and 6.8MB for a 1,663-character one,
 * against a ~4.5MB buffered-response ceiling. Measured against the real
 * stored summaries, every one was over the line, which means read-aloud
 * fails in production and surfaces as an opaque error that the client
 * reports as "could not reach the speech service" before falling back to
 * the device voice. Nothing reproduces locally, because the ceiling is not
 * local.
 *
 * The same split fixes the wait: a small FIRST chunk starts speaking in a
 * second or two instead of after the whole clip has been generated,
 * serialised and decoded.
 *
 * Streaming was investigated and rejected. Google's :streamGenerateContent
 * truncates audio past roughly 60s with finishReason 'OTHER' at HTTP 200,
 * and a full summary is 250-300s of speech — it would turn a slow reading
 * into a silently truncated one behind a green UI.
 *
 * Pure, so the boundary rules are pinned by tests rather than discovered in
 * a browser.
 */

/**
 * The first chunk is deliberately small: it is the only one the listener
 * waits on, and ~450 characters is about 30 seconds of speech — plenty of
 * runway to fetch the next while this one plays.
 */
export const HEAD_CHUNK_CHARS = 450

/**
 * Later chunks are larger (fewer requests, and nobody is waiting on them).
 * Per the measurements in the header (~4KB of base64 per English character),
 * ~900 effective characters is roughly 3.6MB of audio — about 80% of the
 * ~4.5MB ceiling, which is the real margin. There is no room for a script
 * that speaks slower per character, hence the effective-length weighting.
 */
export const TAIL_CHUNK_CHARS = 900

/**
 * Sinhala packs roughly TWICE the speech into each UTF-16 code unit that
 * English does (aksharas ~1.7-2.2 units per spoken syllable vs ~3.9-4.0 for
 * English under the header's own calibration), so a pure-Sinhala chunk sized
 * by .length would carry ~2x the audio and blow the response ceiling the
 * chunking exists to stay under. All budget math therefore runs on an
 * effective length that counts Sinhala-block units double.
 */
const SINHALA_UNIT = /[඀-෿]/

export function effectiveSpeechLength(text: string): number {
  let extra = 0
  for (let i = 0; i < text.length; i += 1) {
    if (SINHALA_UNIT.test(text[i])) extra += 1
  }
  return text.length + extra
}

/**
 * The largest raw slice length of `text` whose effective length stays within
 * `effectiveLimit` — the bridge from audio budgets to string offsets.
 */
export function rawLimitFor(text: string, effectiveLimit: number): number {
  let weight = 0
  for (let i = 0; i < text.length; i += 1) {
    weight += SINHALA_UNIT.test(text[i]) ? 2 : 1
    if (weight > effectiveLimit) return i
  }
  return text.length
}

/**
 * Hard cap. Every chunk is a separate billed request against the caller's
 * own free-tier rate limit, so an unbounded split would trade a broken
 * feature for an exhausted quota.
 */
export const MAX_SPEECH_CHUNKS = 5

/** Sentence-ish boundaries, including the Sinhala full stop (।) and ellipsis. */
const SENTENCE_END = /[.!?।…]/

/**
 * Where to cut `text` so the piece is at most `limit` characters and ends on
 * a finished thought. Prefers a sentence boundary, falls back to a word
 * boundary, and only cuts mid-word when a single "word" outruns the limit.
 */
function cutAt(text: string, limit: number): number {
  if (text.length <= limit) return text.length

  const window = text.slice(0, limit)

  // Walk back from the ceiling for terminal punctuation followed by a space
  // (or the very end of the window).
  for (let i = window.length - 1; i > limit * 0.4; i -= 1) {
    if (SENTENCE_END.test(window[i]) && (i + 1 >= window.length || /\s/.test(window[i + 1]))) {
      return i + 1
    }
  }

  // No sentence break worth honouring — one in the first 40% would waste
  // most of the chunk. Fall back to the last space.
  const lastSpace = window.lastIndexOf(' ')
  return lastSpace > limit * 0.4 ? lastSpace : limit
}

/**
 * The chunks to synthesise, in order. Empty for blank input; a single
 * element for anything that already fits in one head-sized piece.
 *
 * Text beyond what MAX_SPEECH_CHUNKS can hold is dropped here rather than
 * crammed into the last chunk — the caller (synthesizeSpeech) has already
 * truncated at a sentence boundary and reports that truncation to the UI,
 * so a shortened reading is something the listener is told about rather
 * than something they have to notice.
 */
export function chunkForSpeech(text: string): string[] {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (!trimmed) return []
  if (effectiveSpeechLength(trimmed) <= HEAD_CHUNK_CHARS) return [trimmed]

  const chunks: string[] = []
  let rest = trimmed

  while (rest.length > 0 && chunks.length < MAX_SPEECH_CHUNKS) {
    const limit = chunks.length === 0 ? HEAD_CHUNK_CHARS : TAIL_CHUNK_CHARS
    // Budgets are effective (audio-weighted) units; cutAt works in raw string
    // offsets, so translate first.
    const rawLimit = rawLimitFor(rest, limit)
    if (rest.length <= rawLimit) {
      chunks.push(rest)
      break
    }
    const cut = cutAt(rest, rawLimit)
    chunks.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }

  return chunks
}
