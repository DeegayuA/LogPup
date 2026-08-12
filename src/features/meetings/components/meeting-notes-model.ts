// Turns what the model wrote about a meeting into the shapes the notes panel
// actually renders: one merged action list with an owner and a due date, a
// due-date status that decides whether a row gets the danger colour, how long
// a follow-up has been carried, and the handful of counts a collapsed meeting
// row shows.
//
// Colocated with the components (see meeting-glance.ts for why) and pure: the
// input types are declared structurally rather than imported from
// ai-actions.ts so this module — and its test — never pull a 'use server'
// file, a database client, or an auth session into scope.

import { differenceInCalendarDays, isValid, parse } from 'date-fns'

/* --- due dates -------------------------------------------------------- */

/**
 * `due` on a model-produced deadline is documented in the prompt as "date or
 * phrase as spoken", so it is genuinely free text: "2026-08-20", "next
 * Friday", "before the client call", "end of the month". Anything we cannot
 * resolve to a real day stays 'unparsed' and is rendered as the words the
 * model wrote, with no colour — inventing a date from "next Friday" would
 * mean guessing which Friday, and a wrong overdue flag is worse than none.
 */
export type DueStatus = 'overdue' | 'today' | 'soon' | 'scheduled' | 'unparsed' | 'unscheduled'

/** Days from today inside which a real, future due date reads as "soon". */
export const DUE_SOON_DAYS = 3

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/

/**
 * Formats we accept beyond ISO. All of them carry an explicit four-digit
 * year, and none of them is all-numeric: "03/04/2026" is March 4th to an
 * American and April 3rd to everyone else, and the model is told to write
 * what was *said*, so there is no way to know which convention it copied.
 * A silently wrong deadline is the one failure mode this list exists to
 * avoid, so ambiguous numeric formats are left unparsed on purpose.
 */
const SPOKEN_FORMATS = [
  'yyyy-MM-dd',
  'MMMM d, yyyy',
  'MMM d, yyyy',
  'MMMM d yyyy',
  'MMM d yyyy',
  'd MMMM yyyy',
  'd MMM yyyy',
]

/** Resolves a spoken/written due date to a real day, or null if it is a phrase. */
export function parseSpokenDueDate(raw: string | null | undefined): Date | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null

  // An ISO value may carry a time we don't care about; everything else may
  // carry a sentence-ending full stop.
  const candidate = ISO_DATE.test(trimmed) ? trimmed.slice(0, 10) : trimmed.replace(/\.$/, '')

  // date-fns `parse` with an explicit format is strict about both shape and
  // range — it rejects 2026-02-31 outright, where `new Date('2026-02-31')`
  // silently rolls over to March 3rd in V8 and would report a deadline that
  // was never said. The reference date only fills in fields the format does
  // not mention, and every format above supplies its own year, month and day,
  // so it never leaks into the result.
  const reference = new Date(2000, 0, 1)
  for (const format of SPOKEN_FORMATS) {
    const parsed = parse(candidate, format, reference)
    if (isValid(parsed)) return parsed
  }
  return null
}

export function dueStatus(raw: string | null | undefined, now: Date): DueStatus {
  if (!raw?.trim()) return 'unscheduled'
  const parsed = parseSpokenDueDate(raw)
  if (!parsed) return 'unparsed'
  const days = differenceInCalendarDays(parsed, now)
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days <= DUE_SOON_DAYS) return 'soon'
  return 'scheduled'
}

/* --- the merged action list ------------------------------------------- */

type PerPersonLike = { name: string; points: string[]; actionItems: string[] }
type DeadlineLike = { item: string; owner: string; due: string }

export type ActionRow = {
  /** Stable React key — the normalized text, which is also the merge key. */
  key: string
  text: string
  owner: string | null
  /** The due date exactly as the model wrote it, for display when unparsed. */
  due: string | null
  dueDate: Date | null
  status: DueStatus
}

/** Lowercased, whitespace-collapsed, trailing punctuation dropped. */
function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!;:]+$/, '')
}

