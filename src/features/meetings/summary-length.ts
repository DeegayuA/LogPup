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

/**
 * The ~900 chars/minute calibration above is English. The same speech written
 * in Sinhala script is systematically SHORTER in code units (~0.6x — see the
 * measured ratios in language-switch.ts), so an unweighted estimate reads a
 * 60-minute Sinhala meeting as ~37 minutes and hands the very meetings this
 * bilingual pipeline was built for a shallower summary bucket. Weighting
 * Sinhala units 1.6x makes the estimate script-fair.
 */
export function estimateMinutesFromTranscript(text: string): number {
  let sinhala = 0
  for (let i = 0; i < text.length; i += 1) {
    if (/[඀-෿]/.test(text[i])) sinhala += 1
  }
  return (text.length + 0.6 * sinhala) / TRANSCRIPT_CHARS_PER_MINUTE
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
  transcript?: string | null
  minutes?: number | null
}): string {
  const fromText =
    input.transcript && input.transcript.length > 0
      ? estimateMinutesFromTranscript(input.transcript)
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
