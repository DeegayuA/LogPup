/**
 * Which side of a two-way calendar sync should win, field by field — and
 * where nobody should win without a person.
 *
 * Pure. It CLASSIFIES and deliberately does not RESOLVE, for the same reason
 * event-identity has an `uncertain` verdict: last-write-wins silently discards
 * whichever edit lost the race, and in this product the thing discarded could
 * be an agenda somebody rewrote between two syncs. A discarded edit leaves no
 * trace and nobody to notice it.
 *
 * WHY A BASE SNAPSHOT RATHER THAN A `lastSyncedAt` TIMESTAMP. Three states are
 * needed, and only a three-way comparison distinguishes them: the field as it
 * stood at the last successful sync (`base`), and each side now. A
 * record-level timestamp cannot attribute a change to a FIELD — it says the
 * row changed, not which part — so a title edit here and an agenda edit there
 * would collide as one whole-record conflict and send a person to arbitrate
 * two edits that never disagreed. Storing the synced snapshot costs one row
 * per link and turns most conflicts into non-events.
 *
 * `base` may be absent, which is the first sync of something imported: there
 * is no shared history, so any difference is a genuine `conflict` rather than
 * a change with a direction. Guessing a direction there is how an import
 * overwrites a local agenda with an empty Google description.
 */

export type FieldVerdict = 'unchanged' | 'take-local' | 'take-remote' | 'conflict'

export type FieldReason =
  /** Both sides equal — nothing to do. */
  | 'identical'
  /** Only this side moved since the last sync. */
  | 'only-local-changed'
  | 'only-remote-changed'
  /** Both moved, to different values. */
  | 'both-changed'
  /** They differ and there is no shared history to attribute it to. */
  | 'no-baseline'
  /** Attendees: the two sides' edits touch different people, so both apply. */
  | 'disjoint-membership'

export type FieldDecision<T> = {
  field: string
  verdict: FieldVerdict
  reason: FieldReason
  /** What to write when the verdict resolves. Absent on `conflict`, which is
   *  the point: there is nothing safe to write. */
  value?: T
}

/** Scalar three-way merge: title, agenda, start, end. */
export function reconcileScalar<T>(
  field: string,
  base: T | undefined,
  local: T,
  remote: T,
  equals: (a: T, b: T) => boolean = Object.is,
): FieldDecision<T> {
  if (equals(local, remote)) {
    return { field, verdict: 'unchanged', reason: 'identical', value: local }
  }
  if (base === undefined) {
    // Different, with no history to say who moved. A first import must not
    // guess: an empty Google description would otherwise erase a local agenda.
    return { field, verdict: 'conflict', reason: 'no-baseline' }
  }
  const localMoved = !equals(local, base)
  const remoteMoved = !equals(remote, base)

  if (localMoved && !remoteMoved) {
    return { field, verdict: 'take-local', reason: 'only-local-changed', value: local }
  }
  if (remoteMoved && !localMoved) {
    return { field, verdict: 'take-remote', reason: 'only-remote-changed', value: remote }
  }
  // Both moved, to different values — the only honest answer is a person.
  return { field, verdict: 'conflict', reason: 'both-changed' }
}

export type AttendeeMerge = {
  field: 'attendees'
  verdict: FieldVerdict
  reason: FieldReason
  /** The merged roster when the verdict resolves. */
  value?: string[]
}

const asSet = (emails: readonly string[]) =>
  new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))

/**
 * Attendees merge as SETS, not as a scalar.
 *
 * Two people editing one roster usually are not disagreeing: one added a
 * designer, the other removed somebody who left. Comparing the rosters whole
 * would call that a conflict and make a person redo arithmetic they could have
 * had for free. So each side's ADDITIONS and REMOVALS relative to the base are
 * computed, and they merge whenever they touch different people.
 *
 * There is no contested case: see the proof inside. Attendee edits always
 * merge once a baseline exists, which is a property of three-way set merge
 * rather than an assumption about how considerate people are.
 */
