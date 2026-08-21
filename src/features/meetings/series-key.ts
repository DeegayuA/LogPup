/**
 * Inferred meeting-series identity, and the purpose a title names.
 *
 * LogPup's schema has no recurrence concept: a "series" (Vela's weekly sync,
 * a project's daily standup) is never stored anywhere — it is INFERRED by
 * normalising meeting titles down to whatever part names what the meeting
 * IS, stripping away whatever part someone happened to type in for a given
 * occurrence (the date, the weekday, the cadence word, the sprint number).
 *
 * `seriesKey` is the SINGLE normaliser. The attendee recommender, the series
 * surface, the no-app inference ladder and the meeting-load suggestion engine
 * all call this — a second ad-hoc `.toLowerCase().trim()` somewhere else is
 * exactly how two halves of the system would silently disagree about which
 * meetings belong together, and every retrospective "why was this person
 * recommended" line would become unverifiable.
 *
 * WHY THIS IS ITS OWN MODULE. It arrived inside `attendee-series.ts`, which
 * is one caller among several. The R3 SHARE-A-SLOT and R6 COVER-TOGETHER
 * rules both need it and neither has anything to do with attendee
 * recommendation, so it lives beside them rather than under one of them —
 * the meeting-load design asks for exactly this file by name. `sameSeries`
 * stayed behind: it compares two meeting ROWS, which is the recommender's
 * question, not the normaliser's.
 *
 * Pure: no `Date`, no I/O, nothing beyond string normalisation. The window
 * (most recent 6 occurrences, 180-day cutoff) and the established/2+
 * threshold live with the caller, not here.
 */

/** Characters treated as "part of a word" for boundary checks and for the
 *  final collapse in step 5 — plain ASCII alphanumerics plus the Sinhala
 *  Unicode block (U+0D80–U+0DFF). Deliberately NOT `\w`/`\p{L}`: those
 *  either miss Sinhala entirely (`\w`) or need Unicode property escapes
 *  whose `u`-flag semantics we don't need for a two-script problem. Kept as
 *  an explicit range so a Sinhala CONTENT word (e.g. a meeting named
 *  entirely in Sinhala) survives step 5 just like an English one does —
 *  only step 3's weekday list deletes specific Sinhala tokens, never the
 *  script as a whole. */
const WORD_CHAR = 'a-z0-9\\u0d80-\\u0dff'

/** Builds a global regex matching any word in `words`, bounded so it can
 *  never match inside a larger word (so the month "may" doesn't eat half of
 *  some other token, and "standup" is never mistaken for containing "sun").
 *  Longest-first ordering is a defensive optimisation, not a correctness
 *  requirement — lookaround backtracking would find the right alternative
 *  either way, since the boundary check applies to the whole alternation. */
function wordListPattern(words: readonly string[]): RegExp {
  const sorted = [...words].sort((a, b) => b.length - a.length)
  const alternation = sorted.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  return new RegExp(`(?<![${WORD_CHAR}])(?:${alternation})(?![${WORD_CHAR}])`, 'g')
}

const WEEKDAYS_EN = [
  'monday', 'mon',
  'tuesday', 'tue', 'tues',
  'wednesday', 'wed', 'weds',
  'thursday', 'thu', 'thur', 'thurs',
  'friday', 'fri',
  'saturday', 'sat',
  'sunday', 'sun',
]

/** The සඳුදා-family: standard Sinhala weekday names. Sinhala has no
 *  case and (unlike English) no widely-used abbreviations for these, so the
 *  full words are the only forms worth matching. */
const WEEKDAYS_SI = [
  'ඉරිදා', // Sunday
  'සඳුදා', // Monday
  'අඟහරුවාදා', // Tuesday
  'බදාදා', // Wednesday
  'බ්‍රහස්පතින්දා', // Thursday
  'සිකුරාදා', // Friday
  'සෙනසුරාදා', // Saturday
]

const MONTHS = [
  'january', 'jan',
  'february', 'feb',
  'march', 'mar',
  'april', 'apr',
  'may',
  'june', 'jun',
  'july', 'jul',
  'august', 'aug',
  'september', 'sept', 'sep',
  'october', 'oct',
  'november', 'nov',
  'december', 'dec',
]

/** ONLY cadence words. Never content words — "sync", "standup" and "retro"
 *  name what the meeting IS and must survive every step below. */
const CADENCE_WORDS = ['fortnightly', 'bi-weekly', 'biweekly', 'weekly', 'monthly', 'daily']

/** Small, deliberately short filler-word list. It exists for exactly one
 *  purpose: catching a title that normalises down to nothing but function
 *  words (e.g. "The") so it returns `null` instead of a useless key — not
 *  for scrubbing filler out of otherwise-meaningful titles. */
const STOPWORDS = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'with', 'is', 'are'])

