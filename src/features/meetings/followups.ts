// Pure, unit-testable pieces of the person-linked follow-up carry-forward
// system. Kept free of DB/network calls on purpose — the server actions in
// ai-actions.ts fetch rows and call these functions to decide what to do
// with them.

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
