// Raw PCM → playable WAV, in the browser or Node.
//
// Gemini TTS answers generateContent with base64 raw PCM (mono, 16-bit,
// little-endian — typically 24kHz, declared in the part's mimeType as e.g.
// "audio/L16;codec=pcm;rate=24000"). No browser will play headerless PCM, so
// the client wraps it in a minimal RIFF/WAVE header before handing it to an
// <audio> element. Pure functions, no DOM — unit-tested in wav.test.ts.
//
// Direction matters: transcription/pcm.ts is the OTHER side of this coin
// (browser mic Float32 → PCM for Gemini's ears); this file is Gemini's voice
// → the user's speakers. They share nothing but the sample format.

/** Sample rate Gemini TTS models emit today; used when the mimeType omits it. */
export const DEFAULT_TTS_SAMPLE_RATE = 24000

/**
 * Pulls the sample rate out of a PCM mimeType ("audio/pcm;rate=24000",
 * "audio/L16;codec=pcm;rate=24000"). Falls back rather than throws: a WAV at
 * the wrong rate plays chipmunked, which is diagnosable — an exception here
 * silences the whole read-aloud feature over a header string.
 */
export function parsePcmRate(mimeType: string, fallback: number = DEFAULT_TTS_SAMPLE_RATE): number {
  const match = /(?:^|;)\s*rate=(\d{4,6})\s*(?:;|$)/i.exec(mimeType)
  if (!match) return fallback
  const rate = Number(match[1])
  return Number.isFinite(rate) && rate > 0 ? rate : fallback
}

/**
 * Wraps raw 16-bit little-endian PCM in a RIFF/WAVE header. Mono by default —
 * everything Gemini TTS produces here is mono speech.
 */
export function pcmToWav(
  pcm: Uint8Array,
  sampleRate: number,
  channels: number = 1,
  bitsPerSample: number = 16,
): Uint8Array<ArrayBuffer> {
  const blockAlign = (channels * bitsPerSample) / 8
  const byteRate = sampleRate * blockAlign
  // Allocated through an explicit ArrayBuffer (never SharedArrayBuffer) so
  // the result is directly usable as a BlobPart — `new Blob([wav])` is the
  // whole point of this function, and Uint8Array<ArrayBufferLike> is not
  // assignable to BlobPart.
  const buffer = new ArrayBuffer(44 + pcm.length)
  const out = new Uint8Array(buffer)
  const view = new DataView(buffer)

  writeAscii(out, 0, 'RIFF')
  view.setUint32(4, 36 + pcm.length, true)
  writeAscii(out, 8, 'WAVE')
  writeAscii(out, 12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM format tag
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeAscii(out, 36, 'data')
  view.setUint32(40, pcm.length, true)
  out.set(pcm, 44)

  return out
}

/**
 * base64 → bytes without Node's Buffer, so the same function runs in the
 * browser (atob) and in tests (Buffer fallback keeps vitest's Node happy).
 */
export function base64ToBytes(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return bytes
  }
  return new Uint8Array(Buffer.from(base64, 'base64'))
}

function writeAscii(target: Uint8Array, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) target[offset + i] = text.charCodeAt(i)
}
