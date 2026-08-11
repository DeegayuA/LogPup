import { describe, expect, it } from 'vitest'
import { INLINE_AUDIO_MAX_BYTES, shouldUseInlineAudio } from './audio-strategy'

describe('shouldUseInlineAudio', () => {
  it('uses inline for anything under the threshold', () => {
    expect(shouldUseInlineAudio(INLINE_AUDIO_MAX_BYTES - 1)).toBe(true)
  })

  it('uses inline exactly at the threshold', () => {
    expect(shouldUseInlineAudio(INLINE_AUDIO_MAX_BYTES)).toBe(true)
  })

  it('uses the Files API just over the threshold', () => {
    expect(shouldUseInlineAudio(INLINE_AUDIO_MAX_BYTES + 1)).toBe(false)
  })

  it('uses the Files API for a large payload', () => {
    expect(shouldUseInlineAudio(15 * 1024 * 1024)).toBe(false)
  })

  it('uses inline for an empty payload', () => {
    expect(shouldUseInlineAudio(0)).toBe(true)
  })
})
