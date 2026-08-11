import { describe, expect, it } from 'vitest'
import {
  EMPTY_TRANSCRIPT,
  appendFragment,
  commitTurn,
  fullText,
  longestSuffixPrefixOverlap,
} from './transcript-buffer'

describe('appendFragment', () => {
  it('starts the in-flight turn from empty', () => {
    expect(appendFragment(EMPTY_TRANSCRIPT, 'hello')).toEqual({ committed: '', interim: 'hello' })
  })

  it('concatenates genuinely new text', () => {
    const state = appendFragment(EMPTY_TRANSCRIPT, 'hello')
    expect(appendFragment(state, ' world').interim).toBe('hello world')
  })

  it('ignores an empty fragment without churning state', () => {
    const state = appendFragment(EMPTY_TRANSCRIPT, 'hello')
    expect(appendFragment(state, '')).toBe(state)
  })

  it('drops a fragment that exactly repeats what we already have', () => {
    // Session resumption after a dropped socket can replay the current turn.
    const state = appendFragment(EMPTY_TRANSCRIPT, 'api eka deploy karanna')
    expect(appendFragment(state, 'api eka deploy karanna')).toBe(state)
  })

  it('appends only the new tail when a replay partially overlaps', () => {
    const state = appendFragment(EMPTY_TRANSCRIPT, 'sprint eka')
    expect(appendFragment(state, 'eka ivara una').interim).toBe('sprint eka ivara una')
  })

  it('keeps code-switched Sinhala and Latin text in one line, unmodified', () => {
    let state = appendFragment(EMPTY_TRANSCRIPT, 'අපි ')
    state = appendFragment(state, 'deploy ')
    state = appendFragment(state, 'කරමු')
    expect(state.interim).toBe('අපි deploy කරමු')
  })
})

describe('commitTurn', () => {
  it('moves the in-flight turn into committed text', () => {
    const state = appendFragment(EMPTY_TRANSCRIPT, 'first turn')
    expect(commitTurn(state)).toEqual({ committed: 'first turn', interim: '' })
  })

  it('joins successive turns with a space, not a newline', () => {
    // Live emits turn boundaries on pauses, not sentence ends — newlines here
    // would split one spoken sentence across lines.
    let state = commitTurn(appendFragment(EMPTY_TRANSCRIPT, 'first'))
    state = commitTurn(appendFragment(state, 'second'))
    expect(state.committed).toBe('first second')
  })

  it('discards a whitespace-only turn instead of padding the transcript', () => {
    const state = appendFragment(EMPTY_TRANSCRIPT, '   ')
    expect(commitTurn(state)).toEqual({ committed: '', interim: '' })
  })

  it('is idempotent on an already-empty turn', () => {
    const state = commitTurn(appendFragment(EMPTY_TRANSCRIPT, 'x'))
    expect(commitTurn(state)).toEqual(state)
  })
})

describe('fullText', () => {
  it('is empty for a fresh buffer', () => {
    expect(fullText(EMPTY_TRANSCRIPT)).toBe('')
  })

  it('returns the in-flight turn when nothing is committed yet', () => {
    expect(fullText(appendFragment(EMPTY_TRANSCRIPT, 'hi'))).toBe('hi')
  })

  it('joins committed and in-flight text', () => {
    const state = appendFragment(commitTurn(appendFragment(EMPTY_TRANSCRIPT, 'done')), 'saying')
    expect(fullText(state)).toBe('done saying')
  })
})

describe('longestSuffixPrefixOverlap', () => {
  it('finds no overlap between unrelated strings', () => {
    expect(longestSuffixPrefixOverlap('abc', 'xyz')).toBe(0)
  })

  it('prefers the longest overlap so a full replay collapses entirely', () => {
    expect(longestSuffixPrefixOverlap('aaaa', 'aaaa')).toBe(4)
  })

  it('matches a partial suffix/prefix join', () => {
    expect(longestSuffixPrefixOverlap('hello wor', 'wor ld')).toBe(3)
  })
})