const WEEKDAY_MONTH_RE = wordListPattern([...WEEKDAYS_EN, ...WEEKDAYS_SI, ...MONTHS])
const CADENCE_RE = wordListPattern(CADENCE_WORDS)

/** A trailing parenthetical, e.g. "Standup (Tue)" -> "Standup". Only the
 *  trailing one — a parenthetical mid-title is more likely to be real
 *  content ("Vela (staging) sync") than noise. */
const TRAILING_PARENTHETICAL_RE = /\s*\([^)]*\)\s*$/

/** Date-like tokens: `12/08`, `2026-08-12`, `12.08.2026`. Requires a
 *  `-`/`/`/`.` separator between digit groups, which is what keeps this from
 *  colliding with clock times (`:`-separated) or plain numbers. */
const DATE_LIKE_RE = /(?<!\d)\d{1,4}[-/.]\d{1,2}(?:[-/.]\d{1,4})?(?!\d)/g

/** Clock times WITH a colon, am/pm optional: `10:00`, `2:30 pm`, `2:30pm`. */
const CLOCK_COLON_RE = /(?<!\d)\d{1,2}:\d{2}(?:\s*(?:am|pm))?(?!\d)/g

/** Clock times as a bare hour + am/pm, no colon: `2pm`, `2 am`. Requires the
 *  am/pm suffix — otherwise a bare number like a sprint count would vanish. */
const CLOCK_AMPM_RE = /(?<!\d)\d{1,2}\s*(?:am|pm)(?!\d)/g

/** Ordinals: `1st`, `2nd`, `3rd`, `4th`, ... */
const ORDINAL_RE = /(?<!\d)\d+(?:st|nd|rd|th)(?![a-z0-9])/g

/** Issue numbers: `#12`. */
const ISSUE_HASH_RE = /#\d+/g

/** Week numbers: `w4`. Bounded so "week" itself (no digit) never matches. */
const WEEK_NUM_RE = new RegExp(`(?<![${WORD_CHAR}])w\\d+(?![${WORD_CHAR}])`, 'g')

/** Sprint numbers: `sprint 3`, `sprint3`. */
const SPRINT_NUM_RE = new RegExp(`(?<![${WORD_CHAR}])sprint\\s*\\d+(?![${WORD_CHAR}])`, 'g')

/** Everything that isn't a word character, per `WORD_CHAR` above — step 5's
 *  final collapse, and the only place non-Latin/non-Sinhala punctuation
 *  (em dashes, brackets, full-width punctuation, ...) gets removed. */
const NON_WORD_RUN_RE = new RegExp(`[^${WORD_CHAR}]+`, 'g')

/**
 * Normalises a meeting title down to the part that names what the meeting
 * IS, discarding whatever was typed in for one specific occurrence.
 *
 * Steps, in order (see spec "Series rule" — this is the single authority,
 * do not duplicate the logic anywhere else):
 *   1. NFKC normalise, lowercase.
 *   2. Strip a trailing parenthetical.
 *   3. Delete weekday names (English + Sinhala), month names, ordinals,
 *      date-like tokens, clock times, and issue/sprint/week numbers.
 *   4. Delete cadence words ONLY (daily/weekly/biweekly/bi-weekly/
 *      fortnightly/monthly) — never content words.
 *   5. Collapse all non-word runs to single spaces and trim.
 *
 * Returns `null` if what's left is under 3 characters, or has zero
 * non-stopword tokens (e.g. "The" clears the length floor alone but is pure
 * filler) — either way there is nothing stable enough to key a series on.
 */
export function seriesKey(title: string): string | null {
  let s = title.normalize('NFKC').toLowerCase()

  s = s.replace(TRAILING_PARENTHETICAL_RE, '')

  s = s.replace(DATE_LIKE_RE, ' ')
  s = s.replace(CLOCK_COLON_RE, ' ')
  s = s.replace(CLOCK_AMPM_RE, ' ')
  s = s.replace(ISSUE_HASH_RE, ' ')
  s = s.replace(WEEK_NUM_RE, ' ')
  s = s.replace(SPRINT_NUM_RE, ' ')
  s = s.replace(ORDINAL_RE, ' ')
  s = s.replace(WEEKDAY_MONTH_RE, ' ')

  s = s.replace(CADENCE_RE, ' ')

  s = s.replace(NON_WORD_RUN_RE, ' ').trim()

  if (s.length < 3) return null

  const tokens = s.split(' ')
  const hasMeaningfulToken = tokens.some((token) => !STOPWORDS.has(token))
  if (!hasMeaningfulToken) return null

  return s
}

// ---------------------------------------------------------------------------
// The purpose veto
// ---------------------------------------------------------------------------

