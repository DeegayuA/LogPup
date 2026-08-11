/**
 * Pure decision logic for live bilingual speech recognition (see
 * `MeetingIntelPanel`). Sri Lankan meetings code-switch between Sinhala and
 * English mid-sentence — a single recognizer running one `lang` at a time
 * can never handle that, no matter how fast it switches. Instead the
 * component runs TWO concurrent `SpeechRecognition` instances (`en-US` and
 * `si-LK`) against the same microphone and, for every utterance, keeps
 * whichever engine's result actually sounds right.
 *
 * Kept side-effect free and framework-free on purpose: the component owns
 * all the mutable state (the two recognizer instances, the pairing buffer,
 * timestamps) and calls these on every final result to get a plain answer —
 * which candidate wins, and when to stop waiting for a pair.
 *
 * Historical note: this file previously held a single-recognizer
 * "confidence-average + 10s cooldown" auto-switcher. That approach assumed
 * one language per meeting and reacted on the order of seconds, which is
 * the wrong shape for a sentence that switches languages twice. It has been
 * replaced outright rather than kept alongside the new logic — two
 * competing "which language is this" mechanisms would just fight each
 * other.
 */

/** Recognition languages the two concurrent engines run. There is no
 *  "auto" value here — that is a UI-level preference (see
 *  `LanguagePreference` in meeting-intel.tsx) describing whether BOTH
 *  engines run at once or the user pinned it down to one. */
export type ActiveLanguage = 'en-US' | 'si-LK'

/** One engine's finalized result for (roughly) one utterance. */
export interface UtteranceCandidate {
  lang: ActiveLanguage
  text: string
  /** Omitted by some browsers entirely — never assume a number here, and
   *  never treat a missing value as evidence of a bad match. */
  confidence?: number
}

export interface PickUtteranceInput {
  /** Every candidate finalized for this utterance — in practice 1 (only one
   *  engine produced a final within the pairing window) or 2 (both did).
   *  Order matters only for the tie-break case documented below. */
  candidates: UtteranceCandidate[]
  /** The language the last ACCEPTED utterance was in, or `null` at the very
   *  start of a recording before anything has been accepted yet. Used only
   *  as a fallback when confidence can't decide (see below) — never
   *  overrides a real confidence signal. */
  previousLang: ActiveLanguage | null
}

/**
 * Picks the winning candidate for one utterance. Pure: same input always
 * yields the same output, no timers, no DOM, no recognizer access.
 *
 * Decision order:
 *   1. Zero candidates → null (nothing to pick from).
 *   2. One candidate → that one, whatever its confidence (nothing to
 *      compare it against).
 *   3. Two candidates, both with a numeric confidence → higher confidence
 *      wins. Exactly equal confidence is a tie: resolved deterministically
 *      by taking the FIRST candidate in the input array. This is a
 *      documented, arbitrary-but-stable rule (not conversation inertia —
 *      that's reserved for the "no usable confidence at all" case below) so
 *      identical inputs always produce identical output; callers should
 *      pass candidates in a consistent order (e.g. en-US, then si-LK) so
 *      the tie-break is at least predictable to a human reading the code.
 *   4. Two candidates, only one with a numeric confidence → that one wins
 *      (a real number beats an absent one).
 *   5. Two candidates, NEITHER with a usable confidence (common — some
 *      browsers never report it) → conversation inertia: prefer whichever
 *      candidate's language matches `previousLang`, since a speaker is more
 *      likely mid-thought in the same language than switching every
 *      sentence. If neither matches (or there is no previous language yet),
 *      fall back to the first candidate for the same determinism reason as
 *      the tie-break above.
 */
export function pickUtterance({ candidates, previousLang }: PickUtteranceInput): UtteranceCandidate | null {
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]

  const [first, second] = candidates
  const firstConfidence = first.confidence
  const secondConfidence = second.confidence
  const firstHasConfidence = typeof firstConfidence === 'number'
  const secondHasConfidence = typeof secondConfidence === 'number'

  if (firstHasConfidence && secondHasConfidence) {
    if (firstConfidence === secondConfidence) return first // tie-break: first wins, deterministically
    return firstConfidence > secondConfidence ? first : second
  }
  if (firstHasConfidence) return first
  if (secondHasConfidence) return second

  // Neither engine reported a usable confidence — fall back to whichever
  // matches the previously accepted utterance's language.
  if (previousLang) {
    const matchingPrevious = candidates.find((c) => c.lang === previousLang)
    if (matchingPrevious) return matchingPrevious
  }
  return first
}

/** How long to hold a finalized utterance from one engine, waiting to see
 *  if the other engine finalizes its own result for (roughly) the same
 *  stretch of speech, before giving up and using what arrived alone. The
 *  two engines never finalize in perfect lockstep — one is usually a few
 *  hundred ms ahead — so this has to comfortably cover that lag without
 *  making the live transcript feel like it's stalling. 1.2s is long enough
 *  for that gap in practice, short enough that a genuinely single-engine
 *  utterance (the other engine heard nothing worth finalizing) still shows
 *  up promptly. */
export const UTTERANCE_PAIR_WINDOW_MS = 1_200

/**
 * Whether a buffered-but-unpaired utterance has waited long enough that it
 * should be flushed on its own rather than continuing to wait for a partner
 * that may never come (e.g. the other engine genuinely heard nothing, or
 * its result got dropped). Pure — the caller supplies the elapsed time, a
 * real timer drives when this actually gets checked.
 */
export function shouldFlush(bufferAgeMs: number): boolean {
  return bufferAgeMs >= UTTERANCE_PAIR_WINDOW_MS
}
