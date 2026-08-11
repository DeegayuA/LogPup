import { describe, expect, it } from 'vitest'
import { parseLiveTranscriptionFlag } from './flag'

describe('parseLiveTranscriptionFlag', () => {
  it('is off when unset — the Web Speech path stays the default', () => {
    expect(parseLiveTranscriptionFlag(undefined)).toBe(false)
  })

  it('is on only for the literal "1"', () => {
    expect(parseLiveTranscriptionFlag('1')).toBe(true)
  })

  it('does not treat other truthy-looking values as enabled', () => {
    // Matches the ENABLE_DB_CLEAR === '1' convention already used here; a typo
    // like "true" must fail closed rather than silently enable a metered feature.
    for (const value of ['', '0', 'true', 'TRUE', 'yes', 'on', ' 1']) {
      expect(parseLiveTranscriptionFlag(value)).toBe(false)
    }
  })
})
