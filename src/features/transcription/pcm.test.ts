import { describe, expect, it } from 'vitest'
import {
  TARGET_SAMPLE_RATE,
  bytesToBase64,
  downsampleTo,
  encodeAudioChunk,
  floatTo16BitPCM,
  int16ToLittleEndianBytes,
} from './pcm'

describe('downsampleTo', () => {
  it('returns the input untouched when the rate already matches', () => {
    const input = new Float32Array([0.1, 0.2, 0.3])
    expect(downsampleTo(input, TARGET_SAMPLE_RATE)).toBe(input)
  })

  it('decimates 48kHz to 16kHz by averaging each 3-sample window', () => {
    // 6 samples at 48k -> 2 samples at 16k; each output is the mean of 3 inputs.
    const input = new Float32Array([0, 0.3, 0.6, 0.9, 0.6, 0.3])
    const out = downsampleTo(input, 48000)
    expect(out.length).toBe(2)
    expect(out[0]).toBeCloseTo(0.3, 5)
    expect(out[1]).toBeCloseTo(0.6, 5)
  })

  it('averages rather than picking, so an alternating signal collapses toward its mean', () => {
    // A hard +1/-1 alternation is the aliasing worst case. Nearest-neighbour
    // would return all +1 or all -1; the box filter must pull it toward zero.
    const input = new Float32Array(48)
    for (let i = 0; i < input.length; i += 1) input[i] = i % 2 === 0 ? 1 : -1
    const out = downsampleTo(input, 48000)
    for (const sample of out) expect(Math.abs(sample)).toBeLessThan(0.5)
  })

  it('never reads past the end of the buffer for a non-integer ratio', () => {
    const input = new Float32Array(100)
    input.fill(0.5)
    const out = downsampleTo(input, 44100)
    expect(out.length).toBeGreaterThan(0)
    for (const sample of out) expect(Number.isNaN(sample)).toBe(false)
  })

  it('refuses to upsample rather than silently producing wrong-rate audio', () => {
    expect(() => downsampleTo(new Float32Array([0]), 8000)).toThrow(RangeError)
  })

  it('rejects a nonsensical input rate', () => {
    expect(() => downsampleTo(new Float32Array([0]), 0)).toThrow(RangeError)
  })
})

describe('floatTo16BitPCM', () => {
  it('maps the full-scale endpoints to the 16-bit extremes', () => {
    const out = floatTo16BitPCM(new Float32Array([0, 1, -1]))
    expect(out[0]).toBe(0)
    expect(out[1]).toBe(32767)
    expect(out[2]).toBe(-32768)
  })

  it('clamps out-of-range samples instead of letting them wrap', () => {
    // Wrapping would turn a loud sample into a full-scale click of the opposite
    // sign — much worse than clipping.
    const out = floatTo16BitPCM(new Float32Array([5, -5]))
    expect(out[0]).toBe(32767)
    expect(out[1]).toBe(-32768)
  })
})

describe('int16ToLittleEndianBytes', () => {
  it('emits low byte first', () => {
    const bytes = int16ToLittleEndianBytes(new Int16Array([0x0102]))
    expect(Array.from(bytes)).toEqual([0x02, 0x01])
  })

  it('round-trips a negative sample through two-complement bytes', () => {
    const bytes = int16ToLittleEndianBytes(new Int16Array([-2]))
    expect(Array.from(bytes)).toEqual([0xfe, 0xff])
  })
})

describe('bytesToBase64', () => {
  // Cross-checked against Buffer, which is the reference implementation we
  // cannot use at runtime (this code also runs where Buffer/btoa don't exist).
  it('matches Buffer for every length remainder (padding cases)', () => {
    for (let length = 0; length <= 16; length += 1) {
      const bytes = new Uint8Array(length)
      for (let i = 0; i < length; i += 1) bytes[i] = (i * 37) % 256
      expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'))
    }
  })

  it('matches Buffer across the full byte range', () => {
    const bytes = new Uint8Array(256)
    for (let i = 0; i < 256; i += 1) bytes[i] = i
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'))
  })

  it('encodes an empty buffer as an empty string', () => {
    expect(bytesToBase64(new Uint8Array(0))).toBe('')
  })
})

describe('encodeAudioChunk', () => {
  it('produces base64 whose decoded length is 2 bytes per resampled sample', () => {
    const input = new Float32Array(4800) // 100ms at 48kHz -> 1600 samples at 16k
    input.fill(0.25)
    const encoded = encodeAudioChunk(input, 48000)
    expect(Buffer.from(encoded, 'base64').length).toBe(1600 * 2)
  })

  it('survives a chunk far larger than the argument-spread limit', () => {
    // Guards the reason bytesToBase64 is hand-rolled: String.fromCharCode(...)
    // would throw on a buffer this size.
    const input = new Float32Array(48000 * 2)
    input.fill(0.1)
    expect(() => encodeAudioChunk(input, 48000)).not.toThrow()
  })
})
