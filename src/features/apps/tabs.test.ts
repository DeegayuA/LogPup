import { describe, expect, it } from 'vitest'
import {
  APP_TAB_IDS,
  appTabHref,
  boardHref,
  normalizeAppTab,
  type AppTabId,
} from '@/features/apps/tabs'

const ALL = APP_TAB_IDS
const MEMBER: readonly AppTabId[] = APP_TAB_IDS.filter((id) => id !== 'settings')

describe('normalizeAppTab', () => {
  it('defaults to overview when no tab is given', () => {
    expect(normalizeAppTab(undefined, ALL)).toBe('overview')
  })

  it('accepts every known tab', () => {
    for (const tab of ALL) {
      expect(normalizeAppTab(tab, ALL)).toBe(tab)
    }
  })

  it('falls back for an unknown value', () => {
    expect(normalizeAppTab('kanban', ALL)).toBe('overview')
  })

  it('falls back for a real tab the viewer cannot see', () => {
    expect(normalizeAppTab('settings', MEMBER)).toBe('overview')
    expect(normalizeAppTab('settings', ALL)).toBe('settings')
  })

  it('takes the first value when the param repeats', () => {
    expect(normalizeAppTab(['activity', 'settings'], ALL)).toBe('activity')
  })

  it('sends the retired board tab to the plan it is now part of', () => {
    // These links are in bookmarks, Slack and the search index. A renamed
    // section is never a reason to land somebody on Overview.
    expect(normalizeAppTab('board', ALL)).toBe('roadmap')
    expect(normalizeAppTab(['board', 'settings'], ALL)).toBe('roadmap')
  })
})

describe('appTabHref', () => {
  it('leaves the canonical app URL clean for overview', () => {
    expect(appTabHref('ledger', 'overview')).toBe('/apps/ledger')
  })

  it('names every other tab explicitly', () => {
    expect(appTabHref('ledger', 'roadmap')).toBe('/apps/ledger?tab=roadmap')
    expect(appTabHref('ledger', 'activity')).toBe('/apps/ledger?tab=activity')
  })
})

describe('boardHref', () => {
  it('always names the tab so the plan never bounces to overview', () => {
    expect(boardHref('ledger')).toBe('/apps/ledger?tab=roadmap')
  })

  it('carries a sprint selection alongside the tab', () => {
    expect(boardHref('ledger', 'backlog')).toBe('/apps/ledger?tab=roadmap&sprint=backlog')
    expect(boardHref('ledger', 'abc-123')).toBe('/apps/ledger?tab=roadmap&sprint=abc-123')
  })

  it('carries the board filter params so a count can link to its own cards', () => {
    expect(boardHref('ledger', 'abc-123', { who: 'unassigned' })).toBe(
      '/apps/ledger?tab=roadmap&sprint=abc-123&who=unassigned',
    )
    // An empty value is dropped rather than written as `&who=`.
    expect(boardHref('ledger', 'abc-123', { who: '' })).toBe(
      '/apps/ledger?tab=roadmap&sprint=abc-123',
    )
  })

  it('ignores an empty sprint id', () => {
    expect(boardHref('ledger', '')).toBe('/apps/ledger?tab=roadmap')
    expect(boardHref('ledger', null)).toBe('/apps/ledger?tab=roadmap')
  })
})
