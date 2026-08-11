/**
 * @-mention resolution for the comment/discussion box: finding the token the
 * caret sits in, and ranking people against it.
 *
 * People type a first name, a last name, both in either order, initials, or a
 * plain typo — a substring test resolves only the first of those. Matching is a
 * cascade instead: confident rules always outrank looser ones, and the
 * typo-tolerant `fuzzyMatches` runs only when every deterministic rule found
 * nothing, per the contract documented in src/lib/fuzzy.ts. Same layering the
 * ⌘K parsers use (src/lib/task-intent.ts, src/lib/meeting-intent.ts).
 *
 * Pure on purpose — no clock, no network, no DOM — so the popover's behaviour
 * is unit-testable without React.
 */

import { fuzzyMatches } from '@/lib/fuzzy'

export type MentionCandidate = { id: string; name: string }

/** Why a row is in the list. `fuzzy` rows are the typo fallback, never mixed in. */
export type MentionMatchKind =
  | 'exact'
  | 'name-prefix'
  | 'word-prefix'
  | 'tokens'
  | 'initials'
  | 'substring'
  | 'fuzzy'

export type MentionSuggestion<T extends MentionCandidate = MentionCandidate> = {
  user: T
  kind: MentionMatchKind
}

/** The '@' token the caret is inside: where it starts, and what was typed after it. */
export type ActiveMention = { start: number; query: string }

/** Most rows the popover ever shows. */
export const MENTION_SUGGESTION_LIMIT = 6

/** Best first. Initials sit below every real prefix so they never outrank one. */
const RANK: Record<MentionMatchKind, number> = {
  exact: 0,
  'name-prefix': 1,
  'word-prefix': 2,
  tokens: 3,
  initials: 4,
  substring: 5,
  fuzzy: 6,
}

// --- the active "@…" token ---------------------------------------------------

/**
 * A mention query may run to two words, which is what lets "@shan ayas" reach
 * the matcher at all. The bound is what stops a whole sentence typed after an
 * '@' from being read as a name.
 */
const MENTION_QUERY_MAX_WORDS = 2

/** Letters/digits plus the punctuation that lives *inside* names (O'Neil, Anne-Marie). */
const NAME_WORD = String.raw`[\p{L}\p{N}][\p{L}\p{N}'’-]*`

/*
 * The whole slice between '@' and the caret must be a bare "@" or up to
 * MENTION_QUERY_MAX_WORDS words joined by single spaces. Everything else — a
 * third word, a trailing space, a comma, a newline — ends the token. The
 * trailing-space rule matters twice over: it closes the popover between words
 * rather than guessing mid-phrase, and it means the space written after an
 * inserted mention closes the popover instead of instantly reopening it on the
 * name that was just completed.
 */
const MENTION_QUERY_RE = new RegExp(
  `^(?:${NAME_WORD}(?: ${NAME_WORD}){0,${MENTION_QUERY_MAX_WORDS - 1}})?$`,
  'u',
)

/**
 * Finds the "@token" the caret is currently inside: the nearest '@' before the
 * caret that starts a word (start of text, or after whitespace), followed only
 * by a valid mention query.
 */
export function findMentionQuery(value: string, caret: number): ActiveMention | null {
  const upToCaret = value.slice(0, Math.max(0, Math.min(caret, value.length)))
  const at = upToCaret.lastIndexOf('@')
  if (at === -1) return null
  if (at > 0 && !/\s/.test(upToCaret[at - 1])) return null
  const query = upToCaret.slice(at + 1)
  if (!MENTION_QUERY_RE.test(query)) return null
  return { start: at, query }
}

// --- ranking -----------------------------------------------------------------

function wordsOf(name: string): string[] {
  return name.toLowerCase().split(/\s+/).filter(Boolean)
}

/**
 * True when every query token claims a DIFFERENT name word as a prefix, in any
 * order — "shan ayas" and "ayasmanthi shanika" both land on Shanika Ayasmanthi.
 *
 * Augmenting-path matching rather than a greedy pass, so overlapping tokens
 * ("a ay" against "Ayasmanthi Anne") can't fail purely on assignment order.
 */
function tokensCoverWords(tokens: string[], nameWords: string[]): boolean {
  if (tokens.length > nameWords.length) return false
  /* name word index -> token index that claimed it */
  const claimedBy = new Array<number>(nameWords.length).fill(-1)

  function claim(token: number, visited: boolean[]): boolean {
    for (let w = 0; w < nameWords.length; w++) {
      if (visited[w] || !nameWords[w].startsWith(tokens[token])) continue
      visited[w] = true
      if (claimedBy[w] === -1 || claim(claimedBy[w], visited)) {
        claimedBy[w] = token
        return true
      }
    }
    return false
  }

  for (let t = 0; t < tokens.length; t++) {
    if (!claim(t, new Array<boolean>(nameWords.length).fill(false))) return false
  }
  return true
}

/** The best rule this name satisfies, or null when none of them do. */
function classify(query: string, tokens: string[], name: string): MentionMatchKind | null {
  const lower = name.toLowerCase()
  if (lower === query) return 'exact'
  if (lower.startsWith(query)) return 'name-prefix'

  const nameWords = wordsOf(name)
  if (nameWords.some((word) => word.startsWith(query))) return 'word-prefix'
  if (tokens.length > 1 && tokensCoverWords(tokens, nameWords)) return 'tokens'

  const initials = nameWords.map((word) => word[0]).join('')
  if (tokens.length === 1 && query.length > 1 && initials.startsWith(query)) return 'initials'

  if (lower.includes(query)) return 'substring'
  return null
}

/** Rank first, then name, then id — never input order, so the list never jitters. */
function compare<T extends MentionCandidate>(a: MentionSuggestion<T>, b: MentionSuggestion<T>) {
  if (RANK[a.kind] !== RANK[b.kind]) return RANK[a.kind] - RANK[b.kind]
  const nameA = a.user.name.toLowerCase()
  const nameB = b.user.name.toLowerCase()
  if (nameA !== nameB) return nameA < nameB ? -1 : 1
  return a.user.id < b.user.id ? -1 : a.user.id > b.user.id ? 1 : 0
}

/**
 * Ranked mention suggestions for `query`, deduplicated by id and capped.
 *
 * An empty query matches everyone — typing a bare '@' opens the list of
 * teammates. A query nobody matches, even fuzzily, returns nothing so the
 * caller can say so rather than fail silently.
 */
export function matchMentions<T extends MentionCandidate>(
  rawQuery: string,
  users: T[],
  limit = MENTION_SUGGESTION_LIMIT,
): MentionSuggestion<T>[] {
  const query = rawQuery.trim().toLowerCase().replace(/\s+/g, ' ')
  const tokens = query.split(' ').filter(Boolean)

  const best = new Map<string, MentionSuggestion<T>>()
  for (const user of users) {
    const kind = classify(query, tokens, user.name)
    if (!kind) continue
    const held = best.get(user.id)
    if (!held || RANK[kind] < RANK[held.kind]) best.set(user.id, { user, kind })
  }

  // Typo rescue ("deghayu" -> "Deeghayu") only once every deterministic rule has
  // come up empty, so a confident match is never second-guessed. fuzzyMatches
  // returns everything tied for the best score, which surfaces here as several
  // equally-close rows rather than a silent guess.
  if (best.size === 0) {
    for (const user of fuzzyMatches(query, users, (u) => u.name)) {
      if (!best.has(user.id)) best.set(user.id, { user, kind: 'fuzzy' })
    }
  }

  return [...best.values()].sort(compare).slice(0, limit)
}
