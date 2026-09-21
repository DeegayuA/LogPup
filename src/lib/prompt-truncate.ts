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
export const SINHALA_CONTINUATION = /[ංඃ්-ෟ‍]/

/** The zero-width joiner, which glues a virama to the next consonant (ව්‍යා). */
export const ZWJ = '\u200d'

/**
 * Walks a UTF-16 cut offset left until it no longer splits a Sinhala grapheme
 * cluster: the character at `cut` must not be a dependent sign, and the one
 * before it must not be a joiner. Returns 0 when everything before is marks.
 */
export function graphemeSafeCut(text: string, cut: number): number {
  while (cut > 0 && (SINHALA_CONTINUATION.test(text[cut]) || text[cut - 1] === ZWJ)) {
    cut -= 1
  }
  return cut
}

export function truncateAtWordBoundary(text: string, max: number): string {
  if (text.length <= max) return text
  const window = text.slice(0, max)
  const space = Math.max(window.lastIndexOf(' '), window.lastIndexOf('\n'))
  // A boundary further back than ~200 chars would cost real content for no
  // gain — no natural-language "word" is that long.
  let cut = space > max - 200 ? space : max
  cut = graphemeSafeCut(text, cut)
  return text.slice(0, cut)
}
