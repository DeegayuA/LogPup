/**
 * Truncates text that is about to be embedded in an AI prompt.
 *
 * A raw `.slice(0, N)` cuts at an arbitrary UTF-16 offset, which for Sinhala
 * can land inside a grapheme cluster — stranding a bare consonant where
 * ව්‍යාපෘතිය used to be, so the final word the model reads is a half-syllable.
 * Backing off to the last whitespace fixes the common case; the mark-walk
 * covers pathological whitespace-free tails.
 *
 * Lives outside the 'use server' action modules because a sync helper cannot
 * be exported from one (every export there becomes a POST endpoint).
 */

/** Sinhala dependent signs and the zero-width joiner — a cut before one of
 * these (or straight after a joiner) splits a grapheme cluster. */
const SINHALA_CONTINUATION = /[ංඃ්-ෟ‍]/

export function truncateAtWordBoundary(text: string, max: number): string {
  if (text.length <= max) return text
  const window = text.slice(0, max)
  const space = Math.max(window.lastIndexOf(' '), window.lastIndexOf('\n'))
  // A boundary further back than ~200 chars would cost real content for no
  // gain — no natural-language "word" is that long.
  let cut = space > max - 200 ? space : max
  while (cut > 0 && (SINHALA_CONTINUATION.test(text[cut]) || text[cut - 1] === '‍')) {
    cut -= 1
  }
  return text.slice(0, cut)
}
