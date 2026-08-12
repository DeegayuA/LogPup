import { describe, expect, it } from 'vitest'
import { pickParentPage, type NotionPageCandidate } from './parent-page'

const page = (id: string, parentType: string, title: string): NotionPageCandidate => ({
  id,
  parentType,
  title,
})

describe('pickParentPage', () => {
  it('refuses when the integration can see nothing', () => {
    expect(pickParentPage([])).toEqual({ kind: 'none' })
  })

  it('uses the only visible page — the state Notion sharing UI naturally produces', () => {
    expect(pickParentPage([page('a', 'workspace', 'LogPup')])).toEqual({
      kind: 'use',
      id: 'a',
      title: 'LogPup',
    })
  })

  it('uses the only visible page even when it is a subpage', () => {
    expect(pickParentPage([page('a', 'page_id', 'Sprints')])).toEqual({
      kind: 'use',
      id: 'a',
      title: 'Sprints',
    })
  })

  it('picks the single top-level page when its subpages are visible too', () => {
    // Sharing one top-level page makes its children visible as well — that is
    // one deliberate share action, so the top-level page is "the" home.
    const decision = pickParentPage([
      page('child1', 'page_id', 'Sprint 1'),
      page('home', 'workspace', 'LogPup'),
      page('child2', 'page_id', 'Sprint 2'),
    ])
    expect(decision).toEqual({ kind: 'use', id: 'home', title: 'LogPup' })
  })

  it('refuses to guess between several top-level pages', () => {
    const decision = pickParentPage([
      page('a', 'workspace', 'LogPup'),
      page('b', 'workspace', 'Personal notes'),
    ])
    expect(decision.kind).toBe('ambiguous')
    if (decision.kind === 'ambiguous') {
      expect(decision.titles).toEqual(['LogPup', 'Personal notes'])
    }
  })

  it('refuses to guess between several subpages with no clear home', () => {
    expect(
      pickParentPage([page('a', 'page_id', 'One'), page('b', 'page_id', 'Two')]).kind,
    ).toBe('ambiguous')
  })

  it('labels untitled pages rather than showing an empty string', () => {
    const decision = pickParentPage([page('a', 'page_id', ''), page('b', 'page_id', 'Two')])
    if (decision.kind === 'ambiguous') expect(decision.titles).toEqual(['(untitled)', 'Two'])
    expect(decision.kind).toBe('ambiguous')
  })
})
