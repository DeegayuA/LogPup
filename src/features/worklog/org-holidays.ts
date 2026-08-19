/**
 * Which company holidays are in force for a given day.
 *
 * Pure, so the "revocation does not reach backwards" rule is pinned by a test
 * rather than discovered when somebody's August coverage changes in November.
 */
export type OrgHolidayRow = {
  day: string
  /** The day the cancellation took effect, or null if still in force. */
  revokedFrom: string | null
}

/**
 * A day is a company holiday if a row names it AND that row was either never
 * cancelled, or was cancelled only AFTER the day had already passed.
 *
 * `day < revokedFrom` — strict, and deliberately so. Cancelling a shutdown on
 * the morning of the shutdown calls off that day too, which is what an
 * operator means when they cancel something today.
 */
export function orgHolidaySet(rows: readonly OrgHolidayRow[]): Set<string> {
  const days = new Set<string>()
  for (const row of rows) {
    if (row.revokedFrom === null || row.day < row.revokedFrom) days.add(row.day)
  }
  return days
}
