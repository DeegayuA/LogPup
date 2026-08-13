import { describe, expect, it } from 'vitest'
import { HEAD_CHUNK_CHARS, MAX_SPEECH_CHUNKS, TAIL_CHUNK_CHARS, chunkForSpeech } from './chunk-speech'

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
})
