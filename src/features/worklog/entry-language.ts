import { ENTRY_MINUTES_MAX, type EntryCategory } from '@/features/worklog/entries'

/**
 * One line of plain English becomes one hour entry.
 *
 * WHY THIS EXISTS. Logging an hour cost four controls — a duration box, a Kind
 * select, a Project select and a note field — sitting under a note field that
 * had already asked what you did. People do not think in four fields; they
 * think "2h reviewing the feeder model for CEB". This turns that sentence into
 * the same four values, shows what it understood, and lets the person correct
 * it before anything is written.
 *
 * PURE AND SYNCHRONOUS, like entries.ts and entry-form.ts. Every input arrives
 * as data — the vocabulary, the projects, the tasks — so the parser is
 * testable without a database, and the help text and the model prompt are
 * DERIVED FROM THE SAME TABLES rather than written out a second time. A
 * grammar documented in three places is a grammar that disagrees with itself
 * within a month.
 *
 * IT NEVER GUESSES A DURATION. No minutes in the line means no minutes in the
 * result — the caller shows the line as unloggable rather than inventing a
 * number. Hours are what an invoice is built from; a plausible default here
 * would be a fiction with somebody's name on it.
 *
 * ENGLISH ONLY, deliberately, for now. This studio writes bilingually and the
 * honest thing is to parse what the vocabulary below actually covers rather
 * than half-recognise Sinhala and mis-file the rest. An unparsed line still
 * logs — it just needs its duration written the way the help says.
 */

/**
 * The words that name a kind of work, in PRECEDENCE ORDER.
 *
 * Order is the whole rule when a line contains more than one — "review meeting
 * with the client" is a MEETING that happened to be about a review, and a
 * "support call" is support. Each list is scanned in this order and the first
 * hit wins, so moving an entry up or down here changes behaviour and the tests
 * say which way.
 */
export const CATEGORY_WORDS: readonly { category: EntryCategory; words: readonly string[] }[] = [
  {
    category: 'meeting',
    words: [
      'meeting', 'meet', 'met', 'call', 'standup', 'stand-up', 'sync', 'dsm',
      'demo', 'interview', 'workshop', 'catch-up', 'catchup', 'discussion', 'retro',
    ],
  },
  {
    category: 'review',
    words: ['review', 'reviewed', 'reviewing', 'pr', 'merge request', 'feedback', 'walkthrough'],
  },
  {
    category: 'support',
    words: [
      'support', 'incident', 'outage', 'hotfix', 'troubleshoot', 'troubleshooting',
      'debug', 'debugging', 'bugfix', 'firefighting', 'on-call',
    ],
  },
  {
    category: 'learning',
    words: [
      'learning', 'learnt', 'learned', 'training', 'kt', 'knowledge transfer',
      'course', 'study', 'studying', 'tutorial', 'reading',
    ],
  },
  {
    category: 'admin',
    words: [
      'admin', 'timesheet', 'paperwork', 'email', 'emails', 'planning', 'appraisal',
      'onboarding', 'expenses', 'recruitment',
    ],
  },
  {
    category: 'task',
    words: [
      'task', 'built', 'build', 'building', 'implement', 'implemented', 'implementing',
      'develop', 'development', 'coding', 'coded', 'wrote', 'shipped', 'fixed', 'feature',
    ],
  },
]

/** What a line means when no word above appears in it. */
export const DEFAULT_CATEGORY: EntryCategory = 'other'

/**
 * The self-score, when the line carries one.
 *
 * REQUIRES THE PERCENT SIGN. "80%" is a score; "80" at the start of a line is
 * eighty hours' worth of nothing — the bare-number rule already means hours,
 * and one token that could mean either a judgement or a measurement is exactly
 * the collapse the percent/minutes firewall exists to prevent. The sign is
 * cheap to type and impossible to misread.
 */
const PERCENT_RE = /(?:^|\s)(\d{1,3})\s*%/

