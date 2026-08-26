import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SIDEBAR_STATE,
  SIDEBAR_NAV_ID,
  SIDEBAR_STORAGE_KEY,
  nextSidebarState,
  resolveSidebarState,
  sidebarCommandLabel,
  sidebarToggleLabel,
  type SidebarState,
} from './sidebar-model'

/**
 * The sidebar's collapse switch, tested where it is testable.
 *
 * There is no jsdom in this repo (vitest.config.ts collects `src/**` `.test.ts`
 * only, and there is not a single .test.tsx), so the component cannot be
 * rendered here. Everything that could be WRONG rather than merely ugly lives
 * in sidebar-model.ts instead: what a stored value means, where the toggle
 * goes, and what the control is called once it gets there.
 */

describe('resolveSidebarState', () => {
  it('reads the one value the app ever writes', () => {
    expect(resolveSidebarState('rail')).toBe('rail')
    expect(resolveSidebarState('expanded')).toBe('expanded')
  })

  it('defaults to expanded when nothing was ever stored', () => {
    // The first load in a new browser, and — because the store answers this on
    // the server too — the state every piece of SSR markup is built from.
    expect(resolveSidebarState(null)).toBe('expanded')
    expect(resolveSidebarState(undefined)).toBe('expanded')
    expect(resolveSidebarState('')).toBe('expanded')
  })

  it('falls back rather than trusting a corrupt value', () => {
    // Storage is a shared, writable, long-lived surface: an older build, a
    // hand edit, or another script on the same origin can leave anything here.
    expect(resolveSidebarState('RAIL')).toBe('expanded')
    expect(resolveSidebarState('Rail ')).toBe('expanded')
    expect(resolveSidebarState('collapsed')).toBe('expanded')
    expect(resolveSidebarState('true')).toBe('expanded')
    expect(resolveSidebarState('1')).toBe('expanded')
    expect(resolveSidebarState('{"state":"rail"}')).toBe('expanded')
  })

  it('can only be talked INTO the default, never out of it', () => {
    /* The failure direction that matters. Garbage in storage must not be able
       to hide the navigation — only the one affirmative string collapses it,
       so every unknown value lands on the state where the labels are legible. */
    const junk = ['x', 'null', 'undefined', '[]', '0', 'expanded ', ' rail']
    for (const value of junk) {
      expect(resolveSidebarState(value)).toBe(DEFAULT_SIDEBAR_STATE)
    }
  })

  it('round-trips whatever the toggle writes', () => {
    // The store writes the state name itself, so parsing its own output has to
    // be the identity — the drift that would otherwise appear one reload later.
    const states: SidebarState[] = ['expanded', 'rail']
    for (const state of states) {
      expect(resolveSidebarState(state)).toBe(state)
    }
  })
})

describe('nextSidebarState', () => {
  it('flips both ways', () => {
    expect(nextSidebarState('expanded')).toBe('rail')
    expect(nextSidebarState('rail')).toBe('expanded')
  })

  it('is its own inverse, so a double press is a no-op', () => {
    expect(nextSidebarState(nextSidebarState('expanded'))).toBe('expanded')
    expect(nextSidebarState(nextSidebarState('rail'))).toBe('rail')
  })
})

describe('labels', () => {
  it('names the state the press will leave you in, never the verb', () => {
    // Also the button's accessible name, which is what makes the name change
    // with the state instead of aria-expanded carrying that alone.
    expect(sidebarToggleLabel('expanded')).toBe('Collapse sidebar')
    expect(sidebarToggleLabel('rail')).toBe('Expand sidebar')
  })

  it('gives the ⌘K row the same answer in row-shaped wording', () => {
    expect(sidebarCommandLabel('expanded')).toBe('Collapse the sidebar')
    expect(sidebarCommandLabel('rail')).toBe('Expand the sidebar')
  })

  it('never describes the state you are already in', () => {
    const states: SidebarState[] = ['expanded', 'rail']
    for (const state of states) {
      // "Collapse" while collapsed would make you press it to find out.
      const promised = nextSidebarState(state)
      expect(sidebarToggleLabel(state).toLowerCase()).toContain(
        promised === 'rail' ? 'collapse' : 'expand',
      )
      expect(sidebarCommandLabel(state).toLowerCase()).toContain(
        promised === 'rail' ? 'collapse' : 'expand',
      )
    }
  })
})

describe('constants', () => {
  it('namespaces the storage key like every other preference in the app', () => {
    // logpup.theme, logpup.accent, logpup.goShortcuts — one origin, shared
    // with whatever else is served from it.
    expect(SIDEBAR_STORAGE_KEY.startsWith('logpup.')).toBe(true)
  })

  it('gives the nav an id the toggle can point aria-controls at', () => {
    expect(SIDEBAR_NAV_ID).toBeTruthy()
    expect(SIDEBAR_NAV_ID).not.toMatch(/\s/)
  })
})
