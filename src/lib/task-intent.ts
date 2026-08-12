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
  /** First (or only) resolved person — every single-assignee caller reads this. */
  assignee: IntentPerson | null
  /**
   * Every resolved person, in the order typed, deduped — "@shanika @sam fix
   * login" selects two people, and a caller that supports it creates one task
   * per person. `[assignee]` in the single case; empty when nobody resolved.
   */
  assignees: IntentPerson[]
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
 * Words that may sit BETWEEN two selected names without ending the run:
 * "shanika and deeghayu", "shanika, deeghayu", "shanika or deeghayu". Either
 * conjunction selects BOTH people — the parser cannot make the team's choice
 * for it, and creating for both is the reading the preview can show honestly.
 */
const NAME_SEPARATOR = /^(?:and|or|&|,)$/i

/**
 * Words that INTRODUCE a trailing recipient list ("fix login to shanika",
 * "ship it for dee and sam"). Consumed once the run has found at least one
 * name, then the run ends: they mark where the title stopped.
 */
const NAME_TERMINATOR = /^(?:to|for)$/i

/**
 * Greedy run of resolvable names at either end of the phrase — the one
 * machine behind every bare-name form, single or multi, with or without @:
 * "shanika deeghayu fix login", "fix login shanika or deeghayu",
 * "fix login to shanika and deeghayu".
 *
 * Every candidate resolves through findPeople, so every position gets the
 * full fuzzy tiers ("shanka" → Shanika) — per the workspace's explicit call
 * that typo tolerance beats the occasional stolen word. The run still stops
 * at the first word that resolves to nobody and always leaves at least one
 * word for the title, so an ordinary sentence loses nothing: "fix login
 * page" ends the run at "page" and keeps every word it was given.
 */
function takeNameRun(
  text: string,
  people: IntentPerson[],
  from: 'start' | 'end',
): { rest: string; queries: string[] } {
  // Commas become their own tokens so "shanika, deeghayu" scans the same as
  // "shanika and deeghayu".
  const words = text.replace(/,/g, ' , ').split(/\s+/).filter(Boolean)
  const queries: string[] = []
  let rest = [...words]

  while (rest.length > 1) {
    const edge = from === 'start' ? rest[0] : rest[rest.length - 1]
    if (queries.length > 0 && NAME_SEPARATOR.test(edge)) {
      rest = from === 'start' ? rest.slice(1) : rest.slice(0, -1)
      continue
    }
    if (from === 'end' && queries.length > 0 && NAME_TERMINATOR.test(edge)) {
      rest = rest.slice(0, -1)
      break
    }
    let matched = false
    // Two words first, so a full name binds before its first name alone.
    for (const take of [2, 1]) {
      if (rest.length - take < 1) continue
      const slice = from === 'start' ? rest.slice(0, take) : rest.slice(-take)
      if (slice.some((word) => NAME_SEPARATOR.test(word) || NAME_TERMINATOR.test(word))) continue
      const candidate = slice.join(' ')
      if (findPeople(candidate, people).length > 0) {
        if (from === 'start') {
          queries.push(candidate)
          rest = rest.slice(take)
        } else {
          queries.unshift(candidate)
          rest = rest.slice(0, -take)
        }
        matched = true
        break
      }
    }
    if (!matched) break
  }

  return { rest: rest.filter((word) => word !== ',').join(' '), queries }
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
  // EVERY @token, not just the first: "@shanika @sam fix login" is two
  // selections, and each strip re-runs the regex on the shortened body so
  // adjacent mentions cannot hide each other.
  const atQueries: string[] = []
  {
    let match = AT_ANYWHERE.exec(body)
    while (match) {
      atQueries.push(match[2])
      body = (body.slice(0, match.index) + ' ' + body.slice(match.index + match[0].length))
        .replace(/\s+/g, ' ')
        .trim()
      match = AT_ANYWHERE.exec(body)
    }
  }
  // 2. "assign <title> to <name>" / "task <title> for <name>"
  const command =
    /^(?:assign|create\s+task|add\s+task|task)\s+([\s\S]+?)\s+(?:to|for)\s+([\s\S]+)$/i.exec(text)
  // 3. "sam: ship the thing"
  const colon = /^([\w][\w .'-]{0,40}?)\s*:\s+([\s\S]+)$/.exec(text)

  if (atQueries.length > 0) {
    nameQuery = atQueries[0]
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

  // Resolve every selected name; the single-name forms funnel through as a
  // one-element list. ALL names must resolve cleanly before anything is
  // assigned — "@shanika @bob fix login" with an unknown bob reports bob
  // rather than quietly creating for shanika alone, because the preview can
  // only warn about what the parse surfaces.
  const queries = atQueries.length > 0 ? atQueries : nameQuery ? [nameQuery] : []
  const resolved: IntentPerson[] = []
  let ambiguousMatches: IntentPerson[] = []
  let failedQuery: string | null = null
  for (const query of queries) {
    const found = findPeople(query, people)
    if (found.length === 1) {
      if (!resolved.some((person) => person.id === found[0].id)) resolved.push(found[0])
    } else if (failedQuery === null) {
      failedQuery = query
      if (found.length > 1) ambiguousMatches = found
    }
  }
  const clean = queries.length > 0 && failedQuery === null && resolved.length > 0

  const title = rest.replace(LEADING_FILLER, '').trim()

  if (!title) return null

  return {
    assignee: clean ? resolved[0] : null,
    assignees: clean ? resolved : [],
    assigneeQuery: failedQuery,
    ambiguous: ambiguousMatches,
    title,
    due: withoutDue.due,
    dueLabel: withoutDue.label,
    appQuery: withoutApp.app,
    priority: withoutPriority.priority,
    priorityLabel: withoutPriority.priorityLabel,
    description,
  }
}
