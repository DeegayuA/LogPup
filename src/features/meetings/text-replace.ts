// "You changed this word — it appears 7 other times. Fix those too?"
//
// A transcription model mis-hears a name the same way every time, so a
// correction is almost never local: fixing "Shanaka" to "Shanika" once leaves
// six more in the transcript, the summary and the action items. This module
// finds the others and applies the ones a person picks.
//
// Pure and dependency-free so the matching RULES are testable without a
// database — they are the whole feature, and the interesting cases (Sinhala,
// near-misses, partial words) are all decided here.
//
// Three deliberate constraints:
//
//  1. NO regex word boundaries. \b is defined on ASCII word characters, so
//     against Sinhala it matches at nearly every character boundary and would
//     report matches inside a single word. Boundaries come from Unicode
//     letter/number membership instead.
//  2. Fuzziness is bounded by LENGTH, not a fixed edit count. One edit in a
//     four-letter word is a different word; one edit in a twelve-letter name
//     is a typo. A flat threshold gets short words catastrophically wrong.
//  3. Every occurrence carries its surrounding text. A count is not
//     reviewable — somebody confirming a bulk edit has to see the sentence
//     each change lands in.

/** A haystack to search: a note segment, the summary, an action item. */
export type SearchTarget = {
  id: string
  /** Where this text lives, so the review UI can group and explain it. */
  kind: 'segment' | 'summary' | 'action' | 'transcript'
  text: string
  /** Human label for the group, e.g. a speaker name or "Summary". */
  label?: string
}

export type Occurrence = {
  targetId: string
  kind: SearchTarget['kind']
  label?: string
  /** Character offset of the match within the target's text. */
  start: number
  /** The text actually matched — may differ in case or spelling from the term. */
  matched: string
  /** 1 = identical; below 1 = a fuzzy near-miss. */
  similarity: number
  /** True when the match is not character-identical to the search term. */
  approximate: boolean
  context: { before: string; after: string }
}

/** How much text to show either side of a match in the review list. */
export const CONTEXT_CHARS = 48

/**
 * Longest edit distance tolerated for a term of `length` characters.
 *
 * Zero below five: at that size an edit is a different word ("bug"/"bus",
 * "දින"/"දිය"), and offering to rewrite those in bulk is how find-and-replace
 * destroys a transcript. Then one edit up to eight, two beyond — enough for
 * the way a speech model actually errs on names (Shanika/Shanaka,
 * Prabuddha/Prabudda) without reaching unrelated words.
 */
export function fuzzyBudget(length: number): number {
  if (length < 5) return 0
  if (length <= 8) return 1
  return 2
}

/**
 * How much word may hang off the end of a term and still be treated as the
 * same name inflected. Sinhala's case endings are short (ට, ගේ, ගෙන්, ලා);
 * five characters covers them without letting a term swallow the front of an
 * unrelated compound.
 */
const MAX_INFLECTION_CHARS = 5

/** Unicode-aware "could a word start here". */
function isWordStart(char: string | undefined): boolean {
  if (char === undefined) return false
  return /\p{L}|\p{N}|_/u.test(char)
}

/**
 * "Is this character part of a word already begun".
 *
 * `\p{M}` is the load-bearing part. Sinhala writes its vowels as combining
 * marks on a consonant — the ා in කතා is U+0DCF, category Mc, which `\p{L}`
 * does not match. Without marks in this class every Sinhala word broke at its
 * first vowel sign: "කතා" tokenised as "කත", and a search for a name would
 * have compared, matched and rewritten half of it. The same applies to every
 * abugida (Devanagari, Tamil) and to the virama ්.
 */
