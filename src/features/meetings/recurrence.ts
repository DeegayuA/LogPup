/**
 * Meeting recurrence: a rule, the local dates it fires on, and the instants
 * those dates mean.
 *
 * Pure. No I/O, no `Date.now()`, nothing that reads the machine's own
 * timezone — every answer is a function of the rule and the window it is
 * asked about, so the same series expands identically on a laptop in Colombo
 * and a build agent in Virginia.
 *
 * WHAT THIS DELIBERATELY IS NOT. There is no RRULE *parser* here. We generate
 * the handful of patterns a studio actually schedules and we emit RFC 5545
 * outward (`rruleFor`, for .ics and eventually Google), but we never accept an
 * arbitrary one. Parsing RRULE means BYSETPOS, WKST, EXDATE and the rest of a
 * specification that took a committee years, and every one of those branches
 * would be a branch nothing in LogPup can produce or test. Generating a closed
 * set is a tested module; parsing an open one is vendoring a calendar library
 * and pretending it is ours.
 *
 * DATES AND INSTANTS ARE DIFFERENT THINGS HERE, on purpose. `expand` deals
 * only in `yyyy-mm-dd` local dates and does plain calendar arithmetic on them
 * — no timezone enters, because "the second Tuesday" is a claim about a
 * calendar, not about an offset. `occurrenceInstant` is the ONLY place a zone
 * is applied, and it is the only place that can be wrong about DST.
 */

import { zoneOffsetMs } from './calendar-grid'

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly'
export type MonthlyMode = 'day-of-month' | 'nth-weekday'

export interface RecurrenceRule {
  freq: RecurrenceFreq
  /** Every N days/weeks/months. Values below 1 are read as 1 — see `stride`. */
  interval: number
  /** Weekly only. 0 = Sunday. Empty falls back to the anchor's own weekday. */
  byWeekday: number[]
  /** Monthly only; ignored otherwise. */
  monthlyMode: MonthlyMode | null
  /** IANA zone the wall clock below is expressed in. */
  timeZone: string
  /** Minutes past local midnight. */
  startMinutes: number
  durationMinutes: number
  /** First candidate day, local `yyyy-mm-dd`. Also fixes the phase of every
   *  interval and, for monthly rules, WHICH day of the month is meant. */
  anchorDate: string
  /** Inclusive last day, local. `null` means open-ended. */
  untilDate: string | null
}

/**
 * Hard ceiling on one `expand` call.
 *
 * An open-ended daily series asked about a hundred-year window is not a
 * request anyone typed; it is a bug upstream, and the honest failure is a
 * truncated list rather than a hung request holding a database connection.
 * The horizon that materialises occurrences asks for 90 days at a time, so
 * real callers are three orders of magnitude below this.
 */
export const MAX_EXPANDED_OCCURRENCES = 1000

const MS_PER_DAY = 86_400_000
/** RFC 5545 weekday codes, indexed by JS `getUTCDay()`. */
const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

/** An interval of 0 or a negative one would step nowhere and loop forever. */
function stride(interval: number): number {
  return Number.isFinite(interval) && interval >= 1 ? Math.floor(interval) : 1
}

function partsOf(iso: string): [number, number, number] {
  const [year, month, day] = iso.split('-').map(Number)
  return [year, month, day]
}

