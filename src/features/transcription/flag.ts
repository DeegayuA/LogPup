// Feature flag for Gemini Live streaming transcription.
//
// Default ON since 2026-08-12 (it shipped default-OFF while unverified): the
// realtime path is the product ask, and it now degrades automatically —
// Live token/socket failure falls back to Web Speech, and the segmented
// pipeline still transcribes everything regardless — so a key without Live
// access costs a notice, never the recording. Set
// NEXT_PUBLIC_GEMINI_LIVE_TRANSCRIPTION=0 to force the old Web-Speech-only
// behaviour (e.g. to conserve a shared free-tier key's quota).

/**
 * Pure predicate, separated from `process.env` so it can be tested directly.
 * Only the literal string '0' disables the feature — every other value
 * (unset, '', '1', 'true', 'false') resolves to ON. An opt-OUT, where the
 * old flag was an opt-in: the inverse of the `ENABLE_DB_CLEAR === '1'`
 * convention, deliberately, because the safe state flipped once the
 * fallback ladder existed.
 */
export function parseLiveTranscriptionFlag(raw: string | undefined): boolean {
  return raw !== '0'
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
