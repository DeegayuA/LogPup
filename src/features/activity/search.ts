import { similarity } from '@/lib/fuzzy'
import type { ActivityRow } from '@/features/activity/types'

/**
 * Layer 2 of /activity search: typo tolerance, entirely in pure TS, over
 * rows Layer 1 (features/activity/filters.ts's activitySearchCondition)
 * already returned — or, when that layer found nothing at all, over an
 * unfiltered page (see the /activity page's fallback). SQL `ilike` cannot
 * tolerate a misspelling: "meetign" matches nothing however good the pattern
 * is. Levenshtein similarity (src/lib/fuzzy.ts) can.
 */

/**
 * The same four columns activitySearchCondition searches in SQL, joined into
 * one haystack. Kept deliberately in sync with that list — what counts as a
 * "match" shouldn't quietly drift between the SQL layer and this one.
 */
export function activityRowSearchText(row: ActivityRow): string {
  return [row.entityLabel, row.detail, row.verb, row.entityType].filter(Boolean).join(' ')
}

function tokenize(q: string): string[] {
  return q.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

/** Splits a haystack into words, discarding punctuation. */
function words(haystack: string): string[] {
  return haystack.split(/[^a-z0-9]+/i).filter(Boolean)
}

/** Best similarity between `token` and any individual word of `haystackWords`. */
function bestWordSimilarity(token: string, haystackWords: string[]): number {
  let best = 0
  for (const word of haystackWords) {
    const score = similarity(token, word)
    if (score > best) best = score
  }
  return best
}

/**
 * Re-ranks rows by relevance instead of leaving them in whatever order the
 * caller handed them in (normally SQL's chronological `created_at desc`).
 * Keeps a row only if its text contains at least one query token verbatim —
 * true by construction of every row Layer 1 already returned, re-checked
 * here so this degrades safely if it's ever handed unfiltered rows — then
 * orders the survivors by the average best per-token word similarity,
 * descending. Ties keep their original relative order (stable).
 *
 * An empty/whitespace query is a no-op: rows come back exactly as given.
 */
export function rankActivityMatches<T>(rows: T[], q: string, text: (row: T) => string): T[] {
  const tokens = tokenize(q)
  if (tokens.length === 0) return rows

  const scored: { row: T; score: number; index: number }[] = []
  rows.forEach((row, index) => {
    const haystack = text(row).toLowerCase()
    if (!tokens.some((token) => haystack.includes(token))) return
    const haystackWords = words(haystack)
    const score =
      tokens.reduce((sum, token) => sum + bestWordSimilarity(token, haystackWords), 0) / tokens.length
    scored.push({ row, score, index })
  })

  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((s) => s.row)
}

// Comfortably below a genuine one-transposition typo's similarity
// ("meetign" vs "meeting" scores ~0.714) and comfortably above two unrelated
// words' (which land at or near 0) — see search.test.ts for the numbers this
// is tuned against. Distinct from fuzzy.ts's 0.72 default, which is tuned for
// short single-word name matching rather than free-text rows.
const FALLBACK_THRESHOLD = 0.65

/**
 * "Close but not exact" matches, for when Layer 1's SQL search found nothing
 * at all. The caller re-queries WITHOUT `q` (bounded to the normal page
 * size) and hands the result here. Unlike rankActivityMatches, there is no
 * substring gate — a row qualifies purely on fuzzy similarity, which is the
 * whole point: a misspelling is, by definition, not a substring match.
 *
 * An empty/whitespace query returns no rows — there's nothing to be a fuzzy
 * match FOR.
 */
export function fuzzyActivityFallback<T>(rows: T[], q: string, text: (row: T) => string): T[] {
  const tokens = tokenize(q)
  if (tokens.length === 0) return []

  const scored: { row: T; score: number; index: number }[] = []
  rows.forEach((row, index) => {
    const haystackWords = words(text(row).toLowerCase())
    if (haystackWords.length === 0) return
    const score =
      tokens.reduce((sum, token) => sum + bestWordSimilarity(token, haystackWords), 0) / tokens.length
    if (score >= FALLBACK_THRESHOLD) scored.push({ row, score, index })
  })

  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((s) => s.row)
}
