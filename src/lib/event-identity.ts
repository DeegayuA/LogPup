/**
 * Is this Google event the same meeting as this LogPup row?
 *
 * Pure — no database, no Google client. The decision only, so it can be
 * exhaustively tested; the sync loop that calls it lives elsewhere. This is
 * the part that must not be wrong.
 *
 * THE ASYMMETRY THAT SHAPES EVERYTHING HERE: the two mistakes are not equally
 * bad. Showing one meeting twice is untidy and self-correcting — somebody sees
 * the duplicate and links them. Merging two DIFFERENT meetings hides one, and
 * the one that disappears is invisible precisely because it disappeared:
 * nobody can miss what they never saw. A client call quietly absorbed into a
 * stand-up is a meeting somebody does not attend. It is also this product's
 * characteristic calendar failure — the write returns ok and the thing that
 * did not happen goes to console.error — except that a bad merge destroys rows
 * rather than skipping a write.
 *
 * So there are three verdicts, not two, and every one carries a REASON: a
 * person resolving an `uncertain` needs to know which signal was ambiguous.
 * "Same time and title, no attendees in common" is a different question from
 * "same people, different time", and a bare verdict cannot tell them apart.
 *
 * Any later change that collapses `uncertain` into `same` to tidy duplicates
 * is trading a visible annoyance for an invisible failure.
 */

export type IdentityVerdict = 'same' | 'uncertain' | 'different'

export type IdentityReason =
  /** An id we wrote, or a link a person confirmed. */
  | 'linked'
  /** This meeting is linked to some other Google event, so it is not this one. */
  | 'linked-elsewhere'
  /** Start times are further apart than the slot tolerance. */
  | 'different-time'
  /** Same slot, near-identical title, nothing objecting. */
  | 'title-and-slot'
  /** Same slot and title, but the durations disagree by too much to be sure. */
  | 'duration-gap'
  /** Same slot and title, and not one attendee in common. */
  | 'no-attendee-overlap'
  /** Same slot, titles share something but not enough to decide. */
  | 'weak-title'
  /** Same slot, titles unlike, but nearly the same people. */
  | 'attendees-only'
  /** Same slot and nothing else agrees. */
  | 'no-signal'

export type Identification = {
  verdict: IdentityVerdict
  reason: IdentityReason
}

export type CandidateMeeting = {
  title: string
  /** Epoch milliseconds — instants, not calendar days, so no timezone can turn
   *  two different times into one. */
  startsAtMs: number
  endsAtMs: number
  /** Attendee emails. An empty list is common and must never imply a match. */
  attendeeEmails: readonly string[]
}

export type CandidateEvent = CandidateMeeting & {
  /** Google's own id for the event. */
  eventId: string
  /** Present on an occurrence of a series (Google's `recurringEventId`). Two
   *  occurrences of one series are DIFFERENT meetings, however alike. */
  recurringEventId?: string | null
}

/**
 * Google event ids already known to BE this meeting.
 *
 * A list rather than the single `meetings.google_event_id` column, deliberately
 * and at the sync owner's request: one meeting is about to be linkable to more
 * than one event — the same gathering seen from two accounts, and an occurrence
 * belonging to a series — so a function that assumed one id would need
 * rewriting the day the schema changed. Empty means "never linked", which is
 * the normal state of anything imported.
 */
export type KnownLinks = readonly string[]

/**
 * Start times within this count as the same slot. Five minutes because
 * calendars round, people nudge a meeting by a few minutes, and Google returns
 * second-precision instants for events entered to the minute — while two
 * genuinely different meetings are almost never five minutes apart.
 */
export const START_TOLERANCE_MS = 5 * 60 * 1000

/** Durations may differ by this much and still be one meeting: somebody
 *  extended it by a quarter of an hour. */
export const DURATION_TOLERANCE_MS = 15 * 60 * 1000

/**
 * Strip what a calendar adds and a person does not mean: reply and forward
 * prefixes, punctuation, emoji. None of it changes which meeting this is.
 */
export function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^(re|fwd|fw|updated|cancelled|canceled)\s*:\s*/i, '')
    // Anything that is not a letter, digit or COMBINING MARK becomes a space.
    // \p{M} is load-bearing and was missing on the first pass: Sinhala vowel
    // signs are marks, not letters, so [^\p{L}\p{N}] stripped them and turned
    // "සති" into "සත" — silently mangling every title in one of the two
    // languages this product is written in, and scoring two identical Sinhala
    // titles as less alike than they are. Same for Tamil and Devanagari.
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim()
}

/**
 * Token overlap, symmetric, 0..1. Jaccard rather than a substring test, so
 * "Kestrel weekly sync" and "Weekly sync Kestrel" score identically — word
 * order in a meeting title carries no meaning.
 */