export type ParsedEntryLine = {
  /** Self-scored percent when the line says one, e.g. "80%". */
  percent: number | null
  /** Whole minutes, or null when the line names no duration at all. */
  minutes: number | null
  category: EntryCategory
  /** True when a word in CATEGORY_WORDS decided the category. */
  categoryMatched: boolean
  appId: string | null
  appName: string | null
  taskId: string | null
  taskTitle: string | null
  /** The line with the duration taken out — what gets stored as the note. */
  note: string
}

export type NamedRef = { id: string; name: string }

/**
 * Every duration spelling this understands, most specific first.
 *
 * `1h30` must be tried before `1h`, or the 30 is silently dropped — the kind of
 * failure somebody notices a week later in a total they cannot explain.
 */
const DURATION_PATTERNS: readonly { re: RegExp; minutes: (m: RegExpMatchArray) => number }[] = [
  { re: /\b(\d+)\s*h(?:rs?|ours?)?\s*(\d{1,2})\s*m?(?:ins?|inutes?)?\b/i, minutes: (m) => Number(m[1]) * 60 + Number(m[2]) },
  { re: /\b(\d+(?:[.,]\d+)?)\s*h(?:rs?|ours?)?\b/i, minutes: (m) => Math.round(Number(m[1].replace(',', '.')) * 60) },
  { re: /\b(\d+)\s*m(?:ins?|inutes?)?\b/i, minutes: (m) => Number(m[1]) },
  { re: /\b(\d+(?:[.,]\d+)?)\s*(?:hours?|hrs?)\b/i, minutes: (m) => Math.round(Number(m[1].replace(',', '.')) * 60) },
  // A BARE number only counts at the very start ("2 reviewing the model"), and
  // only then. Mid-sentence digits are ordinary prose — "Goodwe plant data
  // extraction (5/10)" must not book five hours.
  { re: /^\s*(\d+(?:[.,]\d+)?)\s+/, minutes: (m) => Math.round(Number(m[1].replace(',', '.')) * 60) },
]

/** Regex-safe: project names here legitimately contain "|", "(" and "+". */
function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Longest name first, so "DERMS Mobile App" is not matched as "DERMS Web App"'s
 * shorter sibling and, more importantly, so a project whose name CONTAINS
 * another project's name resolves to the specific one.
 */
function matchLongest(text: string, refs: readonly NamedRef[]): NamedRef | null {
  const haystack = text.toLowerCase()
  let best: NamedRef | null = null
  for (const ref of refs) {
    if (!ref.name) continue
    if (!haystack.includes(ref.name.toLowerCase())) continue
    if (!best || ref.name.length > best.name.length) best = ref
  }
  return best
}

