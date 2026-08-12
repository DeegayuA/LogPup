import { LK_TIMEZONE } from '@/lib/lk-holidays'
import { isoDayOf } from '@/features/people/iso-day'

/**
 * Wall-clock formatting of an INSTANT in the business timezone, for server
 * components.
 *
 * WHY THIS EXISTS AT ALL. Everywhere else in the product a meeting time is
 * printed by `date-fns` `format()` inside a `'use client'` component
 * (meeting-list, the month calendar, the detail dialog), so it lands in the
 * *viewer's* timezone. The person page renders its meeting rows on the server,
 * and `format()` there resolves against the SERVER's zone — UTC on Vercel. A
 * 9:00 AM Colombo standup would print as "03:30" on /people/[id] while
 * /meetings printed "9:00 AM" for the same row. That is not a rounding
 * difference; it is the wrong answer on every deployed environment, and it is
 * invisible in local development because the developer's machine already runs
 * Asia/Colombo.
 *
 * THE CHOICE MADE HERE is to pin the person page to the business timezone
 * rather than to ship a client component purely to read `Date`. Asia/Colombo is
 * already the product's one definition of "what day is it" — sprint dates,
 * holidays, as-of-date, the activity graph and iso-day.ts all resolve there —
 * so a server-rendered time in Colombo agrees with every other date on the same
 * page. The tradeoff is real and worth stating: a teammate reading this page
 * from London sees Colombo time here and their own local time on /meetings.
 * That is a smaller and far more explicable error than being five and a half
 * hours wrong for everyone, and it costs no client JS on a page whose whole
 * point is that it is server-rendered.
 *
 * Formatting goes through `Intl.DateTimeFormat` with an explicit `timeZone`
 * rather than through date-fns, because date-fns has no timezone support
 * without `date-fns-tz`, which this project does not depend on. `en-US` is
 * pinned deliberately: the output must not change shape with the server's
 * locale (and `en-GB` would silently switch the clock to 24-hour, which is not
 * what the rest of the product prints).
 */

type Parts = Record<Intl.DateTimeFormatPartTypes, string>

function partsOf(date: Date, options: Intl.DateTimeFormatOptions): Parts {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('Cannot format an invalid Date')
  }
  const out = {} as Parts
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: LK_TIMEZONE, ...options })
  for (const part of formatter.formatToParts(date)) out[part.type] = part.value
  return out
}

/** `9:05 AM` — 12-hour, matching every other time in the product. */
export function formatBusinessTime(date: Date): string {
  const { hour, minute, dayPeriod } = partsOf(date, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return `${hour}:${minute} ${dayPeriod}`
}

/** `Aug 12`. */
export function formatBusinessDayMonth(date: Date): string {
  const { month, day } = partsOf(date, { month: 'short', day: 'numeric' })
  return `${month} ${day}`
}

/** `Tue, Aug 12`. */
export function formatBusinessWeekdayDayMonth(date: Date): string {
  const { weekday, month, day } = partsOf(date, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  return `${weekday}, ${month} ${day}`
}

/** `Wednesday, August 12` — the dashboard's header date, spelled out. */
export function formatBusinessWeekdayLong(date: Date): string {
  const { weekday, month, day } = partsOf(date, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  return `${weekday}, ${month} ${day}`
}

/**
 * The hour (0–23) of an instant in the business timezone — for deciding
 * morning/afternoon/evening on the server, where `date.getHours()` answers
 * for the SERVER's zone and would greet a Colombo user five and a half hours
 * out of step with their own day.
 */
export function businessHourOf(date: Date): number {
  // hourCycle 'h23' so midnight reads 0, not the '24' that a plain
  // hour12:false yields in some ICU versions.
  const { hour } = partsOf(date, { hour: 'numeric', hourCycle: 'h23' })
  return Number(hour)
}

/** `Aug 2026` — the "joined" line in the header. */
export function formatBusinessMonthYear(date: Date): string {
  const { month, year } = partsOf(date, { month: 'short', year: 'numeric' })
  return `${month} ${year}`
}

/**
 * `Tue, Aug 12 · 9:00 AM – 10:00 AM`, and when a meeting runs past midnight
 * the end carries its own day (`… – Wed, Aug 13 12:30 AM`) rather than reading
 * as if it finished eight and a half hours before it started. The day boundary
 * is resolved in the business timezone by the same `isoDayOf` the rest of the
 * page ages things with, so the printed date and the printed "3d late" can
 * never come from two different calendars.
 */
export function formatBusinessMeetingRange(startsAt: Date, endsAt: Date): string {
  const start = `${formatBusinessWeekdayDayMonth(startsAt)} · ${formatBusinessTime(startsAt)}`
  const sameDay = isoDayOf(startsAt) === isoDayOf(endsAt)
  const end = sameDay
    ? formatBusinessTime(endsAt)
    : `${formatBusinessWeekdayDayMonth(endsAt)} ${formatBusinessTime(endsAt)}`
  return `${start} – ${end}`
}
