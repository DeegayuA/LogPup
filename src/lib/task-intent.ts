/**
 * Natural-language task capture for the ⌘K palette.
 *
 * Turns things people actually type — "shanika do this task today",
 * "@sam fix the login flow", "assign billing copy to mary on logpup",
 * "dee: ship the roadmap by friday" — into { assignee, title, due, app }.
 *
 * Deliberately a pure function over a caller-supplied people list: it runs on
 * every keystroke to power the palette's live preview, so it must never touch
 * the network or the clock implicitly (pass `today` in — tests depend on it).
 */

import { fuzzyMatches } from '@/lib/fuzzy'

export type IntentPerson = { id: string; name: string }

export type TaskIntent = {
  assignee: IntentPerson | null
  /** Set when a name was written but matched nobody, or matched several. */
  assigneeQuery: string | null
  ambiguous: IntentPerson[]
  title: string
  /** Calendar day, `YYYY-MM-DD`. */
  due: string | null
  dueLabel: string | null
  appQuery: string | null
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

// Verbs/politeness that carry no meaning once the assignee is extracted:
// "shanika please do this" -> "this".
const LEADING_FILLER =
  /^(?:please\s+|pls\s+|kindly\s+|can\s+you\s+|could\s+you\s+|you\s+|to\s+|should\s+|must\s+|needs?\s+to\s+|has\s+to\s+|have\s+to\s+|make\s+sure\s+to\s+|do\s+)+/i

function toIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/**
 * Pulls a date phrase out of the text and returns the remaining title.
 * Matches at a word boundary only, so a title keeps words that merely contain
 * a date word.
 */
function extractDue(
  text: string,
  today: Date,
): { rest: string; due: string | null; label: string | null } {
  const patterns: {
    re: RegExp
    resolve: (m: RegExpMatchArray) => Date
    label: (m: RegExpMatchArray) => string
  }[] = [
    { re: /\b(today|tdy)\b/i, resolve: () => today, label: () => 'today' },
    { re: /\b(tomorrow|tmr|tmrw)\b/i, resolve: () => addDays(today, 1), label: () => 'tomorrow' },
    {
      re: /\bin\s+(\d{1,2})\s+days?\b/i,
      resolve: (m) => addDays(today, Number(m[1])),
      label: (m) => `in ${m[1]} days`,
    },
    { re: /\bnext\s+week\b/i, resolve: () => addDays(today, 7), label: () => 'next week' },
    {
      // "friday", "on friday", "by next monday"
      re: new RegExp(`\\b(?:by\\s+|on\\s+|due\\s+)?(next\\s+)?(${WEEKDAYS.join('|')})\\b`, 'i'),
      resolve: (m) => {
        const target = WEEKDAYS.indexOf(m[2].toLowerCase() as (typeof WEEKDAYS)[number])
        let delta = (target - today.getDay() + 7) % 7
        // A bare weekday means the NEXT one, never today; "next friday" adds a week.
        if (delta === 0) delta = 7
        if (m[1]) delta += 7
        return addDays(today, delta)
      },
      label: (m) => (m[1] ? `next ${m[2].toLowerCase()}` : m[2].toLowerCase()),
    },
  ]

  for (const { re, resolve, label } of patterns) {
    const match = re.exec(text)
    if (!match) continue
    const rest = (text.slice(0, match.index) + ' ' + text.slice(match.index + match[0].length))
      .replace(/\s+/g, ' ')
      .trim()
    return { rest, due: toIso(resolve(match)), label: label(match) }
  }
  return { rest: text, due: null, label: null }
}

/**
 * Trailing "on <app>". Only "on" — allowing "in"/"for" swallowed ordinary
 * titles ("write copy for marketing"). Even so this is a hint: the caller
 * restores the words when <app> resolves to nothing.
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
  const contains = people.filter((p) => p.name.toLowerCase().includes(q))
  if (contains.length > 0) return contains
  // Typo fallback ("shanka" → "Shanika"), only when nothing above matched.
  return fuzzyMatches(query, people, (p) => p.name)
}

/**
 * @param raw    what the user typed
 * @param people active users to resolve a name against
 * @param today  reference day for relative dates (injected so tests are stable)
 */
export function parseTaskIntent(
  raw: string,
  people: IntentPerson[],
  today: Date = new Date(),
): TaskIntent | null {
  const text = raw.trim().replace(/\s+/g, ' ')
  if (text.length < 3) return null

  let nameQuery: string | null = null
  let body = text

  // 1. "@sam ..." — explicit, wins outright.
  const at = /^@([\w.'-]+)\s+([\s\S]+)$/.exec(text)
  // 2. "assign <title> to <name>" / "task <title> for <name>"
  const command =
    /^(?:assign|create\s+task|add\s+task|task)\s+([\s\S]+?)\s+(?:to|for)\s+([\s\S]+)$/i.exec(text)
  // 3. "sam: ship the thing"
  const colon = /^([\w][\w .'-]{0,40}?)\s*:\s+([\s\S]+)$/.exec(text)

  if (at) {
    nameQuery = at[1]
    body = at[2]
  } else if (command) {
    body = command[1]
    nameQuery = command[2]
  } else if (colon) {
    nameQuery = colon[1]
    body = colon[2]
  } else {
    // 4. Bare leading name: try two words then one, so "shanika ayasmanthi do
    // X" and "shanika do X" both resolve. Only accepted when it actually
    // matches somebody — otherwise the words stay in the title.
    const words = text.split(' ')
    for (const take of [2, 1]) {
      if (words.length <= take) continue
      const candidate = words.slice(0, take).join(' ')
      if (findPeople(candidate, people).length > 0) {
        nameQuery = candidate
        body = words.slice(take).join(' ')
        break
      }
    }
  }

  const matches = nameQuery ? findPeople(nameQuery, people) : []

  // Dates first: "audit in 3 days" would otherwise be read as app "3 days",
  // and "fix login on monday" as app "monday".
  const withoutDue = extractDue(body, today)
  const withoutApp = extractApp(withoutDue.rest)
  const title = withoutApp.rest.replace(LEADING_FILLER, '').trim()

  if (!title) return null

  return {
    assignee: matches.length === 1 ? matches[0] : null,
    assigneeQuery: nameQuery && matches.length !== 1 ? nameQuery : null,
    ambiguous: matches.length > 1 ? matches : [],
    title,
    due: withoutDue.due,
    dueLabel: withoutDue.label,
    appQuery: withoutApp.app,
  }
}