export function parseEntryLine(
  raw: string,
  refs: { apps?: readonly NamedRef[]; tasks?: readonly NamedRef[] } = {},
): ParsedEntryLine {
  let text = raw.trim()

  // Taken out FIRST, so "80% 2h review" reads as a score and a duration rather
  // than the duration reader tripping over the score's digits.
  let percent: number | null = null
  const percentMatch = text.match(PERCENT_RE)
  if (percentMatch && Number(percentMatch[1]) <= 100) {
    percent = Number(percentMatch[1])
    text = (text.slice(0, percentMatch.index ?? 0) +
      text.slice((percentMatch.index ?? 0) + percentMatch[0].length))
      .replace(/\s{2,}/g, ' ')
      .trim()
  }

  let minutes: number | null = null
  let note = text
  for (const pattern of DURATION_PATTERNS) {
    const match = text.match(pattern.re)
    if (!match) continue
    const value = pattern.minutes(match)
    // A typo'd 900 must not become a 15-hour entry that validateEntry rejects
    // after the fact; out-of-range reads as "no duration found" so the caller
    // asks rather than the server refusing.
    if (value <= 0 || value > ENTRY_MINUTES_MAX) break
    minutes = value
    note = (text.slice(0, match.index ?? 0) + text.slice((match.index ?? 0) + match[0].length))
      .replace(/\s{2,}/g, ' ')
      .trim()
    break
  }

  // Leading connectives left over once the duration is gone — "2h on the
  // feeder model" should store "the feeder model", not "on the feeder model".
  note = note.replace(/^(?:of\s+)?(?:on|for|doing|spent|did|was|in)\b\s*/i, '').trim()

  const haystack = ` ${text.toLowerCase()} `
  let category: EntryCategory = DEFAULT_CATEGORY
  let categoryMatched = false
  outer: for (const group of CATEGORY_WORDS) {
    for (const word of group.words) {
      if (new RegExp(`(?:^|[^a-z])${escape(word)}(?:[^a-z]|$)`, 'i').test(haystack)) {
        category = group.category
        categoryMatched = true
        break outer
      }
    }
  }

  const task = matchLongest(text, refs.tasks ?? [])
  const app = matchLongest(text, refs.apps ?? [])

  // Naming a task IS saying it was task work, and it is the stronger signal:
  // the words are a guess about intent, a named task is a reference to a real
  // row. The server derives the project from the task and ignores any appId,
  // so nothing here fights that.
  if (task) {
    return {
      percent,
      minutes,
      category: 'task',
      categoryMatched: true,
      appId: null,
      appName: null,
      taskId: task.id,
      taskTitle: task.name,
      note,
    }
  }

  // A project name with no other signal means project work, not "other".
  if (app && !categoryMatched) {
    return {
      percent,
      minutes,
      category: 'other',
      categoryMatched: false,
      appId: app.id,
      appName: app.name,
      taskId: null,
      taskTitle: null,
      note,
    }
  }

  return {
    percent,
    minutes,
    category,
    categoryMatched,
    appId: app?.id ?? null,
    appName: app?.name ?? null,
    taskId: null,
    taskTitle: null,
    note,
  }
}

/**
 * The supported grammar in words — for the help panel AND for the model.
 *
 * ONE SOURCE. The person reading the hint and the model drafting a line are
 * told the same thing by the same arrays the parser runs on, so a word added
 * to CATEGORY_WORDS is documented and prompted for free, and a word removed
 * cannot linger in help text promising something that no longer works.
 */
export function describeGrammar(): { durations: string[]; kinds: { label: string; words: string }[] } {
  return {
    durations: ['2h', '1.5h', '1h30', '90m', '2 hours', '45 mins', '2 …  (a bare number at the start is hours)'],
    kinds: CATEGORY_WORDS.map((group) => ({
      label: group.category,
      words: group.words.slice(0, 6).join(', '),
    })),
  }
}

/** The same grammar as one block of prompt text. */
export function grammarForPrompt(): string {
  const { durations, kinds } = describeGrammar()
  return [
    `Durations understood: ${durations.join(' | ')}.`,
    'Kind is chosen by the first matching word, in this order:',
    ...kinds.map((k) => `  ${k.label}: ${k.words}`),
    `Anything with no matching word is "${DEFAULT_CATEGORY}".`,
    'Naming a task makes it a task entry; naming a project attributes it to that project.',
  ].join('\n')
}

/**
 * "1.5", "90m", "1h30", "2h" all mean the same thing to somebody logging a
 * day, and refusing three of them because the fourth was expected is the kind
 * of small rudeness that stops a habit forming. Returns whole minutes, or null
 * when there is genuinely no number in there.
 */
