import { describe, expect, it } from 'vitest'
import { splitNoteAppTags, type AppRef } from './note-app-tags'

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
