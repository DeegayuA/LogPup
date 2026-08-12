/**
 * Natural-language meeting capture. Turns a single line — "standup tomorrow 10am
 * with shanika and deeghayu", "design review friday 2-3pm on LogPup with sam" —
 * into a structured intent the meeting form can prefill.
 *
 * Pure function over a caller-supplied people list and an injected `now`, so it
 * runs on every keystroke without touching the clock or network (tests depend
 * on the injected `now`). Weekday/relative-day math matches the task parser
 * (src/lib/task-intent.ts).
 */

import { fuzzyMatches } from '@/lib/fuzzy'

export type MeetingPerson = { id: string; name: string }

export type MeetingIntent = {
  title: string
  startsAt: Date | null
  endsAt: Date | null
  /** Raw name tokens from the "with …" list, in order. */
  attendeeNames: string[]
  /** Uniquely-resolved attendees, deduped by id, in first-seen order. */
  attendees: MeetingPerson[]
  /** Tokens that matched more than one person. */
  ambiguous: string[]
  /** Tokens that matched nobody. */
  unresolved: string[]
  /** "on <app>" hint. The caller owns the app list; the parser never resolves it. */
  appQuery: string | null
  /** Always null from the parser; the caller resolves the hint to a real app. */
  appName: string | null
  /** A video-call link found anywhere in the text, routed to the meeting link. */
  meetingUrl: string | null
}

const WEEKDAYS = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
] as const

const DEFAULT_DURATION_MIN = 60
const DAY_ONLY_START_HOUR = 9

// Leading words that describe the act of scheduling, not the meeting itself.
const LEADING_FILLER = /^(?:schedule|set\s?up|book|create|arrange|plan|add)\s+(?:a\s+|an\s+)?(?:meeting\s+)?/i

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function stripMatch(text: string, match: RegExpMatchArray): string {
  return (text.slice(0, match.index) + ' ' + text.slice(match.index! + match[0].length))
    .replace(/\s+/g, ' ')
    .trim()
}

// --- attendees --------------------------------------------------------------

function resolvePeople(
  segment: string,
  people: MeetingPerson[],
): Pick<MeetingIntent, 'attendeeNames' | 'attendees' | 'ambiguous' | 'unresolved'> {
  const attendeeNames = segment
    .split(/\s*(?:,|&|\band\b)\s*/i)
    .map((t) => t.trim())
    .filter(Boolean)

  const attendees: MeetingPerson[] = []
  const ambiguous: string[] = []
  const unresolved: string[] = []
  const seen = new Set<string>()

  for (const token of attendeeNames) {
    const q = token.toLowerCase()
    // Exact/prefix first; fall back to fuzzy only when prefix finds nothing, so a
    // typo ("deghayu") resolves while confident matches are never second-guessed.
    let matched = people.filter((p) => p.name.toLowerCase().startsWith(q))
    if (matched.length === 0) matched = fuzzyMatches(token, people, (p) => p.name)
    if (matched.length === 1) {
      if (!seen.has(matched[0].id)) {
        seen.add(matched[0].id)
        attendees.push(matched[0])
      }
    } else if (matched.length > 1) {
      if (!ambiguous.includes(token)) ambiguous.push(token)
    } else if (!unresolved.includes(token)) {
      unresolved.push(token)
    }
  }
  return { attendeeNames, attendees, ambiguous, unresolved }
}

// --- day --------------------------------------------------------------------

function extractDay(text: string, now: Date): { rest: string; day: Date | null } {
  const patterns: { re: RegExp; resolve: (m: RegExpMatchArray) => Date }[] = [
    { re: /\b(today|tdy)\b/i, resolve: () => now },
    // `tom+or+ow` tolerates the misspellings people actually type — tommorow,
    // tommorrow, tomorow — alongside the correct spelling and the shorthands.
    // Worth the ugly regex: an unrecognised date word is not reported, it is
    // silently left in the title and the meeting quietly lands on today. That
    // reads as a scheduling bug rather than a typo, and it is only noticed
    // after the meeting has been missed.
    { re: /\b(tom+or+ow|tmrw?)\b/i, resolve: () => addDays(now, 1) },
    { re: /\bnext\s+week\b/i, resolve: () => addDays(now, 7) },
    {
      re: new RegExp(`\\b(?:by\\s+|on\\s+|due\\s+)?(next\\s+)?(${WEEKDAYS.join('|')})\\b`, 'i'),
      resolve: (m) => {
        const target = WEEKDAYS.indexOf(m[2].toLowerCase() as (typeof WEEKDAYS)[number])
        let delta = (target - now.getDay() + 7) % 7
        if (delta === 0) delta = 7 // a bare weekday is always the NEXT one
        if (m[1]) delta += 7 // "next monday" adds a week
        return addDays(now, delta)
      },
    },
  ]
  for (const { re, resolve } of patterns) {
    const match = re.exec(text)
    if (!match) continue
    const d = resolve(match)
    return { rest: stripMatch(text, match), day: new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
  }
  return { rest: text, day: null }
}

// --- duration ---------------------------------------------------------------

function extractDuration(text: string): { rest: string; minutes: number | null } {
  const match = /\bfor\s+(\d+)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)\b/i.exec(text)
  if (!match) return { rest: text, minutes: null }
  const n = Number(match[1])
  const minutes = /^h/i.test(match[2]) ? n * 60 : n
  return { rest: stripMatch(text, match), minutes }
}

