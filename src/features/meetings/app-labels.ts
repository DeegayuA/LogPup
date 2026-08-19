/**
 * The projects a meeting is on, and how to say them in a narrow place.
 *
 * Pure — no db import — so a client component can take the type and the
 * formatter without pulling a query module into the browser bundle.
 */

/** One project on a meeting. Always ordered by name at the read site. */
export type MeetingApp = { id: string; name: string; slug: string }

/**
 * Up to `max` names, then "+N" for the rest: "Alpha", "Alpha, Beta",
 * "Alpha, Beta +2".
 *
 * ONE definition, used by the command palette subtitle, the calendar chip, the
 * list badge overflow and the print running foot, so the same meeting reads the
 * same way everywhere. Returns '' for no projects — every caller decides for
 * itself what "no project" looks like (a date, a "No app" badge, nothing at
 * all), and none of them may render an empty string as if it were a name.
 *
 * The input must already be ordered by app name. Ordering by anything storage
 * decides — a join-row id, insertion order — makes the "+2" set shift between
 * two reads of the same unchanged meeting.
 */
export function formatAppNames(names: readonly string[], max = 2): string {
  if (names.length === 0) return ''
  if (names.length <= max) return names.join(', ')
  return `${names.slice(0, max).join(', ')} +${names.length - max}`
}
