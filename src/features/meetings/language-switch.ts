/**
 * Pure decision logic for live bilingual speech recognition (see
 * `MeetingIntelPanel`). Sri Lankan meetings code-switch between Sinhala and
 * English mid-sentence — a single recognizer running one `lang` at a time
 * can never handle that, no matter how fast it switches. The design answer
 * was to run TWO concurrent `SpeechRecognition` instances (`en-US` and
 * `si-LK`) against the same microphone and, for every utterance, keep
 * whichever engine's result actually sounds right.
 *
 * MEASURED 2026-08-11 (Chrome 151): no browser we ship to can actually do
 * that. Chrome arbitrates one speech session per browser process — starting
 * the second silently ABORTS the first, and `start()` does not throw, so
 * nothing notices. Every target browser is affected (Edge and Android Chrome
 * are Chromium; Safari arbitrates one `SFSpeechRecognizer` the same way).
 * See docs/superpowers/specs/2026-08-11-live-transcription-design.md for the
 * event traces. The pairing logic below is therefore correct but currently
 * dormant: the component proves concurrency per browser before it will run
 * two engines, and otherwise runs exactly one and says so. Keep this file
 * honest about that — it is the difference between "degraded" and "lying".
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

// --- Script awareness --------------------------------------------------
// The Sinhala block. Sinhala is an abugida: one base letter carries a whole
// syllable and its vowel is a combining sign, so a Sinhala transcript of the
// same speech is systematically SHORTER in UTF-16 code units than an English
// one (~1.9 units per syllable against English's ~3.0 including spaces).
// Anything that compares the two engines by string length is therefore
// structurally biased towards English — see estimateSpokenUnits.
// Written as escapes, not as literal glyphs: the interesting ones here are
// combining marks that render invisibly (or on top of the bracket) in an
// editor, which is not a thing to have in a range expression.
const SINHALA_BLOCK = /[\u0D80-\u0DFF]/
/** Independent vowels + consonants — each is roughly one spoken syllable. */
const SINHALA_LETTER = /[\u0D85-\u0DC6]/g
/** Al-lakuna (virama): fuses the letters either side into one syllable. */
const SINHALA_VIRAMA = /\u0DCA/g
const LATIN_WORD = /[A-Za-z]+/g
const LATIN_VOWEL_GROUP = /[aeiouy]+/gi
const DIGIT_RUN = /\d+/g

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0
}

/**
 * Whether the text contains any Sinhala codepoint (U+0D80–U+0DFF). Pure.
 *
 * Deliberately NOT used to decide "which engine is hearing Sinhala": an
 * si-LK recognizer emits Sinhala script for whatever it hears, English
 * speech included, so that predicate is true almost whenever the si engine
 * has produced anything at all — it would just flip the English bias into a
 * Sinhala one. Where it IS diagnostic is the reverse direction: a browser
 * that accepted `lang = 'si-LK'` and then never emits a single Sinhala
 * codepoint is not transcribing Sinhala at all (see isSilentSinhalaFallback).
 */
export function containsSinhala(text: string): boolean {
  return SINHALA_BLOCK.test(text)
}

/**
 * Estimates how many syllables of speech a transcript represents, in a unit
 * that is comparable ACROSS scripts — the whole point being that two engines
 * transcribing the same audio into different scripts can then be measured
 * against each other fairly.
 *
 *   Sinhala — count base letters, subtract viramas (a consonant cluster
 *             written C + virama + C is one syllable, not two).
 *   Latin   — count vowel groups per word, minimum one per word; the
 *             standard cheap English syllable heuristic.
 *   Digits  — one unit per run. A crude approximation ("2026" is four
 *             syllables, not one) but digit runs are rare in speech
 *             transcripts and never the thing that decides a comparison.
 *
 * An estimate, not a linguistic analysis: it only has to be unbiased between
 * the two scripts, not exact in either.
 */
export function estimateSpokenUnits(text: string): number {
  const sinhala = Math.max(0, countMatches(text, SINHALA_LETTER) - countMatches(text, SINHALA_VIRAMA))
  let latin = 0
  for (const word of text.match(LATIN_WORD) ?? []) {
    latin += Math.max(1, countMatches(word, LATIN_VOWEL_GROUP))
  }
  return sinhala + latin + countMatches(text, DIGIT_RUN)
}

/**
 * How far ahead a challenger must be, in estimated spoken units, before it
 * takes the interim display away from the engine currently holding it. A
 * live transcript that flips between two scripts on every partial result is
 * unreadable, so the incumbent is sticky on purpose.
 */
export const INTERIM_LEADER_MARGIN = 1.25

