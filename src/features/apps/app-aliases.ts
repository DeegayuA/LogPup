/**
 * WHAT A PROJECT IS ACTUALLY CALLED, as opposed to what it is named.
 *
 * Nobody writes "Syntax Genie Attendance Web App" in a work log. They write
 * SGX, or AV, or CC, or "the attendance one", or "Solar app" for Solarsim — and
 * every one of those was invisible to a matcher that lowercased the full name
 * and looked for a substring. The hours still got logged; they just landed with
 * no project on them, which is a hole in every per-project total built on top.
 *
 * THREE WAYS A NAME REACHES A PROJECT, in descending order of confidence:
 *
 *   1. THE NAME OR A STORED ALIAS. Exact, and the only one anybody has to
 *      maintain. `apps.aliases` is free text a PM types once — "SGX", "syntax
 *      genie" — because an abbreviation like SGX is a fact about the client,
 *      not something derivable from the letters of the app's name.
 *   2. A DERIVED ACRONYM. "CareCode" gives CC, "Attendance Web App" gives AWA.
 *      These cost nothing and are right often enough to be worth having with no
 *      setup at all. Matched CASE-SENSITIVELY and only as a whole word, so the
 *      "cc" in "reviewed the cc list" is not a project.
 *   3. A UNIQUE PREFIX. "Solar" reaches Solarsim. Four characters minimum, and
 *      it must match EXACTLY ONE project — an ambiguous prefix resolves to
 *      nothing, because attributing four hours to the wrong project is worse
 *      than leaving them unattributed, and only the unattributed case is
 *      visible to the person afterwards.
 *   4. A TYPO. "attendace app" is Attendance Web App to anybody reading it, and
 *      somebody writing out a week from memory misspells project names
 *      constantly. Bounded edit distance, scaled to word length, unique match
 *      only — the same refusal to guess as the prefix tier above.
 *
 * PURE AND SYNCHRONOUS. Every input arrives as data, so the same vocabulary
 * feeds the instant one-line parser, the catch-up prompt and the tests without
 * three of them drifting apart.
 */

export type AliasedApp = {
  id: string
  name: string
  /** Free-text nicknames a PM typed. Empty for a project nobody has annotated. */
  aliases?: readonly string[]
}

/** How a phrase reached a project — carried back so the UI can say so. */
export type AppMatchHow = 'name' | 'alias' | 'acronym' | 'prefix' | 'typo'

export type AppMatch = { app: AliasedApp; how: AppMatchHow; matched: string }

/** The shortest prefix worth guessing on. Three letters collide; four rarely do. */
export const MIN_PREFIX = 4

/**
 * Words that carry no identity and must never become part of an acronym or be
 * matched on alone. Every studio project is an "app" or a "system"; a matcher
 * that let those through would attribute the first project alphabetically to
 * any sentence containing the word "app".
 */
const NOISE = new Set([
  'app', 'application', 'apps', 'the', 'a', 'an', 'of', 'and', 'for', 'to', 'on',
  'web', 'mobile', 'portal', 'system', 'platform', 'service', 'tool', 'project',
  'site', 'dashboard', 'internal', 'new', 'old', 'v1', 'v2',
])

function words(name: string): string[] {
  return name.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 0)
}

/**
 * The acronyms a name gives up on its own.
 *
 * Two sources, because studios name projects both ways: initials across words
 * ("Attendance Web App" → AWA) and the capitals inside one CamelCase word
 * ("CareCode" → CC). Noise words are dropped from the first — the initials of
 * "Attendance Web App" are really A, W and A, and AWA is only useful because
 * the noise is gone.
 *
 * Nothing shorter than two letters comes back. A one-letter acronym matches
 * every sentence containing that letter as a word.
 */