/**
 * Whether two already-normalized owner strings name the same person.
 *
 * `deadlines[].owner` is free text written as the name was *spoken*
 * ("Nadeesha") while `perPerson[].name` is the fuller form the model settled
 * on ("Nadeesha Perera"), so an exact match is too strict to join the two
 * halves of one commitment. A prefix-on-a-word-boundary match covers the
 * first-name/full-name pair without matching two genuinely different people
 * (substring matching would make "Amal" the same person as "Kamal").
 */
function sameOwner(a: string, b: string): boolean {
  if (a === b) return true
  return a.startsWith(`${b} `) || b.startsWith(`${a} `)
}

const STATUS_RANK: Record<DueStatus, number> = {
  overdue: 0,
  today: 1,
  soon: 2,
  scheduled: 3,
  unparsed: 4,
  unscheduled: 5,
}

/**
 * One scannable list of everything somebody owes after this meeting.
 *
 * The model returns the same commitment twice in two different shapes:
 * `deadlines[]` has the due date but a free-text owner, and
 * `perPerson[].actionItems[]` has the reliable owner but no date. Rendering
 * them as two separate sections (what the panel used to do) means a reader
 * has to join them by eye to answer "who owes what, by when" — the single
 * question the section exists for. Merging on normalized text gives each row
 * both halves; anything that appears in only one of the two still shows up,
 * with the half it has.
 *
 * Matching on text ALONE is not enough, and that is the subtle part: two
 * people can be handed the same-worded job ("Update the status doc"), and
 * folding those into one row would delete one person's assignment — the exact
 * failure this list exists to prevent. So a mention only merges into an
 * existing row when that row has no owner yet, the mention has no owner, or
 * the two owners name the same person (see sameOwner). Otherwise it becomes
 * its own row, keyed by text AND owner so React still has a unique key.
 *
 * Ordering is by urgency, not by source: overdue, due today, due soon, dated,
 * then undated. Within a rank the input order is preserved (deadlines before
 * per-person items) so the list is stable across re-renders.
 */
export function buildActionList(
  notes: { perPerson: PerPersonLike[]; deadlines: DeadlineLike[] },
  now: Date,
): ActionRow[] {
  // The normalized text/owner a row was matched on is bookkeeping, not
  // something the panel renders, so it rides alongside the row rather than
  // widening the exported ActionRow type.
  type Draft = { row: ActionRow; textKey: string; ownerKey: string | null }
  const drafts: Draft[] = []

  function add(text: string, rawOwner: string | null, rawDue: string | null) {
    const trimmed = text.trim()
    if (!trimmed) return
    const textKey = normalize(trimmed)
    const owner = rawOwner?.trim() ? rawOwner.trim() : null
    const ownerKey = owner ? normalize(owner) : null
    const due = rawDue?.trim() ? rawDue.trim() : null

    // Linear scan rather than a Map: the match is owner-sensitive, and a
    // meeting's action list is a handful of rows, never a hot loop.
    const match = drafts.find(
      (draft) =>
        draft.textKey === textKey &&
        (draft.ownerKey === null || ownerKey === null || sameOwner(draft.ownerKey, ownerKey)),
    )
    if (match) {
      // Two sources describing one commitment: keep whichever half each
      // source actually has rather than letting the later one blank it.
      if (!match.row.owner && owner) {
        match.row.owner = owner
        match.ownerKey = ownerKey
      }
      if (!match.row.due && due) {
        match.row.due = due
        match.row.dueDate = parseSpokenDueDate(due)
        match.row.status = dueStatus(due, now)
      }
      return
    }
    drafts.push({
      textKey,
      ownerKey,
      row: {
        key: ownerKey ? `${textKey}#${ownerKey}` : textKey,
        text: trimmed,
        owner,
        due,
        dueDate: parseSpokenDueDate(due),
        status: dueStatus(due, now),
      },
    })
  }

  for (const deadline of notes.deadlines) add(deadline.item, deadline.owner, deadline.due)
  for (const person of notes.perPerson) {
    for (const item of person.actionItems) add(item, person.name, null)
  }
  const rows = drafts.map((draft) => draft.row)

  // Array.prototype.sort has been required to be stable since ES2019, which
  // is what keeps equal-ranked rows in the order they were added rather than
  // shuffling between renders.
  return rows.slice().sort((a, b) => {
    const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status]
    if (rank !== 0) return rank
    if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime()
    return 0
  })
}

