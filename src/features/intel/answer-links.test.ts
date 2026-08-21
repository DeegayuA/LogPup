import { describe, expect, it } from 'vitest'
import { splitAnswerLinks } from './answer-links'

const CITES = [
  { label: 'Pasindu Prabhashwara', href: '/people/09844444-19a1-47d3-9d90-bb8cac317ed8' },
  { label: 'Sumeera Madushanka', href: '/people/dcecf1f4-4e69-4a04-a571-1aa471fc3e66' },
]

describe('splitAnswerLinks', () => {
  it('turns an inline route into a NAME, not a UUID', () => {
    // The visible bug: "[/people/09844444-…]" rendered as bracketed hex
    // mid-sentence, with the person one un-clickable click away.
    const out = splitAnswerLinks(
      'Pasindu Prabhashwara (110 percent) [/people/09844444-19a1-47d3-9d90-bb8cac317ed8] is over.',
      CITES,
    )
    expect(out).toEqual([
      { kind: 'text', text: 'Pasindu Prabhashwara (110 percent) ' },
      {
        kind: 'link',
        label: 'Pasindu Prabhashwara',
        href: '/people/09844444-19a1-47d3-9d90-bb8cac317ed8',
      },
      { kind: 'text', text: ' is over.' },
    ])
  })

  it('handles several routes in one sentence', () => {
    const out = splitAnswerLinks(
      'A [/people/09844444-19a1-47d3-9d90-bb8cac317ed8] and B [/people/dcecf1f4-4e69-4a04-a571-1aa471fc3e66].',
      CITES,
    )
    expect(out.filter((s) => s.kind === 'link')).toHaveLength(2)
  })

  it('falls back to a readable label rather than showing the raw id', () => {
    const out = splitAnswerLinks('See [/people/unknown-id] for detail.', [])
    expect(out).toContainEqual({ kind: 'link', label: 'View person', href: '/people/unknown-id' })
  })

  it('REFUSES an off-site route and keeps the words', () => {
    // The answer is written by a model reading user-authored titles, so a
    // planted title is enough to steer it. WHATWG folds the backslash into a
    // slash and resolves this to https://evil.com/.
    const out = splitAnswerLinks('Check [/\\evil.com] now', [])
    expect(out.some((s) => s.kind === 'link')).toBe(false)
    expect(out).toEqual([{ kind: 'text', text: 'Check /\\evil.com now' }])
  })

  it('refuses a protocol-relative URL', () => {
    const out = splitAnswerLinks('Go [//evil.com] here', [])
    expect(out.some((s) => s.kind === 'link')).toBe(false)
  })

  it('refuses an absolute http URL', () => {
    const out = splitAnswerLinks('Go [https://evil.com] here', [])
    expect(out.some((s) => s.kind === 'link')).toBe(false)
  })

  it('leaves an answer with no routes completely alone', () => {
    const text = 'The facts do not specify what tasks could move off them.'
    expect(splitAnswerLinks(text, CITES)).toEqual([{ kind: 'text', text }])
  })

  it('emits no empty text segments', () => {
    const out = splitAnswerLinks('[/worklog]', [])
    expect(out).toEqual([{ kind: 'link', label: 'Work log', href: '/worklog' }])
  })
})
