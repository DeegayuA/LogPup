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
 * Cuts `text` to at most `limit` characters, preferring the last sentence
 * boundary in the final quarter so speech ends on a finished thought instead
 * of mid-word.
 *
 * Lives here, not in actions.ts, and not only for the unit test: a
 * `'use server'` module may export nothing but async functions — every export
 * becomes a POST endpoint, and a sync helper cannot be one. The build
 * enforces that; this module is where the pure text helpers already live.
 */
export function truncateForSpeech(text: string, limit: number = MAX_TTS_CHARS): string {
  if (text.length <= limit) return text
  const head = text.slice(0, limit)
  const lastStop = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '))
  // Only honour a boundary in the last quarter — an early one would throw
  // away most of what was asked for.
  return lastStop > limit * 0.75 ? head.slice(0, lastStop + 1) : head
}
