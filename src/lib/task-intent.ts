/**
 * Natural-language task capture for the ⌘K palette and the board composer.
 *
 * Turns things people actually type — "shanika do this task today",
 * "@sam fix the login flow", "assign billing copy to mary on logpup",
 * "new task to shanika", "dee: ship the roadmap by friday" — into
 * { assignee, title, due, app }.
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
  /** The board's scale: 1 Low, 2 Medium, 3 High (see board-view.ts). */
  priority: number | null
  priorityLabel: string | null
  /** Everything after a ` -- ` / ` — ` separator, verbatim and unparsed. */
  description: string | null
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
    // Misspellings tolerated, matching meeting-intent.ts — these two parsers
    // are documented as sharing their relative-day math, and a phrase that
    // schedules a meeting for tomorrow should date a task for tomorrow too.
    { re: /\b(tom+or+ow|tmrw?)\b/i, resolve: () => addDays(today, 1), label: () => 'tomorrow' },
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

/** Letters/digits plus the punctuation that lives *inside* names (O'Neil, Anne-Marie). */
const NAME_WORD = String.raw`[\p{L}\p{N}][\p{L}\p{N}.'’-]*`

/**
 * `@name`, ANYWHERE in the phrase — "fix login @shanika today" as well as
 * "@shanika fix login". The `@` is the user explicitly flagging a person, so
 * unlike the bare trailing name it may sit mid-sentence and it earns the full
 * fuzzy tiers. One token only: `@` has always bound a single word here, and
 * two would swallow the start of the title ("@sam fix login" → "sam fix").
 */
const AT_ANYWHERE = new RegExp(String.raw`(^|\s)@(${NAME_WORD})(?=\s|$)`, 'u')

/**
 * Everything after ` -- ` (or an em-dash) is the task's DESCRIPTION, verbatim:
 * "fix login -- users with 2FA get a blank screen after the redirect".
 * Split off before any other parsing, so a date or a name inside the
 * description is prose, never an instruction.
 */
const DESCRIPTION_SPLIT = /\s+(?:--|—)\s+/

/** Board scale (board-view.ts): 1 Low, 2 Medium, 3 High. Urgent is High. */
const PRIORITY_WORDS: Record<string, { value: number; label: string }> = {
  urgent: { value: 3, label: 'High' },
  high: { value: 3, label: 'High' },
  medium: { value: 2, label: 'Medium' },
  med: { value: 2, label: 'Medium' },
  low: { value: 1, label: 'Low' },
}

const PRIORITY_KEYS = Object.keys(PRIORITY_WORDS).join('|')

/**
 * A priority word at the END of the phrase ("fix login high", "ship it,
 * urgent", "audit low priority"), or `!word` anywhere ("fix !high login").
 *
 * End-only for the bare form, same reasoning as the bare trailing name: these
 * are ordinary English words, and "fix high latency" must keep its "high".
 * The `!` form is the explicit escape hatch when the word has to sit
 * elsewhere.
 */
const TRAILING_PRIORITY = new RegExp(
  String.raw`^([\s\S]*\S)[\s,]+(?:priority\s+)?(${PRIORITY_KEYS})(?:\s+priority)?$`,
  'i',
)
const BANG_PRIORITY = new RegExp(String.raw`(^|\s)!(${PRIORITY_KEYS})(?=\s|$)`, 'i')

function extractPriority(text: string): {
  rest: string
  priority: number | null
  priorityLabel: string | null
} {
  const bang = BANG_PRIORITY.exec(text)
  if (bang) {
    const word = PRIORITY_WORDS[bang[2].toLowerCase()]
    const rest = (text.slice(0, bang.index) + ' ' + text.slice(bang.index + bang[0].length))
      .replace(/\s+/g, ' ')
      .trim()
    return { rest, priority: word.value, priorityLabel: word.label }
  }
  const trailing = TRAILING_PRIORITY.exec(text)
  if (trailing) {
    const word = PRIORITY_WORDS[trailing[2].toLowerCase()]
    return { rest: trailing[1].replace(/,$/, '').trim(), priority: word.value, priorityLabel: word.label }
  }
  return { rest: text, priority: null, priorityLabel: null }
}

/**
 * A recipient written at the END of the phrase: "new task to shanika",
 * "ship the brief for dee", "fix login @sam".
 *
 * The tail is capped at two words so a whole clause can never be read as a
 * name, and the caller only accepts the split when that tail resolves to
 * somebody — "write docs for the API" keeps every word it was given.
 */
const TRAILING_ASSIGNEE = new RegExp(
  String.raw`^([\s\S]*\S)\s+(?:(?:to|for)\s+|@)(${NAME_WORD}(?:\s+${NAME_WORD})?)$`,
  'iu',
)

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
 * Splits a trailing recipient off the phrase, but ONLY when it names someone
 * real. Refusing the split otherwise is the whole safety property: an
 * unresolved tail stays in the title rather than quietly disappearing into an
 * assignment nobody asked for.
 */
