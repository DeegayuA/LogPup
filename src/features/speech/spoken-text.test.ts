import { describe, expect, it } from 'vitest'
import { sinhalaFraction, toSpokenText, truncateForSpeech } from './spoken-text'
import { effectiveSpeechLength } from './chunk-speech'

describe('toSpokenText', () => {
  it('drops heading markers and ends the heading as a sentence', () => {
    // Without the full stop a heading runs straight into the paragraph under
    // it, and the listener hears one long line with no structure at all.
    expect(toSpokenText('## Decisions made\nWe shipped the login fix.')).toBe(
      'Decisions made.\nWe shipped the login fix.',
    )
  })

  it('does not double-punctuate a heading that already ends in punctuation', () => {
    expect(toSpokenText('### Next steps:')).toBe('Next steps:')
  })

  it('strips bullet and number markers but keeps the item', () => {
    expect(toSpokenText('- Ship it\n* Then rest\n1. Finally sleep')).toBe(
      'Ship it\nThen rest\nFinally sleep',
    )
  })

  it('removes emphasis markers', () => {
    expect(toSpokenText('**Kasun** owns the _deploy_ step')).toBe('Kasun owns the deploy step')
  })

  it('reads link text, not the URL', () => {
    expect(toSpokenText('See [the sprint board](https://example.com/x?y=1) for detail')).toBe(
      'See the sprint board for detail',
    )
  })

  it('reads code without its backticks or fences', () => {
    expect(toSpokenText('Run `npm run build` first')).toBe('Run npm run build first')
    expect(toSpokenText('```ts\nconst x = 1\n```')).toBe('const x = 1')
  })

  it('leaves Sinhala text untouched', () => {
    // The whole point of the feature is a voice that can read this — a
    // stripper that mangled non-Latin script would be worse than none.
    expect(toSpokenText('## සාරාංශය\n- ලොග් එක හදනවා')).toBe('සාරාංශය.\nලොග් එක හදනවා')
  })

  it('collapses the blank lines stripping leaves behind', () => {
    expect(toSpokenText('One\n\n---\n\nTwo')).toBe('One\n\nTwo')
  })
})

describe('truncateForSpeech', () => {
  it('honours a sentence that ends at a newline', () => {
    // toSpokenText emits bullet items and headings as lines ending '.\n';
    // a '. '-only boundary search missed every one and fell through to the
    // hard cap, handing TTS a mid-word fragment as the reading's last word.
    const text = 'මේ sprint එකේ API deploy කරලා QA team එකට කිව්වා.\n'.repeat(300)
    const out = truncateForSpeech(text, 4000)
    expect(out.length).toBeLessThan(text.length)
    expect(out.endsWith('.')).toBe(true)
  })

  it('never ends on a dangling Sinhala mark or joiner at the hard cap', () => {
    // ව්‍යාපෘතිය carries a virama+ZWJ conjunct; a raw slice can strand 'ව්‍'
    // with its ර cut away — a grapheme that must never be split.
    const text = 'ව්‍යාපෘතිය'.repeat(1000)
    const out = truncateForSpeech(text, 4000)
    expect(out.length).toBeGreaterThan(0)
    expect(text.startsWith(out)).toBe(true)
    // A complete cluster may legally end with a vowel sign (අපි) — the real
    // invariant is that nothing beyond the cut continues the final cluster,
    // and the cut never dangles a virama or joiner.
    expect(/[ංඃ්-ෟ‍]/.test(text[out.length])).toBe(false)
    expect(/[්‍]$/.test(out)).toBe(false)
  })

  it('budgets Sinhala text by audio, not code units', () => {
    // 4000 Sinhala code units is ~2x the speech of 4000 English ones; the cap
    // exists to bound audio, so it must count effective units.
    const text = 'අපි හෙට රැස්වීමට කලින් සියලු සටහන් සම්පූර්ණ කරමු. '.repeat(200)
    const out = truncateForSpeech(text, 4000)
    expect(effectiveSpeechLength(out)).toBeLessThanOrEqual(4000)
  })
})

describe('sinhalaFraction', () => {
  it('measures the Sinhala share of non-whitespace text', () => {
    expect(sinhalaFraction('all english here')).toBe(0)
    expect(sinhalaFraction('අපි')).toBe(1)
    expect(sinhalaFraction('අපිok')).toBeCloseTo(0.6)
  })
})
