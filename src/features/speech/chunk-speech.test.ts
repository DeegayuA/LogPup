import { describe, expect, it } from 'vitest'
import {
  HEAD_CHUNK_CHARS,
  MAX_SPEECH_CHUNKS,
  TAIL_CHUNK_CHARS,
  chunkForSpeech,
  effectiveSpeechLength,
} from './chunk-speech'

describe('effectiveSpeechLength', () => {
  it('counts a Sinhala code unit as two effective characters', () => {
    // Sinhala packs roughly twice the speech into each UTF-16 code unit that
    // English does (the byte budgets were calibrated on English), so budget
    // math weights Sinhala units double.
    expect(effectiveSpeechLength('abcd')).toBe(4)
    expect(effectiveSpeechLength('අපි')).toBe(6)
    expect(effectiveSpeechLength('අපි ok')).toBe(9)
  })
})

describe('chunkForSpeech', () => {
  it('returns a single chunk for text that already fits', () => {
    expect(chunkForSpeech('Short enough to say in one breath.')).toEqual([
      'Short enough to say in one breath.',
    ])
  })

  it('returns nothing for empty text', () => {
    expect(chunkForSpeech('   ')).toEqual([])
  })

  it('makes the FIRST chunk small, so sound starts quickly', () => {
    const text = 'A sentence. '.repeat(400)
    const chunks = chunkForSpeech(text)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0].length).toBeLessThanOrEqual(HEAD_CHUNK_CHARS)
  })

  it('breaks on sentence boundaries, never mid-word', () => {
    const text = `${'First sentence here. '.repeat(30)}${'Second body sentence. '.repeat(60)}`
    for (const chunk of chunkForSpeech(text)) {
      expect(chunk).toBe(chunk.trim())
      // A chunk that split mid-word would end on a partial token; every
      // chunk here should close on terminal punctuation.
      expect(/[.!?]$/.test(chunk)).toBe(true)
    }
  })

  it('never exceeds the per-chunk ceiling', () => {
    const text = 'Sentence number one. '.repeat(500)
    for (const chunk of chunkForSpeech(text)) {
      expect(chunk.length).toBeLessThanOrEqual(TAIL_CHUNK_CHARS)
    }
  })

  it('caps the number of chunks, because each one is a separate paid request', () => {
    const text = 'Long sentence that goes on. '.repeat(2000)
    expect(chunkForSpeech(text).length).toBeLessThanOrEqual(MAX_SPEECH_CHUNKS)
  })

  it('loses no words up to the cap', () => {
    const text = `${'Alpha beta gamma. '.repeat(20)}${'Delta epsilon zeta. '.repeat(20)}`
    const rejoined = chunkForSpeech(text).join(' ')
    expect(rejoined.replace(/\s+/g, ' ')).toBe(text.trim().replace(/\s+/g, ' '))
  })

  it('handles text with no sentence punctuation at all', () => {
    const text = 'word '.repeat(600).trim()
    const chunks = chunkForSpeech(text)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(TAIL_CHUNK_CHARS)
  })

  it('keeps every chunk inside the audio budget for Sinhala-heavy text', () => {
    // A pure-Sinhala tail chunk at the full English character budget carries
    // roughly twice the speech, which blows the ~4.5MB response ceiling the
    // chunking exists to stay under — budgets are effective units, not .length.
    const text = 'අපි ලබන සතියේ API එක deploy කරන්න තීරණය කළා. QA team එකට කිව්වා. '.repeat(60)
    const chunks = chunkForSpeech(text)
    expect(chunks.length).toBeGreaterThan(1)
    chunks.forEach((chunk, i) => {
      const limit = i === 0 ? HEAD_CHUNK_CHARS : TAIL_CHUNK_CHARS
      expect(effectiveSpeechLength(chunk)).toBeLessThanOrEqual(limit)
    })
  })
})
