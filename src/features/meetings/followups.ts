// Pure, unit-testable pieces of the person-linked follow-up carry-forward
// system. Kept free of DB/network calls on purpose — the server actions in
// ai-actions.ts fetch rows and call these functions to decide what to do
// with them.
//
// Depends on notes.ts (one direction only — notes.ts imports nothing) so that
// "what resolves a model-produced name to a person" is ONE function shared by
// the note timeline and the follow-up derivation, rather than two rules that
// can drift apart.

import { resolveSpeakerUserId, type SpeakerMapping } from '@/features/meetings/notes'
import { isTerminal } from '@/features/sprints/board-view'

import { differenceInCalendarDays } from 'date-fns'

export type FollowupKind = 'question' | 'action'

export type AttendeeRef = { id: string; name: string }

/**
 * Resolves a raw, as-spoken person name (from the AI transcript) to an
 * attendee's user id.
 *
 * Tries an exact, case-insensitive full-name match first. If that's
 * ambiguous (two attendees share a name) it gives up rather than guess.
 * Otherwise falls back to matching the name against attendees' first names,
 * but only when exactly one attendee's first name matches — two "John"s in
 * the room means neither gets credited automatically.
 *
 * Returns null (never throws) when nothing unambiguous is found; callers
 * keep the raw personName either way and just leave userId unset.
 */
export function matchPersonToAttendee(
  personName: string,
  attendees: AttendeeRef[],
): string | null {
  const needle = personName.trim().toLowerCase()
  if (!needle) return null

  const exactMatches = attendees.filter((a) => a.name.trim().toLowerCase() === needle)
  if (exactMatches.length === 1) return exactMatches[0].id
  if (exactMatches.length > 1) return null

  const firstNameMatches = attendees.filter((a) => {
    const first = a.name.trim().toLowerCase().split(/\s+/)[0]
    return first === needle
  })
  if (firstNameMatches.length === 1) return firstNameMatches[0].id

  return null
}

export type DerivedFollowupRow = {
  sourceMeetingId: string
  userId: string | null
  personName: string
  text: string
  kind: FollowupKind
}

/**
 * Turns the model's per-person notes and prep questions into follow-up rows.
 *
 * The person name here is a MODEL GUESS in exactly the way a speaker label is:
 * the analysis prompt asks Gemini to attribute points and action items to
 * named people, and it will happily name someone who was discussed rather than
 * speaking. So attribution goes through resolveSpeakerUserId against the
 * meeting's confirmed `meeting_speakers` mappings — the same single rule the
 * note timeline uses — and NOT through matchPersonToAttendee, which would
 * resolve any label that happens to match an attendee's name and render the
 * guess as fact. That was the bug: an unconfirmed match here silently made a
 * real person owe work they never agreed to, and carried it into every future
 * meeting they attended.
 *
 * `personName` always keeps the raw text, mapped or not, so nothing the model
 * observed is lost — an unresolved row renders that name as a LABEL and stays
 * assignable by a human (assignFollowupPerson).
 */
export function buildFollowupRows(
  sourceMeetingId: string,
  perPerson: { name: string; actionItems?: string[] }[],
  questions: { person: string; questions?: string[] }[],
  mappings: SpeakerMapping[],
): DerivedFollowupRow[] {
  const rows: DerivedFollowupRow[] = []

  for (const person of perPerson) {
    if (!person.name) continue
    const userId = resolveSpeakerUserId(person.name, mappings)
    for (const action of person.actionItems ?? []) {
      if (!action) continue
      rows.push({ sourceMeetingId, userId, personName: person.name, text: action, kind: 'action' })
    }
  }

  for (const entry of questions) {
    if (!entry.person) continue
    const userId = resolveSpeakerUserId(entry.person, mappings)
    for (const question of entry.questions ?? []) {
      if (!question) continue
      rows.push({
        sourceMeetingId,
        userId,
        personName: entry.person,
        text: question,
        kind: 'question',
      })
    }
  }

  return rows
}

export type OpenFollowupItem = {
  id: string
  userId: string | null
  personName: string
  text: string
  kind: FollowupKind
  sourceMeetingId: string
  sourceMeetingTitle: string
  sourceMeetingStartsAt: Date
}

export type CarriedForwardEntry = {
  id: string
  text: string
  kind: FollowupKind
  fromTitle: string
  fromDate: Date
  sourceMeetingId: string
  /** Calendar days since the source meeting, as of the `now` selectCarriedForward was called with. */
  ageDays: number
  /** True once ageDays reaches CARRY_STALE_DAYS — old enough that "still open" stops being informative. */
  stale: boolean
}

export type CarriedForwardGroup = {
  userId: string
  person: string
  /** Oldest-first, capped at MAX_CARRIED_PER_PERSON — see overflowCount for what's left out. */
  items: CarriedForwardEntry[]
  /** How many more open items this person has beyond what `items` shows. Never silently dropped. */
  overflowCount: number
}

