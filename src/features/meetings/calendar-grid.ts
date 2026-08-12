/**
 * Geometry for the meetings time grid: where a meeting sits in a day column,
 * how tall it is, which meetings belong in the all-day strip instead, and how
 * a calendar DAY (a `yyyy-mm-dd` string in Asia/Colombo) maps onto the epoch
 * milliseconds a `Date` actually carries.
 *
 * WHY THE GRID IS KEYED BY ISO DATE STRINGS, NOT `Date`s. This component tree
 * renders on the server and then hydrates in the browser, and those two run in
 * different timezones as a matter of course. A grid whose day boundaries came
 * from `startOfDay(new Date())` would put a 09:00 meeting in a different row on
 * each side. Every day here is a string in the team's timezone, and the only
 * conversion to instants goes through `zonedDayStartMs`, which asks the
 * platform's own timezone database rather than adding an offset by hand.
 *
 * Pure — no DOM, no clock reads except the ones the caller passes in.
 */

import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'

export const MINUTES_PER_DAY = 24 * 60
const MS_PER_MINUTE = 60_000

/**
 * The grid always renders a FULL 24 hours. Hiding the small hours would mean a
 * 06:30 flight-day standup or a 21:00 call with a US client silently does not
 * exist on the calendar — the one failure a calendar must never have. The cost
 * is vertical space, which `SCROLL_TO_HOUR` and the working-hours emphasis pay
 * back on open.
 */
export const GRID_START_HOUR = 0
export const GRID_END_HOUR = 24

/** Working hours are drawn at full strength; everything outside them is dimmed
 *  (never hidden) so the eye lands on the part of the day that has meetings in
 *  it without losing the part that occasionally does. */
export const WORK_START_HOUR = 8
export const WORK_END_HOUR = 18

/** Where the scroll container parks itself when the grid opens. */
export const SCROLL_TO_HOUR = 8

/* Zoom is ONE number: the height of an hour row in CSS pixels. Everything else
   — event tops, heights, the now line, the hour labels — is derived from it,
   so there is no second source of truth to drift.

   The floor is set by the hour label: below ~32px/hour two adjacent labels
   collide. The ceiling is set by usefulness: past ~160px/hour a single meeting
   fills the viewport and the grid stops being a grid. */
export const MIN_PX_PER_HOUR = 32
export const MAX_PX_PER_HOUR = 160
export const DEFAULT_PX_PER_HOUR = 56
export const PX_PER_HOUR_STEP = 8

export function clampPxPerHour(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PX_PER_HOUR
  return Math.min(MAX_PX_PER_HOUR, Math.max(MIN_PX_PER_HOUR, Math.round(value)))
}

/**
 * Shortest an event block may be drawn, whatever the zoom.
 *
 * At the minimum zoom a 15-minute meeting is 8px tall: too short to read a
 * title in, and — more to the point — too short to reliably click. 22px keeps
 * one line of text and a real hit target. Blocks shorter than their true
 * duration therefore overlap the next slot slightly; that is the honest trade,
 * and the alternative (a meeting you cannot open) is worse.
 */
export const MIN_EVENT_HEIGHT_PX = 22

/**
 * A meeting this long or longer goes in the ALL-DAY STRIP above the scrolling
 * grid instead of being drawn as a block inside it.
 *
 * THE RULE: `endsAt - startsAt >= 20 hours`. Nothing else — not the start
 * time, not the timezone.
 *
 * Why a duration threshold rather than "starts and ends at midnight": the
 * midnight-to-midnight shape is only one of the ways an all-day block reaches
 * us. Google Calendar hands back 00:00–00:00 (24h); an .ics import or a
 * hand-typed block often lands on 00:00–23:59 (23h59m); a two-day offsite is
 * 48h. All three are the same thing to a reader and all three clear 20 hours,
 * so the midnight-to-midnight case is subsumed rather than special-cased.
 *
 * Why 20 and not 24: it leaves an hours-wide margin on both sides. Nobody
 * schedules a 20-hour meeting, and no all-day block is shorter than 23 hours,
 * so there is no realistic input anywhere near the boundary.
 *
 * A meeting that merely CROSSES midnight (22:00–02:00, four hours) is not
 * all-day. It is clipped by `clipToDay` and drawn as a block on each of the two
 * days it touches, which is what it looks like in real life.
 */
export const ALL_DAY_MIN_MINUTES = 20 * 60

export function isAllDayMeeting(startMs: number, endMs: number): boolean {
  return (endMs - startMs) / MS_PER_MINUTE >= ALL_DAY_MIN_MINUTES
}

/**
 * The UTC offset of `timeZone` at a given instant, in milliseconds.
 *
 * Formats the instant as wall-clock parts in the zone, reads those parts back
 * as if they were UTC, and takes the difference. That is the standard way to
 * get an offset out of the platform's own timezone database without shipping
 * one — and without ever writing "+5:30" as a literal, which would be wrong
 * the moment this is asked about anywhere else.
 */
function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs))

  const at = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0')
  const asUtc = Date.UTC(at('year'), at('month') - 1, at('day'), at('hour'), at('minute'), at('second'))
  // formatToParts has no millisecond field, so compare against the instant
  // floored to the second rather than the raw instant.
  return asUtc - Math.floor(instantMs / 1000) * 1000
}

