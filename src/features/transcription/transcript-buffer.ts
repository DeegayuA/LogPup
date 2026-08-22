// Accumulates the incremental transcription fragments the Live API streams.
//
// Pure and synchronous so the merge behaviour — especially the replay handling
// that reconnection depends on — is unit-testable without a socket.

export type TranscriptState = {
  /** Text belonging to turns the server has marked complete. */
  committed: string
  /** Text for the turn currently in flight; replaced wholesale on commit. */
  interim: string
}

export const EMPTY_TRANSCRIPT: TranscriptState = { committed: '', interim: '' }

/**
 * Longest overlap (in characters) we will look for when de-duplicating a
 * replayed fragment. Bounded because the check is O(n) per candidate length and
 * runs on every frame; 400 chars is far more than a single resumed turn.
 */
export const MAX_OVERLAP_SCAN = 400

/**
 * Appends a fragment to the in-flight turn, tolerating replay — but ONLY when
 * the caller says this frame may be one.
 *
 * Why dedup exists at all: after a socket drop we reconnect with a
 * session-resumption handle, and the server may re-send part of the turn we
 * already displayed. Naive concatenation would duplicate it ("hello hello
 * world"), which looks like a stutter and, worse, gets fed into the meeting
 * minutes as if it were actually said twice.
 *
 * Why it must not run on every frame: a speaker who actually repeats a word —
 * "නෑ නෑ", "very very good" — produces a fragment whose prefix matches the
 * interim's tail, and overlap-dedup on a healthy session silently ate the
 * repetition. Only the first frame after a resumed connection can be a replay,
 * so only that frame gets the overlap treatment (live-client arms it).
 */
export function appendFragment(
  state: TranscriptState,
  fragment: string,
  opts?: { replay?: boolean },
): TranscriptState {
  if (fragment.length === 0) return state
  if (state.interim.length === 0) return { ...state, interim: fragment }
  if (!opts?.replay) return { ...state, interim: state.interim + fragment }

  const overlap = longestSuffixPrefixOverlap(state.interim, fragment)
  const addition = fragment.slice(overlap)
  if (addition.length === 0) return state

  return { ...state, interim: state.interim + addition }
}

/**
 * Finalises the in-flight turn.
 *
 * Turns are joined with a space rather than a newline: Live emits a turn
 * boundary on pauses, not on sentence boundaries, so newlines here would shred
 * one spoken sentence across several lines.
 */
export function commitTurn(state: TranscriptState): TranscriptState {
  const trimmed = state.interim.trim()
  if (trimmed.length === 0) return { ...state, interim: '' }
  const committed = state.committed.length === 0 ? trimmed : `${state.committed} ${trimmed}`
  return { committed, interim: '' }
}

/** Everything transcribed so far, committed and in-flight. */
export function fullText(state: TranscriptState): string {
  if (state.interim.trim().length === 0) return state.committed
  if (state.committed.length === 0) return state.interim.trim()
  return `${state.committed} ${state.interim.trim()}`
}

/**
 * Length of the longest string that is both a suffix of `existing` and a prefix
 * of `incoming`, capped at {@link MAX_OVERLAP_SCAN}.
 *
 * Checked longest-first so a replay of the whole turn collapses completely
 * rather than matching some short accidental overlap and leaving a partial
 * duplicate behind.
 */
export function longestSuffixPrefixOverlap(existing: string, incoming: string): number {
  const max = Math.min(existing.length, incoming.length, MAX_OVERLAP_SCAN)
  for (let len = max; len > 0; len -= 1) {
    if (existing.endsWith(incoming.slice(0, len))) return len
  }
  return 0
}