/**
 * Whether two pieces of note text are the same writing.
 *
 * finalizeMeetingRecording stores the AI summary twice on purpose: once on
 * meeting_ai_notes.summary and once as an 'ai' segment in the timeline (see
 * insertAutoNotesAndSuggestions). The panel now renders the summary at the
 * top at full size, so the timeline copy below it is a duplicate — but only
 * when it really is the same text, which is why this compares content rather
 * than assuming every 'ai' segment is the summary. A meeting analyzed before
 * the segment-insert existed, or one where somebody edited the segment
 * afterwards, keeps both.
 */
export function isSameNoteText(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return a.trim().replace(/\s+/g, ' ') === b.trim().replace(/\s+/g, ' ')
}

/* --- carried-forward follow-ups --------------------------------------- */

/** Days an open follow-up can be carried before it reads as slipping. */
export const FOLLOWUP_AGING_DAYS = 7
export const FOLLOWUP_STALE_DAYS = 21

export type FollowupAge = {
  days: number
  tone: 'fresh' | 'aging' | 'stale'
  label: string
}

/**
 * How long an open follow-up has been carried, measured from the meeting it
 * came out of. The panel used to distinguish open from resolved with a 20%
 * alpha step on the same muted fill — which is to say, not at all — and said
 * nothing whatsoever about an item that had been rolling forward for a month.
 * 'stale' is the only tone that earns the danger colour.
 */
export function followupAge(fromDate: Date, now: Date): FollowupAge {
  const days = Math.max(0, differenceInCalendarDays(now, fromDate))
  const tone = days >= FOLLOWUP_STALE_DAYS ? 'stale' : days >= FOLLOWUP_AGING_DAYS ? 'aging' : 'fresh'
  const label =
    days === 0 ? 'Raised today' : days === 1 ? 'Carried 1 day' : `Carried ${days} days`
  return { days, tone, label }
}

/* --- the collapsed row's glance --------------------------------------- */

type IntelLike = {
  notes: {
    summary: string | null
    perPerson: PerPersonLike[]
    deadlines: DeadlineLike[]
    questions: { person: string; questions: string[] }[]
    createdAt: Date
  } | null
  prep: {
    items: { status: 'open' | 'resolved'; fromDate: Date }[]
  }[]
}

export type MeetingGlance = {
  hasNotes: boolean
  analyzedAt: Date | null
  /** Commitments the AI notes recorded, after merging (see buildActionList). */
  actions: number
  /** Merged actions already past their due date. */
  overdueActions: number
  openFollowups: number
  /** Open follow-ups carried past FOLLOWUP_STALE_DAYS. */
  staleFollowups: number
  questions: number
}

/**
 * Everything a collapsed meeting row can say about what the meeting produced.
 * The panel below it fetches this intel anyway; before this, the row spent
 * that request and then displayed nothing from it, so the only way to learn
 * whether a meeting produced anything was to open all of them.
 */
export function glanceFromIntel(intel: IntelLike, now: Date): MeetingGlance {
  const actions = intel.notes ? buildActionList(intel.notes, now) : []
  let openFollowups = 0
  let staleFollowups = 0
  for (const group of intel.prep) {
    for (const item of group.items) {
      if (item.status !== 'open') continue
      openFollowups += 1
      if (followupAge(item.fromDate, now).tone === 'stale') staleFollowups += 1
    }
  }

  return {
    hasNotes: intel.notes !== null,
    analyzedAt: intel.notes?.createdAt ?? null,
    actions: actions.length,
    overdueActions: actions.filter((action) => action.status === 'overdue').length,
    openFollowups,
    staleFollowups,
    questions: (intel.notes?.questions ?? []).reduce(
      (total, entry) => total + entry.questions.length,
      0,
    ),
  }
}