/**
 * The instant at which the calendar day `iso` (a `yyyy-mm-dd` string) begins in
 * `timeZone` — i.e. that day's 00:00 wall clock, as epoch milliseconds.
 *
 * Asia/Colombo has had a fixed +05:30 offset since 2006 and no DST, so the
 * first guess is always right there. The refinement pass exists anyway: a zone
 * WITH DST can have a different offset at UTC-midnight than at local midnight,
 * and a helper that only happens to be correct for one timezone is a trap for
 * whoever reuses it.
 */
export function zonedDayStartMs(iso: string, timeZone: string = LK_TIMEZONE): number {
  const [year, month, day] = iso.split('-').map(Number)
  const utcMidnight = Date.UTC(year, month - 1, day)
  const firstPass = utcMidnight - zoneOffsetMs(utcMidnight, timeZone)
  const secondPass = utcMidnight - zoneOffsetMs(firstPass, timeZone)
  return secondPass
}

export type DayWindow = {
  /** The ISO day this window describes, in `timeZone`. */
  iso: string
  /** Epoch ms of 00:00 on that day. */
  startMs: number
  /** Epoch ms of the NEXT day's 00:00 — exclusive, so windows tile without gaps. */
  endMs: number
}

/** The [00:00, 24:00) instant window of one calendar day. Derived from the two
 *  neighbouring midnights rather than `start + 24h`, so a DST day is 23 or 25
 *  hours long instead of silently losing an hour off its end. */
export function dayWindow(iso: string, timeZone: string = LK_TIMEZONE): DayWindow {
  const startMs = zonedDayStartMs(iso, timeZone)
  // +36h then re-snap: any instant safely inside the next day, whatever the
  // offset change, snapped back to that day's own midnight.
  const nextIso = toIsoDateInTimeZone(new Date(startMs + 36 * 60 * MS_PER_MINUTE), timeZone)
  return { iso, startMs, endMs: zonedDayStartMs(nextIso, timeZone) }
}

export type DaySegment = {
  /** Minutes from this day's 00:00 to where the block starts. */
  startMinutes: number
  /** Minutes from this day's 00:00 to where the block ends. */
  endMinutes: number
  /** The meeting began on an earlier day — the block is cut off at the top. */
  continuesBefore: boolean
  /** The meeting runs into a later day — the block is cut off at the bottom. */
  continuesAfter: boolean
}

/**
 * The part of a meeting that falls inside one day, in minutes from that day's
 * midnight, or null when it does not touch the day at all.
 *
 * A meeting that crosses midnight yields a segment on each day it touches, so
 * a 22:00–02:00 call is drawn as two blocks rather than as one block hanging
 * off the bottom of Tuesday with nothing on Wednesday.
 *
 * A meeting that ends exactly at midnight belongs only to the day it started
 * — it does not earn a zero-height sliver at the top of the next one. A
 * ZERO-LENGTH meeting is the one exception: it has nothing but a start
 * instant, so it is kept wherever that instant lands.
 */
export function clipToDay(startMs: number, endMs: number, window: DayWindow): DaySegment | null {
  const hasExtent = endMs > startMs
  if (hasExtent ? endMs <= window.startMs : endMs < window.startMs) return null
  if (startMs >= window.endMs) return null

  const clippedStart = Math.max(startMs, window.startMs)
  const clippedEnd = Math.min(Math.max(endMs, startMs), window.endMs)

  return {
    startMinutes: (clippedStart - window.startMs) / MS_PER_MINUTE,
    endMinutes: (clippedEnd - window.startMs) / MS_PER_MINUTE,
    continuesBefore: startMs < window.startMs,
    continuesAfter: endMs > window.endMs,
  }
}

export type EventGeometry = { top: number; height: number }

/**
 * A block's pixel top and height inside its day column.
 *
 * `top` is the minute offset scaled by the zoom, `height` the duration scaled
 * the same way — one multiplication each, so a block's position IS its time and
 * a future drag handler can invert it with a division.
 *
 * Two clamps, both load-bearing:
 *   - height never falls below MIN_EVENT_HEIGHT_PX, or short meetings become
 *     unreadable and unclickable at low zoom;
 *   - top is pulled up so `top + height` never exceeds the column, or a 23:50
 *     meeting stretched to that minimum paints outside the grid it belongs to.
 */
export function eventGeometry(
  startMinutes: number,
  endMinutes: number,
  pxPerHour: number,
  dayMinutes: number = MINUTES_PER_DAY,
): EventGeometry {
  const pxPerMinute = pxPerHour / 60
  const spanMinutes = Math.max(endMinutes - startMinutes, 0)
  const dayHeight = dayMinutes * pxPerMinute
  const height = Math.max(spanMinutes * pxPerMinute, MIN_EVENT_HEIGHT_PX)
  const rawTop = startMinutes * pxPerMinute
  const top = Math.min(Math.max(rawTop, 0), Math.max(dayHeight - height, 0))
  return { top, height }
}

/**
 * Minutes from the start of `window` to `instantMs`, or null when the instant
 * is not inside that day. This is what positions the "now" line — it returns
 * null on every day except today, so the caller renders nothing rather than
 * pinning the line to the top or bottom edge of the wrong column.
 */
export function minutesIntoDay(instantMs: number, window: DayWindow): number | null {
  if (instantMs < window.startMs || instantMs >= window.endMs) return null
  return (instantMs - window.startMs) / MS_PER_MINUTE
}

/** `HH:mm` label for an hour row, in 24-hour form so the gutter stays two
 *  characters wide and the numbers line up under `tabular-nums`. */
export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

/** True for the hours drawn at full strength (08:00–17:59 by default). */
export function isWorkingHour(hour: number): boolean {
  return hour >= WORK_START_HOUR && hour < WORK_END_HOUR
}
