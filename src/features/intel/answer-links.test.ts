import { describe, expect, it } from 'vitest'
import { splitAnswerLinks } from './answer-links'

const CITES = [
  { label: 'Pasindu Prabhashwara', href: '/people/09844444-19a1-47d3-9d90-bb8cac317ed8' },
  { label: 'Sumeera Madushanka', href: '/people/dcecf1f4-4e69-4a04-a571-1aa471fc3e66' },
]

describe('splitAnswerLinks', () => {
  it('turns an inline route into a NAME, not a UUID', () => {
    // The original bug: "[/people/09844444-…]" rendered as bracketed hex
    // mid-sentence, with the person one un-clickable click away. The name the
    // model already wrote is what becomes the link — see the duplication tests
    // below for why it is not appended after it.
    const out = splitAnswerLinks(
      'Pasindu Prabhashwara (110 percent) [/people/09844444-19a1-47d3-9d90-bb8cac317ed8] is over.',
      CITES,
    )
    expect(out).toEqual([
      {
        kind: 'link',
        label: 'Pasindu Prabhashwara',
        href: '/people/09844444-19a1-47d3-9d90-bb8cac317ed8',
      },
      { kind: 'text', text: ' (110 percent) is over.' },
    ])
    expect(out.map((s) => (s.kind === 'text' ? s.text : s.label)).join('')).toBe(
      'Pasindu Prabhashwara (110 percent) is over.',
    )
  })

  it('does NOT print the name twice when the prose already said it', () => {
    // The reported bug: "Pasindu Prabhashwara Pasindu Prabhashwara and Sumeera
    // Madushanka Sumeera Madushanka have the highest workload". The route
    // ANNOTATES a name the model just wrote, so the existing words become the
    // link rather than the label being appended after them.
    const out = splitAnswerLinks(
      'Pasindu Prabhashwara [/people/09844444-19a1-47d3-9d90-bb8cac317ed8] and Sumeera Madushanka [/people/dcecf1f4-4e69-4a04-a571-1aa471fc3e66] have the highest workload.',
      CITES,
    )
    expect(out).toEqual([
      {
        kind: 'link',
        label: 'Pasindu Prabhashwara',
        href: '/people/09844444-19a1-47d3-9d90-bb8cac317ed8',
      },
      { kind: 'text', text: ' and ' },
      {
        kind: 'link',
        label: 'Sumeera Madushanka',
        href: '/people/dcecf1f4-4e69-4a04-a571-1aa471fc3e66',
      },
      { kind: 'text', text: ' have the highest workload.' },
    ])
    // The rendered sentence reads exactly once through.
    expect(out.map((s) => (s.kind === 'text' ? s.text : s.label)).join('')).toBe(
      'Pasindu Prabhashwara and Sumeera Madushanka have the highest workload.',
    )
  })

  it('links the name and keeps what sits between it and the route', () => {
    const out = splitAnswerLinks(
      'Pasindu Prabhashwara (110 percent) [/people/09844444-19a1-47d3-9d90-bb8cac317ed8] is over.',
      CITES,
    )
    expect(out).toEqual([
      {
        kind: 'link',
        label: 'Pasindu Prabhashwara',
        href: '/people/09844444-19a1-47d3-9d90-bb8cac317ed8',
      },
      { kind: 'text', text: ' (110 percent) is over.' },
    ])
  })

  it('matches the name however the model cased it, and keeps the original casing', () => {
    const out = splitAnswerLinks(
      'pasindu prabhashwara [/people/09844444-19a1-47d3-9d90-bb8cac317ed8] logged nothing.',
      CITES,
    )
    expect(out[0]).toEqual({
      kind: 'link',
      label: 'pasindu prabhashwara',
      href: '/people/09844444-19a1-47d3-9d90-bb8cac317ed8',
    })
  })

  it('does not hoist a link back to a name mentioned far earlier', () => {
    // Moving a link away from the claim it supports is worse than repeating a
    // name, so the backward search is windowed.
    const far = `Pasindu Prabhashwara had a quiet week. ${'Filler sentence about the sprint. '.repeat(8)}The most loaded person [/people/09844444-19a1-47d3-9d90-bb8cac317ed8] is elsewhere.`
    const out = splitAnswerLinks(far, CITES)
    const firstText = out[0]
    expect(firstText.kind).toBe('text')
    expect(firstText.kind === 'text' && firstText.text.startsWith('Pasindu Prabhashwara had')).toBe(
      true,
    )
  })

  it('still appends a label when the prose never named them', () => {
    const out = splitAnswerLinks(
      'The most loaded person is [/people/09844444-19a1-47d3-9d90-bb8cac317ed8].',
      CITES,
    )
    expect(out).toContainEqual({
      kind: 'link',
      label: 'Pasindu Prabhashwara',
      href: '/people/09844444-19a1-47d3-9d90-bb8cac317ed8',
    })
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