function isoOf(year: number, month: number, day: number): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${year}-${pad(month)}-${pad(day)}`
}

/** Days since the epoch. Pure calendar arithmetic — `Date.UTC` is used as a
 *  day counter here, never as an instant anyone will see. */
function dayNumber(iso: string): number {
  const [year, month, day] = partsOf(iso)
  return Date.UTC(year, month - 1, day) / MS_PER_DAY
}

function isoFromDayNumber(n: number): string {
  const d = new Date(n * MS_PER_DAY)
  return isoOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

function weekdayOf(iso: string): number {
  const [year, month, day] = partsOf(iso)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** Sunday-start week index. Epoch day 0 was a Thursday, so +4 moves the
 *  boundary onto a Sunday before the floor. */
function weekIndex(iso: string): number {
  return Math.floor((dayNumber(iso) + 4) / 7)
}

function monthIndex(iso: string): number {
  const [year, month] = partsOf(iso)
  return year * 12 + (month - 1)
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Which ordinal the anchor's weekday is within its month: 1st, 2nd… 5th. */
function nthOfMonth(iso: string): number {
  const [, , day] = partsOf(iso)
  return Math.ceil(day / 7)
}

/**
 * The date of the `nth` `weekday` in a month, or `null` when the month has no
 * such day. `nth` of 5 means THE LAST one — see the `expand` note below.
 */
function nthWeekdayOf(year: number, month: number, weekday: number, nth: number): string | null {
  const total = daysInMonth(year, month)
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const firstMatch = 1 + ((weekday - firstWeekday + 7) % 7)
  if (nth >= 5) {
    const last = firstMatch + Math.floor((total - firstMatch) / 7) * 7
    return isoOf(year, month, last)
  }
  const day = firstMatch + (nth - 1) * 7
  return day <= total ? isoOf(year, month, day) : null
}

/**
 * The local dates this rule fires on, within `[fromIso, toIso]` inclusive.
 *
 * INTERVALS ARE PHASED FROM THE ANCHOR, never from the window. Asking a
 * fortnightly series about a window that happens to open on an off week must
 * not shift the series onto it — otherwise the same series expands to
 * different dates depending on what the caller asked for, and the horizon
 * top-up would fight the calendar view forever.
 *
 * MONTHS WITH NO SUCH DAY ARE SKIPPED, not clamped. A series on the 31st has
 * no February. Clamping it to the 28th would invent a meeting on a date the
 * rule never described, and the person who scheduled "month end" would find a
 * standup they did not put there.
 *
 * A FIFTH-WEEKDAY ANCHOR MEANS THE LAST of the month. Read literally, "the
 * fifth Monday" fires about four times a year, which is never what someone
 * picking the last Monday of the month meant.
 */
export function expand(rule: RecurrenceRule, fromIso: string, toIso: string): string[] {
  const step = stride(rule.interval)
  const startIso = fromIso > rule.anchorDate ? fromIso : rule.anchorDate
  const endIso = rule.untilDate && rule.untilDate < toIso ? rule.untilDate : toIso
  if (startIso > endIso) return []

  const out: string[] = []
  const push = (iso: string) => {
    if (iso >= startIso && iso <= endIso) out.push(iso)
    return out.length < MAX_EXPANDED_OCCURRENCES
  }

  if (rule.freq === 'monthly') {
    const mode: MonthlyMode = rule.monthlyMode ?? 'day-of-month'
    const anchorMonth = monthIndex(rule.anchorDate)
    const [, , anchorDay] = partsOf(rule.anchorDate)
    const anchorWeekday = weekdayOf(rule.anchorDate)
    const anchorNth = nthOfMonth(rule.anchorDate)
    // Start from the anchor's own month so the phase is right, then walk by
    // whole steps — the first candidate month at or after the window.
    const firstMonth = monthIndex(startIso)
    const behind = Math.max(0, firstMonth - anchorMonth)
    let month = anchorMonth + Math.ceil(behind / step) * step
    const lastMonth = monthIndex(endIso)
    while (month <= lastMonth) {
      const year = Math.floor(month / 12)
      const monthOfYear = (month % 12) + 1
      const iso =
        mode === 'day-of-month'
          ? anchorDay <= daysInMonth(year, monthOfYear)
            ? isoOf(year, monthOfYear, anchorDay)
            : null
          : nthWeekdayOf(year, monthOfYear, anchorWeekday, anchorNth)
      if (iso && !push(iso)) break
      month += step
    }
    return out
  }

  const weekdays =
    rule.freq === 'weekly'
      ? rule.byWeekday.length > 0
        ? new Set(rule.byWeekday)
        : new Set([weekdayOf(rule.anchorDate)])
      : null
  const anchorDay = dayNumber(rule.anchorDate)
  const anchorWeek = weekIndex(rule.anchorDate)
  const lastDay = dayNumber(endIso)

  for (let day = dayNumber(startIso); day <= lastDay; day += 1) {
    const iso = isoFromDayNumber(day)
    const fires =
      rule.freq === 'daily'
        ? (day - anchorDay) % step === 0
        : weekdays!.has(weekdayOf(iso)) && (weekIndex(iso) - anchorWeek) % step === 0
    if (fires && !push(iso)) break
  }
  return out
}

/**
 * The instant a given occurrence date starts and ends.
 *
 * Built from the LOCAL WALL CLOCK, which is the whole reason the rule stores
 * `startMinutes` + `timeZone` rather than a stored instant: a 09:00 standup
 * is 09:00 on both sides of a DST boundary, which means its UTC instant has
 * to move. Storing the instant instead would keep UTC fixed and drift the
 * meeting an hour into someone's morning.
 *
 * The two-pass offset resolution is `zonedDayStartMs`'s, generalised from
 * midnight to any wall clock: guess at UTC, measure the zone's offset at that
 * guess, correct, then re-measure in case the correction crossed a
 * transition. Adding `startMinutes` to that day's midnight would be simpler
 * and wrong — on a spring-forward day, midnight and 09:00 sit on opposite
 * sides of the jump, so the sum lands an hour late.
 */
export function occurrenceInstant(
  rule: RecurrenceRule,
  dateIso: string,
): { startsAt: Date; endsAt: Date } {
  const [year, month, day] = partsOf(dateIso)
  const guess = Date.UTC(year, month - 1, day) + rule.startMinutes * 60_000
  const firstPass = guess - zoneOffsetMs(guess, rule.timeZone)
  const startMs = guess - zoneOffsetMs(firstPass, rule.timeZone)
  return {
    startsAt: new Date(startMs),
    endsAt: new Date(startMs + rule.durationMinutes * 60_000),
  }
}

/**
 * The rule as an RFC 5545 RRULE value, for the .ics export.
 *
 * UNTIL is written as a UTC instant at the end of the day, never as a bare
 * date: a floating date is read in the recipient's own zone, which can drop
 * or add a final occurrence for anyone east or west of the team.
 */
export function rruleFor(rule: RecurrenceRule): string {
  const step = stride(rule.interval)
  const parts: string[] = [`FREQ=${rule.freq.toUpperCase()}`]
  if (step !== 1) parts.push(`INTERVAL=${step}`)

  if (rule.freq === 'weekly') {
    const days = rule.byWeekday.length > 0 ? rule.byWeekday : [weekdayOf(rule.anchorDate)]
    const codes = [...new Set(days)].sort((a, b) => a - b).map((d) => RRULE_DAYS[d])
    parts.push(`BYDAY=${codes.join(',')}`)
  } else if (rule.freq === 'monthly') {
    if ((rule.monthlyMode ?? 'day-of-month') === 'day-of-month') {
      parts.push(`BYMONTHDAY=${partsOf(rule.anchorDate)[2]}`)
    } else {
      const nth = nthOfMonth(rule.anchorDate)
      // -1 is RFC 5545 for "the last one in the month", which is what a fifth
      // ordinal means here — same reading as `expand`, or the .ics and the app
      // would disagree about the same series.
      const ordinal = nth >= 5 ? -1 : nth
      parts.push(`BYDAY=${ordinal}${RRULE_DAYS[weekdayOf(rule.anchorDate)]}`)
    }
  }

  if (rule.untilDate) parts.push(`UNTIL=${rule.untilDate.replace(/-/g, '')}T235959Z`)
  return parts.join(';')
}
