// Pure decision: whether an audio payload is small enough to send inline
// (base64-encoded straight into the generateContent request body) or should
// go through Gemini's Files API instead. Inline costs one fewer round trip;
// against that, base64 inflates the payload by ~33% and Gemini's inline
// request ceiling is ~20MB, so inline-by-default stops working long before
// a real meeting segment would. Kept pure/dependency-free (no fetch, no db)
// so it's unit-testable without mocking network calls — see
// audio-strategy.test.ts. client.ts is the only caller.
export const INLINE_AUDIO_MAX_BYTES = 4 * 1024 * 1024 // 4 MB

export function shouldUseInlineAudio(byteLength: number): boolean {
  return byteLength <= INLINE_AUDIO_MAX_BYTES
}
