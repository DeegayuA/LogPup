/**
 * The pure half of the sidebar's collapse switch.
 *
 * Split out from sidebar.tsx for the reason every *-model.ts in this repo is
 * (see features/meetings/components/meeting-panels-model.ts): there is no jsdom
 * here — vitest.config.ts collects `src/**\/*.test.ts` only — so anything that
 * has to be TESTED must be reachable without rendering a component. What is
 * left in the component is markup; what is here is the decisions.
 *
 * Deliberately free of 'use client', React, and `window`: the palette row in
 * features/settings/commands.ts imports it, the client store imports it, and
 * its test imports it in a node environment with no DOM.
 */

/**
 * The two shapes the desktop sidebar takes.
 *
 * `rail` rather than `hidden` on purpose. Below `md` the sidebar is already
 * gone entirely and MobileNav is the navigation; the only trigger that reopens
 * it there is `md:hidden` (header.tsx). So a desktop "collapse" that hid the
 * column would remove the app's one `<nav aria-label="Primary">` landmark at
 * widths where nothing else offers it, and leave the way back reachable only
 * from a control that had just hidden itself. An icon rail keeps every
 * destination one click and one tab-stop away, which is the whole point of
 * collapsing rather than closing.
 */
export type SidebarState = 'expanded' | 'rail'

/**
 * What a browser that has never been told otherwise gets — and, because the
 * store answers this on the server too, what the SSR markup is built from.
 */
export const DEFAULT_SIDEBAR_STATE: SidebarState = 'expanded'

/**
 * The one place the storage key is written down.
 *
 * localStorage, not a users column: every UI preference in this app already
 * lives there (theme, colourway, go-to shortcuts, panel open state, summary
 * language), and a column would mean a migration for a per-browser choice —
 * the same person on a laptop and a desk monitor genuinely wants two answers.
 */
export const SIDEBAR_STORAGE_KEY = 'logpup.sidebar'

/**
 * The `<nav>`'s DOM id, so the toggle can point `aria-controls` at the region
 * it actually collapses. Here rather than inline in the component because the
 * button and the nav are two files apart from each other's edits.
 */
export const SIDEBAR_NAV_ID = 'app-sidebar'

/**
 * Reads whatever is in storage, and never trusts it.
 *
 * Anything that is not exactly 'rail' — never written, written by an older
 * build, hand-edited, or a JSON blob left by something else on the same origin
 * — resolves to the default rather than throwing or collapsing the nav. The
 * failure direction matters: a corrupt value must not be able to hide the
 * navigation, so only the affirmative string can.
 */
export function resolveSidebarState(stored: string | null | undefined): SidebarState {
  return stored === 'rail' ? 'rail' : DEFAULT_SIDEBAR_STATE
}

/** Where the toggle sends you from here. */
export function nextSidebarState(state: SidebarState): SidebarState {
  return state === 'rail' ? 'expanded' : 'rail'
}

/**
 * What the toggle is CALLED right now.
 *
 * Names the state it will leave you in, not the verb "toggle" — the same rule
 * the go-to shortcuts row follows in features/settings/commands.ts. It is also
 * the button's accessible name, so the name changes with the state, which is
 * what makes `aria-expanded` a second signal rather than the only one.
 */
export function sidebarToggleLabel(state: SidebarState): string {
  return state === 'rail' ? 'Expand sidebar' : 'Collapse sidebar'
}

/** The same answer, worded for a ⌘K row rather than a 28px button. */
export function sidebarCommandLabel(state: SidebarState): string {
  return state === 'rail' ? 'Expand the sidebar' : 'Collapse the sidebar'
}
