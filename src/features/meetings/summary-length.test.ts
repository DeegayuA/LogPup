import { describe, expect, it } from 'vitest'
import {
  estimateMinutesFromAudioBytes,
  estimateMinutesFromTranscript,
  summaryDepthInstruction,
} from './summary-length'

describe('summaryDepthInstruction', () => {
  it('falls back to the bare scale rule when no signal exists', () => {
    const out = summaryDepthInstruction({})
    expect(out).toContain('Scale the summary with the meeting')
    expect(out).not.toContain('minutes of discussion')
  })

  it('keeps a stand-up brief', () => {
    const out = summaryDepthInstruction({ minutes: 8 })
    expect(out).toContain('roughly 8 minutes')
    expect(out).toContain('80–150 words')
  })

  it('scales an hour-long meeting up', () => {
    const out = summaryDepthInstruction({ minutes: 60 })
    expect(out).toContain('500–800 words')
  })

  it('asks for full minutes past 90 minutes', () => {
    const out = summaryDepthInstruction({ minutes: 120 })
    expect(out).toContain('800–1300 words')
  })

  it('prefers transcript length over booked minutes', () => {
    // 54,000 chars ≈ 60 spoken minutes even though the room was booked for 15.
    const out = summaryDepthInstruction({ transcriptChars: 54_000, minutes: 15 })
    expect(out).toContain('roughly 60 minutes')
    expect(out).toContain('500–800 words')
  })

  it('ignores empty transcripts', () => {
    const out = summaryDepthInstruction({ transcriptChars: 0, minutes: 30 })
    expect(out).toContain('roughly 30 minutes')
  })
})

describe('estimators', () => {
  it('converts transcript chars at ~900/minute', () => {
    expect(estimateMinutesFromTranscript(9_000)).toBe(10)
  })

  it('converts 32 kbps audio at ~240kB/minute', () => {
    expect(estimateMinutesFromAudioBytes(240_000 * 5)).toBe(5)
  })
})
