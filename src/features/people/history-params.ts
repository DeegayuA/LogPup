// URL params for /people/history, and the hrefs that set them.
//
// Same house rule as apps/browse.ts and the activity filters: the view's whole
// state lives in the query string, so a page anyone can link, bookmark and
// back-button out of stays a server component. Parsing is total — a malformed
// param degrades to the default rather than throwing — because these values
// arrive from bookmarks and hand-edited URLs, not from a form we control.

import { isoDaysAgo, resolveAsOf, todayIso, type ResolvedAsOf } from '@/features/people/as-of-date'

/** Which slice of the page is in front. Link-based, like AppTabNav. */
export const HISTORY_VIEWS = ['people', 'apps', 'changes'] as const
export type HistoryView = (typeof HISTORY_VIEWS)[number]

export const HISTORY_VIEW_LABEL: Record<HistoryView, string> = {
  people: 'By person',
  apps: 'By app',
  changes: 'Change log',
}

/** How far back the comparison window reaches, in days. */
export const COMPARE_WINDOWS = [7, 14, 30, 90] as const
export type CompareWindow = (typeof COMPARE_WINDOWS)[number]
export const DEFAULT_COMPARE_WINDOW: CompareWindow = 30

export type HistoryParams = {
  /** The "as of" day — the right-hand edge of the window. */
  at: string | undefined
  /** How many days before `at` the comparison reaches. */
  window: CompareWindow
  view: HistoryView
  /** Free-text filter over person and app names. */
  q: string
  /** Show only people whose load or apps actually moved in the window. */
  movedOnly: boolean
}

export type RawHistoryParams = {
  at?: string
  window?: string
  view?: string
  q?: string
  moved?: string
}

const MAX_QUERY_CHARS = 60

export function parseHistoryParams(raw: RawHistoryParams): HistoryParams {
  const windowDays = Number(raw.window)
  return {
    at: raw.at,
    window: (COMPARE_WINDOWS as readonly number[]).includes(windowDays)
      ? (windowDays as CompareWindow)
      : DEFAULT_COMPARE_WINDOW,
    view: (HISTORY_VIEWS as readonly string[]).includes(raw.view ?? '')
      ? (raw.view as HistoryView)
      : 'people',
    // Trimmed and capped: this only ever feeds a substring match, but an
    // unbounded param has no business round-tripping through a URL.
    q: (raw.q ?? '').trim().slice(0, MAX_QUERY_CHARS),
    movedOnly: raw.moved === '1',
  }
}

/**
 * The window this page actually queries: `to` is the resolved as-of instant,
 * `from` is the end of the day N days before it.
 *
 * `from` is derived by resolving the ISO DAY N days back — never by
 * subtracting milliseconds — so both edges of the window land on the end of a
 * day in Asia/Colombo, the same rule the as-of picker's own presets use.
 */
export function resolveHistoryWindow(
  params: HistoryParams,
  now: Date = new Date(),
): { asOf: ResolvedAsOf; from: Date; fromIso: string } {
  const asOf = resolveAsOf(params.at, now)
  const fromIso = isoDaysAgo(params.window, asOf.at)
  // `now` is passed through so the future-clamp inside resolveAsOf uses the
  // same clock; a `from` in the past is never clamped, so this only matters
  // for consistency in tests.
  const from = resolveAsOf(fromIso, now).at
  return { asOf, from, fromIso }
}

/** Rebuilds the page's URL with `patch` applied — the only way links are built. */
export function historyHref(
  params: HistoryParams,
  patch: Partial<HistoryParams>,
  now: Date = new Date(),
): string {
  const next = { ...params, ...patch }
  const search = new URLSearchParams()
  // Today is the default and needs no param — a bare /people/history is the
  // canonical "now" link.
  if (next.at && next.at !== todayIso(now)) search.set('at', next.at)
  if (next.window !== DEFAULT_COMPARE_WINDOW) search.set('window', String(next.window))
  if (next.view !== 'people') search.set('view', next.view)
  if (next.q) search.set('q', next.q)
  if (next.movedOnly) search.set('moved', '1')
  const query = search.toString()
  return query ? `/people/history?${query}` : '/people/history'
}