export function deriveAcronyms(name: string): string[] {
  const out: string[] = []

  const parts = words(name)
  const meaningful = parts.filter((word) => !NOISE.has(word.toLowerCase()))

  /* THREE WORDS OR MORE take their initials WHOLE, noise included: "Attendance
     Web App" is AWA to everybody who says it, and dropping Web and App to get
     "A" is not an abbreviation of anything. A TWO-WORD name only qualifies if
     both words carry identity — "Solarsim Portal" would give SP, a two-letter
     token too collision-prone to guess a project from when half of it means
     nothing. */
  const source = parts.length >= 3 ? parts : meaningful
  if (source.length >= 2) {
    const initials = source.map((word) => word[0].toUpperCase()).join('')
    if (initials.length >= 2) out.push(initials)
  }

  for (const word of parts) {
    // CamelCase only — an all-caps word IS its own acronym and adding it again
    // is noise, and a lowercase word has no internal capitals to read.
    const caps = word.match(/\p{Lu}/gu)
    if (!caps || caps.length < 2) continue
    if (word === word.toUpperCase()) continue
    const acronym = caps.join('')
    if (!out.includes(acronym)) out.push(acronym)
  }

  return out
}

/** Everything a project answers to by name, longest first. See `matchApp` for the rest. */
export function appVocabulary(app: AliasedApp): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const term of [app.name, ...(app.aliases ?? [])]) {
    const trimmed = term?.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out.sort((a, b) => b.length - a.length)
}

