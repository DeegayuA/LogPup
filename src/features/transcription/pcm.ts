// Audio conversion for the Gemini Live API.
//
// Live expects raw 16-bit PCM, 16 kHz, little-endian, base64-encoded, with
// mimeType "audio/pcm;rate=16000". Browsers hand us Float32 samples at the
// AudioContext's own rate (typically 44.1 or 48 kHz), so every chunk needs
// resampling + quantising + base64 before it goes on the wire.
//
// Everything here is pure and allocation-explicit so it can be unit-tested in
// Node without an AudioContext, and so it can run inside an AudioWorklet where
// no DOM APIs (including btoa) are available.

/** Sample rate Gemini Live expects, in Hz. */
export const TARGET_SAMPLE_RATE = 16000

/** The mimeType string that must accompany every audio chunk. */
export const AUDIO_MIME_TYPE = `audio/pcm;rate=${TARGET_SAMPLE_RATE}`

/**
 * Resamples mono Float32 audio to `targetRate` using a box filter: each output
 * sample is the mean of the input samples that fall inside its window.
 *
 * A box filter (rather than nearest-neighbour or naive linear interpolation) is
 * deliberate. Decimating 48 kHz speech to 16 kHz without any low-pass folds
 * everything above 8 kHz back down as aliasing, which sounds like a metallic
 * lisp and measurably hurts recognition of Sinhala retroflex/sibilant contrasts.
 * Averaging the window is a crude but real low-pass and costs one pass.
 *
 * Returns the input unchanged when the rates already match.
 */
export function downsampleTo(
  input: Float32Array,
  inputRate: number,
  targetRate: number = TARGET_SAMPLE_RATE,
): Float32Array {
  if (!Number.isFinite(inputRate) || inputRate <= 0) {
    throw new RangeError(`inputRate must be a positive number, got ${inputRate}`)
  }
  if (inputRate === targetRate) return input
  if (inputRate < targetRate) {
    throw new RangeError(
      `cannot upsample: inputRate ${inputRate} is below targetRate ${targetRate}`,
    )
  }

  const ratio = inputRate / targetRate
  const outLength = Math.floor(input.length / ratio)
  const out = new Float32Array(outLength)

  for (let i = 0; i < outLength; i += 1) {
    const start = Math.floor(i * ratio)
    // `end` is exclusive and clamped so the final window never runs past the
    // buffer; guarantee at least one sample so we never divide by zero.
    const end = Math.min(Math.floor((i + 1) * ratio), input.length)
    let sum = 0
    let count = 0
    for (let j = start; j < end; j += 1) {
      sum += input[j]
      count += 1
    }
    out[i] = count > 0 ? sum / count : input[Math.min(start, input.length - 1)]
  }

  return out
}

/**
 * Quantises Float32 samples in [-1, 1] to signed 16-bit PCM.
 *
 * Values outside [-1, 1] are clamped rather than allowed to wrap — a wrapped
 * sample is a loud click, which is far worse than a clipped one.
 *
 * The asymmetric scaling (0x8000 negative, 0x7fff positive) is the standard
 * mapping: two's-complement 16-bit has one more negative step than positive.
 */
export function floatTo16BitPCM(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, input[i]))
    out[i] = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff)
  }
  return out
}

/** Reinterprets 16-bit samples as little-endian bytes. */
export function int16ToLittleEndianBytes(samples: Int16Array): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2)
  for (let i = 0; i < samples.length; i += 1) {
    const value = samples[i]
    bytes[i * 2] = value & 0xff
    bytes[i * 2 + 1] = (value >> 8) & 0xff
  }
  return bytes
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/**
 * Base64-encodes bytes without depending on `btoa` or Node's `Buffer`.
 *
 * Hand-rolled because this runs in an AudioWorklet, whose global scope has
 * neither. It is also why we don't use `String.fromCharCode(...bytes)` — that
 * spread blows the argument limit on chunks of any real size.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const hasB1 = i + 1 < bytes.length
    const hasB2 = i + 2 < bytes.length
    const b1 = hasB1 ? bytes[i + 1] : 0
    const b2 = hasB2 ? bytes[i + 2] : 0

    out += BASE64_ALPHABET[b0 >> 2]
    out += BASE64_ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)]
    out += hasB1 ? BASE64_ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)] : '='
    out += hasB2 ? BASE64_ALPHABET[b2 & 0x3f] : '='
  }
  return out
}

/**
 * Full microphone-chunk pipeline: resample, quantise, serialise, encode.
 * The result is ready to drop straight into `realtimeInput.audio.data`.
 */
export function encodeAudioChunk(input: Float32Array, inputRate: number): string {
  const resampled = downsampleTo(input, inputRate)
  const pcm = floatTo16BitPCM(resampled)
  return bytesToBase64(int16ToLittleEndianBytes(pcm))
}
