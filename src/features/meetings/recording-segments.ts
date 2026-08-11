// Pure, unit-testable pieces of segmented meeting recording: the boundary
// decision for cutting one segment off the live capture, and the
// ordering/concatenation of transcribed segments into the single text blob
// the final synthesis pass reads. Kept free of DOM/MediaRecorder/DB/network
// calls on purpose, same as retry.ts and notes.ts — meeting-intel.tsx (client
// capture) and ai-actions.ts (server synthesis) both import these to decide
// what to do, not how to talk to a recorder or a database.

/**
 * Target duration of one recording segment before it's cut, uploaded, and
 * transcribed in the background. At 32 kbps mono Opus (~4 KB/s — see the
 * bitrate comment in meeting-intel.tsx), 5 minutes of audio is
 * ~1.2 MB (300s * 4 KB/s), comfortably under the 8 MB server action body
 * limit (next.config.ts) with ~6.5x headroom to absorb multipart overhead
 * and per-browser bitrate variance — a single segment upload essentially
 * never approaches the ceiling that used to make hour-long meetings fail.
 */
export const SEGMENT_TARGET_MS = 5 * 60 * 1000

/**
 * Safety-net byte threshold: cuts a segment early even if SEGMENT_TARGET_MS
 * hasn't elapsed. Guards against a browser ignoring the requested
 * audioBitsPerSecond (e.g. defaulting to ~128 kbps) — without this, a
 * duration-only trigger could still grow one segment to 4-5x the expected
 * size before the timer fires. Set well above the ~1.2 MB nominal segment
 * size so it never fires in normal operation, but well below the server's
 * hard per-segment cap (see MAX_SEGMENT_AUDIO_BYTES in ai-actions.ts) so it
 * always has room to actually prevent an oversized upload.
 */
export const SEGMENT_BYTE_SOFT_CAP = 4 * 1024 * 1024

/**
 * Whether the currently-accumulating segment should be cut now. Duration is
 * the primary trigger (the ~5-minute target); byte size is the safety net
 * described above. Either crossing its threshold is enough.
 */
export function shouldCutSegment(elapsedMs: number, bytes: number): boolean {
  return elapsedMs >= SEGMENT_TARGET_MS || bytes >= SEGMENT_BYTE_SOFT_CAP
}

/**
 * How many times ONE segment's upload+transcription is attempted before the
 * UI gives up and asks a human to press Retry. A meeting is a live event
 * nobody wants to babysit: a single dropped request, a server restart mid-
 * deploy, or a 30-second network hiccup should heal itself silently rather
 * than leave an amber "segment 3 failed" box the person recording only
 * notices an hour later. Four attempts spread over ~13s (see
 * segmentRetryDelayMs) cover all of those without stalling the
 * genuinely-broken case for long.
 */
export const SEGMENT_UPLOAD_ATTEMPTS = 4

/**
 * Backoff before the next attempt (1-based: the delay BEFORE attempt 2 is
 * segmentRetryDelayMs(1)). Exponential from 1s — 1s, 3s, 9s — because the
 * failures worth retrying are exactly the ones that clear on their own given
 * a few seconds, and a fixed short delay would burn every attempt inside a
 * single outage window.
 */
export function segmentRetryDelayMs(attempt: number): number {
  return 1000 * 3 ** Math.max(0, attempt - 1)
}

/**
 * Whether a failed attempt is worth retrying automatically. Some failures are
 * permanent by construction and retrying them is pure noise: a segment the
 * server rejected as oversized will be exactly as oversized next time, a
 * caller without permission still won't have it, and a database missing a
 * migration stays missing until a person applies it. Everything else — a
 * network blip, an overloaded Gemini, a server restarting mid-deploy — is
 * retried. Matched on the server's own message text (the strings in
 * ai-actions.ts) rather than an error code, because a server action can only
 * hand back a string; keep the two in sync when either changes.
 */
export function isRetriableSegmentError(message: string): boolean {
  return !/unexpectedly large|Only admins|No audio received|pending migration has not been applied/i.test(
    message,
  )
}

export type TranscribedSegment = { index: number; transcript: string }

export type ConcatenatedSegments = {
  /** The full text handed to the final synthesis pass, segments in index
   *  order and clearly delimited (each segment was transcribed by an
   *  independent Gemini call, so e.g. "Speaker 1" in segment 2 is NOT
   *  necessarily the same person as "Speaker 1" in segment 1 — the
   *  synthesis prompt is told this explicitly and the delimiters make the
   *  boundaries visible). */
  text: string
  /** Segment indices between 0 and the highest index seen that never
   *  produced a transcript (upload/transcription failed and was never
   *  retried, or the tab closed mid-upload). Reported so a gap in the
   *  minutes has a stated cause instead of silently reading as "nothing
   *  happened during those five minutes". */
  missingIndices: number[]
}

/**
 * Orders transcribed segments by index (not insertion/arrival order —
 * uploads can complete out of order) and concatenates them into one text
 * block for the final synthesis pass. Any index gap between 0 and the
 * highest index present is called out both in the returned text (so the
 * model doesn't silently paper over it) and in `missingIndices` (so the UI
 * can surface it).
 */
export function concatenateSegments(segments: TranscribedSegment[]): ConcatenatedSegments {
  if (segments.length === 0) return { text: '', missingIndices: [] }

  const byIndex = new Map(segments.map((segment) => [segment.index, segment.transcript]))
  const maxIndex = Math.max(...segments.map((segment) => segment.index))

  const missingIndices: number[] = []
  const parts: string[] = []
  for (let index = 0; index <= maxIndex; index += 1) {
    const transcript = byIndex.get(index)
    if (transcript !== undefined) {
      parts.push(`--- segment ${index + 1} ---\n${transcript}`)
    } else {
      missingIndices.push(index)
      parts.push(`--- segment ${index + 1} (missing — not transcribed, audio lost) ---`)
    }
  }

  return { text: parts.join('\n\n'), missingIndices }
}
