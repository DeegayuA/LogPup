import { describe, it, expect } from 'vitest'
import type { ChangelogEntry } from '@/lib/changelog'
import type { ReadinessLevel } from '@/features/gemini/readiness'
import { describeAiStatus, findRelease } from './overview'

const history: ChangelogEntry[] = [
  { version: 'v0.0.1', date: '2026-01-01', hash: 'aaa1111', change: 'first commit' },
  { version: 'v0.0.2', date: '2026-01-02', hash: 'bbb2222', change: 'feat: pups' },
  { version: 'v0.0.3', date: '2026-01-03', hash: 'ccc3333', change: 'fix: fetch' },
]

describe('findRelease', () => {
  it('returns the entry for the running version', () => {
    expect(findRelease('v0.0.2', history)).toEqual(history[1])
  })

  it('returns null when the history has no entry for that version', () => {
    // The shallow-clone case: changelog.data.json names a `current` the
    // committed history predates. "We don't know" beats a wrong date.
    expect(findRelease('v0.0.9', history)).toBeNull()
  })

  it('returns null for an empty history rather than throwing', () => {
    expect(findRelease('v0.0.1', [])).toBeNull()
  })
})

describe('describeAiStatus', () => {
  const levels: ReadinessLevel[] = ['ready', 'degraded', 'blocked']

  it('gives every readiness level a non-empty word', () => {
    for (const level of levels) {
      expect(describeAiStatus(level).word.trim()).not.toBe('')
    }
  })

  it('keeps the words distinct, so badge colour is never the only signal', () => {
    const words = levels.map((level) => describeAiStatus(level).word)
    expect(new Set(words).size).toBe(levels.length)
  })

  it('escalates blocked to the destructive variant', () => {
    expect(describeAiStatus('blocked').variant).toBe('destructive')
    expect(describeAiStatus('ready').variant).toBe('default')
  })
})
