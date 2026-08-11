/**
 * Natural-language meeting capture for the "New meeting" dialog.
 *
 * Turns one typed phrase — "standup tomorrow 10am with shanika and deeghayu",
 * "design review friday 2-3pm on LogPup with shanika", "1:1 with deeghayu next
 * monday 9.30am for 45m" — into the five fields that dialog otherwise asks for
 * one at a time.
 *
 * Same shape as `task-intent.ts` and for the same reason: it runs on every
 * keystroke behind a live preview, so it is a pure function over a
 * caller-supplied people list, never touches the network, and takes its
 * reference time as an argument (tests depend on that). It fills nothing in by
 * guesswork — a name that matches two people comes back as ambiguous rather
 * than as an attendee, and the app is only ever reported as a query string for
 * the caller to resolve against its own list.
 */

import type { IntentPerson } from './task-intent'

export type MeetingIntent = {
  title: string
  startsAt: Date | null
  endsAt: Date | null
  /** Names exactly as they were written after "with", in order. */
  attendeeNames: string[]
  /** Names that matched exactly one person, de-duplicated. */
  attendees: IntentPerson[]
  /** Names that matched more than one person — deliberately not guessed at. */
  ambiguous: string[]
  /** Names that matched nobody. */
  unresolved: string[]
  /** Trailing "on <app>" hint. */
  appQuery: string | null
  /** Always null here: only the caller knows the app list. */
  appName: string | null
}

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

const MINUTES_PER_DAY = 24 * 60
const DEFAULT_DURATION_MINUTES = 60
/** Used only when a day is named without any time — surfaced in the preview. */
const DEFAULT_HOUR = 9

// "schedule a standup", "book the retro" — scheduling verbs carry no meaning
// once the dialog itself is the thing doing the scheduling.
const LEADING_FILLER =
  /^(?:(?:schedule|book|set\s+up|setup|create|arrange|add)\s+)+(?:an?\s+|the\s+)?/i

/** hour, separator, minutes, meridiem — reused for both ends of a range. */
const CLOCK = String.raw`(\d{1,2})(?:([:.])([0-5]\d))?\s*(am|pm)?\b`

const RANGE_RE = new RegExp(
  String.raw`(?:\b(?:from|at)\s+|@\s*)?\b` +
    CLOCK +
    String.raw`\s*(?:-|–|—|\bto\b|\buntil\b|\btill\b)\s*` +
    CLOCK,
  'gi',
)

const SINGLE_TIME_RE = new RegExp(String.raw`(?:\b(?:at|from)\s+|@\s*)?\b` + CLOCK, 'gi')

const DURATION_RE = /\bfor\s+(\d+(?:\.\d+)?)\s*(minutes?|mins?|m|hours?|hrs?|h)\b/i

// Runs to the end of the phrase, but stops short of a trailing "on <app>" via
// lookahead so "with shanika on logpup" keeps the app out of the name list.
const WITH_RE = /\bwith\s+(.+?)(?=\s+on\s+|$)/i

const NAME_SEPARATOR_RE = /\s*(?:,|&|\+|\band\b)\s*/i

type Clock = {
  hour: number
  minute: number
  meridiem: 'am' | 'pm' | null
  /** True when it was *written* like a time: "10am", "9.30am", "14:00". */
  explicit: boolean
}