function isWordChar(char: string | undefined): boolean {
  if (char === undefined) return false
  return /\p{L}|\p{N}|\p{M}|[_'’-]/u.test(char)
}

/**
 * Levenshtein distance, capped: it gives up once the distance exceeds `max`,
 * which keeps the usual O(n·m) cheap for the common case of two words that
 * are nothing alike.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
      current.push(value)
      if (value < rowMin) rowMin = value
    }
    // The whole row is already past budget — no later row can come back under.
    if (rowMin > max) return max + 1
    previous = current
  }
  return previous[b.length]
}

/**
 * Word tokens with their offsets, by Unicode letter membership rather than
 * whitespace — so punctuation attached to a word ("Shanika,") stays out of
 * it, and Sinhala tokenises correctly.
 */
export function tokenize(text: string): { word: string; start: number }[] {
  const tokens: { word: string; start: number }[] = []
  let start = -1
  for (let i = 0; i <= text.length; i += 1) {
    // A word may only START on a letter or digit, but once begun it carries on
    // through combining marks — otherwise a stray mark after punctuation would
    // open a token of its own.
    if (start === -1 ? isWordStart(text[i]) : isWordChar(text[i])) {
      if (start === -1) start = i
    } else if (start !== -1) {
      tokens.push({ word: text.slice(start, i), start })
      start = -1
    }
  }
  return tokens
}

/**
 * "Did this edit correct exactly one word?" — and if so, which word became
 * which.
 *
 * Deliberately strict: same token count, exactly one position different. That
 * narrowness is the whole point. This is what decides whether to interrupt
 * somebody with "found this spelling 11 more times", and an offer to rewrite
 * eleven other places is only welcome when the edit really was a correction. A
 * looser diff would fire on rewritten sentences, where the "term" it picked
 * would be an arbitrary word from the middle of the change.
 *
 * Case-sensitive on purpose — fixing "sanjeewa" to "Sanjeewa" is precisely the
 * correction most worth offering to propagate.
 */
export function diffSingleWord(before: string, after: string): { from: string; to: string } | null {
  const a = tokenize(before)
  const b = tokenize(after)
  if (a.length === 0 || a.length !== b.length) return null

  let changed = -1
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].word === b[i].word) continue
    if (changed !== -1) return null
    changed = i
  }
  if (changed === -1) return null

  const from = a[changed].word
  const to = b[changed].word
  // A one-character term matches half the transcript; findOccurrences would
  // hand back noise and the offer would be worse than silence.
  if (from.length < 2 || to.length === 0) return null
  return { from, to }
}

export type FindOptions = {
  /** Off = character-identical matches only (case still ignored). */
  fuzzy?: boolean
  /** Match case exactly. Off by default — a transcript's casing is arbitrary. */
  caseSensitive?: boolean
}

/**
 * Every place `term` appears across `targets`.
 *
 * Multi-word terms match as a phrase over consecutive tokens, so "salary
 * advance" is found as a unit rather than two unrelated words. Results are
 * ordered by target then position — the order somebody reads them in.
 */
export function findOccurrences(
  targets: SearchTarget[],
  term: string,
  options: FindOptions = {},
): Occurrence[] {
  const needle = term.trim()
  if (!needle) return []

  const termTokens = tokenize(needle)
  if (termTokens.length === 0) return []

  const fold = (text: string) => (options.caseSensitive ? text : text.toLowerCase())
  const foldedTerm = fold(needle)
  const budget = options.fuzzy ? fuzzyBudget(needle.length) : 0

  const found: Occurrence[] = []

  for (const target of targets) {
    const tokens = tokenize(target.text)

    for (let i = 0; i + termTokens.length <= tokens.length; i += 1) {
      const first = tokens[i]
      const last = tokens[i + termTokens.length - 1]
      // Span the ORIGINAL text between first and last token, so whitespace
      // and punctuation inside a phrase are preserved exactly.
      const end = last.start + last.word.length
      const candidate = target.text.slice(first.start, end)
      const folded = fold(candidate)

      let similarity: number
      if (folded === foldedTerm) {
        similarity = 1
      } else if (budget > 0) {
        const distance = editDistance(folded, foldedTerm, budget)
        if (distance > budget) continue
        similarity = 1 - distance / Math.max(foldedTerm.length, 1)
      } else {
        continue
      }

      found.push({
        targetId: target.id,
        kind: target.kind,
        label: target.label,
        start: first.start,
        matched: candidate,
        similarity,
        approximate: similarity < 1,
        context: {
          before: target.text.slice(Math.max(0, first.start - CONTEXT_CHARS), first.start),
          after: target.text.slice(end, end + CONTEXT_CHARS),
        },
      })
    }

    // Inflected forms. Sinhala marks case with a suffix glued to the noun, so
    // the same misheard name appears as ශානිකගේ, ශානිකට, ශානිකගෙන් — one token
    // each, none equal to the name and all beyond the edit-distance budget
    // once the suffix is two or three characters long. Correcting a name would
    // otherwise reach every bare mention and none of the inflected ones, which
    // in a Sinhala transcript is most of them.
    //
    // The match spans ONLY the name, never the suffix, so applying it rewrites
    // ශානිකගේ to the corrected name plus ගේ — still possessive. Always
    // approximate: this is a longer word than what was searched for, and the
    // review row must say so before anyone ticks it.
    if (budget > 0 && termTokens.length === 1) {
      for (const token of tokens) {
        const suffixLength = token.word.length - needle.length
        if (suffixLength <= 0 || suffixLength > MAX_INFLECTION_CHARS) continue
        const prefix = token.word.slice(0, needle.length)
        if (editDistance(fold(prefix), foldedTerm, budget) > budget) continue
        const end = token.start + prefix.length
        found.push({
          targetId: target.id,
          kind: target.kind,
          label: target.label,
          start: token.start,
          matched: prefix,
          // Not an edit-distance score: the prefix may match the term exactly.
          // What is uncertain here is whether the longer word is the same word
          // at all, so the number says how much of it the term accounts for.
          similarity: needle.length / token.word.length,
          approximate: true,
          context: {
            before: target.text.slice(Math.max(0, token.start - CONTEXT_CHARS), token.start),
            after: target.text.slice(end, end + CONTEXT_CHARS),
          },
        })
      }
    }
  }

  return found
}

