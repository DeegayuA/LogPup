/**
 * Client-local search over the docket — no URL writes, no history thrash.
 *
 * Substring match, never word match: Sinhala has no dependable word
 * boundaries, and the repo's bilingual rules forbid word-splitting regexes
 * because \p{M} combining marks and the ZWJ inside conjuncts (ශ්‍රී) must
 * survive whatever the matcher does. So both sides are folded the same way —
 * NFC then lowercase — and compared with String#includes. NFC is there
 * because two keyboards can emit different byte sequences for the same
 * visible letter (කෝ composed vs base-plus-marks); it recomposes without
 * dropping a single mark or joiner. Lowercase is a no-op for Sinhala and the
 * whole point for English.
 *
 * Fields are matched one at a time, not concatenated, so a needle can never
 * pretend to match across the seam between a title and an attendee's name.
 */

/** Structural on purpose: MeetingSummary satisfies it, and the generic hands
 *  callers back the row type they gave us. */
type SearchableMeeting = {
  title: string
  agenda: string | null
  attendees: { name: string }[]
  apps: { name: string }[]
}

function fold(value: string): string {
  return value.normalize('NFC').toLowerCase()
}

export function filterMeetingsBySearch<T extends SearchableMeeting>(
  meetings: T[],
  query: string,
): T[] {
  // Trim AFTER folding: trim() strips only whitespace, which neither NFC nor
  // lowercasing can produce or consume, and ZWJ/combining marks are not
  // whitespace — an edge joiner in the query survives.
  const needle = fold(query).trim()
  // Identity, not a copy: an empty search box must not re-render every row.
  if (needle === '') return meetings

  return meetings.filter((meeting) => {
    if (fold(meeting.title).includes(needle)) return true
    if (meeting.agenda !== null && fold(meeting.agenda).includes(needle)) return true
    if (meeting.attendees.some((attendee) => fold(attendee.name).includes(needle))) return true
    return meeting.apps.some((app) => fold(app.name).includes(needle))
  })
}
