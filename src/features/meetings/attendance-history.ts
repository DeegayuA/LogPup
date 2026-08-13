// Pure, unit-testable pieces of meeting-attendance history — the same
// half-open-interval + tombstone model `assignment_history` uses for project
// membership, applied to who was on a meeting.
//
// Deliberately NOT a second pattern: the "which row is in force at this
// instant" rule is `selectRowsAsOf` from allocation-history.ts, imported
// rather than reimplemented, so the two histories can never drift apart on
// the one comparison that decides every "as of" answer.

import { selectRowsAsOf, type HistoryInterval } from '@/features/people/allocation-history'

/**
 * Mirrors `allocation_change` one-for-one: 'added' is 'assigned' (the verb
 * differs only because "assigned to a meeting" reads wrong), 'updated' is an
 * RSVP change, 'removed' is the tombstone.
 */
export type AttendanceChange = 'added' | 'updated' | 'removed'

export type AttendanceResponse = 'pending' | 'going' | 'maybe' | 'declined'

/** A history row as the queries hand it to the pure layer. */
export type AttendanceHistoryRow = HistoryInterval & {
  meetingId: string
  userId: string
  response: AttendanceResponse
  changeKind: AttendanceChange
}

export type AttendanceEntryInput = {
  meetingId: string
  userId: string
  response: AttendanceResponse
  changeKind: AttendanceChange
  changedBy: string
  at: Date
  note?: string | null
}

export type AttendanceEntry = {
  meetingId: string
  userId: string
  response: AttendanceResponse
  changeKind: AttendanceChange
  changedBy: string
  effectiveFrom: Date
  effectiveTo: null
  note: string | null
}

/**
 * Builds the row a membership change appends. Always opens a new interval
 * (`effectiveTo: null`); closing the previous one is a separate statement in
 * the same batch, driven by the same `at`, so the two intervals abut exactly.
 *
 * Unlike buildHistoryEntry there is nothing to force to zero — attendance has
 * no summed payload. The tombstone instead CARRIES the response the person
 * last had, which is what lets a timeline say "removed — was going" rather
 * than inventing a state they never chose. Excluding tombstones from the
 * roster is the reader's job (see attendanceAsOf), exactly as excluding them
 * from an allocation breakdown is capacityAsOf's.
 */
export function buildAttendanceEntry(input: AttendanceEntryInput): AttendanceEntry {
  return {
    meetingId: input.meetingId,
    userId: input.userId,
    response: input.response,
    changeKind: input.changeKind,
    changedBy: input.changedBy,
    effectiveFrom: input.at,
    effectiveTo: null,
    note: input.note ?? null,
  }
}

export type AttendanceAsOf = { userId: string; response: AttendanceResponse }

/**
 * Who was on the meeting at `at`, with the RSVP they held then.
 *
 * Tombstones are in force like any other row — that is what makes "they were
 * NOT on this meeting on that date" a positive, recorded fact instead of an
 * absence — but they are dropped from the roster, since a removed person is
 * not an attendee. Sorted by userId so the result is stable to compare.
 */
export function attendanceAsOf(rows: AttendanceHistoryRow[], at: Date): AttendanceAsOf[] {
  return selectRowsAsOf(rows, at)
    .filter((row) => row.changeKind !== 'removed')
    .map((row) => ({ userId: row.userId, response: row.response }))
    .sort((a, b) => a.userId.localeCompare(b.userId))
}
