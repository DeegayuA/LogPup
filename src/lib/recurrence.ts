import { isWorkingDay } from '@/lib/working-days'

/**
 * When does a repeating meeting actually happen?
 *
 * Pure expansion of a rule into concrete days. No database, no clock: the
 * caller passes the anchor and the horizon, so this is fully testable and a
 * render can never depend on when it ran.
 *
 * WHY THIS RETURNS DAYS RATHER THAN OWNING A SERIES: the occurrences get
 * MATERIALISED as real meeting rows by the caller. That is not an
 * implementation detail — in this product a meeting id is load-bearing far
 * beyond the meeting: meeting_apps, meeting_attendees, the AI notes row,
 * screen keyframes, follow-ups and change-request routing all hang off it. A
 * single rrule string on `meetings` cannot hold "we moved the 3rd by an hour"
 * or "we skipped Poya week", and re-deriving occurrences on read would change
 * ids underneath everything listed above. So: a rule row records the intent,
 * this function says which days it means, and the caller writes rows that can
 * each be edited on their own.
 *
 * Days are `YYYY-MM-DD` strings throughout and are never parsed into a `Date`
 * for comparison — `new Date('2026-08-12')` is midnight UTC, which is still
 * the 11th west of Greenwich.
 */

export type Frequency = 'daily' | 'weekly'

/** 0 = Sunday … 6 = Saturday, matching getUTCDay. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type RecurrenceRule = {
  frequency: Frequency
  /** Every N days or weeks. 1 = every one; 2 = fortnightly. */
  interval: number
  /**
   * WEEKLY ONLY: which days of the week it lands on. Empty means "the same
   * weekday as the anchor", which is what somebody who picked a date and said
   * "weekly" meant.
   */
  weekdays?: readonly Weekday[]
  /**
   * How it ends. Three shapes, because people mean three different things:
   *  - `{ kind: 'until', date }`  — "until the 30th", inclusive.
   *  - `{ kind: 'count', count }` — "the next six".
   *  - `{ kind: 'open' }`         — "until we stop", which has no end date and
   *    is bounded only by the caller's horizon.
   */
  ends: { kind: 'until'; date: string } | { kind: 'count'; count: number } | { kind: 'open' }
  /**
   * Skip days the studio is closed. OFF by default, deliberately: Saturday is
   * a working half day here, so a meeting booked on one is legitimate, and a
   * default that silently dropped occurrences would be worse than one that
   * keeps a day somebody has to move by hand.
   */
  skipNonWorkingDays?: boolean
}

export type ExpandOptions = {
  /** First occurrence, `YYYY-MM-DD`. Included whenever the rule allows it. */
  anchor: string
  /** Do not generate past this day, inclusive. This is what bounds an `open`
   *  rule, which by definition has no end of its own. */
  horizon: string
  /** Composed by the caller from the gazette and the workspace's own closures,
   *  exactly as coverage does. Only consulted when skipNonWorkingDays is set. */
  isHoliday?: (iso: string) => boolean
  /**
   * Hard ceiling on how many days come back, whatever the rule says.
   *
   * An open daily rule over a long horizon is thousands of days, and the
   * caller is about to write each one as a real meeting row. A cap makes the
   * failure "the series stops early" — visible, and fixable by extending it —
   * rather than "the request never came back".
   */
  max?: number
}

export const DEFAULT_MAX_OCCURRENCES = 200

/** Midday UTC, the anchor working-days.ts uses: far enough from either
 *  boundary that the +05:30 Colombo offset cannot tip the day. */
function at(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12))
}

function addDays(iso: string, days: number): string {
  const date = at(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function weekdayOf(iso: string): Weekday {
  return at(iso).getUTCDay() as Weekday
}

/** The Sunday on or before `iso` — the start of its week. */
function weekStart(iso: string): string {
  return addDays(iso, -weekdayOf(iso))
}

export class RecurrenceError extends Error {}

/**
 * Every day this rule produces, in order, from the anchor to the horizon.
 * Inclusive of the anchor and of an `until` date; never before the anchor or
 * after the horizon, whatever the rule asks for.
 */
export function expandRecurrence(rule: RecurrenceRule, options: ExpandOptions): string[] {
  const { anchor, horizon, isHoliday } = options
  const max = options.max ?? DEFAULT_MAX_OCCURRENCES

  if (rule.interval < 1) throw new RecurrenceError('Repeat interval must be at least 1')
  if (rule.ends.kind === 'count' && rule.ends.count < 1) {
    throw new RecurrenceError('A series must have at least one occurrence')
  }
  if (horizon < anchor) return []

  // An `until` before the anchor is a series that never happens. Empty rather
  // than a throw: dragging an end date back past the start should show an
  // empty preview, not an error dialog.
  const until = rule.ends.kind === 'until' ? rule.ends.date : null
  if (until !== null && until < anchor) return []

  const limit = rule.ends.kind === 'count' ? Math.min(rule.ends.count, max) : max
  const stopAt = until !== null && until < horizon ? until : horizon

  const out: string[] = []
  const keep = (iso: string) => {
    if (rule.skipNonWorkingDays && !isWorkingDay(iso, isHoliday)) return
    out.push(iso)
  }

  if (rule.frequency === 'daily') {
    for (let day = anchor; day <= stopAt && out.length < limit; day = addDays(day, rule.interval)) {
      keep(day)
    }
    return out
  }

  // WEEKLY. Days are emitted within each active week in weekday order, so a
  // Mon/Wed/Fri rule comes back in the order somebody would read it.
  const days: Weekday[] =
    rule.weekdays && rule.weekdays.length > 0
      ? [...new Set(rule.weekdays)].sort((a, b) => a - b)
      : [weekdayOf(anchor)]

  for (
    let week = weekStart(anchor);
    week <= stopAt && out.length < limit;
    week = addDays(week, 7 * rule.interval)
  ) {
    for (const weekday of days) {
      if (out.length >= limit) break
      const day = addDays(week, weekday)
      // The anchor's own week contains days BEFORE the anchor: a Wednesday
      // start on a Mon/Wed rule must not emit that Monday.
      if (day < anchor || day > stopAt) continue
      keep(day)
    }
  }
  return out
}

const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const

/**
 * One sentence describing the rule, for the confirmation line.
 *
 * A series somebody is about to create on twenty calendars deserves a sentence
 * they can check before it is sent.
 */
export function describeRecurrence(rule: RecurrenceRule, anchor: string): string {
  const unit = rule.frequency === 'daily' ? 'day' : 'week'
  const every =
    rule.interval === 1 ? `Every ${unit}` : `Every ${rule.interval} ${unit}s`

  let days = ''
  if (rule.frequency === 'weekly') {
    const list =
      rule.weekdays && rule.weekdays.length > 0
        ? [...new Set(rule.weekdays)].sort((a, b) => a - b)
        : [weekdayOf(anchor)]
    const names = list.map((d) => WEEKDAY_NAMES[d])
    days =
      names.length === 1
        ? ` on ${names[0]}`
        : ` on ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  }

  const ending =
    rule.ends.kind === 'until'
      ? `, until ${rule.ends.date}`
      : rule.ends.kind === 'count'
        ? `, ${rule.ends.count} ${rule.ends.count === 1 ? 'time' : 'times'}`
        : ', until you stop it'

  const skipping = rule.skipNonWorkingDays ? ', skipping days the studio is closed' : ''

  return `${every}${days}${ending}${skipping}.`
}