function startOfDay(date: Date): Date {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  return day
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Minutes-from-midnight applied to a day, letting Date carry any rollover. */
function atMinutes(day: Date, minutes: number): Date {
  const result = startOfDay(day)
  result.setMinutes(minutes)
  return result
}

/** Removes a matched span and re-collapses the whitespace it left behind. */
function cut(text: string, match: RegExpExecArray): string {
  const index = match.index ?? 0
  return (text.slice(0, index) + ' ' + text.slice(index + match[0].length))
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * First match a validator accepts, not simply the first match. A bare number is
 * only sometimes a time, so the scan has to be able to walk past "1:1" and
 * "sprint 2" to reach the "9.30am" further along.
 */
function firstMatch(
  re: RegExp,
  text: string,
  accept: (match: RegExpExecArray) => boolean,
): RegExpExecArray | null {
  re.lastIndex = 0
  let match = re.exec(text)
  while (match) {
    if (accept(match)) return match
    if (match.index === re.lastIndex) re.lastIndex += 1
    match = re.exec(text)
  }
  return null
}

function readClock(
  hourRaw: string,
  separator: string | undefined,
  minuteRaw: string | undefined,
  meridiemRaw: string | undefined,
): Clock | null {
  const hour = Number(hourRaw)
  const minute = minuteRaw ? Number(minuteRaw) : 0
  const meridiem = meridiemRaw ? (meridiemRaw.toLowerCase() as 'am' | 'pm') : null
  if (meridiem ? hour < 1 || hour > 12 : hour > 23) return null
  return {
    hour,
    minute,
    meridiem,
    // "9.30" on its own is as likely to be a version number as a time; only a
    // meridiem or a 24-hour colon makes it unambiguous.
    explicit: meridiem !== null || (separator === ':' && minuteRaw !== undefined),
  }
}

/** @param assume meridiem borrowed from the other end of a range, if any. */
function toMinutes(clock: Clock, assume: 'am' | 'pm' | null): number {
  const meridiem = clock.meridiem ?? (clock.hour <= 12 ? assume : null)
  let hour = clock.hour
  if (meridiem === 'am' && hour === 12) hour = 0
  if (meridiem === 'pm' && hour < 12) hour += 12
  return hour * 60 + clock.minute
}

/**
 * "2-3pm": one meridiem at the end governs both halves — unless that reading
 * puts the start after the end, which is what makes "11-1pm" 11am to 1pm.
 */
function resolveRange(start: Clock, end: Clock): { start: number; end: number } {
  let from = toMinutes(start, end.meridiem)
  let to = toMinutes(end, start.meridiem)
  if (from >= to && !start.meridiem && end.meridiem) {
    from = toMinutes(start, end.meridiem === 'pm' ? 'am' : 'pm')
  }
  if (from >= to && !end.meridiem && start.meridiem) {
    to = toMinutes(end, start.meridiem === 'pm' ? 'am' : 'pm')
  }
  return { start: from, end: to }
}

function extractDuration(text: string): { rest: string; minutes: number | null } {
  const match = DURATION_RE.exec(text)
  if (!match) return { rest: text, minutes: null }
  const unit = match[2].toLowerCase()
  const minutes = Math.round(Number(match[1]) * (unit.startsWith('h') ? 60 : 1))
  if (!minutes) return { rest: text, minutes: null }
  return { rest: cut(text, match), minutes }
}

function extractTime(text: string): { rest: string; start: Clock | null; end: Clock | null } {
  const range = firstMatch(RANGE_RE, text, (m) => {
    const from = readClock(m[1], m[2], m[3], m[4])
    const to = readClock(m[5], m[6], m[7], m[8])
    return Boolean(from && to && (from.explicit || to.explicit))
  })
  if (range) {
    return {
      rest: cut(text, range),
      start: readClock(range[1], range[2], range[3], range[4]),
      end: readClock(range[5], range[6], range[7], range[8]),
    }
  }

  const single = firstMatch(SINGLE_TIME_RE, text, (m) =>
    Boolean(readClock(m[1], m[2], m[3], m[4])?.explicit),
  )
  if (!single) return { rest: text, start: null, end: null }
  return {
    rest: cut(text, single),
    start: readClock(single[1], single[2], single[3], single[4]),
    end: null,
  }
}

function extractDay(text: string, now: Date): { rest: string; day: Date | null } {
  const patterns: { re: RegExp; resolve: (match: RegExpExecArray) => Date }[] = [
    { re: /\b(?:on\s+)?(?:today|tdy)\b/i, resolve: () => startOfDay(now) },
    {
      re: /\b(?:on\s+)?(?:tomorrow|tmr|tmrw)\b/i,
      resolve: () => addDays(startOfDay(now), 1),
    },
    { re: /\bnext\s+week\b/i, resolve: () => addDays(startOfDay(now), 7) },
    {
      // "friday", "on friday", "this friday", "next monday"
      re: new RegExp(
        String.raw`\b(?:on\s+|this\s+)?(next\s+)?(${WEEKDAYS.join('|')})\b`,
        'i',
      ),
      resolve: (match) => {
        const target = WEEKDAYS.indexOf(match[2].toLowerCase() as (typeof WEEKDAYS)[number])
        let delta = (target - now.getDay() + 7) % 7
        // A bare weekday means the next one, never today; "next friday" adds a week.
        if (delta === 0) delta = 7
        if (match[1]) delta += 7
        return addDays(startOfDay(now), delta)
      },
    },
  ]

  for (const { re, resolve } of patterns) {
    const match = re.exec(text)
    if (!match) continue
    return { rest: cut(text, match), day: resolve(match) }
  }
  return { rest: text, day: null }
}

function extractAttendees(text: string): { rest: string; names: string[] } {
  const match = WITH_RE.exec(text)
  if (!match) return { rest: text, names: [] }
  const names = match[1]
    .split(NAME_SEPARATOR_RE)
    .map((name) => name.trim())
    .filter(Boolean)
  if (names.length === 0) return { rest: text, names: [] }
  return { rest: cut(text, match), names }
}

/**
 * Trailing "on <app>" only — the same narrow rule task capture uses, because
 * "in"/"for" swallow ordinary titles. It stays a hint: the caller decides
 * whether the words name an app it actually has.
 */
function extractApp(text: string): { rest: string; app: string | null } {
  const match = /^([\s\S]+?)\s+on\s+([\w][\w .-]*)$/i.exec(text)
  if (!match) return { rest: text, app: null }
  return { rest: match[1].trim(), app: match[2].trim() }
}

function findPeople(query: string, people: IntentPerson[]): IntentPerson[] {
  const q = query.toLowerCase()
  const exact = people.filter((p) => p.name.toLowerCase() === q)
  if (exact.length > 0) return exact
  const firstName = people.filter((p) => p.name.toLowerCase().split(/\s+/)[0] === q)
  if (firstName.length > 0) return firstName
  return people.filter((p) => p.name.toLowerCase().includes(q))
}

/**
 * @param raw    what the user typed
 * @param people active users to resolve "with <names>" against
 * @param now    reference instant for relative days (injected so tests are stable)
 */
export function parseMeetingIntent(
  raw: string,
  people: IntentPerson[],
  now: Date = new Date(),
): MeetingIntent | null {
  const text = raw.trim().replace(/\s+/g, ' ')
  if (!text) return null

  // Order matters: the duration leaves before times ("for 45m" holds a number),
  // times before days ("friday 2-3pm" would otherwise lose its range), and both
  // before the "with" list, whose names would otherwise swallow them.
  const duration = extractDuration(text)
  const time = extractTime(duration.rest)
  const day = extractDay(time.rest, now)
  const withClause = extractAttendees(day.rest)
  const app = extractApp(withClause.rest)
  const title = app.rest.replace(LEADING_FILLER, '').trim()

  if (!title) return null

  const attendees: IntentPerson[] = []
  const ambiguous: string[] = []
  const unresolved: string[] = []
  for (const name of withClause.names) {
    const matches = findPeople(name, people)
    if (matches.length > 1) ambiguous.push(name)
    else if (matches.length === 0) unresolved.push(name)
    else if (!attendees.some((a) => a.id === matches[0].id)) attendees.push(matches[0])
  }

  let startsAt: Date | null = null
  let endsAt: Date | null = null
  if (time.start || day.day) {
    const base = day.day ?? startOfDay(now)
    if (time.start && time.end) {
      const range = resolveRange(time.start, time.end)
      startsAt = atMinutes(base, range.start)
      // "10pm-1am" runs into tomorrow rather than backwards.
      endsAt = atMinutes(base, range.end <= range.start ? range.end + MINUTES_PER_DAY : range.end)
    } else {
      // A named day with no clock time gets the house default hour. It shows in
      // the preview and lands in an editable field — never submitted unseen.
      const from = time.start ? toMinutes(time.start, null) : DEFAULT_HOUR * 60
      startsAt = atMinutes(base, from)
      endsAt = atMinutes(base, from + (duration.minutes ?? DEFAULT_DURATION_MINUTES))
    }
  }

  return {
    title,
    startsAt,
    endsAt,
    attendeeNames: withClause.names,
    attendees,
    ambiguous,
    unresolved,
    appQuery: app.app,
    appName: null,
  }
}
