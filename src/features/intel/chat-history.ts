// The Ask LogPup transcript, kept per browser.
//
// WHY LOCAL AND NOT A TABLE. These answers are about right now — "who is
// carrying too much" is true at 09:00 and wrong by Thursday. Storing them
// server-side and rendering them later would put a stale finding in front of
// somebody with the same confident typography as a fresh one, and the reader
// has no way to tell. Keeping the transcript on the device that asked, with
// the time it was asked shown beside it, keeps it what it is: a record of what
// you asked, not a cache of what is true.
//
// It also costs nothing. No migration on a shared database, no rows to prune,
// no privacy question about who can read whose questions.
//
// TWO CAPS, not one. A turn count keeps the panel readable; a BYTE cap keeps
// the whole origin's localStorage alive. The quota is a few megabytes shared
// across everything LogPup stores, and an answer is model-generated prose of
// no fixed length — twenty long answers with citation lists can be hundreds of
// kilobytes. Blowing the quota does not fail politely: it throws on write, and
// the next feature to store anything is the one that breaks.

export type ChatCitation = { label: string; href: string }

export type ChatTurn = {
  /** Stable across renders; the question and time together are not unique
   *  enough (ask the same thing twice in a second and React keys collide). */
  id: string
  question: string
  answer: string
  citations: ChatCitation[]
  grounded: boolean
  model: string
  /** Epoch ms. Shown, because an answer about "right now" needs its now. */
  askedAt: number
}

export const CHAT_MAX_TURNS = 20

/**
 * Serialized ceiling. Deliberately far under the ~5MB origin quota: this is
 * one feature's share, not the budget.
 */
export const CHAT_MAX_BYTES = 128_000

/**
 * Newest first — the order the panel reads and the order eviction works from,
 * so "drop the oldest" is always the tail and never a re-sort.
 */
export function appendTurn(existing: readonly ChatTurn[], turn: ChatTurn): ChatTurn[] {
  return capBytes([turn, ...existing].slice(0, CHAT_MAX_TURNS))
}

/**
 * Trim from the OLDEST end until the serialized form fits.
 *
 * Always keeps at least one turn, even when that one turn is over the cap on
 * its own. The alternative is returning an empty list for a single huge
 * answer, which reads to the person as "it did not save my question" — and the
 * write that follows is small enough that keeping it is not the risk. A
 * genuinely enormous single answer is bounded upstream by the model's own
 * output limit.
 */
export function capBytes(turns: readonly ChatTurn[]): ChatTurn[] {
  const kept = [...turns]
  while (kept.length > 1 && serializedBytes(kept) > CHAT_MAX_BYTES) kept.pop()
  return kept
}

export function serializedBytes(turns: readonly ChatTurn[]): number {
  // The stored form's size, not the objects' — JSON is what hits the quota.
  return new TextEncoder().encode(JSON.stringify(turns)).length
}

/**
 * Tolerant by design. A corrupt or half-written entry means the transcript is
 * lost, never that the panel crashes — this is a convenience, and a person
 * whose browser wrote a truncated string still needs to ask their question.
 * Anything that does not look like a turn is dropped individually, so one bad
 * row does not take the good ones with it.
 */
export function parseChat(raw: string): ChatTurn[] {
  if (raw === '') return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed.filter(isTurn).slice(0, CHAT_MAX_TURNS)
}

function isTurn(value: unknown): value is ChatTurn {
  if (typeof value !== 'object' || value === null) return false
  const t = value as Record<string, unknown>
  return (
    typeof t.id === 'string' &&
    typeof t.question === 'string' &&
    typeof t.answer === 'string' &&
    typeof t.grounded === 'boolean' &&
    typeof t.model === 'string' &&
    typeof t.askedAt === 'number' &&
    Array.isArray(t.citations) &&
    t.citations.every(
      (c) =>
        typeof c === 'object' &&
        c !== null &&
        typeof (c as Record<string, unknown>).label === 'string' &&
        typeof (c as Record<string, unknown>).href === 'string',
    )
  )
}
