/**
 * The app detail page's sections, and the rule for turning `?tab=` into one
 * of them.
 *
 * WHY THIS IS PLAIN URL STATE AND NOT A TABS WIDGET
 * The previous version drove Base UI's <Tabs> from the URL through
 * `useOptimistic`, with a long comment explaining why it had to be controlled
 * (an uncontrolled Tabs re-initialised from a changing `defaultValue` warns,
 * loudly). That whole class of controlled/uncontrolled ambiguity disappears
 * if the tab bar is simply a list of links: the server reads `?tab=`, renders
 * exactly one panel, and there is no second copy of the state to get out of
 * sync. It also means only the ACTIVE section's data is queried — the old
 * page fetched the board, the meeting list, the comment thread and the team
 * on every visit no matter which tab you were on.
 *
 * Links keep keyboard operation for free (Tab to move, Enter to open,
 * ⌘-click to open in a new tab — which a Tabs widget cannot do), and
 * `aria-current="page"` is the correct announcement for "this is the section
 * you are in" on a navigation.
 */

export const APP_TAB_IDS = [
  'overview',
  'board',
  'roadmap',
  'discussion',
  'meetings',
  'activity',
  'settings',
] as const

export type AppTabId = (typeof APP_TAB_IDS)[number]

export const APP_TAB_LABEL: Record<AppTabId, string> = {
  overview: 'Overview',
  board: 'Board',
  roadmap: 'Roadmap',
  discussion: 'Discussion',
  meetings: 'Meetings',
  activity: 'Activity',
  settings: 'Settings',
}

export const DEFAULT_APP_TAB: AppTabId = 'overview'

/**
 * Resolves the requested tab against the ones this viewer can actually see.
 *
 * Two distinct fallbacks, both to Overview: an unrecognised value (a typo, an
 * old link from before a tab was renamed) and a REAL tab the viewer isn't
 * allowed into. Settings is admin-only, so a `?tab=settings` link can outlive
 * the permission that produced it — landing on a working page beats landing
 * on an empty one or a 403.
 */
export function normalizeAppTab(
  raw: string | string[] | undefined,
  available: readonly AppTabId[],
): AppTabId {
  const value = Array.isArray(raw) ? raw[0] : raw
  const match = APP_TAB_IDS.find((id) => id === value)
  if (match && available.includes(match)) return match
  return DEFAULT_APP_TAB
}

/**
 * Link target for a tab. Overview is the bare path so the canonical URL of an
 * app has no query string at all.
 *
 * Other params are deliberately NOT carried across: the only one that exists
 * is `?sprint=`, which is meaningless everywhere except the Board and, when
 * dropped, makes the Board re-select the running sprint — the right default
 * for someone arriving from another section.
 */
export function appTabHref(slug: string, tab: AppTabId): string {
  const base = `/apps/${slug}`
  return tab === DEFAULT_APP_TAB ? base : `${base}?tab=${tab}`
}

/** Board links (sprint switcher, backlog toggle) must keep `tab=board` in the
 *  URL. Omitting it is what used to bounce people back to Overview the moment
 *  they clicked Backlog. */
export function boardHref(slug: string, sprint?: string | null): string {
  const params = new URLSearchParams({ tab: 'board' })
  if (sprint) params.set('sprint', sprint)
  return `/apps/${slug}?${params.toString()}`
}