export interface InterimLeaderInput {
  /** The en-US engine's current partial (uncommitted) transcript. */
  en: string
  /** The si-LK engine's current partial (uncommitted) transcript. */
  si: string
  /** Language of the last ACCEPTED utterance — conversation inertia, same
   *  idea pickUtterance uses, applied when nothing else decides. */
  previousLang: ActiveLanguage | null
  /** Whichever engine's partial is on screen right now, if any. Gives the
   *  incumbent its stickiness; pass null when nothing is displayed yet. */
  currentLeader: ActiveLanguage | null
}

/**
 * Picks whose partial result to show while someone is still talking. Pure.
 *
 * Decision order:
 *   1. Neither engine has text → null (show nothing).
 *   2. Exactly one has text → that one, trivially.
 *   3. Both have text → compare estimateSpokenUnits, NOT string length (see
 *      the block comment above for why length is biased). The incumbent
 *      (current leader, else previousLang) keeps the display unless the
 *      challenger is ahead by INTERIM_LEADER_MARGIN.
 *   4. No incumbent → more spoken units wins; an exact tie goes to en-US so
 *      the function stays deterministic.
 *
 * Works unchanged for single-engine mode: the absent engine's partial is
 * always '', so rule 2 answers every call.
 */
export function pickInterimLeader({
  en,
  si,
  previousLang,
  currentLeader,
}: InterimLeaderInput): ActiveLanguage | null {
  if (!en && !si) return null
  if (!si) return 'en-US'
  if (!en) return 'si-LK'

  const enUnits = estimateSpokenUnits(en)
  const siUnits = estimateSpokenUnits(si)

  const incumbent = currentLeader ?? previousLang
  if (incumbent) {
    const challenger: ActiveLanguage = incumbent === 'en-US' ? 'si-LK' : 'en-US'
    const incumbentUnits = incumbent === 'en-US' ? enUnits : siUnits
    const challengerUnits = challenger === 'en-US' ? enUnits : siUnits
    return challengerUnits > incumbentUnits * INTERIM_LEADER_MARGIN ? challenger : incumbent
  }

  if (enUnits === siUnits) return 'en-US'
  return enUnits > siUnits ? 'en-US' : 'si-LK'
}

/** How many finals from the si-LK engine to look at before concluding the
 *  browser isn't really transcribing Sinhala. Small enough to tell the user
 *  early, large enough that one odd result (a bare "OK", a number) can't
 *  trigger it. */
export const SINHALA_FALLBACK_SAMPLE = 4

/**
 * Whether a browser that ACCEPTED `lang = 'si-LK'` is silently transcribing
 * something else. Some engines (Safari's especially) don't reject an
 * unsupported locale — they quietly fall back to the system language and
 * return confident English for Sinhala speech, which is worse than an error
 * because nothing looks wrong. A Sinhala recognizer writes Sinhala script;
 * several finals in a row with not one codepoint from the block means it is
 * not a Sinhala recognizer. Pure — the caller counts, this decides.
 */
export function isSilentSinhalaFallback({
  finalsSeen,
  finalsWithSinhala,
}: {
  finalsSeen: number
  finalsWithSinhala: number
}): boolean {
  return finalsSeen >= SINHALA_FALLBACK_SAMPLE && finalsWithSinhala === 0
}

/** How many restarts-without-audio it takes to call it a storm. Measured
 *  behaviour of two engines killing each other is thousands of restarts per
 *  second, so anything above a handful is already conclusive; a legitimate
 *  engine reaches `audiostart` on its first or second try. */
export const RESTART_STORM_LIMIT = 6

/**
 * Whether an engine's restart loop has become a storm — the signature of two
 * `SpeechRecognition` sessions aborting each other, where every restart of
 * one kills the other and neither ever reaches `audiostart`. Measured on
 * Chrome 151: ~30,000 session ends in under 7 seconds and zero results. The
 * caller resets the counter whenever the engine actually reaches audio, so
 * this only ever counts consecutive fruitless restarts. Pure.
 */
export function isRestartStorm({ restartsWithoutAudio }: { restartsWithoutAudio: number }): boolean {
  return restartsWithoutAudio >= RESTART_STORM_LIMIT
}

/** Upper bound on how long to wait, after starting a second engine, to see
 *  whether it killed the first. The observed kill lands in ~10ms (Chrome
 *  aborts the incumbent session synchronously with the new one's start), so
 *  this is slack, not a latency budget. */
export const DUAL_PROBE_WINDOW_MS = 600

/** How long to wait before retrying a `recognition.start()` that threw. The
 *  browser is mid-teardown of the previous session; there is no event that
 *  will tell us when it's done, and no session means no future `onend` to
 *  retry from — so a timer is the only way back. */
export const RESTART_RETRY_MS = 150
/** How many times to retry that before giving the engine up for dead. */
export const RESTART_RETRY_LIMIT = 4
