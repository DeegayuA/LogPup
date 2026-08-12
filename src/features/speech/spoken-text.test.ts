import { describe, expect, it } from 'vitest'
import { toSpokenText } from './spoken-text'

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
