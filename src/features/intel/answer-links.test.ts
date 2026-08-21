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

  it('labels a detail route whose id is in the QUERY, not the path', () => {
    // The morning briefing writes "[/meetings?open=<uuid>]" for one meeting.
    // Labelling that "Meetings" sends the reader to the list, where they then
    // have to find the meeting the sentence just named for them.
    const out = splitAnswerLinks(
      '1 meeting is missing a write-up [/meetings?open=3e9ee358-8ba1-424e-8254-370c718a77cb].',
      [],
    )
    expect(out).toContainEqual({
      kind: 'link',
      label: 'View meeting',
      href: '/meetings?open=3e9ee358-8ba1-424e-8254-370c718a77cb',
    })
  })

  it('still labels a plain section route as the section', () => {
    // The same briefing writes "[/worklog]" for the page, not a row — the two
    // must not collapse into one label.
    expect(splitAnswerLinks('Log them [/worklog].', [])).toContainEqual({
      kind: 'link',
      label: 'Work log',
      href: '/worklog',
    })
    expect(splitAnswerLinks('Open [/meetings].', [])).toContainEqual({
      kind: 'link',
      label: 'Meetings',
      href: '/meetings',
    })
  })

  it('labels a project route carrying a tab as the project', () => {
    expect(splitAnswerLinks('Sprint ends soon [/apps/unilever?tab=roadmap].', [])).toContainEqual({
      kind: 'link',
      label: 'View project',
      href: '/apps/unilever?tab=roadmap',
    })
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
