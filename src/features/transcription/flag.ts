// Feature flag for Gemini Live streaming transcription.
//
// Default OFF. The existing Web Speech path stays the default until live
// bilingual transcription has been proven against real code-switched speech by
// a human — it has not been at time of writing (no microphone in the authoring
// environment), and shipping it on by default would repeat exactly the mistake
// that let the dual-recognizer bug hide.

/**
 * Pure predicate, separated from `process.env` so it can be tested directly.
 * Only the literal string '1' enables the feature: an unset var, '', 'false',
 * 'true' and '0' all resolve to off, matching the `ENABLE_DB_CLEAR === '1'`
 * convention already used in this codebase.
 */
export function parseLiveTranscriptionFlag(raw: string | undefined): boolean {
  return raw === '1'
}

/**
 * Whether the live path is enabled for this build.
 *
 * `process.env.NEXT_PUBLIC_GEMINI_LIVE_TRANSCRIPTION` is written out in full
 * rather than read through a variable, because Next.js inlines NEXT_PUBLIC_*
 * vars by literal textual substitution at build time — a dynamic lookup would
 * silently evaluate to undefined in the browser bundle.
 */
export function isLiveTranscriptionEnabled(): boolean {
  return parseLiveTranscriptionFlag(process.env.NEXT_PUBLIC_GEMINI_LIVE_TRANSCRIPTION)
}
