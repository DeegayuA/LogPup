/**
 * Every trace a person leaves in this workspace, reduced to one shape.
 *
 * WHY ONE SHAPE. The corroboration layer asks a single question — "did
 * anything at all happen on this day?" — and it must ask it of commits,
 * meetings, reviews and card moves identically. A per-source design would
 * answer that question once per source, and the day somebody's work lived
 * entirely in a channel the loop forgot is the day the app calls them idle.
 *
 * WHAT IS AND IS NOT IN HERE. This module classifies; it does not fetch.
 * `queries.ts` reads the database and hands rows over. That split is the same
 * one finance/cost.ts and worklog/coverage.ts already use, and it is what lets
 * the golden test — a tech lead's Tuesday of meetings and reviews — run with
 * no database at all.
 */

/**
 * The closed vocabulary of things this workspace can witness.
 *
 * Closed on purpose: an open string would let a caller invent a kind that no
 * classifier knows, and it would silently land in whichever bucket the
 * fallback picked. A new kind should be a compile error until somebody has
 * decided whether it is evidence of an outcome or merely of presence.
 */
export type ObservationKind =
  // --- outcome: something finished, was answered, or was decided ---
  | 'task.completed'
  | 'commit'
  | 'followup.resolved'
  | 'review.approved'
  | 'review.rejected'
  | 'bug.triaged'
  // --- presence: somebody was here and engaged, with nothing closed ---
  | 'task.moved'
  | 'task.created'
  | 'meeting.attended'
  | 'meeting.spoke'
  | 'comment'
  | 'checkin.updated'
  | 'worklog.scored'

/**
 * THE SPLIT THIS FEATURE TURNS ON.
 *
 * An outcome is a thing that finished. Presence is a person who was
 * demonstrably there and engaged without finishing anything — which is what a
 * day of review, argument and debugging looks like from the outside, and is a
 * perfectly good day.
 *
 * The distinction exists so the corroboration layer can grade rather than
 * judge: presence-only is `partial`, never `none`. A design that only counted
 * outcomes would score the studio's most senior people lowest, because
 * seniority here mostly converts into other people's outcomes.
 */
const OUTCOME_KINDS: ReadonlySet<ObservationKind> = new Set([
  'task.completed',
  'commit',
  'followup.resolved',
  'review.approved',
  'review.rejected',
  'bug.triaged',
])

export function isOutcome(kind: ObservationKind): boolean {
  return OUTCOME_KINDS.has(kind)
}

export type Observation = {
  userId: string
  /** `YYYY-MM-DD` in Asia/Colombo — the same day key worklog_entries uses. */
  day: string
  kind: ObservationKind
  /** Which project, when the trace names one. Null is normal, not missing. */
  appId: string | null
  at: Date
}

/**
 * One `activity_log` row, as this module needs it.
 *
 * `verb` and `entityType` are free text in the database (the table serves
 * every feature), so classification happens here rather than at the query —
 * a `WHERE verb IN (...)` list would have to be duplicated at every call site
 * and would silently drop a verb somebody renamed.
 */
export type ActivityRow = {
  actorId: string
  verb: string
  entityType: string
  appId: string | null
  createdAt: Date
  day: string
}

/**
 * What an activity row is evidence OF, or null for the ones that are evidence
 * of nothing.
 *
 * Null is the common case and deliberately so. Signing in, exporting a CSV,
 * opening a page and reading somebody else's board all write rows here, and
 * counting them as work would make the busiest-looking person the one who
 * clicks around most. Only verbs that change something a colleague can see
 * are evidence.
 */