/** One occurrence somebody ticked, identified by where it is. */
export type Selection = { targetId: string; start: number; matched: string }

/**
 * Applies `replacement` at exactly the selected positions.
 *
 * Positions are applied per target from the END backwards, so replacing a
 * word with one of a different length never shifts the offsets of the
 * selections still to come — the classic off-by-N that turns a bulk rename
 * into corrupted text.
 *
 * A selection whose `matched` text no longer sits at its offset is SKIPPED
 * rather than guessed at: the note may have been edited since the matches
 * were found, and writing over whatever happens to be there now is how a
 * stale review screen eats somebody's work. Skipped ones are counted so the
 * caller can say so instead of silently claiming success.
 */
export function applyReplacements(
  targets: SearchTarget[],
  selections: Selection[],
  replacement: string,
): { updated: { id: string; text: string }[]; applied: number; skipped: number } {
  const byTarget = new Map<string, Selection[]>()
  for (const selection of selections) {
    const list = byTarget.get(selection.targetId) ?? []
    list.push(selection)
    byTarget.set(selection.targetId, list)
  }

  const updated: { id: string; text: string }[] = []
  let applied = 0
  let skipped = 0

  for (const target of targets) {
    const list = byTarget.get(target.id)
    if (!list || list.length === 0) continue

    let text = target.text
    let changedHere = 0
    const ordered = [...list].sort((a, b) => b.start - a.start)

    for (const selection of ordered) {
      const end = selection.start + selection.matched.length
      if (text.slice(selection.start, end) !== selection.matched) {
        skipped += 1
        continue
      }
      text = text.slice(0, selection.start) + replacement + text.slice(end)
      changedHere += 1
    }

    if (changedHere > 0) {
      updated.push({ id: target.id, text })
      applied += changedHere
    }
  }

  return { updated, applied, skipped }
}

const KIND_LABEL: Record<Occurrence['kind'], string> = {
  segment: 'Note',
  summary: 'Summary',
  action: 'Action item',
  transcript: 'Transcript',
}

/** Groups occurrences for review — one heading per place they live. */
export function groupOccurrences(occurrences: Occurrence[]): {
  kind: Occurrence['kind']
  label: string
  items: Occurrence[]
}[] {
  const groups = new Map<string, { kind: Occurrence['kind']; label: string; items: Occurrence[] }>()
  for (const occurrence of occurrences) {
    const label = occurrence.label ?? KIND_LABEL[occurrence.kind]
    const key = `${occurrence.kind}:${occurrence.targetId}`
    const group = groups.get(key) ?? { kind: occurrence.kind, label, items: [] }
    group.items.push(occurrence)
    groups.set(key, group)
  }
  return [...groups.values()]
}
