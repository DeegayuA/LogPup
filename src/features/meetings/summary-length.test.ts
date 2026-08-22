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
    const out = summaryDepthInstruction({ transcript: 'a'.repeat(54_000), minutes: 15 })
    expect(out).toContain('roughly 60 minutes')
    expect(out).toContain('500–800 words')
  })

  it('ignores empty transcripts', () => {
    const out = summaryDepthInstruction({ transcript: '', minutes: 30 })
    expect(out).toContain('roughly 30 minutes')
  })

  it('weights Sinhala transcripts so an hour of Sinhala is not read as 38 minutes', () => {
    // The 900 chars/minute calibration is English; the same hour of speech in
    // Sinhala script is ~0.6x the code units, which used to drop a 60-minute
    // Sinhala meeting a whole depth bucket below its English twin.
    const out = summaryDepthInstruction({ transcript: 'අ'.repeat(34_200), minutes: 60 })
    expect(out).toContain('500–800 words')
  })
})

describe('estimators', () => {
  it('converts English transcript chars at ~900/minute', () => {
    expect(estimateMinutesFromTranscript('a'.repeat(9_000))).toBe(10)
  })

  it('converts 32 kbps audio at ~240kB/minute', () => {
    expect(estimateMinutesFromAudioBytes(240_000 * 5)).toBe(5)
  })
})