export function titleSimilarity(a: string, b: string): number {
  const left = new Set(normaliseTitle(a).split(' ').filter(Boolean))
  const right = new Set(normaliseTitle(b).split(' ').filter(Boolean))
  if (left.size === 0 || right.size === 0) return 0
  let shared = 0
  for (const token of left) if (right.has(token)) shared += 1
  return shared / (left.size + right.size - shared)
}

/**
 * Fraction of the smaller attendee set present in the larger, or null when
 * either side has none.
 *
 * Null rather than 0: absence of evidence is not evidence of difference, and
 * scoring an empty roster as total disagreement would make every meeting
 * nobody was invited to look like a different meeting.
 */
export function attendeeOverlap(a: readonly string[], b: readonly string[]): number | null {
  if (a.length === 0 || b.length === 0) return null
  const left = new Set(a.map((e) => e.trim().toLowerCase()))
  const right = new Set(b.map((e) => e.trim().toLowerCase()))
  let shared = 0
  for (const email of left) if (right.has(email)) shared += 1
  return shared / Math.min(left.size, right.size)
}

const TITLE_STRONG = 0.8
const TITLE_WEAK = 0.4
const ATTENDEE_STRONG = 0.8

/**
 * The verdict. Cheap certainties first; judgement calls reached only when
 * nothing decisive is available.
 */
export function identifyEvent(
  meeting: CandidateMeeting,
  event: CandidateEvent,
  links: KnownLinks = [],
): Identification {
  // 1. We already know. A confirmed link is not a heuristic and is never
  //    second-guessed by one — including when every other signal disagrees,
  //    because a person renaming and moving a meeting is ordinary.
  if (links.length > 0) {
    return links.includes(event.eventId)
      ? { verdict: 'same', reason: 'linked' }
      : { verdict: 'different', reason: 'linked-elsewhere' }
  }

  // 2. Time gates everything below, because it is the least ambiguous signal
  //    available: two meetings at genuinely different times are different
  //    meetings however identical their titles — which is precisely what a
  //    weekly stand-up looks like week to week.
  if (Math.abs(meeting.startsAtMs - event.startsAtMs) > START_TOLERANCE_MS) {
    return { verdict: 'different', reason: 'different-time' }
  }

  const durationApart = Math.abs(
    meeting.endsAtMs - meeting.startsAtMs - (event.endsAtMs - event.startsAtMs),
  )
  const title = titleSimilarity(meeting.title, event.title)
  const overlap = attendeeOverlap(meeting.attendeeEmails, event.attendeeEmails)

  // 3. Same slot and near enough the same words.
  if (title >= TITLE_STRONG) {
    // A large duration gap holds this at uncertain rather than deciding: an
    // hour where we expected fifteen minutes may be a different booking that
    // happens to start at the same moment.
    if (durationApart > DURATION_TOLERANCE_MS) {
      return { verdict: 'uncertain', reason: 'duration-gap' }
    }
    // Attendees can veto when BOTH sides have them: same slot, same words, and
    // not one person in common is two teams using one name.
    if (overlap !== null && overlap === 0) {
      return { verdict: 'uncertain', reason: 'no-attendee-overlap' }
    }
    return { verdict: 'same', reason: 'title-and-slot' }
  }

  // 4. Titles sharing little. Strong attendee agreement makes it worth ASKING
  //    about and never worth deciding — a renamed meeting and a coincidental
  //    clash are indistinguishable from this data.
  if (title >= TITLE_WEAK) return { verdict: 'uncertain', reason: 'weak-title' }
  if (overlap !== null && overlap >= ATTENDEE_STRONG) {
    return { verdict: 'uncertain', reason: 'attendees-only' }
  }

  return { verdict: 'different', reason: 'no-signal' }
}

/**
 * Whether these may be linked without asking anyone.
 *
 * A named predicate rather than `=== 'same'` at each call site, so the rule
 * keeps one home: only a certainty merges silently. Everything else goes in
 * front of somebody who knows which meeting they are in.
 */
export function canAutoMerge(id: Identification): boolean {
  return id.verdict === 'same'
}

/** What to tell the person resolving an uncertain match. */
export const REASON_SENTENCE: Record<IdentityReason, string> = {
  linked: 'Already linked to this event.',
  'linked-elsewhere': 'This meeting is linked to a different Google event.',
  'different-time': 'Starts at a different time.',
  'title-and-slot': 'Same title, same time.',
  'duration-gap': 'Same title and start, but the lengths differ — check before merging.',
  'no-attendee-overlap': 'Same title and time, but no attendees in common.',
  'weak-title': 'Same time, and the titles are only partly alike.',
  'attendees-only': 'Same time and nearly the same people, but the titles differ.',
  'no-signal': 'Only the start time matches.',
}
