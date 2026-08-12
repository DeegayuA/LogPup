/**
 * Inferred meeting-series identity.
 *
 * LogPup's schema has no recurrence concept: a "series" (Vela's weekly sync,
 * a project's daily standup) is never stored anywhere — it is INFERRED by
 * normalising meeting titles down to whatever part names what the meeting
 * IS, stripping away whatever part someone happened to type in for a given
 * occurrence (the date, the weekday, the cadence word, the sprint number).
 *
 * `seriesKey` is the SINGLE normaliser. The attendee recommender, the series
 * surface and the no-app inference ladder all call this — a second ad-hoc
 * `.toLowerCase().trim()` somewhere else is exactly how two halves of the
 * system would silently disagree about which meetings belong together, and
 * every retrospective "why was this person recommended" line would become
 * unverifiable.
 *
 * Two meetings are the same series when `seriesKey` is non-null and equal
 * AND `appId` is equal (both `null` counts as equal — see `sameSeries`).
 * This is why "Vela standup" and "Orbit standup" stay apart (different
 * appId, same key) while "Standup", "Daily standup" and "Standup (Tue)"
 * collapse together (same key, same appId).
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

/** Minimal shape `sameSeries` needs from a meeting row. */
export interface SeriesCandidate {
  title: string
  /** The app the meeting belongs to, or `null` when unlinked. */
  appId: string | null
}

/**
 * Whether two meetings belong to the same inferred series: equal, non-null
 * `seriesKey` AND equal `appId` (both `null` counts as equal).
 *
 * A `null` key never matches anything, even against another `null` key —
 * two titles that don't reduce to anything nameable are not evidence of a
 * shared series, they're just two titles LogPup can't parse.
 */
export function sameSeries(a: SeriesCandidate, b: SeriesCandidate): boolean {
  const keyA = seriesKey(a.title)
  const keyB = seriesKey(b.title)
  if (keyA === null || keyB === null) return false
  return keyA === keyB && a.appId === b.appId
}
