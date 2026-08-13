import { describe, it, expect } from 'vitest'
import {
  containsSinhala,
  estimateSpokenUnits,
  isRestartStorm,
  isSilentSinhalaFallback,
  pickInterimLeader,
  pickUtterance,
  shouldFlush,
  RESTART_STORM_LIMIT,
  SINHALA_FALLBACK_SAMPLE,
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

describe('containsSinhala', () => {
  it('is true for Sinhala script', () => {
    expect(containsSinhala('සුභ උදෑසනක්')).toBe(true)
  })

  it('is false for Latin script, digits and punctuation', () => {
    expect(containsSinhala('deploy the build')).toBe(false)
    expect(containsSinhala('2026-08-11, ok?')).toBe(false)
    expect(containsSinhala('')).toBe(false)
  })

  it('is true for code-switched text with even one Sinhala codepoint', () => {
    expect(containsSinhala('build එක deploy කරන්න')).toBe(true)
  })
})

describe('estimateSpokenUnits', () => {
  it('is zero for empty or wordless input', () => {
    expect(estimateSpokenUnits('')).toBe(0)
    expect(estimateSpokenUnits('   — ...')).toBe(0)
  })

  it('counts English syllables as vowel groups, at least one per word', () => {
    // de-ploy (2) + the (1) + build (1)
    expect(estimateSpokenUnits('deploy the build')).toBe(4)
    // a word with no vowel at all still counts as one spoken unit
    expect(estimateSpokenUnits('hmm')).toBe(1)
  })

  it('counts Sinhala base letters, discounting the virama that fuses a cluster', () => {
    // මම (2) + කිව්ව (ක ව ව minus one virama = 2) + විදිහට (ව ද හ ට = 4)
    expect(estimateSpokenUnits('මම කිව්ව විදිහට')).toBe(8)
  })

  it('adds up both scripts in code-switched text', () => {
    expect(estimateSpokenUnits('build එක deploy කරන්න')).toBe(
      estimateSpokenUnits('build deploy') + estimateSpokenUnits('එක කරන්න'),
    )
  })

  it('is not fooled by the UTF-16 length bias that this exists to remove', () => {
    // The same stretch of Sinhala speech, as heard by both engines: si-LK
    // gets it right, en-US produces same-length-ish English mush. The
    // Sinhala string is the SHORTER one in code units — which is exactly
    // why the old "longer partial wins" rule always handed it to English.
    const si = 'මම කිව්ව විදිහට'
    const en = 'mum a cave with heart'
    expect(si.length).toBeLessThan(en.length)
    expect(estimateSpokenUnits(si)).toBeGreaterThan(estimateSpokenUnits(en))
  })
})

describe('pickInterimLeader', () => {
  const nothing = { previousLang: null, currentLeader: null }

  it('leads with nobody when neither engine has a partial', () => {
    expect(pickInterimLeader({ en: '', si: '', ...nothing })).toBeNull()
  })

  it('leads with whichever engine has text when only one does', () => {
    expect(pickInterimLeader({ en: 'deploy the', si: '', ...nothing })).toBe('en-US')
    expect(pickInterimLeader({ en: '', si: 'මම කිව්ව', ...nothing })).toBe('si-LK')
  })

  it('single-engine mode always leads with the engine that is running', () => {
    // The absent engine's partial is permanently '' — the previous leader
    // and inertia must never be able to hand the display to an engine that
    // isn't producing anything.
    expect(
      pickInterimLeader({ en: '', si: 'මම කිව්ව', previousLang: 'en-US', currentLeader: 'en-US' }),
    ).toBe('si-LK')
  })

  it('gives Sinhala the lead when it is genuinely hearing more speech, despite the shorter string', () => {
    const si = 'මම කිව්ව විදිහට'
    const en = 'mum a cave with heart'
    // The regression: comparing string length picks 'en-US' here.
    expect(en.length).toBeGreaterThan(si.length)
    expect(pickInterimLeader({ en, si, ...nothing })).toBe('si-LK')
  })

  it('keeps the incumbent while the challenger is only marginally ahead', () => {
    // si is ahead, but not by the margin — flipping the visible script on a
    // one-syllable lead would make the live transcript unreadable.
    expect(
      pickInterimLeader({
        en: 'deploy the build',
        si: 'මම කිව්ව වි',
        previousLang: null,
        currentLeader: 'en-US',
      }),
    ).toBe('en-US')
  })

  it('hands the lead over once the challenger is clearly ahead', () => {
    expect(
      pickInterimLeader({
        en: 'the',
        si: 'මම කිව්ව විදිහට',
        previousLang: null,
        currentLeader: 'en-US',
      }),
    ).toBe('si-LK')
  })

  it('treats the last accepted language as the incumbent when nothing is on screen yet', () => {
    // Same inputs, different inertia: si is ahead but inside the margin, so
    // whoever holds inertia keeps the display.
    const partials = { en: 'deploy the build', si: 'මම කිව්ව වි' }
    expect(pickInterimLeader({ ...partials, previousLang: 'en-US', currentLeader: null })).toBe('en-US')
    expect(pickInterimLeader({ ...partials, previousLang: 'si-LK', currentLeader: null })).toBe('si-LK')
  })

  it('prefers the current leader over stale inertia', () => {
    expect(
      pickInterimLeader({
        en: 'deploy the build',
        si: 'මම කිව්ව වි',
        previousLang: 'si-LK',
        currentLeader: 'en-US',
      }),
    ).toBe('en-US')
  })

  it('resolves an exact tie with no incumbent deterministically', () => {
    expect(pickInterimLeader({ en: 'ok', si: 'ok', ...nothing })).toBe('en-US')
  })
})

describe('isSilentSinhalaFallback', () => {
  it('does not accuse the browser before it has produced enough finals', () => {
    expect(
      isSilentSinhalaFallback({ finalsSeen: SINHALA_FALLBACK_SAMPLE - 1, finalsWithSinhala: 0 }),
    ).toBe(false)
    expect(isSilentSinhalaFallback({ finalsSeen: 0, finalsWithSinhala: 0 })).toBe(false)
  })

  it('flags an engine that has produced a run of finals without one Sinhala codepoint', () => {
    expect(
      isSilentSinhalaFallback({ finalsSeen: SINHALA_FALLBACK_SAMPLE, finalsWithSinhala: 0 }),
    ).toBe(true)
    expect(isSilentSinhalaFallback({ finalsSeen: 50, finalsWithSinhala: 0 })).toBe(true)
  })

  it('clears the engine the moment it writes any Sinhala at all', () => {
    expect(isSilentSinhalaFallback({ finalsSeen: 50, finalsWithSinhala: 1 })).toBe(false)
  })
})

describe('isRestartStorm', () => {
  it('tolerates the odd fruitless restart', () => {
    expect(isRestartStorm({ restartsWithoutAudio: 0 })).toBe(false)
    expect(isRestartStorm({ restartsWithoutAudio: RESTART_STORM_LIMIT - 1 })).toBe(false)
  })

  it('trips once restarts pile up without the engine ever reaching audio', () => {
    expect(isRestartStorm({ restartsWithoutAudio: RESTART_STORM_LIMIT })).toBe(true)
    expect(isRestartStorm({ restartsWithoutAudio: 16_732 })).toBe(true)
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