/**
 * How many carried items one person's group renders before the rest collapse
 * into "N more". A person who has attended 20 meetings with nothing resolved
 * would otherwise face a wall of prep indistinguishable from today's — the
 * cap forces exactly the oldest, most-overdue items into view (see the
 * oldest-first sort in selectCarriedForward) and names the rest as a count
 * instead of hiding them outright.
 */
export const MAX_CARRIED_PER_PERSON = 5

/**
 * Calendar days an open follow-up can carry before it's flagged stale. Same
 * value as FOLLOWUP_STALE_DAYS in meeting-notes-model.ts (the panel's own
 * visual "carried N days" tone threshold) — one definition of "stale" for
 * the carry-forward system, kept here so the pure selection function can
 * report it as data rather than the UI silently recomputing its own answer.
 */
export const CARRY_STALE_DAYS = 21

/**
 * Given a set of currently-open follow-up items (already filtered to ones
 * whose source meeting is earlier than the target meeting and readable by
 * the caller — see ai-actions.ts) and the target meeting's attendee ids,
 * keeps only items attributed to an attendee and groups them by person.
 *
 * Group order follows first appearance in `openItems`. Within a group, items
 * are sorted OLDEST FIRST (by source meeting date) so the most-overdue items
 * are what a reader sees — and, combined with the MAX_CARRIED_PER_PERSON cap,
 * what survives truncation — rather than being buried under whatever was
 * raised most recently. `now` is the reference point for age/staleness;
 * callers pass the actual current time, not the target meeting's date, so
 * "how stale is this" answers the question honestly regardless of when the
 * meeting it's carried into happens to be scheduled.
 */
export function selectCarriedForward(
  openItems: OpenFollowupItem[],
  attendeeIds: string[],
  now: Date,
): CarriedForwardGroup[] {
  const attendeeSet = new Set(attendeeIds)
  const order: string[] = []
  const byUser = new Map<string, CarriedForwardGroup>()

  for (const item of openItems) {
    if (!item.userId || !attendeeSet.has(item.userId)) continue
    let group = byUser.get(item.userId)
    if (!group) {
      group = { userId: item.userId, person: item.personName, items: [], overflowCount: 0 }
      byUser.set(item.userId, group)
      order.push(item.userId)
    }
    const ageDays = Math.max(0, differenceInCalendarDays(now, item.sourceMeetingStartsAt))
    group.items.push({
      id: item.id,
      text: item.text,
      kind: item.kind,
      fromTitle: item.sourceMeetingTitle,
      fromDate: item.sourceMeetingStartsAt,
      sourceMeetingId: item.sourceMeetingId,
      ageDays,
      stale: ageDays >= CARRY_STALE_DAYS,
    })
  }

  return order.map((userId) => {
    const group = byUser.get(userId)!
    // Array#sort is stable (ES2019+), so items raised at the same source
    // meeting keep their original relative order.
    const sorted = group.items.slice().sort((a, b) => a.fromDate.getTime() - b.fromDate.getTime())
    const visible = sorted.slice(0, MAX_CARRIED_PER_PERSON)
    return {
      userId: group.userId,
      person: group.person,
      items: visible,
      overflowCount: sorted.length - visible.length,
    }
  })
}

/**
 * Open follow-ups the model named someone for but couldn't unambiguously
 * resolve to a user (nickname, misspelling, a client contact who isn't a
 * LogPup user at all). These never enter selectCarriedForward's groups —
 * there is no person to carry a person-less item TO — so without surfacing
 * them some other way they simply disappear the moment they're inserted.
 * Callers pass this a meeting's own open follow-ups (source meeting = the
 * meeting being viewed, not carried-in items) so they can be shown as
 * "Needs attribution" on the one meeting that can actually explain them.
 */
export function selectUnattributed(items: OpenFollowupItem[]): OpenFollowupItem[] {
  return items.filter((item) => item.userId === null)
}

/**
 * Whitelists model-returned ids against the set of ids it was actually
 * given. Used for the "which open follow-ups did this meeting address"
 * pass — the model must not be trusted to invent ids, only to select from
 * the list it was handed.
 */
export function filterValidIds(candidateIds: string[], validIds: string[]): string[] {
  const valid = new Set(validIds)
  const seen = new Set<string>()
  const result: string[] = []
  for (const id of candidateIds) {
    if (valid.has(id) && !seen.has(id)) {
      seen.add(id)
      result.push(id)
    }
  }
  return result
}

/* --- follow-up <-> task-suggestion text matching ----------------------- */

// Common English filler words stripped before comparing two pieces of task
// text. Short and deliberately conservative — the goal is dropping words
// that appear in almost every sentence regardless of subject (articles,
// prepositions, auxiliary verbs), not stemming or a real NLP pipeline. A
// word that carries meaning in some follow-ups (e.g. "with" in "sync with
// the client") is accepted collateral: losing a little precision on both
// sides of a comparison cancels out, where a home-grown stemmer would not.
const MATCH_STOPWORDS = new Set([
  'a', 'an', 'the', 'to', 'for', 'of', 'and', 'or', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'in', 'on', 'at', 'with', 'that', 'this', 'it', 'as',
  'from', 'by', 'up', 'about', 'into', 'over', 'after', 'before', 'so', 'than',
])

