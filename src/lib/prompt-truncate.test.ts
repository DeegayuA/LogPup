import { describe, expect, it } from 'vitest'
import { truncateAtWordBoundary } from './prompt-truncate'

describe('truncateAtWordBoundary', () => {
  it('returns short text untouched', () => {
    expect(truncateAtWordBoundary('hello world', 100)).toBe('hello world')
  })

  it('backs off to the last whitespace instead of cutting mid-word', () => {
    const text = 'alpha beta gamma delta'.repeat(50)
    const out = truncateAtWordBoundary(text, 500)
    expect(out.length).toBeLessThanOrEqual(500)
    expect(text[out.length]).not.toBe(undefined)
    expect(/\s/.test(text[out.length])).toBe(true)
  })

  it('never splits a Sinhala grapheme cluster', () => {
    // ව්‍යාපෘතිය carries a virama+ZWJ conjunct; a raw slice can cut between the
    // base consonant and its marks, corrupting the prompt's final word.
    const text = 'මේ ව්‍යාපෘතිය ගැන කතා කළා. '.repeat(200)
    const out = truncateAtWordBoundary(text, 999)
    expect(text.startsWith(out)).toBe(true)
    expect(/[ංඃ්-ෟ‍]/.test(text[out.length])).toBe(false)
    expect(/[්‍]$/.test(out)).toBe(false)
  })
})
