/**
 * "We'll pick this up on Thursday at 3."
 *
 * The room's agreed next meeting (`meetings.next_meeting_at`), and the one
 * thing every action item out of a meeting hangs its deadline off. Before this
 * existed, a meeting that produced ten commitments produced ten rows reading
 * "No due date", because `normalizeDueDate` (notes.ts) accepts only a strict
 * `YYYY-MM-DD` and the model almost never emits one — "next week", "before the
 * next meeting" and "same day or Monday" all land as null.
 *
 * WHAT THIS MODULE IS NOT. It is not "the next meeting this person attends"
 * (`moveFollowupsToNextMeeting` in followup-move-actions.ts already answers
 * that, per person, from real `meeting_attendees` rows, and `AddFollowupForm`'s
 * NEXT_MEETING sentinel is that same per-person question). This is the
 * room-level agreement, recorded at the moment it was said, usually before
 * anything is in a calendar. The two are allowed to disagree and neither
 * derives from the other — see schema.ts on the column and drizzle/0066.
 *
 * Pure and clock-free on purpose. The default deadline it produces is fed to
 * `suggestionToTaskPayload`, whose output is reconstructed later by
 * `undoAutoAcceptedSuggestion` to decide whether a human has edited an
 * auto-assigned task. A `today + N days` default would recompute differently
 * tomorrow and make every auto-assigned task permanently un-undoable; a value
 * derived only from the meeting row does not.
 */
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'

/**
 * The default `tasks.due_date` for work agreed in a meeting whose room named a
 * next one: the calendar day of that meeting, in Asia/Colombo.
 *
 * A DAY, not the instant, because `tasks.due_date` is a Postgres `date` and
 * every reader compares it as a `YYYY-MM-DD` string (see sprints/due-date.ts,
 * which documents why these stay strings). Taking the Colombo wall-clock day
 * rather than `toISOString().slice(0, 10)` matters at the boundary: a meeting
 * at 08:00 Colombo is still *yesterday* in UTC, so the naive slice would file
 * the work a day early, every time, for an office 5:30 ahead.
 *
 * Null in, null out — a meeting whose room never agreed a next one leaves its
 * tasks dateless, which is the honest answer and the behaviour before this
 * feature. A next meeting already in the past is still returned: this function
 * cannot see a clock, and the surfaces that can (`describeNextMeeting().past`)
 * are the ones allowed to say so.
 */
export function nextMeetingDueDate(
  nextMeetingAt: Date | null | undefined,
  timeZone: string = LK_TIMEZONE,
): string | null {
  if (!nextMeetingAt) return null
  if (Number.isNaN(nextMeetingAt.getTime())) return null
  return toIsoDateInTimeZone(nextMeetingAt, timeZone)
}

/**
 * How a next meeting is spoken about on screen.
 *
 * `relative` is deliberately coarse — "in 6 days", never "in 5 days 21 hours".
 * The date was agreed out loud in a room; presenting it to the minute would
 * claim a precision the agreement does not have. `past` exists so a surface can
 * say the date has gone by instead of showing a stale deadline as if it were
 * still ahead.
 */
export type NextMeetingDescription = {
  /** Calendar day in the business timezone, `YYYY-MM-DD`. */
  iso: string
  /** e.g. "Mon 1 Sep" — gains a year only when it differs from `now`'s. */
  day: string
  /** e.g. "3:00 pm". */
  time: string
  /** e.g. "in 6 days" / "tomorrow" / "today" / "8 days ago". */
  relative: string
  /** True once the agreed moment is behind `now`. */
  past: boolean
}

export function describeNextMeeting(
  nextMeetingAt: Date,
  now: Date,
  timeZone: string = LK_TIMEZONE,
): NextMeetingDescription {
  const iso = toIsoDateInTimeZone(nextMeetingAt, timeZone)
  const todayIso = toIsoDateInTimeZone(now, timeZone)

  // Assembled from parts rather than taken as a formatted string. Two ICU
  // behaviours would otherwise leak into the UI: en-GB inserts a comma after
  // the weekday ONLY when a year is present, so the same row would gain
  // punctuation in January; and its short September is "Sept", four characters
  // where every date-fns 'MMM' elsewhere in the app renders three. Neither is a
  // bug in ICU — they are just not what sits beside them on this screen.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(nextMeetingAt)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''

  // The year is noise 51 weeks of the year and load-bearing in the 52nd.
  const year = iso.slice(0, 4) === todayIso.slice(0, 4) ? '' : ` ${iso.slice(0, 4)}`
  const day = `${part('weekday')} ${part('day')} ${part('month').slice(0, 3)}${year}`
  const time = `${part('hour')}:${part('minute')} ${part('dayPeriod').toLowerCase()}`

  return {
    iso,
    day,
    time,
    relative: relativeDays(iso, todayIso),
    past: nextMeetingAt.getTime() < now.getTime(),
  }
}

/**
 * Whole calendar days between two `YYYY-MM-DD` days, worded.
 *
 * Counted in DAYS, not elapsed milliseconds: a meeting at 09:00 tomorrow is
 * "tomorrow" even when it is 19 hours away, and one at 23:00 tonight is "today"
 * even though it is further off than the first was this morning. Elapsed time
 * is not what a reader is asking when they look at a date.
 *
 * Both sides are parsed as UTC midnight, which is safe precisely BECAUSE both
 * sides were already converted to business-timezone day strings by the caller —
 * the offset cancels, and no `Date` here is ever shown to anyone.
 */
function relativeDays(iso: string, todayIso: string): string {
  const diff = Math.round(
    (Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) / 86_400_000,
  )
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  if (diff > 1) return `in ${diff} days`
  return `${Math.abs(diff)} days ago`
}

/**
 * `YYYY-MM-DDTHH:mm` as a wall clock in Asia/Colombo, to the instant it names.
 *
 * `new Date('2026-09-01T15:00')` would read that as the SERVER's local time —
 * UTC on Vercel — and file a 3pm Colombo meeting at 8:30pm Colombo. The offset
 * is recovered by asking Intl what UTC instant that formats to in Colombo and
 * correcting by the difference, which stays right across a timezone-rule change
 * because it never hardcodes +05:30.
 *
 * Returns null for anything that is not that exact shape or is not a real
 * moment — the model returning prose here means it found nothing, and inventing
 * a date from a malformed one is the failure this whole surface avoids.
 */
export function parseColomboWallClock(
  value: string,
  timeZone: string = LK_TIMEZONE,
): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const [, y, mo, d, h, mi] = match
  const asUtc = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:00Z`)
  if (Number.isNaN(asUtc)) return null

  // What that UTC instant looks like on a Colombo clock; the gap is the offset.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(asUtc))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '00'
  const shown = Date.parse(
    `${part('year')}-${part('month')}-${part('day')}T${part('hour') === '24' ? '00' : part('hour')}:${part('minute')}:00Z`,
  )
  if (Number.isNaN(shown)) return null
  const result = new Date(asUtc - (shown - asUtc))
  return Number.isNaN(result.getTime()) ? null : result
}

/**
 * The words the write-up uses for a deadline nobody typed.
 *
 * Kept beside the value it describes so the chip on an action item and the
 * sentence in the next-meeting header cannot drift into claiming different
 * things about the same date. Phrased as a rule ("By next meeting"), never as a
 * bare date: a bare date reads as a commitment somebody made, and this one is a
 * default the page applied.
 */
export const NEXT_MEETING_DUE_LABEL = 'By next meeting'
