import { describe, expect, it } from 'vitest'
import { DEFAULT_TTS_SAMPLE_RATE, base64ToBytes, parsePcmRate, pcmToWav } from './wav'

describe('parsePcmRate', () => {
  it('reads the rate from both mimeType shapes Gemini TTS uses', () => {
    expect(parsePcmRate('audio/pcm;rate=24000')).toBe(24000)
    expect(parsePcmRate('audio/L16;codec=pcm;rate=24000')).toBe(24000)
    expect(parsePcmRate('audio/L16; codec=pcm; rate=16000')).toBe(16000)
  })

  it('falls back instead of throwing on anything unparseable', () => {
    expect(parsePcmRate('audio/pcm')).toBe(DEFAULT_TTS_SAMPLE_RATE)
    expect(parsePcmRate('')).toBe(DEFAULT_TTS_SAMPLE_RATE)
    expect(parsePcmRate('audio/pcm;rate=abc')).toBe(DEFAULT_TTS_SAMPLE_RATE)
    // A "rate" that is part of some other token must not match.
    expect(parsePcmRate('audio/pcm;bitrate=32000')).toBe(DEFAULT_TTS_SAMPLE_RATE)
  })
})

describe('pcmToWav', () => {
  const ascii = (bytes: Uint8Array, start: number, length: number) =>
    String.fromCharCode(...bytes.subarray(start, start + length))

  it('writes a valid 44-byte RIFF header around the payload', () => {
    const pcm = new Uint8Array([1, 2, 3, 4])
    const wav = pcmToWav(pcm, 24000)
    const view = new DataView(wav.buffer)

    expect(wav.length).toBe(48)
    expect(ascii(wav, 0, 4)).toBe('RIFF')
    expect(view.getUint32(4, true)).toBe(36 + 4)
    expect(ascii(wav, 8, 4)).toBe('WAVE')
    expect(ascii(wav, 12, 4)).toBe('fmt ')
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(24000)
    expect(view.getUint32(28, true)).toBe(24000 * 2) // byte rate, 16-bit mono
    expect(view.getUint16(32, true)).toBe(2) // block align
    expect(view.getUint16(34, true)).toBe(16)
    expect(ascii(wav, 36, 4)).toBe('data')
    expect(view.getUint32(40, true)).toBe(4)
    expect([...wav.subarray(44)]).toEqual([1, 2, 3, 4])
  })
})

describe('base64ToBytes', () => {
  it('round-trips bytes', () => {
    const original = new Uint8Array([0, 1, 127, 128, 255])
    const base64 = Buffer.from(original).toString('base64')
    expect([...base64ToBytes(base64)]).toEqual([...original])
  })
})