// --- time -------------------------------------------------------------------

function toClock(hStr: string, mStr: string | undefined, meridiem: string | undefined) {
  let h = Number(hStr)
  const m = mStr ? Number(mStr) : 0
  const mer = meridiem?.toLowerCase()
  if (mer === 'pm') { if (h < 12) h += 12 } else if (mer === 'am') { if (h === 12) h = 0 }
  return { h, m }
}

type TimeResult = { startH: number; startM: number; endH: number | null; endM: number | null }

const RANGE_RE =
  /\b(?:from\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*(?:-|–|to|until)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/i
const MERIDIEM_RE = /\b(?:at\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/i
const CLOCK24_RE = /\b(\d{1,2}):(\d{2})\b/

function extractTime(text: string): { rest: string; time: TimeResult | null } {
  const range = RANGE_RE.exec(text)
  if (range) {
    const end = toClock(range[4], range[5], range[6])
    let start = toClock(range[1], range[2], range[3] ?? range[6])
    // If the start borrowed the end's meridiem but that puts it after the end,
    // the start was really the morning ("11-1pm" is 11am–1pm, not 11pm–1pm).
    if (!range[3] && range[6] && start.h * 60 + start.m >= end.h * 60 + end.m) {
      start = toClock(range[1], range[2], undefined)
    }
    return {
      rest: stripMatch(text, range),
      time: { startH: start.h, startM: start.m, endH: end.h, endM: end.m },
    }
  }

  const meridiem = MERIDIEM_RE.exec(text)
  if (meridiem) {
    const t = toClock(meridiem[1], meridiem[2], meridiem[3])
    return { rest: stripMatch(text, meridiem), time: { startH: t.h, startM: t.m, endH: null, endM: null } }
  }

  const clock = CLOCK24_RE.exec(text)
  if (clock) {
    const t = toClock(clock[1], clock[2], undefined)
    return { rest: stripMatch(text, clock), time: { startH: t.h, startM: t.m, endH: null, endM: null } }
  }
  return { rest: text, time: null }
}

// --- app --------------------------------------------------------------------

function extractApp(text: string): { rest: string; app: string | null } {
  const match = /\son\s+([A-Za-z][\w .-]*?)\s*$/i.exec(text)
  if (!match) return { rest: text, app: null }
  return { rest: text.slice(0, match.index).trim(), app: match[1].trim() }
}

// --- entry ------------------------------------------------------------------

export function parseMeetingIntent(
  raw: string,
  people: MeetingPerson[],
  now: Date = new Date(),
): MeetingIntent | null {
  let text = raw.trim().replace(/\s+/g, ' ')
  if (!text) return null

  // A pasted video-call link is pulled out first and routed to the meeting link,
  // so it never lands in the title.
  let meetingUrl: string | null = null
  const urlMatch = /https?:\/\/\S+/i.exec(text)
  if (urlMatch) {
    meetingUrl = urlMatch[0].replace(/[.,;]+$/, '')
    text = stripMatch(text, urlMatch)
  }

  // Scheduling clauses come out FIRST, so a "with …" that sits in the middle of
  // the sentence ("1:1 with deeghayu next monday 9.30am") doesn't swallow the day
  // and time that follow the names.
  const duration = extractDuration(text)
  text = duration.rest

  const time = extractTime(text)
  text = time.rest

  const dayResult = extractDay(text, now)
  text = dayResult.rest

  // "with <list>" — stop the list before a trailing "on <app>".
  let attendance = resolvePeople('', people)
  const withMatch = /\bwith\s+([\s\S]+?)(?=\s+on\s+[A-Za-z]|$)/i.exec(text)
  if (withMatch) {
    attendance = resolvePeople(withMatch[1].trim(), people)
    text = stripMatch(text, withMatch)
  }

  const app = extractApp(text)
  text = app.rest

  const title = text.replace(LEADING_FILLER, '').replace(/\s+/g, ' ').trim()
  if (!title) return null

  let startsAt: Date | null = null
  let endsAt: Date | null = null
  const base = dayResult.day ?? new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (time.time) {
    startsAt = new Date(base.getFullYear(), base.getMonth(), base.getDate(), time.time.startH, time.time.startM)
    if (time.time.endH !== null) {
      endsAt = new Date(base.getFullYear(), base.getMonth(), base.getDate(), time.time.endH, time.time.endM ?? 0)
    } else {
      endsAt = new Date(startsAt.getTime() + (duration.minutes ?? DEFAULT_DURATION_MIN) * 60_000)
    }
  } else if (dayResult.day) {
    startsAt = new Date(base.getFullYear(), base.getMonth(), base.getDate(), DAY_ONLY_START_HOUR, 0)
    endsAt = new Date(startsAt.getTime() + (duration.minutes ?? DEFAULT_DURATION_MIN) * 60_000)
  }

  return {
    title,
    startsAt,
    endsAt,
    attendeeNames: attendance.attendeeNames,
    attendees: attendance.attendees,
    ambiguous: attendance.ambiguous,
    unresolved: attendance.unresolved,
    appQuery: app.app,
    appName: null,
    meetingUrl,
  }
}
