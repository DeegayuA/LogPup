/**
 * Who has put time into each project, from worklog_entries.app_id.
 *
 * Reads app_id, never task → app: app_id is the column that also carries
 * meetings, reviews and incidents (see the schema comment on it), so going
 * through tasks would undercount exactly the people whose work is not tickets.
 *
 * Built from the worklog rows themselves, NOT from `assignments`: someone who
 * logged three days on a project they were never formally assigned to still
 * spent those days, and dropping them would make the card disagree with the
 * worklog they typed it into.
 *
 * READS FOLLOW `worklog.view`, row by row. A member's grant is 'own', so on
 * the portfolio they see their own hours and nobody else's; a scoped manager
 * sees everyone on the projects they reach. The filtering happens here, on
 * the server, before anything is rendered — hiding rows in the card would
 * still have shipped them.
 *
 * No per-app total, by request: the card answers "how long did each person
 * spend", and a sum would also have needed hiding from 'own' viewers, for
 * whom it is just their own figure again under a team-sized label.
 */

export type PersonLoggedTime = {
  userId: string
  name: string
  avatarUrl: string | null
  minutes: number
}

export type LoggedTimeRow = {
  appId: string | null
  userId: string
  name: string
  avatarUrl: string | null
  minutes: number
}

/**
 * Under 3 minutes rounds to "0" in formatHours (one decimal of an hour), and
 * a person listed against "0h" reads as an error, not as a short call.
 */
const MIN_SHOWN_MINUTES = 3

/**
 * Per app, the people who logged time on it: most minutes first, ties by name
 * so the order is stable between renders. An app nobody (visible) logged time
 * on has no entry.
 */
export function groupLoggedTime(
  rows: LoggedTimeRow[],
  seesRow: (row: { appId: string; userId: string }) => boolean = () => true,
): Map<string, PersonLoggedTime[]> {
  const byApp = new Map<string, PersonLoggedTime[]>()
  for (const row of rows) {
    if (!row.appId || row.minutes < MIN_SHOWN_MINUTES) continue
    if (!seesRow({ appId: row.appId, userId: row.userId })) continue
    const people = byApp.get(row.appId) ?? []
    people.push({
      userId: row.userId,
      name: row.name,
      avatarUrl: row.avatarUrl,
      minutes: row.minutes,
    })
    byApp.set(row.appId, people)
  }
  for (const people of byApp.values()) {
    people.sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name))
  }
  return byApp
}

/**
 * A calendar month as `YYYY-MM`. All month math is string math on purpose:
 * worklog days are Asia/Colombo calendar dates stored as `date`, and a JS
 * Date built from one would drift a day at the UTC boundary.
 */
export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const index = y * 12 + (m - 1) + delta
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

/** `start` inclusive, `end` exclusive — compare `day >= start AND day < end`. */
export function monthRange(month: string): { start: string; end: string } {
  return { start: `${month}-01`, end: `${shiftMonth(month, 1)}-01` }
}

/** "October 2026", or "Oct 2026" where width is short. */
export function monthLabel(month: string, style: 'long' | 'short' = 'long'): string {
  const [y, m] = month.split('-').map(Number)
  const name = MONTH_NAMES[m - 1]
  return `${style === 'short' ? name.slice(0, 3) : name} ${y}`
}
