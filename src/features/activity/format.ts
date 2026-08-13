import { isoDayDiff, isoDayOf } from '@/features/people/iso-day'
import type { ActivityRow } from '@/features/activity/types'

/**
 * The verb phrase between the actor's name and the entity label:
 * "Deeghayu ‹moved task› Fix login ‹to In progress›". One map so every feed
 * row reads the same; unknown verbs fall through verbatim, which is exactly
 * right for a deliberate one-off verb at some call site.
 */
const VERB_PHRASES: Record<string, string> = {
  created: 'created',
  updated: 'updated',
  deleted: 'deleted',
  moved: 'moved',
  completed: 'completed',
  reopened: 'reopened',
  assigned: 'assigned',
  unassigned: 'unassigned',
  rsvp: 'responded to',
  resolved: 'resolved',
  approved: 'approved',
  rejected: 'rejected',
  commented: 'commented on',
}

export function activityPhrase(row: Pick<ActivityRow, 'verb' | 'entityType'>): string {
  const { verb, entityType } = activityPhraseParts(row)
  return entityType ? `${verb} ${entityType}` : verb
}

/**
 * The same phrase, kept in its two pieces.
 *
 * /activity makes the ENTITY-TYPE word itself a one-click filter ("moved
 * ‹task›" → only tasks), so it needs the type separable from the verb rather
 * than pre-joined. Linking the word that already carries the meaning beats
 * adding a chip that repeats it: no new visual element, and the affordance
 * lands exactly where the reader's eye already is.
 *
 * `entityType` is null precisely when activityPhrase would omit it — comments,
 * whose label is the thing commented ON — so that row simply has no type link.
 */
export function activityPhraseParts(row: Pick<ActivityRow, 'verb' | 'entityType'>): {
  verb: string
  entityType: string | null
} {
  const verb = VERB_PHRASES[row.verb] ?? row.verb
  // "commented on comment Fix login" reads broken — for comments the entity
  // label is the thing commented ON, so the type is dropped.
  if (row.verb === 'commented') return { verb, entityType: null }
  return { verb, entityType: row.entityType }
}

export type ActivityDayGroup = {
  /** `YYYY-MM-DD` in the business timezone. */
  dayIso: string
  /** "Today", "Yesterday", or empty — caller formats the date itself. */
  relativeLabel: 'Today' | 'Yesterday' | ''
  rows: ActivityRow[]
}

/**
 * Rows (already newest-first) bucketed by business-timezone calendar day.
 * Pure: "now" is a parameter so tests never depend on the wall clock.
 */
export function groupActivityByDay(rows: ActivityRow[], now: Date): ActivityDayGroup[] {
  const todayIso = isoDayOf(now)
  const groups: ActivityDayGroup[] = []
  for (const row of rows) {
    const dayIso = isoDayOf(row.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.dayIso === dayIso) {
      last.rows.push(row)
      continue
    }
    const age = isoDayDiff(todayIso, dayIso)
    groups.push({
      dayIso,
      relativeLabel: age === 0 ? 'Today' : age === 1 ? 'Yesterday' : '',
      rows: [row],
    })
  }
  return groups
}

/** How much a day weighs, for the day marker: "18 changes · 5 people". */
export function activityDaySummary(rows: ActivityRow[]): { changes: number; people: number } {
  return { changes: rows.length, people: new Set(rows.map((row) => row.actorId)).size }
}

/**
 * One reading unit of the trail: a single event, or a run of them collapsed.
 * `rows` is always newest-first, exactly as given, and every input row appears
 * in exactly one entry — a burst is a view of the stream, never a filter on it.
 */
export type ActivityEntry =
  | { kind: 'event'; key: string; row: ActivityRow }
  | { kind: 'burst'; key: string; rows: ActivityRow[] }

/**
 * Collapses an edit SESSION into one line.
 *
 * The problem this solves: the trail's density is driven by how chatty a write
 * path is, not by how important a change is. One person fixing a meeting's
 * title, then its agenda, then its time produces three near-identical rows, and
 * a meeting touched eight times in four minutes eats a third of the page and
 * pushes the one interesting change below the fold.
 *
 * The rule is deliberately narrow — CONSECUTIVE rows sharing actor AND entity
 * type AND entity id:
 *
 * - Consecutive only, because the stream is already `created_at desc` and
 *   collapsing non-adjacent rows would reorder the trail. The trail's order is
 *   its meaning.
 * - Same ENTITY, not merely the same actor: "Prabuddha did 6 things" is not
 *   information; "Prabuddha changed *this meeting* 6 times" is exactly one edit
 *   session.
 * - No time window. A window (say 10 minutes) sounds right and is wrong twice:
 *   it renders the same data differently depending on where a page boundary
 *   falls, and it invents a threshold nobody can justify. Adjacency in the
 *   stream is already the stronger signal — a same-actor/same-entity run is
 *   broken only by someone else's change or by a different subject, which is
 *   precisely when the session ended.
 * - A run of ONE stays an ordinary event: no wrapper, no disclosure triangle.
 *
 * Callers pass one DAY's rows (see the feed), so a burst never spans midnight
 * and its rendered time range never crosses a day header. A burst CAN be split
 * by a page boundary, which renders as two shorter bursts — accepted, because
 * the alternative is reading past the keyset cursor to tidy a display detail.
 *
 * Not applied when rows are relevance-ordered (a search): both this and day
 * grouping are statements about chronological adjacency, and neither is true
 * of a ranked list.
 */
export function groupActivityBursts(rows: ActivityRow[]): ActivityEntry[] {
  const entries: ActivityEntry[] = []
  let run: ActivityRow[] = []

  const flush = () => {
    if (run.length === 0) return
    // The key is the run's FIRST row id: ids are unique and every row lands in
    // exactly one entry, so this is unique across the list either way.
    entries.push(
      run.length === 1
        ? { kind: 'event', key: run[0].id, row: run[0] }
        : { kind: 'burst', key: run[0].id, rows: run },
    )
    run = []
  }

  for (const row of rows) {
    const head = run[0]
    const continues =
      head !== undefined &&
      head.actorId === row.actorId &&
      head.entityType === row.entityType &&
      head.entityId === row.entityId
    if (!continues) flush()
    run.push(row)
  }
  flush()

  return entries
}