export function reconcileAttendees(
  base: readonly string[] | undefined,
  local: readonly string[],
  remote: readonly string[],
): AttendeeMerge {
  const localSet = asSet(local)
  const remoteSet = asSet(remote)

  const same = localSet.size === remoteSet.size && [...localSet].every((e) => remoteSet.has(e))
  if (same) {
    return { field: 'attendees', verdict: 'unchanged', reason: 'identical', value: [...localSet] }
  }
  if (base === undefined) {
    return { field: 'attendees', verdict: 'conflict', reason: 'no-baseline' }
  }

  const baseSet = asSet(base)
  const added = (set: Set<string>) => [...set].filter((e) => !baseSet.has(e))
  const removed = (set: Set<string>) => [...baseSet].filter((e) => !set.has(e))

  const localAdded = added(localSet)
  const localRemoved = removed(localSet)
  const remoteAdded = added(remoteSet)
  const remoteRemoved = removed(remoteSet)

  // NO CONTEST IS POSSIBLE HERE, and the reason is structural rather than
  // lucky. `added` means "in this side, NOT in base"; `removed` means "in
  // base, NOT in this side". For one address to be both added by one side and
  // removed by the other it would have to be absent from base and present in
  // it, so the intersection is empty by construction, always.
  //
  // An earlier version of this function carried a `contested-membership`
  // branch for that case. It was dead code — deleting it changed no test —
  // and a guard that cannot fire is worse than no guard, because it advertises
  // a protection nobody has. Three-way set merge on attendees always resolves;
  // the disagreements it cannot settle are about the fields below, not the
  // roster.

  // Disjoint edits: apply both sides' intentions.
  const merged = new Set(baseSet)
  for (const email of [...localAdded, ...remoteAdded]) merged.add(email)
  for (const email of [...localRemoved, ...remoteRemoved]) merged.delete(email)

  const onlyLocalMoved = remoteAdded.length === 0 && remoteRemoved.length === 0
  const onlyRemoteMoved = localAdded.length === 0 && localRemoved.length === 0

  return {
    field: 'attendees',
    verdict: onlyRemoteMoved && !onlyLocalMoved ? 'take-remote' : 'take-local',
    reason: onlyLocalMoved
      ? 'only-local-changed'
      : onlyRemoteMoved
        ? 'only-remote-changed'
        : 'disjoint-membership',
    value: [...merged].sort(),
  }
}

export type SyncSnapshot = {
  title: string
  agenda: string | null
  startsAtMs: number
  endsAtMs: number
  attendeeEmails: readonly string[]
}

export type Reconciliation = {
  decisions: (FieldDecision<unknown> | AttendeeMerge)[]
  /** True when any field needs a person. */
  needsPerson: boolean
}

/**
 * Reconcile a whole meeting.
 *
 * `needsPerson` is deliberately whole-record even though the decisions are
 * per-field: writing the resolvable fields and leaving the contested ones
 * would produce a meeting that existed on neither side — a new title against
 * an old agenda — and would do it silently. The caller shows the conflict and
 * writes nothing until it is settled.
 */
export function reconcileMeeting(
  base: SyncSnapshot | undefined,
  local: SyncSnapshot,
  remote: SyncSnapshot,
): Reconciliation {
  // Null and empty agenda are the same absence: Google returns '' where we
  // store null, and treating those as a change would make every sync of an
  // agenda-less meeting look like an edit.
  const text = (a: string | null, b: string | null) => (a ?? '') === (b ?? '')

  const decisions = [
    reconcileScalar('title', base?.title, local.title, remote.title),
    reconcileScalar('agenda', base?.agenda, local.agenda, remote.agenda, text),
    reconcileScalar('startsAtMs', base?.startsAtMs, local.startsAtMs, remote.startsAtMs),
    reconcileScalar('endsAtMs', base?.endsAtMs, local.endsAtMs, remote.endsAtMs),
    reconcileAttendees(base?.attendeeEmails, local.attendeeEmails, remote.attendeeEmails),
  ] as (FieldDecision<unknown> | AttendeeMerge)[]

  return { decisions, needsPerson: decisions.some((d) => d.verdict === 'conflict') }
}

/** What to tell the person arbitrating. */
export const FIELD_REASON_SENTENCE: Record<FieldReason, string> = {
  identical: 'Both sides agree.',
  'only-local-changed': 'Changed here since the last sync.',
  'only-remote-changed': 'Changed in Google since the last sync.',
  'both-changed': 'Changed in both places since the last sync — pick one.',
  'no-baseline': 'These have never been synced, so there is no way to tell which is newer.',
  'disjoint-membership': 'Both sides changed the roster, but not the same people.',
}