/**
 * The kinds of conversation this studio holds, as words that appear in
 * titles. The list exists for ONE job: stopping the merge rules from joining
 * things that are only superficially similar — R3 SHARE-A-SLOT will not put
 * a standup and a retro in one slot however identical the invite lists are,
 * and R6 COVER-TOGETHER will not carry a demo's open item into a planning
 * meeting.
 *
 * ONE LIST, shared by both rules. Vetoing on two different vocabularies would
 * mean the same pair merges on one surface and not the other, and nobody
 * could say which was right.
 *
 * ORDER IS THE TIE-BREAK, not a ranking: `purposeToken` returns the first of
 * these a title names, so "Sprint review and retro" and "Retro and sprint
 * review" resolve identically. `1:1` sorts first because it is the purpose
 * least survivable as a merge — the entire point of a one-to-one is that
 * only two people are in the room.
 *
 * WHAT A MISSING TOKEN COSTS, stated plainly: an unrecognised word makes
 * `purposeToken` return `null`, and a null purpose is compatible with
 * everything. The veto is therefore PERMISSIVE by construction — it blocks
 * the crossings it can name and is silent about the rest. That is the safe
 * direction for a suggestion a human has to accept before anything happens,
 * and the wrong direction for anything that acts on its own, which is why
 * nothing built on this may ever be wired to a write.
 */
export const PURPOSE_TOKENS = [
  '1:1',
  'standup',
  'retro',
  'planning',
  'crit',
  'review',
  'demo',
  'sync',
  'postmortem',
  'handover',
] as const

export type PurposeToken = (typeof PURPOSE_TOKENS)[number]

/**
 * Sinhala words naming the same purposes. Deliberately short, and only words
 * whose meaning is not in doubt: a WRONG entry does real damage (it asserts
 * a title means something it does not), whereas a MISSING one only leaves
 * the veto silent — which is where it already is for every word not listed.
 *
 * Mapped onto the English token rather than standing alone, so a Sinhala
 * "සමාලෝචනය" and an English "review" are ONE purpose and never merge across.
 */
const SINHALA_PURPOSES: Readonly<Record<string, PurposeToken>> = {
  'සමාලෝචනය': 'review',
  'සැලසුම': 'planning',
  'ප්‍රදර්ශනය': 'demo',
}

/** Second spellings of a purpose already on the list. Folded so a title
 *  saying "Retrospective" and one saying "Retro" are the same purpose rather
 *  than two that veto each other. */
const PURPOSE_SPELLINGS: Readonly<Record<string, PurposeToken>> = {
  retrospective: 'retro',
  'post-mortem': 'postmortem',
  'hand-over': 'handover',
  'stand-up': 'standup',
}

/** `1:1`, `1-1`, `1 on 1`, `one on one`. Matched on the RAW title, before
 *  normalisation: step 5 collapses the colon and would leave "1 1", a shape
 *  no word list can hold. */
const ONE_TO_ONE_RE = /(?<!\d)(?:1\s*[:\-/]\s*1|1\s+on\s+1|one\s+on\s+one)(?!\d)/i

/** Every purpose spelling the word list can match. `1:1` is excluded — its
 *  punctuation does not survive normalisation, so it is handled by
 *  `ONE_TO_ONE_RE` on the raw title instead. */
const PURPOSE_RE = wordListPattern([
  ...PURPOSE_TOKENS.filter((token) => token !== '1:1'),
  ...Object.keys(SINHALA_PURPOSES),
  ...Object.keys(PURPOSE_SPELLINGS),
])

/**
 * The purpose a title names, or `null` when it names none.
 *
 * `null` is the common answer and is NOT a failure: most titles are a project
 * name and a noun. It means "this rule has no opinion about what this is
 * for", and a null purpose is compatible with every other purpose.
 *
 * When a title names more than one purpose ("Sprint review and retro"), the
 * first in `PURPOSE_TOKENS` order wins rather than the first in the string —
 * the answer has to be the same however somebody happened to word it, or two
 * rows describing the same meeting would veto differently.
 */
export function purposeToken(title: string): PurposeToken | null {
  const found = new Set<PurposeToken>()

  if (ONE_TO_ONE_RE.test(title)) found.add('1:1')

  const normalised = title.normalize('NFKC').toLowerCase()
  for (const match of normalised.matchAll(PURPOSE_RE)) {
    const word = match[0]
    found.add(SINHALA_PURPOSES[word] ?? PURPOSE_SPELLINGS[word] ?? (word as PurposeToken))
  }

  if (found.size === 0) return null
  return PURPOSE_TOKENS.find((token) => found.has(token)) ?? null
}

/**
 * Whether two purposes may share one meeting.
 *
 * `null` (no opinion) is compatible with everything; two DIFFERENT named
 * purposes never are. The whole veto, in one function, so the two rules that
 * call it cannot drift apart.
 */
export function purposesCompatible(a: PurposeToken | null, b: PurposeToken | null): boolean {
  if (a === null || b === null) return true
  return a === b
}
