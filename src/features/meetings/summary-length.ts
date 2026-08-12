/**
 * How deep the AI meeting summary should go, scaled to how much was actually
 * said. Injected into both analysis prompts (the single-shot audio pass and
 * the segmented finalize pass in ai-actions.ts): without an explicit target
 * the model writes the same ~150 words for a 10-minute stand-up and a
 * two-hour workshop, which is exactly wrong at both ends.
 *
 * Pure and clock-free so the buckets stay pinned by the sibling test.
 */

/**
 * Spoken meeting conversation runs ~150 words/minute, and transcripts of it
 * average ~6 characters per word including spaces — ~900 chars/minute. Only
 * an order-of-magnitude estimate, which is all bucket selection needs.
 */
const TRANSCRIPT_CHARS_PER_MINUTE = 900

/**
 * The meeting recorder captures WebM/Opus at 32 kbps (see the MediaRecorder
 * options in meeting-intel.tsx), so recorded audio is ~240 kB/minute.
 */
const AUDIO_BYTES_PER_MINUTE = (32_000 / 8) * 60

export function estimateMinutesFromTranscript(chars: number): number {
  return chars / TRANSCRIPT_CHARS_PER_MINUTE
}

export function estimateMinutesFromAudioBytes(bytes: number): number {
  return bytes / AUDIO_BYTES_PER_MINUTE
}

const SCALE_RULE =
  'Scale the summary with the meeting — never pad a short stand-up, and never ' +
  'compress a long meeting into a few lines. The target covers the English ' +
  'section; a Sinhala section, when present, mirrors the same depth.'

/**
 * One sentence appended to the "summary" field spec in the analysis prompts.
 * Prefers real transcript length over minutes: what was said is a better
 * depth signal than how long the room was booked.
 */
export function summaryDepthInstruction(input: {
  transcriptChars?: number | null
  minutes?: number | null
}): string {
  const fromText =
    input.transcriptChars && input.transcriptChars > 0
      ? estimateMinutesFromTranscript(input.transcriptChars)
      : null
  const minutes = fromText ?? (input.minutes && input.minutes > 0 ? input.minutes : null)

  if (minutes === null) return SCALE_RULE

  const target =
    minutes <= 10
      ? 'keep it brief — 80–150 words total'
      : minutes <= 25
        ? 'aim for 150–300 words'
        : minutes <= 45
          ? 'aim for 300–500 words'
          : minutes <= 90
            ? 'aim for 500–800 words, giving every decision and each major discussion thread its own sentence or two'
            : 'write full minutes — 800–1300 words, with a short bolded lead-in line per topic inside each part so it stays navigable'

  return `This was roughly ${Math.max(1, Math.round(minutes))} minutes of discussion: ${target}. ${SCALE_RULE}`
}