/**
 * Lowercases, strips punctuation (kept-Unicode-letter/number aware, so this
 * degrades gracefully on non-Latin names/terms rather than mangling them),
 * and drops stopwords — the shared normalization both sides of a text
 * comparison go through before anything is measured.
 */
function normalizeMatchTokens(text: string): string[] {
  return text
    .toLowerCase()
    // \p{M} and ZWJ (‍) stay: Sinhala vowel signs and the al-lakuna are
    // combining marks, and stripping them shatters every Sinhala word into
    // consonant fragments — unrelated Sinhala texts then share enough
    // fragments to cross the match threshold and auto-link (and later
    // auto-resolve) the wrong follow-up.
    .replace(/[^\p{L}\p{M}\p{N}\s‍]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0 && !MATCH_STOPWORDS.has(word))
}

/**
 * Jaccard similarity (intersection over union) of the two texts' normalized
 * token sets — 0 for nothing in common, 1 for the same set of meaningful
 * words. Token-set overlap tolerates reordering and minor rewording ("Send
 * the client the revised proposal" vs "Send revised proposal to client")
 * far better than an edit-distance/substring measure would, without pulling
 * in an embedding model for what is, in practice, short imperative
 * sentences describing the same piece of work.
 *
 * Returns exactly 0 for empty/whitespace-only input on either side rather
 * than throwing or producing NaN (0/0) — a blank follow-up or suggestion
 * text should never accidentally "match" everything.
 */
export function followupTaskSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalizeMatchTokens(a))
  const tokensB = new Set(normalizeMatchTokens(b))
  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let intersection = 0
  for (const token of tokensA) if (tokensB.has(token)) intersection += 1
  const union = tokensA.size + tokensB.size - intersection
  return union === 0 ? 0 : intersection / union
}

/**
 * The line between "same piece of work, reworded" and "two different
 * things that happen to share a word or two". Chosen high (rather than,
 * say, 0.25) on purpose: linking a task to the wrong follow-up is worse
 * than not linking one at all — a false link auto-resolves someone's real
 * open question the moment an unrelated task is finished, which is quiet
 * and easy to miss, where a missed link just leaves both items visible for
 * a person to connect by hand.
 */
export const FOLLOWUP_TASK_MATCH_THRESHOLD = 0.5

export type FollowupMatchCandidate = { id: string; userId: string | null; text: string }

/**
 * Finds the best-matching OPEN follow-up for a task suggestion being turned
 * into a real task — the pure decision behind "record the link" in
 * ai-actions.ts (acceptTaskSuggestion, and the auto-assign path). A match
 * requires BOTH: the same person (no userId on either side never matches —
 * `null === null` would otherwise pair every unattributed follow-up with
 * every unassigned suggestion), and text similarity at or above
 * FOLLOWUP_TASK_MATCH_THRESHOLD. Among ties/multiple qualifying candidates,
 * the highest-scoring one wins; ties keep whichever came first in
 * `candidates`, same "stable, first-seen wins" spirit as filterValidIds.
 * Returns null (never throws) when nothing clears the bar.
 */
export function findMatchingFollowup(
  suggestion: { assigneeId: string | null; text: string },
  candidates: FollowupMatchCandidate[],
): string | null {
  if (!suggestion.assigneeId) return null

  let best: { id: string; score: number } | null = null
  for (const candidate of candidates) {
    if (candidate.userId !== suggestion.assigneeId) continue
    const score = followupTaskSimilarity(candidate.text, suggestion.text)
    if (score >= FOLLOWUP_TASK_MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { id: candidate.id, score }
    }
  }
  return best?.id ?? null
}

/* --- task completion <-> follow-up resolution --------------------------- */

export type TaskLikeStatus = 'todo' | 'in_progress' | 'done'
export type FollowupResolutionDecision = 'resolve' | 'reopen' | 'none'

/**
 * What a linked follow-up should do when the task that closes it changes
 * status. Symmetric on purpose: a task freshly moved TO 'done' resolves its
 * linked follow-up, and one moved back OUT of 'done' (a mis-click, or work
 * that turned out to be incomplete) reopens it — otherwise a mis-click would
 * permanently hide a question that is, in fact, still open. Any transition
 * that doesn't cross the done/not-done line (todo -> in_progress, or a
 * no-op update that resends the same status) is 'none'.
 */
export function decideFollowupResolutionOnTaskStatusChange(
  fromStatus: TaskLikeStatus,
  toStatus: TaskLikeStatus,
): FollowupResolutionDecision {
  const wasDone = isTerminal(fromStatus)
  const isDone = isTerminal(toStatus)
  if (wasDone === isDone) return 'none'
  return isDone ? 'resolve' : 'reopen'
}