function takeTrailingAssignee(
  text: string,
  people: IntentPerson[],
): { rest: string; query: string } | null {
  const match = TRAILING_ASSIGNEE.exec(text)
  if (!match) return null
  const query = match[2].trim()
  // Ambiguity counts as a match: two Sams must be reported, not left buried in
  // the title where the user would never learn the name was even read.
  if (findPeople(query, people).length === 0) return null
  return { rest: match[1].trim(), query }
}

/**
 * A bare name at the END of the phrase — "fix login shanika" — the mirror of
 * the bare LEADING name that has always worked.
 *
 * Deliberately stricter than every other form: the last words of an ordinary
 * title are usually nouns ("fix login page", "update billing copy"), so this
 * accepts only an exact full-name or exact first-name hit — no substring, no
 * typo fallback. A trailing "to"/"for"/"@" is the user *saying* the next word
 * is a person, and earns the fuzzy tiers; a bare last word proves nothing,
 * and stealing it from the title on a fuzzy guess would be worse than the
 * Unassigned it replaces — the preview shows Unassigned as a nudge, but a
 * wrong assignee reads as success.
 */
function takeBareTrailingName(
  text: string,
  people: IntentPerson[],
): { rest: string; query: string } | null {
  const words = text.split(' ')
  // Two words first, so "… shanika ayasmanthi" binds the full name rather
  // than leaving "shanika" stranded in the title.
  for (const take of [2, 1]) {
    if (words.length <= take) continue // the title must keep at least one word
    const candidate = words.slice(-take).join(' ')
    const q = candidate.toLowerCase()
    const strict = people.filter((p) => {
      const name = p.name.toLowerCase()
      return name === q || name.split(/\s+/)[0] === q
    })
    if (strict.length > 0) return { rest: words.slice(0, -take).join(' '), query: candidate }
  }
  return null
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
  // The description is split off before ANY parsing: a date or a name inside
  // it is prose describing the task, not an instruction about it.
  const rawParts = raw.trim().split(DESCRIPTION_SPLIT)
  const description = rawParts.length > 1 ? rawParts.slice(1).join(' — ').trim() || null : null

  const text = rawParts[0].trim().replace(/\s+/g, ' ')
  if (text.length < 3) return null

  let nameQuery: string | null = null
  let body = text

  // 1. "@sam …" wherever the @ sits — explicit, wins outright.
  const at = AT_ANYWHERE.exec(text)
  // 2. "assign <title> to <name>" / "task <title> for <name>"
  const command =
    /^(?:assign|create\s+task|add\s+task|task)\s+([\s\S]+?)\s+(?:to|for)\s+([\s\S]+)$/i.exec(text)
  // 3. "sam: ship the thing"
  const colon = /^([\w][\w .'-]{0,40}?)\s*:\s+([\s\S]+)$/.exec(text)

  if (at) {
    nameQuery = at[2]
    body = (text.slice(0, at.index) + ' ' + text.slice(at.index + at[0].length))
      .replace(/\s+/g, ' ')
      .trim()
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

  // Dates first: "audit in 3 days" would otherwise be read as app "3 days",
  // and "fix login on monday" as app "monday".
  const withoutDue = extractDue(body, today)
  // Priority after dates ("fix login today high" peels the date first, which
  // is what leaves "high" on the end) and before names, so a trailing name
  // never has to look through a priority word to find itself.
  const withoutPriority = extractPriority(withoutDue.rest)
  let rest = withoutPriority.rest

  /*
   * Then the trailing recipient — "new task to shanika". Tried once on either
   * side of the app hint, because either can be written last:
   *   "fix login to shanika on logpup"  -> app must come off first
   *   "fix login on logpup to shanika"  -> name must come off first
   * Never when a name was already read from the front: "@sam ship it for
   * review" must not be reassigned by its own tail.
   */
  if (!nameQuery) {
    const trailing = takeTrailingAssignee(rest, people)
    if (trailing) {
      nameQuery = trailing.query
      rest = trailing.rest
    }
  }

  const withoutApp = extractApp(rest)
  rest = withoutApp.rest

  if (!nameQuery) {
    const trailing = takeTrailingAssignee(rest, people)
    if (trailing) {
      nameQuery = trailing.query
      rest = trailing.rest
    }
  }

  // Last resort: a bare name on the end, with no "to"/"for"/"@" announcing
  // it. Runs after the app hint has been peeled so "fix login shanika on
  // logpup" resolves both, and only under its strict matcher (see
  // takeBareTrailingName for why fuzzy is not welcome here).
  if (!nameQuery) {
    const bare = takeBareTrailingName(rest, people)
    if (bare) {
      nameQuery = bare.query
      rest = bare.rest
    }
  }

  const matches = nameQuery ? findPeople(nameQuery, people) : []
  const title = rest.replace(LEADING_FILLER, '').trim()

  if (!title) return null

  return {
    assignee: matches.length === 1 ? matches[0] : null,
    assigneeQuery: nameQuery && matches.length !== 1 ? nameQuery : null,
    ambiguous: matches.length > 1 ? matches : [],
    title,
    due: withoutDue.due,
    dueLabel: withoutDue.label,
    appQuery: withoutApp.app,
    priority: withoutPriority.priority,
    priorityLabel: withoutPriority.priorityLabel,
    description,
  }
}
