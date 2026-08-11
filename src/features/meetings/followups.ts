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
}

export type CarriedForwardGroup = {
  userId: string
  person: string
  items: CarriedForwardEntry[]
}

/**
 * Given a set of currently-open follow-up items (already filtered to ones
 * whose source meeting is earlier than the target meeting and readable by
 * the caller — see ai-actions.ts) and the target meeting's attendee ids,
 * keeps only items attributed to an attendee and groups them by person.
 *
 * Group order follows first appearance in `openItems`; items within a group
 * keep their input order (callers pass them newest/oldest as they prefer).
 */
export function selectCarriedForward(
  openItems: OpenFollowupItem[],
  attendeeIds: string[],
): CarriedForwardGroup[] {
  const attendeeSet = new Set(attendeeIds)
  const order: string[] = []
  const byUser = new Map<string, CarriedForwardGroup>()

  for (const item of openItems) {
    if (!item.userId || !attendeeSet.has(item.userId)) continue
    let group = byUser.get(item.userId)
    if (!group) {
      group = { userId: item.userId, person: item.personName, items: [] }
      byUser.set(item.userId, group)
      order.push(item.userId)
    }
    group.items.push({
      id: item.id,
      text: item.text,
      kind: item.kind,
      fromTitle: item.sourceMeetingTitle,
      fromDate: item.sourceMeetingStartsAt,
      sourceMeetingId: item.sourceMeetingId,
    })
  }

  return order.map((userId) => byUser.get(userId)!)
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
