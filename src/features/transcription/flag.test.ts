import { describe, expect, it } from 'vitest'
import { parseLiveTranscriptionFlag } from './flag'

describe('parseLiveTranscriptionFlag', () => {
  it('is ON when unset — the Live path is the default now that it degrades safely', () => {
    expect(parseLiveTranscriptionFlag(undefined)).toBe(true)
  })

  it('is off only for the literal "0"', () => {
    expect(parseLiveTranscriptionFlag('0')).toBe(false)
  })

  it('treats every other value as enabled — the kill switch must be exact', () => {
    // Opt-out flag: a typo ('OFF', 'false', ' 0') must fail OPEN to the live
    // path, whose failure mode is a graceful fallback — not fail closed and
    // silently take realtime transcription away from every meeting.
    for (const value of ['', '1', 'true', 'false', 'off', 'OFF', ' 0', 'no']) {
      expect(parseLiveTranscriptionFlag(value)).toBe(true)
    }
  })
})
