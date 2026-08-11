/**
 * Pure decision logic for automatic language switching during live speech
 * recognition (see `MeetingIntelPanel`). The Web Speech API can't detect a
 * spoken language on its own — it only ever transcribes in whatever `lang`
 * it was started with — so "auto" mode fakes detection by watching how
 * *confident* the recognizer is in what it's hearing and switching to the
 * other language when confidence drops enough, for long enough, that the
 * recognizer is probably listening to the wrong one.
 *
 * Kept side-effect free and framework-free on purpose: the component owns
 * all the mutable state (the rolling confidence window, the recognizer
 * instance, timestamps) and calls this on every final result to get a
 * yes/no answer.
 */

/** Recognition languages this feature actually switches between. "Auto" is
 *  a UI-level preference, never a value passed to SpeechRecognition itself. */
export type ActiveLanguage = 'en-US' | 'si-LK'

/** Rolling-window size: how many of the most recent FINAL results'
 *  confidence scores are averaged before considering a switch. Small
 *  enough to react within a sentence or two of the language actually
 *  changing; large enough that one misheard word doesn't trigger a switch
 *  on its own. */
export const CONFIDENCE_WINDOW_SIZE = 4

/** Rolling-average confidence below which the current language is treated
 *  as a poor fit. The Web Speech API tends to report ~0.85-0.95 confidence
 *  when it's transcribing the language it was told to expect, and drops
 *  well under 0.5 when it's forcing phonemes from the wrong language into
 *  that grammar — 0.6 sits between the two without tripping on ordinary
 *  recognition noise (accents, cross-talk, a mumbled word). */
export const CONFIDENCE_SWITCH_THRESHOLD = 0.6

/** Minimum time between automatic switches. Restarting the recognizer
 *  drops a beat of audio, so this is the hysteresis that stops one bad
 *  ~2-second patch (a cough, a proper noun, background noise) from
 *  ping-ponging the language back and forth. */
export const SWITCH_COOLDOWN_MS = 10_000

export interface ShouldSwitchLanguageInput {
  /** Confidence scores from the most recent FINAL results, oldest first.
   *  Callers must omit samples where `confidence` was `undefined` (some
   *  browsers never report it) — an absent score is not evidence of a bad
   *  match and must never count toward the average. Only the most recent
   *  `CONFIDENCE_WINDOW_SIZE` entries are considered; extra history is
   *  ignored rather than being an error. */
  confidences: number[]
  /** The language currently in use. Not read by the decision itself
   *  (averaging + cooldown alone decide *whether* to switch — the caller
   *  decides *to which* language), but kept in the shape so call sites
   *  stay self-documenting and any future per-language tuning has
   *  somewhere to hang. */
  currentLang: ActiveLanguage
  /** Milliseconds since the last automatic switch (or since recording
   *  started, if there hasn't been one yet). */
  msSinceLastSwitch: number
}

/**
 * Decides whether live recognition should switch to the other language
 * right now. Pure: same input always yields the same output, no timers, no
 * DOM, no recognizer access.
 */
export function shouldSwitchLanguage({
  confidences,
  msSinceLastSwitch,
}: ShouldSwitchLanguageInput): boolean {
  if (msSinceLastSwitch < SWITCH_COOLDOWN_MS) return false

  const window = confidences.slice(-CONFIDENCE_WINDOW_SIZE)
  if (window.length < CONFIDENCE_WINDOW_SIZE) return false

  const average = window.reduce((sum, c) => sum + c, 0) / window.length
  return average < CONFIDENCE_SWITCH_THRESHOLD
}

/** The language auto mode should switch *to*, given the one it's leaving. */
export function otherLanguage(lang: ActiveLanguage): ActiveLanguage {
  return lang === 'en-US' ? 'si-LK' : 'en-US'
}
