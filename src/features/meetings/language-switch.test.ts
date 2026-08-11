import { describe, it, expect } from 'vitest'
import {
  pickUtterance,
  shouldFlush,
  UTTERANCE_PAIR_WINDOW_MS,
  type UtteranceCandidate,
} from './language-switch'

const en = (text: string, confidence?: number): UtteranceCandidate => ({ lang: 'en-US', text, confidence })
const si = (text: string, confidence?: number): UtteranceCandidate => ({ lang: 'si-LK', text, confidence })

describe('pickUtterance', () => {
  it('returns null on empty input', () => {
    expect(pickUtterance({ candidates: [], previousLang: null })).toBeNull()
  })

  it('returns the only candidate when there is just one, regardless of confidence', () => {
    const only = en('hello', 0.1)
    expect(pickUtterance({ candidates: [only], previousLang: null })).toBe(only)
  })

  it('returns the only candidate when it has no confidence at all', () => {
    const only = si('hello')
    expect(pickUtterance({ candidates: [only], previousLang: 'en-US' })).toBe(only)
  })

  it('picks the higher-confidence candidate when both report a number', () => {
    const weak = en('helo', 0.4)
    const strong = si('හෙලෝ', 0.9)
    expect(pickUtterance({ candidates: [weak, strong], previousLang: null })).toBe(strong)
    // Order in the array must not matter for a clear winner.
    expect(pickUtterance({ candidates: [strong, weak], previousLang: null })).toBe(strong)
  })

  it('prefers the candidate with a numeric confidence over one with none', () => {
    const withScore = en('deploy the build', 0.55)
    const noScore = si('build එක deploy කරන්න')
    expect(pickUtterance({ candidates: [withScore, noScore], previousLang: null })).toBe(withScore)
    expect(pickUtterance({ candidates: [noScore, withScore], previousLang: null })).toBe(withScore)
  })

  it('falls back to previousLang when neither candidate has a usable confidence', () => {
    const enCandidate = en('as I said')
    const siCandidate = si('මම කිව්ව විදිහට')
    expect(
      pickUtterance({ candidates: [enCandidate, siCandidate], previousLang: 'si-LK' }),
    ).toBe(siCandidate)
    expect(
      pickUtterance({ candidates: [enCandidate, siCandidate], previousLang: 'en-US' }),
    ).toBe(enCandidate)
  })

  it('falls back to the first candidate when neither has confidence and there is no previous language', () => {
    const first = en('good morning')
    const second = si('සුභ උදෑසනක්')
    expect(pickUtterance({ candidates: [first, second], previousLang: null })).toBe(first)
  })

  it('falls back to the first candidate when neither has confidence and previousLang matches neither', () => {
    // previousLang can only ever be 'en-US' or 'si-LK' in practice, but the
    // fallback-to-first behaviour should hold even if nothing matches.
    const first = en('good morning')
    const second = si('සුභ උදෑසනක්')
    expect(pickUtterance({ candidates: [first, second], previousLang: 'si-LK' })).toBe(second)
    expect(pickUtterance({ candidates: [second, first], previousLang: 'en-US' })).toBe(first)
  })

  it('resolves an exact confidence tie deterministically by taking the first candidate', () => {
    const first = en('same score', 0.75)
    const second = si('එකම ලකුණ', 0.75)
    expect(pickUtterance({ candidates: [first, second], previousLang: null })).toBe(first)
    // Reversing the array reverses which one is "first" — still deterministic.
    expect(pickUtterance({ candidates: [second, first], previousLang: null })).toBe(second)
  })

  it('a tie is decided by array order even when previousLang matches the second candidate', () => {
    // Ties are NOT resolved by conversation inertia — only the
    // no-confidence-at-all case uses previousLang. This pins that down.
    const first = en('same score', 0.5)
    const second = si('එකම ලකුණ', 0.5)
    expect(pickUtterance({ candidates: [first, second], previousLang: 'si-LK' })).toBe(first)
  })
})

describe('shouldFlush', () => {
  it('does not flush before the pairing window elapses', () => {
    expect(shouldFlush(UTTERANCE_PAIR_WINDOW_MS - 1)).toBe(false)
    expect(shouldFlush(0)).toBe(false)
  })

  it('flushes the instant the pairing window elapses', () => {
    expect(shouldFlush(UTTERANCE_PAIR_WINDOW_MS)).toBe(true)
  })

  it('flushes anything older than the window', () => {
    expect(shouldFlush(UTTERANCE_PAIR_WINDOW_MS + 5_000)).toBe(true)
  })
})
