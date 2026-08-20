import { WORK_DAY_PATTERN } from '@/features/worklog/worklog-day'

/**
 * URL params for /progress, and the hrefs that set them.
 *
 * Same house rule as people/history-params.ts and apps/browse.ts: the page's
 * whole state lives in the query string, so any view can be linked, bookmarked
 * and back-buttoned, and the page stays a server component. Parsing is total —
 * a malformed param degrades to the default rather than throwing, because
 * these values arrive from bookmarks and hand-edited URLs, not from a form we
 * control.
 *
 * Pure and DB-free so both the server page and the client filter bar can
 * import it, and so the window arithmetic is pinned by tests rather than
 * discovered on a month boundary.
 */

export const PROGRESS_RANGES = ['fortnight', 'month'] as const
export type ProgressRange = (typeof PROGRESS_RANGES)[number]

export const PROGRESS_RANGE_LABEL: Record<ProgressRange, string> = {
  fortnight: 'Fortnight',
  month: 'Month',
}

export type ProgressParams = {
  range: ProgressRange
  /**
   * Any ISO day inside the wanted window, or null for "the current one".
   * `resolveProgressWindow` snaps it — to its Monday for a fortnight, to its
   * month for a month — so prev/next links can pass a plain day and stay
   * correct whichever mode the reader toggles to next.
   */
  start: string | null
  /** Free-text filter over person names. */
  q: string
  /** One app id, narrowing both the matrix and the lane. */
  app: string | null
}

/** Next hands searchParams values over as string | string[] | undefined. */
export type RawProgressParams = {
  range?: string | string[]
  start?: string | string[]
  q?: string | string[]
  app?: string | string[]
}

const MAX_QUERY_CHARS = 60

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * A day that both matches the shape AND survives a round trip through the
 * calendar — `2026-02-31` matches the pattern but is not a date, and letting
 * it through would put the cursor arithmetic below into a silent carry.
 */
function isValidIsoDay(value: string): boolean {
  if (!WORK_DAY_PATTERN.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function parseProgressParams(raw: RawProgressParams): ProgressParams {
  const range = first(raw.range)
  const start = first(raw.start)
  const app = first(raw.app)
  return {
    range: (PROGRESS_RANGES as readonly string[]).includes(range ?? '')
      ? (range as ProgressRange)
      : 'fortnight',
    start: start && isValidIsoDay(start) ? start : null,
    // Trimmed and capped: it only ever feeds a substring match, but an
    // unbounded param has no business round-tripping through a URL.
    q: (first(raw.q) ?? '').trim().slice(0, MAX_QUERY_CHARS),
    // An id the viewer cannot see is dropped by the page after it has the
    // visible-app list; here it only has to be URL-safe and bounded.
    app: app ? app.slice(0, MAX_QUERY_CHARS) : null,
  }
}

/**
 * One ISO day, `days` steps away. Anchored at midday UTC — the same guard
 * coverage.ts and the worklog page's shiftDay use — so the ±05:30 Colombo
 * offset can never tip a step into the neighbouring date. Calendar arithmetic
 * only; which days are WORKING days is decided in src/lib/working-days.ts and
 * nowhere else.
 */
export function addDaysIso(iso: string, days: number): string {
  const cursor = new Date(`${iso}T12:00:00Z`)
  cursor.setUTCDate(cursor.getUTCDate() + days)
  return cursor.toISOString().slice(0, 10)
}

/** Every day from `from` to `to`, both ends inclusive. */
export function eachDayInclusive(from: string, to: string): string[] {
  const days: string[] = []
  for (let iso = from; iso <= to; iso = addDaysIso(iso, 1)) days.push(iso)
  return days
}

/**
 * The Monday of the week containing `iso`. Midday-UTC weekday read, same
 * guard as `weekdayKey` in coverage.ts — this is calendar arithmetic, not a
 * working-day decision.
 */
export function mondayOf(iso: string): string {
  const weekday = new Date(`${iso}T12:00:00Z`).getUTCDay()
  return addDaysIso(iso, -((weekday + 6) % 7))
}

function firstOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

/** The first of the month `months` steps away from the month containing `iso`. */
function shiftMonthFirst(iso: string, months: number): string {
  const total = Number(iso.slice(0, 4)) * 12 + (Number(iso.slice(5, 7)) - 1) + months
  const year = Math.floor(total / 12)
  const month = (total % 12) + 1
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`
}

export type ProgressWindow = {
  /** Inclusive bounds of the visible window. */
  from: string
  to: string
  /** Every visible day, oldest first — the matrix's columns. */
  days: string[]
  /** `start` values for the prev/next links. */
  prevStart: string
  nextStart: string
  /**
   * Whether a later window would contain any non-future day. A window that is
   * pure future has nothing to say on a page about what was logged, so the
   * next control stops here rather than paging into blank weeks.
   */
  hasNext: boolean
}

/**
 * The window the params ask for.
 *
 * Fortnights start on a Monday, always — any `start` is snapped back to its
 * week's Monday so two people pasting slightly different links see the same
 * columns. The default fortnight is LAST week plus this one: the page's job
 * is finding gaps, and a window that is mostly future has none to find.
 */
export function resolveProgressWindow(params: ProgressParams, today: string): ProgressWindow {
  if (params.range === 'month') {
    const from = firstOfMonth(params.start ?? today)
    const nextStart = shiftMonthFirst(from, 1)
    const to = addDaysIso(nextStart, -1)
    return {
      from,
      to,
      days: eachDayInclusive(from, to),
      prevStart: shiftMonthFirst(from, -1),
      nextStart,
      hasNext: nextStart <= today,
    }
  }

  const from = params.start ? mondayOf(params.start) : addDaysIso(mondayOf(today), -7)
  const to = addDaysIso(from, 13)
  const nextStart = addDaysIso(from, 14)
  return {
    from,
    to,
    days: eachDayInclusive(from, to),
    prevStart: addDaysIso(from, -14),
    nextStart,
    hasNext: nextStart <= today,
  }
}

/**
 * Rebuilds the page's URL with `patch` applied — the only way links are
 * built. Defaults are omitted so a bare /progress stays the canonical
 * "current fortnight, everyone" link.
 */
export function progressHref(params: ProgressParams, patch: Partial<ProgressParams>): string {
  const next = { ...params, ...patch }
  const search = new URLSearchParams()
  if (next.range !== 'fortnight') search.set('range', next.range)
  if (next.start) search.set('start', next.start)
  if (next.q) search.set('q', next.q)
  if (next.app) search.set('app', next.app)
  const query = search.toString()
  return query ? `/progress?${query}` : '/progress'
}
