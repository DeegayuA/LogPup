import { rawLimitFor } from './chunk-speech'

/**
 * Markdown → something worth listening to.
 *
 * The summary panel renders MarkdownLite, so its raw content carries `##`,
 * `**`, `-` and link syntax. Sent straight to a speech engine those are not
 * silent: they get read out as "hash hash", "star star", "open bracket" — or,
 * with a model trying to be helpful, as an unpredictable mix. Either way the
 * listener hears punctuation nobody wrote for them.
 *
 * Deliberately a stripper, not a parser: it only has to make text speakable,
 * and a real Markdown AST here would be a second renderer to keep in step
 * with MarkdownLite. Pure, so it is unit-tested without a DOM.
 */
export function toSpokenText(markdown: string): string {
  return (
    markdown
      // Fenced code: read the code, not the fence.
      .replace(/```[a-z]*\n?/gi, '')
      .replace(/`([^`]+)`/g, '$1')
      // Images before links — an image's alt text is its only speakable part.
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      // Headings become sentences: the added full stop is what stops a
      // heading running into the paragraph below it as one breathless line.
      .replace(/^#{1,6}\s*(.+)$/gm, (_match, heading: string) =>
        /[.!?:]$/.test(heading.trim()) ? heading.trim() : `${heading.trim()}.`,
      )
      // Bullets and numbered items: drop the marker, keep the item.
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+[.)]\s+/gm, '')
      .replace(/^\s*>\s?/gm, '')
      // Emphasis markers carry nothing audible.
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      // Horizontal rules are pure typography.
      .replace(/^\s*([-*_])\1{2,}\s*$/gm, '')
      // Collapse the blank lines all of the above leaves behind.
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

/** Hard cap on what one TTS call will speak — see synthesizeSpeech. */
export const MAX_TTS_CHARS = 4000

/**
 * Terminal punctuation followed by ANY whitespace. Not just '. ': toSpokenText
 * turns bullets and headings into lines ending '.\n', and this runs BEFORE
 * chunkForSpeech normalises whitespace — a space-only search missed every
 * newline-terminated sentence in exactly the summaries this app produces.
 */
const SENTENCE_STOP = /[.!?।…](?=\s)/g

/**
 * Sinhala dependent signs (vowel signs, al-lakuna ්, ං/ඃ) and the zero-width
 * joiner — a cut may never leave one of these as the last character, and may
 * never strand text whose next character is one of them: both split a grapheme
 * cluster (e.g. ශ්‍රී), handing TTS a half-syllable to pronounce.
 */
const SINHALA_CONTINUATION = /[ංඃ්-ෟ‍]/

/** Share of non-whitespace characters that are Sinhala script — used by the
 * browser-voice fallback to decide whether an English default voice would
 * silently skip most of the content. */
export function sinhalaFraction(text: string): number {
  let sinhala = 0
  let total = 0
  for (const ch of text) {
    if (/\s/.test(ch)) continue
    total += 1
    if (/[඀-෿]/.test(ch)) sinhala += 1
  }
  return total === 0 ? 0 : sinhala / total
}

/**
 * Cuts `text` to at most `limit` EFFECTIVE characters (audio-weighted — see
 * effectiveSpeechLength; Sinhala counts double), preferring the last sentence
 * boundary in the final quarter so speech ends on a finished thought instead
 * of mid-word, and never splitting a Sinhala grapheme cluster at the cap.
 *
 * Lives here, not in actions.ts, and not only for the unit test: a
 * `'use server'` module may export nothing but async functions — every export
 * becomes a POST endpoint, and a sync helper cannot be one. The build
 * enforces that; this module is where the pure text helpers already live.
 */
export function truncateForSpeech(text: string, limit: number = MAX_TTS_CHARS): string {
  const rawLimit = rawLimitFor(text, limit)
  if (text.length <= rawLimit) return text
  const head = text.slice(0, rawLimit)

  let lastStop = -1
  for (const match of head.matchAll(SENTENCE_STOP)) lastStop = match.index
  // A stop as the window's very last character has no following whitespace to
  // match — count it too.
  if (/[.!?।…]$/.test(head)) lastStop = head.length - 1
  // Only honour a boundary in the last quarter — an early one would throw
  // away most of what was asked for.
  if (lastStop > rawLimit * 0.75) return head.slice(0, lastStop + 1)

  // Hard cap: back off to a word boundary when one is close enough, then walk
  // left off any split grapheme (next char continues the cluster, or the cut
  // sits right after a joiner).
  let cut = head.length
  const lastSpace = head.lastIndexOf(' ')
  if (lastSpace > rawLimit * 0.75) cut = lastSpace
  while (
    cut > 0 &&
    (SINHALA_CONTINUATION.test(text[cut]) || text[cut - 1] === '‍')
  ) {
    cut -= 1
  }
  return text.slice(0, cut)
}
