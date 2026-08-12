/**
 * Geometry and row packing for the roadmap timeline.
 *
 * The timeline is a single linear day axis: every day is exactly
 * `PX_PER_DAY[zoom]` pixels wide, everywhere, so a bar's pixel position IS
 * its date and the inverse (pixels dragged → days moved) is a division. No
 * per-month column widths, no accumulated rounding — that is what makes
 * drag-to-reschedule land on the day the user aimed at.
 *
 * ROW PACKING. One row per sprint wastes vertical space and hides the thing
 * a roadmap is for: whether work overlaps. `packRows` is greedy interval
 * partitioning — walk the sprints in date order and drop each into the first
 * row whose last bar has already finished. Sprints that genuinely overlap
 * are forced onto separate rows and the collision becomes visible; sprints
 * that don't share a row. Greedy is provably optimal for interval graphs
 * (it uses exactly max-concurrent rows), so there is no cleverer algorithm
 * to reach for later.
 *
 * Pure and colocated with roadmap-layout.test.ts: this is drag maths, which
 * is exactly the class of logic that must not live inside a component.
 */

import { addCalendarDays, dayDelta, inclusiveDayCount } from '@/features/sprints/sprint-date-range'

export const ZOOM_LEVELS = ['week', 'month', 'quarter'] as const
export type Zoom = (typeof ZOOM_LEVELS)[number]

/**
 * Day width per zoom. `week` is wide enough to read a day-of-month label on
 * every column; `month` matches the previous static roadmap (4px/day was too
 * tight to grab a 6px bar edge, so it doubles); `quarter` trades legibility
 * for a year of context in one screen.
 */
export const PX_PER_DAY: Record<Zoom, number> = { week: 26, month: 8, quarter: 3 }

export const ZOOM_LABEL: Record<Zoom, string> = {
  week: 'Weeks',
  month: 'Months',
  quarter: 'Quarters',
}

export function parseZoom(raw: string | null | undefined): Zoom {
  return (ZOOM_LEVELS as readonly string[]).includes(raw ?? '') ? (raw as Zoom) : 'month'
}

export type Span = { id: string; startDate: string; endDate: string }

/**
 * Row index per span, keyed by id. Input order is irrelevant — spans are
 * sorted by (start, end, id) first, so the packing is deterministic and two
 * renders of the same data can never disagree about which row a bar is on
 * (a bar that hops rows between renders reads as data changing when nothing
 * did).
 *
 * `gapDays` is breathing room BETWEEN bars measured in days: two sprints
 * where one ends the day before the next begins do not overlap, but at
 * quarter zoom their bars are a few pixels apart and read as one. Demanding
 * a gap pushes them apart instead of lying about the dates.
 */
export function packRows(spans: Span[], gapDays = 0): Map<string, number> {
  const ordered = [...spans].sort(
    (a, b) =>
      a.startDate.localeCompare(b.startDate) ||
      a.endDate.localeCompare(b.endDate) ||
      a.id.localeCompare(b.id),
  )

  // rowEnds[i] is the last occupied day of row i, as an ISO date.
  const rowEnds: string[] = []
  const rows = new Map<string, number>()

  for (const span of ordered) {
    // An inverted range (end before start) can only come from a direct DB
    // edit; treat it as a single day at its start so it still gets a row
    // rather than silently colliding with everything.
    const end = span.endDate < span.startDate ? span.startDate : span.endDate

    let placed = -1
    for (let row = 0; row < rowEnds.length; row += 1) {
      if (dayDelta(rowEnds[row], span.startDate) > gapDays) {
        placed = row
        break
      }
    }
    if (placed === -1) {
      placed = rowEnds.length
      rowEnds.push(end)
    } else if (end > rowEnds[placed]) {
      rowEnds[placed] = end
    }
    rows.set(span.id, placed)
  }

  return rows
}

/** How many rows `packRows` produced — the timeline's height in rows. */
export function rowCount(rows: Map<string, number>): number {
  let max = -1
  for (const row of rows.values()) if (row > max) max = row
  return max + 1
}

export type TimelineWindow = {
  startDate: string
  endDate: string
  /** Inclusive day count, i.e. the axis length in day columns. */
  totalDays: number
}

/**
 * The date range the axis has to cover: every sprint, plus today (so the
 * "you are here" marker is always on screen, even for an app whose sprints
 * all finished last quarter), plus `padDays` of margin at each end so a bar
 * can be dragged PAST the current extremes without the axis having to grow
 * mid-drag.
 */
export function timelineWindow(spans: Span[], todayIso: string, padDays = 7): TimelineWindow {
  let min = todayIso
  let max = todayIso
  for (const span of spans) {
    if (span.startDate < min) min = span.startDate
    if (span.endDate > max) max = span.endDate
    // Defensive: an inverted range must still widen the window both ways.
    if (span.endDate < min) min = span.endDate
    if (span.startDate > max) max = span.startDate
  }
  const startDate = addCalendarDays(min, -padDays)
  const endDate = addCalendarDays(max, padDays)
  return { startDate, endDate, totalDays: inclusiveDayCount(startDate, endDate) }
}

export type BarGeometry = { left: number; width: number }

/**
 * Where a bar sits on the axis, in pixels. `width` is floored at one day so a
 * single-day sprint is still a grabbable target at quarter zoom (3px would
 * not be), and an inverted range renders as that same minimum rather than a
 * negative width that would paint outside its own row.
 */
export function barGeometry(span: Span, window: TimelineWindow, zoom: Zoom): BarGeometry {
  const pxPerDay = PX_PER_DAY[zoom]
  const offset = dayDelta(window.startDate, span.startDate)
  const days = Math.max(inclusiveDayCount(span.startDate, span.endDate), 1)
  return { left: offset * pxPerDay, width: days * pxPerDay }
}

/**
 * Pixels dragged → whole days moved. Rounding (not truncation) is what makes
 * the bar snap to the NEAREST day: drag two-thirds of a day forward and you
 * meant the next day, not this one.
 */
export function snapDays(deltaPx: number, zoom: Zoom): number {
  if (!Number.isFinite(deltaPx)) return 0
  return Math.round(deltaPx / PX_PER_DAY[zoom])
}

/** Day columns from the window's start to `iso`; negative when `iso` is
 *  before the window (the caller decides whether that is off-screen). */
export function offsetOfDate(window: TimelineWindow, iso: string): number {
  return dayDelta(window.startDate, iso)
}
