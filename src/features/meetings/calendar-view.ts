/**
 * Which calendar view is showing, which date it is focused on, and exactly
 * which days that combination puts on screen.
 *
 * WHY THE URL OWNS BOTH. A calendar whose view and date reset on every reload
 * is one you cannot link to. `?view=week&date=2026-08-10` is a sentence
 * somebody can paste into a message, and the server can read it before the
 * first paint — so the page arrives already showing the right week rather than
 * flickering from a default. Same reasoning (and the same `replaceState`
 * mechanics) as the sprint board's `board-view.ts`.
 *
 * WHY EVERY DATE HERE IS A `yyyy-mm-dd` STRING. This runs on the server and
 * again in the browser, in two different timezones. A day boundary derived
 * from a `Date` would differ between them; a calendar-date string is the same
 * character-for-character on both sides. The only place strings become instants
 * is `calendar-grid.ts`, which asks the platform's timezone database.
 *
 * Weeks start MONDAY, matching the existing month grid and how this team reads
 * a week.
 */

import { addCalendarDays, dayDelta } from '@/features/sprints/sprint-date-range'
import { zonedDayStartMs } from '@/features/meetings/calendar-grid'
import { LK_TIMEZONE } from '@/lib/lk-holidays'

export const CALENDAR_VIEWS = ['list', 'day', 'week', 'month', 'agenda'] as const
export type CalendarView = (typeof CALENDAR_VIEWS)[number]

/** The page opens on the list, exactly as it does today — the new views are
 *  something you navigate to, not something that replaces what worked. */
export const DEFAULT_VIEW: CalendarView = 'list'

/** The two views the scrollable time grid renders. */
export const TIME_GRID_VIEWS = ['day', 'week'] as const

export function isTimeGridView(view: CalendarView): view is 'day' | 'week' {
  return view === 'day' || view === 'week'
}

/** Everything except the untouched list view. */
export function isCalendarView(view: CalendarView): boolean {
  return view !== 'list'
}

export const VIEW_LABEL: Record<CalendarView, string> = {
  list: 'List',
  day: 'Day',
  week: 'Week',
  month: 'Month',
  agenda: 'Agenda',
}

/** The unit Prev/Next moves by in each view — also the word the buttons say,
 *  so "Next" can never mean something different from what it is labelled. */
export const VIEW_STEP_UNIT: Record<CalendarView, 'day' | 'week' | 'month'> = {
  list: 'day',
  day: 'day',
  week: 'week',
  month: 'month',
  agenda: 'month',
}

