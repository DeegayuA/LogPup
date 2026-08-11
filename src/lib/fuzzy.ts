/**
 * Tiny typo-tolerant matcher for the NLP parsers. Used only as a FALLBACK after
 * exact / prefix / substring matching has found nothing, so confident matches
 * never get second-guessed and only genuine typos ("deghayu" → "Deeghayu") are
 * rescued.
 */

/** Classic Levenshtein edit distance (insert/delete/substitute = 1). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array<number>(b.length + 1)

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

/** Similarity in [0,1]: 1 is identical, 0 is nothing in common. */
export function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length)
  if (max === 0) return 1
  return 1 - levenshtein(a, b) / max
}

/**
 * Best fuzzy matches for `query` among `items`, keyed by `key`. Compares the
 * query against each item's full key AND its first word (so a mistyped first
 * name still lands), and returns every item tied for the best score at or above
 * `threshold`. A tie (> 1 result) is the caller's cue to treat it as ambiguous.
 */
export function fuzzyMatches<T>(
  query: string,
  items: T[],
  key: (item: T) => string,
  threshold = 0.72,
): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  let best = 0
  const scored = items.map((item) => {
    const name = key(item).toLowerCase()
    const score = Math.max(similarity(q, name), similarity(q, name.split(/\s+/)[0]))
    if (score > best) best = score
    return { item, score }
  })

  if (best < threshold) return []
  return scored.filter((s) => s.score === best).map((s) => s.item)
}
