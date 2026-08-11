import { describe, expect, it } from 'vitest'
import { ownTitleInput } from './title-schema'

describe('ownTitleInput', () => {
  it('accepts an empty string (clears the job role)', () => {
    const parsed = ownTitleInput.safeParse('')
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data).toBe('')
  })

  it('trims surrounding whitespace', () => {
    const parsed = ownTitleInput.safeParse('  Software Engineer  ')
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data).toBe('Software Engineer')
  })

  it('accepts exactly 60 characters', () => {
    const value = 'A'.repeat(60)
    const parsed = ownTitleInput.safeParse(value)
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data).toBe(value)
  })

  it('rejects 61 characters', () => {
    const parsed = ownTitleInput.safeParse('A'.repeat(61))
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe('Job role must be 60 characters or fewer')
    }
  })

  it('measures the cap after trimming, not before', () => {
    // 60 real characters padded with whitespace that trim() removes first.
    const value = `  ${'B'.repeat(60)}  `
    const parsed = ownTitleInput.safeParse(value)
    expect(parsed.success).toBe(true)
  })
})