/** Regex-safe: project names legitimately contain "|", "(" and "+". */
function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Whole-word containment, so "CC" does not match inside "account". */
function containsWord(haystack: string, needle: string, caseSensitive = false): boolean {
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${escape(needle)}(?![\\p{L}\\p{N}])`,
    caseSensitive ? 'u' : 'iu',
  )
  return pattern.test(haystack)
}

/**
 * Which project a piece of text is about, or null.
 *
 * ONE ANSWER OR NONE, NEVER A BEST GUESS. Each tier is tried in full before the
 * next, and within a tier the LONGEST match wins — so a project whose name
 * contains another project's name resolves to the specific one, and "DERMS
 * Mobile App" is never read as "DERMS Web App"'s shorter sibling.
 *
 * The prefix tier is the only one that can be ambiguous, and ambiguity there
 * returns null rather than picking. Somebody's afternoon on the wrong project
 * is a number nobody can correct later, because nothing about it looks wrong.
 */
export function matchApp(text: string, apps: readonly AliasedApp[]): AppMatch | null {
  if (!text.trim() || apps.length === 0) return null

  // 1. Name or stored alias, longest first, case-insensitive.
  let best: AppMatch | null = null
  for (const app of apps) {
    for (const term of appVocabulary(app)) {
      if (!containsWord(text, term)) continue
      if (best && best.matched.length >= term.length) continue
      best = { app, how: term === app.name ? 'name' : 'alias', matched: term }
    }
  }
  if (best) return best

  // 2. Derived acronym — CASE-SENSITIVE. "SGX" written in caps is an
  //    abbreviation; "sgx" mid-sentence is more likely a typo than a project,
  //    and "cc" certainly is.
  for (const app of apps) {
    for (const acronym of deriveAcronyms(app.name)) {
      if (!containsWord(text, acronym, true)) continue
      if (best && best.matched.length >= acronym.length) continue
      best = { app, how: 'acronym', matched: acronym }
    }
  }
  if (best) return best

  // 3. A unique prefix of a meaningful word in the name — "Solar" for
  //    Solarsim. Ambiguous prefixes resolve to nothing.
  const candidates: AppMatch[] = []
  const tokens = words(text).filter(
    (token) => token.length >= MIN_PREFIX && !NOISE.has(token.toLowerCase()),
  )
  for (const token of tokens) {
    const hits: AppMatch[] = []
    for (const app of apps) {
      const nameWords = words(app.name).filter((word) => !NOISE.has(word.toLowerCase()))
      /* `startsWith` with no length condition, deliberately. Requiring the name
         word to be STRICTLY longer meant a token equal to a whole word in the
         name matched nothing — "Solarsim meeting prep" missed Solarsim Portal,
         because tier 1 looks for the full name and this tier refused an exact
         word. One word of a name is exactly how people refer to a project. */
      const hit = nameWords.find((word) => word.toLowerCase().startsWith(token.toLowerCase()))
      if (hit) hits.push({ app, how: 'prefix', matched: token })
    }
    // Exactly one project answers to this prefix, or it answers to none.
    if (hits.length === 1) candidates.push(hits[0])
  }
  if (candidates.length > 0) {
    // Longest unambiguous prefix wins: "Attend" is a better signal than "Sola".
    return candidates.sort((a, b) => b.matched.length - a.matched.length)[0]
  }

  // 4. A TYPO. "attendace app" is Attendance Web App to any human reading it,
  //    and people writing a week from memory misspell project names constantly.
  //    Last of the four tiers and the least confident, so it only ever runs
  //    when nothing exact, abbreviated or prefixed matched — and, like the
  //    prefix tier, it refuses to choose between two candidates.
  const typos: AppMatch[] = []
  for (const token of tokens) {
    const budget = typoBudget(token)
    if (budget === 0) continue
    const hits: AppMatch[] = []
    for (const app of apps) {
      const nameWords = words(app.name).filter((word) => !NOISE.has(word.toLowerCase()))
      const hit = nameWords.find((word) => withinEditDistance(token, word, budget))
      if (hit) hits.push({ app, how: 'typo', matched: token })
    }
    if (hits.length === 1) typos.push(hits[0])
  }
  if (typos.length === 0) return null
  return typos.sort((a, b) => b.matched.length - a.matched.length)[0]
}

/**
 * How wrong a word may be and still be that word.
 *
 * SCALED TO LENGTH, because one wrong letter in a five-letter word is a
 * different claim from one wrong letter in a twelve-letter one. Below five
 * characters the budget is zero: at four letters an edit distance of one
 * reaches most other four-letter words in the language, and a project would
 * start collecting hours from any sentence that rhymed with it.
 */
function typoBudget(token: string): number {
  if (token.length < 5) return 0
  return token.length >= 8 ? 2 : 1
}

/**
 * Levenshtein distance, but it stops as soon as it exceeds `max`.
 *
 * BOUNDED ON PURPOSE. This runs per token per project on every keystroke of the
 * one-line field, and the answer is only ever consulted as a yes/no — computing
 * a distance of 30 to then compare it against 2 is work nobody reads. The
 * length check below rejects most pairs before a single row is filled in.
 */
function withinEditDistance(a: string, b: string, max: number): boolean {
  const left = a.toLowerCase()
  const right = b.toLowerCase()
  if (left === right) return true
  if (Math.abs(left.length - right.length) > max) return false

  let previous = Array.from({ length: right.length + 1 }, (_, i) => i)
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i]
    let rowMin = i
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      const value = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost)
      current.push(value)
      if (value < rowMin) rowMin = value
    }
    // Every remaining row can only add to the best value on this one, so once
    // the whole row is past the budget the answer is settled.
    if (rowMin > max) return false
    previous = current
  }
  return previous[right.length] <= max
}

/**
 * The vocabulary as one line per project, for a prompt.
 *
 * The model does the fuzzy reading and this tells it what the words ARE — the
 * id fence in catch-up-parse.ts still decides what survives, so a richer
 * vocabulary here can only ever help it match, never let it invent.
 */
export function appPromptLine(app: AliasedApp): string {
  const extra = [...(app.aliases ?? []), ...deriveAcronyms(app.name)]
    .map((term) => term.trim())
    .filter((term, index, all) => term.length > 0 && all.indexOf(term) === index)
    .filter((term) => term.toLowerCase() !== app.name.toLowerCase())
  return `- ${app.id} — ${app.name}${extra.length > 0 ? ` (also called: ${extra.join(', ')})` : ''}`
}