export function parseCalendarView(raw: string | null | undefined): CalendarView {
  return (CALENDAR_VIEWS as readonly string[]).includes(raw ?? '')
    ? (raw as CalendarView)
    : DEFAULT_VIEW
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** True only for a `yyyy-mm-dd` string naming a date that exists — `2026-02-30`
 *  is rejected rather than silently rolled over into March. */
export function isIsoDate(raw: string): boolean {
  const match = ISO_DATE.exec(raw)
  if (!match) return false
  const [, year, month, day] = match.map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

/** The focused date from the URL, falling back to today for anything missing
 *  or hand-mangled. `todayIso` is passed in rather than read here so the
 *  server and the browser can be handed the same value. */
export function parseFocusedDate(raw: string | null | undefined, todayIso: string): string {
  return raw && isIsoDate(raw) ? raw : todayIso
}

/**
 * The view and date as URL params, in the `null means delete this key` shape
 * the caller applies over the CURRENT params — so `?new=1` and anything else
 * on the page survives.
 *
 * Both defaults serialise to null, which keeps `/meetings` clean for the view
 * the page opens in. The consequence, taken with eyes open: a link shared while
 * looking at today's week is `?view=week`, so it opens on the RECIPIENT's
 * current week. That is the right behaviour for "show me this week" and the
 * wrong one for "look at this specific Tuesday" — which is why moving off
 * today pins the date into the URL immediately.
 */
export function calendarUrlPatch(
  view: CalendarView,
  focusedIso: string,
  todayIso: string,
): Record<string, string | null> {
  return {
    view: view === DEFAULT_VIEW ? null : view,
    date: view === DEFAULT_VIEW || focusedIso === todayIso ? null : focusedIso,
  }
}

/* ── calendar-date arithmetic ─────────────────────────────────────────────
   All of it in `Date.UTC` space and back out through the UTC getters, so a
   month boundary never depends on where the code is running. `addCalendarDays`
   / `dayDelta` are reused from the sprint roadmap rather than rewritten — the
   same "always UTC in, always UTC out" contract, already tested. */

function isoParts(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month, day }
}

function toIso(utcMs: number): string {
  const date = new Date(utcMs)
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${date.getUTCFullYear()}-${month}-${day}`
}

/** 0 = Monday … 6 = Sunday. Monday-based because the week starts Monday here,
 *  so this index doubles as the column number in the week view. */
export function mondayIndex(iso: string): number {
  const { year, month, day } = isoParts(iso)
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7
}

export function startOfWeekIso(iso: string): string {
  return addCalendarDays(iso, -mondayIndex(iso))
}

export function startOfMonthIso(iso: string): string {
  const { year, month } = isoParts(iso)
  return toIso(Date.UTC(year, month - 1, 1))
}

export function endOfMonthIso(iso: string): string {
  const { year, month } = isoParts(iso)
  // Day 0 of the NEXT month is the last day of this one — and rolls the year
  // over correctly in December without a special case.
  return toIso(Date.UTC(year, month, 0))
}

/** Adds whole months, clamping the day so 31 Jan + 1 month is 28/29 Feb rather
 *  than spilling into March. */
export function addCalendarMonths(iso: string, months: number): string {
  const { year, month, day } = isoParts(iso)
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate()
  return toIso(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, lastDay)),
  )
}

export type VisibleRange = {
  /** Every day on screen, in order, as `yyyy-mm-dd`. */
  days: string[]
  /** First and last of `days` — the header's range label reads off these. */
  start: string
  end: string
}

function rangeFrom(start: string, dayCount: number): VisibleRange {
  const days: string[] = []
  for (let i = 0; i < dayCount; i += 1) days.push(addCalendarDays(start, i))
  return { days, start, end: days[days.length - 1] }
}

/**
 * The days a view puts on screen for a given focused date.
 *
 *   day    — the focused day alone.
 *   week   — Monday through Sunday around it.
 *   month  — the padded GRID the month calendar draws: whole Monday-started
 *            weeks from the one containing the 1st to the one containing the
 *            last day, so it always ends on a Sunday and is 28/35/42 days.
 *            (The grid days, not the month's own bounds: a meeting on the 31st
 *            of the previous month IS on screen, and pretending otherwise
 *            would leave it unrendered in a cell the user can see.)
 *   agenda — the focused calendar month itself, 1st to last. The agenda is a
 *            reading list, not a grid, so it has no weeks to pad out to.
 *   list   — not a ranged view; the untouched list renders every meeting. The
 *            focused day is returned so callers need no special case.
 */
export function visibleRange(view: CalendarView, focusedIso: string): VisibleRange {
  if (view === 'week') return rangeFrom(startOfWeekIso(focusedIso), 7)

  if (view === 'month') {
    const gridStart = startOfWeekIso(startOfMonthIso(focusedIso))
    const lastDay = endOfMonthIso(focusedIso)
    const gridEnd = addCalendarDays(startOfWeekIso(lastDay), 6)
    return rangeFrom(gridStart, dayDelta(gridStart, gridEnd) + 1)
  }

  if (view === 'agenda') {
    const start = startOfMonthIso(focusedIso)
    return rangeFrom(start, dayDelta(start, endOfMonthIso(focusedIso)) + 1)
  }

  return rangeFrom(focusedIso, 1)
}

/** Where Prev / Next land, by the current view's own unit. */
export function stepFocusedDate(
  view: CalendarView,
  focusedIso: string,
  direction: 1 | -1,
): string {
  const unit = VIEW_STEP_UNIT[view]
  if (unit === 'month') return addCalendarMonths(focusedIso, direction)
  return addCalendarDays(focusedIso, direction * (unit === 'week' ? 7 : 1))
}

/**
 * A `Date` standing for the MIDDAY of `iso` in the team's timezone.
 *
 * The point of the midday: `getLkHoliday` and `isLkSunday` take an INSTANT and
 * work out which Colombo day it lands on. Handing them a naive local midnight
 * would resolve to the day before or after on a machine far enough east or
 * west. Anchoring to the real Colombo midnight and stepping twelve hours in
 * makes the answer exact from any runtime — and reuses those helpers rather
 * than re-deriving Sunday-or-holiday from the ISO string.
 */
export function isoDayInstant(iso: string, timeZone: string = LK_TIMEZONE): Date {
  return new Date(zonedDayStartMs(iso, timeZone) + 12 * 60 * 60_000)
}

/**
 * A `Date` carrying `iso`'s calendar fields in LOCAL time, for `date-fns`
 * `format` calls only (weekday name, day number, month name). Constructed from
 * the components and read back through the matching local getters, so the round
 * trip is exact and never touches a timezone. Never use it as an instant.
 */
export function isoToDisplayDate(iso: string): Date {
  const { year, month, day } = isoParts(iso)
  return new Date(year, month - 1, day)
}
