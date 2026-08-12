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
  const verb = VERB_PHRASES[row.verb] ?? row.verb
  // "commented on comment Fix login" reads broken — for comments the entity
  // label is the thing commented ON, so the type is dropped.
  if (row.verb === 'commented') return verb
  return `${verb} ${row.entityType}`
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
