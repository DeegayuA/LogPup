import { describe, expect, it } from 'vitest'
import {
  noteHasAppTag,
  splitNoteAppTags,
  toggleNoteAppTag,
  type AppRef,
} from './note-app-tags'

const APPS: AppRef[] = [
  { name: 'EV Charging App', slug: 'ev-charging-app' },
  { name: 'DERMS Web App', slug: 'derms-web-app' },
]

describe('splitNoteAppTags', () => {
  it('lifts a trailing run of tags off the end of a real note', () => {
    const note =
      'DSM, Qognetix meeting, Script/App for extracting 1min data from goodwe plants (1 out of 10) over 2 years for ML model training. [EV Charging App] [DERMS Web App]'
    const { text, tags } = splitNoteAppTags(note, APPS)
    expect(text).toBe(
      'DSM, Qognetix meeting, Script/App for extracting 1min data from goodwe plants (1 out of 10) over 2 years for ML model training.',
    )
    expect(tags).toEqual([
      { label: 'EV Charging App', slug: 'ev-charging-app' },
      { label: 'DERMS Web App', slug: 'derms-web-app' },
    ])
  })

  it('leaves brackets inside prose completely alone', () => {
    // "(1 out of 10)" is not a project, and neither is a mid-sentence aside.
    // Eating part of somebody's own account of their day is the failure worth
    // preventing, so only a trailing run counts.
    const note = 'Fixed the [admin] path changes and shipped it'
    expect(splitNoteAppTags(note, APPS)).toEqual({ text: note, tags: [] })
  })

  it('keeps a tag no project answers to, rather than dropping it', () => {
    const { text, tags } = splitNoteAppTags('SE intern interviews [Hiring]', APPS)
    expect(text).toBe('SE intern interviews')
    expect(tags).toEqual([{ label: 'Hiring', slug: null }])
  })

  it('matches a project name regardless of case and inner spacing', () => {
    const { tags } = splitNoteAppTags('Work [ev  charging app]', APPS)
    expect(tags).toEqual([{ label: 'ev  charging app', slug: 'ev-charging-app' }])
  })

  it('handles a note that is nothing but tags', () => {
    const { text, tags } = splitNoteAppTags('[DERMS Web App]', APPS)
    expect(text).toBe('')
    expect(tags).toEqual([{ label: 'DERMS Web App', slug: 'derms-web-app' }])
  })

  it('is a no-op for an untagged note, an empty note, and null', () => {
    expect(splitNoteAppTags('Just a normal day', APPS)).toEqual({
      text: 'Just a normal day',
      tags: [],
    })
    expect(splitNoteAppTags(null, APPS)).toEqual({ text: '', tags: [] })
    expect(splitNoteAppTags('', APPS)).toEqual({ text: '', tags: [] })
  })
})

/**
 * THE CHIPS ARE A TOGGLE, and until now they only went one way: clicking a
 * tagged project toasted "already tagged in this work log" and did nothing, so
 * undoing a misclick meant hand-editing your own prose.
 */
describe('toggleNoteAppTag', () => {
  it('adds the tag on its own line, with the caret space after it', () => {
    expect(toggleNoteAppTag('Shipped the importer.', 'Kestrel')).toBe(
      'Shipped the importer.\n[Kestrel] ',
    )
  })

  it('starts the note when there is nothing there yet', () => {
    expect(toggleNoteAppTag('', 'Kestrel')).toBe('[Kestrel] ')
    expect(toggleNoteAppTag('   ', 'Kestrel')).toBe('[Kestrel] ')
  })

  it('takes the tag back out, and leaves no blank line behind', () => {
    expect(toggleNoteAppTag('Shipped the importer.\n[Kestrel] ', 'Kestrel')).toBe(
      'Shipped the importer.',
    )
  })

  it('repairs the gap when the tag sat mid-sentence', () => {
    expect(toggleNoteAppTag('Worked on [Kestrel] all morning.', 'Kestrel')).toBe(
      'Worked on all morning.',
    )
  })

  // The case-sensitivity bug this replaces: the chip read the note
  // case-insensitively and the handler wrote it case-sensitively, so a
  // differently-cased tag showed as Logged and still accepted a duplicate.
  // One rule now answers both, and removal clears every copy in one click.
  it('matches regardless of case, and removes every copy at once', () => {
    expect(noteHasAppTag('done [unilever project] today', 'Unilever Project')).toBe(true)
    expect(toggleNoteAppTag('a [Kestrel] b [kestrel] c', 'Kestrel')).toBe('a b c')
  })

  // "SCADA | CEB Assist" is a real project in this workspace. Unescaped, its
  // pipe turns the removal pattern into an alternation that matches almost
  // anything — it would eat the note.
  it('survives a project name containing regex metacharacters', () => {
    const note = 'Reviewed the feeder model.\n[SCADA | CEB Assist] '
    expect(toggleNoteAppTag(note, 'SCADA | CEB Assist')).toBe('Reviewed the feeder model.')
    expect(toggleNoteAppTag('Reviewed CEB work.', 'SCADA | CEB Assist')).toBe(
      'Reviewed CEB work.\n[SCADA | CEB Assist] ',
    )
  })

  it('round-trips: add then remove returns the original prose', () => {
    const original = 'Finished the migration and paired with Nimal.'
    const tagged = toggleNoteAppTag(original, 'Atutu')
    expect(noteHasAppTag(tagged, 'Atutu')).toBe(true)
    expect(toggleNoteAppTag(tagged, 'Atutu')).toBe(original)
  })
})