export function classifyActivity(row: ActivityRow): ObservationKind | null {
  const verb = row.verb.trim().toLowerCase()
  const entity = row.entityType.trim().toLowerCase()

  if (entity === 'task') {
    if (verb === 'completed') return 'task.completed'
    if (verb === 'created') return 'task.created'
    // 'moved', 'assigned', 'updated', 'reopened': the card changed, which is
    // presence. Reopened is deliberately NOT an outcome — undoing a
    // completion is work, but it is not a thing finishing.
    if (verb === 'moved' || verb === 'assigned' || verb === 'updated' || verb === 'reopened') {
      return 'task.moved'
    }
    return null
  }

  if (entity === 'followup') {
    if (verb === 'resolved') return 'followup.resolved'
    // A response or a defer is engagement with the item without closing it —
    // exactly the shape `responseNote` exists to record.
    if (verb === 'commented' || verb === 'updated') return 'comment'
    return null
  }

  if (entity === 'comment') return verb === 'created' ? 'comment' : null

  if (entity === 'meeting') {
    // 'rsvp' is a calendar answer, not attendance, and counting it would let
    // somebody corroborate a whole week by clicking Yes on invitations.
    if (verb === 'attended') return 'meeting.attended'
    return null
  }

  if (entity === 'changerequest' || entity === 'change_request') {
    if (verb === 'approved') return 'review.approved'
    if (verb === 'rejected') return 'review.rejected'
    return null
  }

  if (entity === 'bug' || entity === 'bugreport' || entity === 'bug_report') {
    // Triage is a judgement somebody made about severity — an outcome. Merely
    // filing a bug is not: reporting a problem is valuable, but it is the
    // start of work rather than a piece of it.
    if (verb === 'updated' || verb === 'resolved' || verb === 'escalated') return 'bug.triaged'
    return null
  }

  return null
}

export function observationsFromActivity(rows: readonly ActivityRow[]): Observation[] {
  const out: Observation[] = []
  for (const row of rows) {
    const kind = classifyActivity(row)
    if (!kind) continue
    out.push({ userId: row.actorId, day: row.day, kind, appId: row.appId, at: row.createdAt })
  }
  return out
}

/**
 * The two witnesses that never reach `activity_log`, and so would be invisible
 * to a design that only read it.
 *
 * Commits happen on GitHub, and voice turns happen inside a meeting
 * transcript. Both are among the strongest evidence this workspace can hold —
 * a commit is an outcome, and somebody arguing for forty minutes in a design
 * review is the clearest possible proof of a working day that closes nothing.
 * They are separate parameters rather than a merged list so a caller cannot
 * forget one silently: omitting them is a choice made at a named argument.
 */
export type ExternalWitness = {
  commits: readonly { userId: string; day: string; appId: string | null; at: Date }[]
  voiceTurns: readonly { userId: string; day: string; appId: string | null; at: Date }[]
}

export function observationsFromWitnesses(witness: ExternalWitness): Observation[] {
  return [
    ...witness.commits.map((c) => ({ ...c, kind: 'commit' as const })),
    ...witness.voiceTurns.map((v) => ({ ...v, kind: 'meeting.spoke' as const })),
  ]
}

/**
 * A self-score with a note, as an observation of the weakest honest kind.
 *
 * A first-person account of a day is not proof that work happened, and it is
 * the one signal the person being measured fully controls. It is here anyway,
 * as `presence` and never as `outcome`, because the alternative is worse: a
 * design that ignored it would read "wrote down what they did" as identical to
 * "said nothing at all", and would therefore rate the honest self-reporter
 * exactly as it rates silence.
 *
 * A score with NO note does not qualify. A bare number is a click; a sentence
 * is an account somebody can be held to.
 */
export function observationsFromSelfScores(
  scores: readonly { userId: string; day: string; note: string | null; at: Date }[],
): Observation[] {
  return scores
    .filter((s) => (s.note ?? '').trim().length > 0)
    .map((s) => ({
      userId: s.userId,
      day: s.day,
      kind: 'worklog.scored' as const,
      appId: null,
      at: s.at,
    }))
}

/** Every observation for one person on one day, grouped for the corroborator. */
export function groupByUserDay(
  observations: readonly Observation[],
): Map<string, Observation[]> {
  const map = new Map<string, Observation[]>()
  for (const observation of observations) {
    const key = `${observation.userId}|${observation.day}`
    const bucket = map.get(key)
    if (bucket) bucket.push(observation)
    else map.set(key, [observation])
  }
  return map
}

export function userDayKey(userId: string, day: string): string {
  return `${userId}|${day}`
}