export function parseDuration(raw: string): number | null {
  const text = raw.trim().toLowerCase()
  if (!text) return null

  const hm = text.match(/^(\d+)\s*h\s*(\d+)\s*m?$/)
  if (hm) return Number(hm[1]) * 60 + Number(hm[2])

  const hours = text.match(/^(\d+(?:[.,]\d+)?)\s*h(?:rs?|ours?)?$/)
  if (hours) return Math.round(Number(hours[1].replace(',', '.')) * 60)

  const mins = text.match(/^(\d+)\s*m(?:ins?|inutes?)?$/)
  if (mins) return Number(mins[1])

  // A bare number is HOURS, because that is what somebody typing "1.5" into a
  // box labelled Hours means. Minutes have to say so.
  const bare = text.match(/^(\d+(?:[.,]\d+)?)$/)
  if (bare) return Math.round(Number(bare[1].replace(',', '.')) * 60)

  return null
}

/**
 * What the line was understood to say, as labelled pieces the UI can paint.
 *
 * SHOWN, NEVER SILENTLY APPLIED. The whole risk of one free-text field is that
 * a person cannot tell what it heard until after they commit — so the reading
 * comes back as data, one chip per recognised thing, and anything unrecognised
 * is explicitly the note rather than quietly dropped.
 */
export type LineToken = {
  kind: 'score' | 'time' | 'category' | 'project' | 'task' | 'note'
  label: string
}

export function describeLine(parsed: ParsedEntryLine): LineToken[] {
  const tokens: LineToken[] = []
  if (parsed.percent !== null) tokens.push({ kind: 'score', label: `${parsed.percent}% of plan` })
  if (parsed.minutes !== null) {
    const hours = Math.round((parsed.minutes / 60) * 10) / 10
    tokens.push({ kind: 'time', label: `${hours}h` })
  }
  if (parsed.taskTitle) tokens.push({ kind: 'task', label: parsed.taskTitle })
  else if (parsed.appName) tokens.push({ kind: 'project', label: parsed.appName })
  // The category is only worth a chip once something else anchors it — a bare
  // "other" on an empty line is noise, not feedback.
  if (parsed.categoryMatched) tokens.push({ kind: 'category', label: parsed.category })
  if (parsed.note) tokens.push({ kind: 'note', label: parsed.note })
  return tokens
}

/**
 * What the line still needs before it records anything.
 *
 * A line may legitimately carry only a score, only hours, or both — this says
 * which of the two it currently is, so the button can name what it will do
 * instead of a generic "Add" that hides whether hours are about to be logged.
 */
export type LineIntent = { scores: boolean; logsHours: boolean; note: string }

export function lineIntent(parsed: ParsedEntryLine): LineIntent {
  return {
    scores: parsed.percent !== null,
    logsHours: parsed.minutes !== null,
    note: parsed.note,
  }
}

/** One tap-to-insert suggestion. `text` is appended to the line as typed. */
export type LineSuggestion = { kind: LineToken['kind']; label: string; text: string }

/**
 * The chips offered under the field.
 *
 * These are not a menu of everything — they are the tokens somebody would
 * otherwise have to remember the spelling of. Scores and durations first
 * because they are what a line CANNOT be committed without; projects next
 * because their names are long and easy to mistype; kinds last because the
 * grammar usually catches those from ordinary prose.
 */
export function lineSuggestions(
  parsed: ParsedEntryLine,
  apps: readonly NamedRef[],
): LineSuggestion[] {
  const out: LineSuggestion[] = []
  if (parsed.percent === null) {
    for (const value of [25, 50, 80, 100]) {
      out.push({ kind: 'score', label: `${value}%`, text: `${value}%` })
    }
  }
  if (parsed.minutes === null) {
    for (const value of ['1h', '2h', '4h']) {
      out.push({ kind: 'time', label: value, text: value })
    }
  }
  if (!parsed.appId && !parsed.taskId) {
    for (const app of apps.slice(0, 4)) {
      out.push({ kind: 'project', label: app.name, text: app.name })
    }
  }
  if (!parsed.categoryMatched) {
    for (const group of CATEGORY_WORDS.slice(0, 4)) {
      out.push({ kind: 'category', label: group.category, text: group.words[0] })
    }
  }
  return out
}
