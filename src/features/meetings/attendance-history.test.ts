import { describe, it, expect } from 'vitest'
import { selectRowsAsOf } from '@/features/people/allocation-history'
import {
  attendanceAsOf,
  buildAttendanceEntry,
  type AttendanceHistoryRow,
} from './attendance-history'

const JAN = new Date('2026-01-01T00:00:00.000Z')
const FEB = new Date('2026-02-01T00:00:00.000Z')
const MAR = new Date('2026-03-01T00:00:00.000Z')

function row(over: Partial<AttendanceHistoryRow> = {}): AttendanceHistoryRow {
  return {
    meetingId: 'm1',
    userId: 'u1',
    response: 'pending',
    changeKind: 'added',
    effectiveFrom: JAN,
    effectiveTo: null,
    ...over,
  }
}

describe('buildAttendanceEntry', () => {
  it('always opens a new interval', () => {
    const entry = buildAttendanceEntry({
      meetingId: 'm1',
      userId: 'u1',
      response: 'going',
      changeKind: 'added',
      changedBy: 'admin',
      at: FEB,
    })
    expect(entry.effectiveFrom).toBe(FEB)
    expect(entry.effectiveTo).toBeNull()
  })

  it('records who made the change — the reason a removal is a tombstone, not a close', () => {
    const entry = buildAttendanceEntry({
      meetingId: 'm1',
      userId: 'u1',
      response: 'going',
      changeKind: 'removed',
      changedBy: 'admin',
      at: FEB,
    })
    expect(entry.changedBy).toBe('admin')
    expect(entry.changeKind).toBe('removed')
  })

  // The counterpart of buildHistoryEntry forcing allocationPct to 0. There is
  // no summed quantity here to corrupt, so the honest thing is to carry the
  // RSVP they last held: the timeline can then say "removed — was going"
  // instead of inventing a state nobody chose.
  it('carries the last response onto the tombstone rather than inventing one', () => {
    const entry = buildAttendanceEntry({
      meetingId: 'm1',
      userId: 'u1',
      response: 'going',
      changeKind: 'removed',
      changedBy: 'admin',
      at: FEB,
    })
    expect(entry.response).toBe('going')
  })

  it('defaults note to null rather than undefined', () => {
    const entry = buildAttendanceEntry({
      meetingId: 'm1',
      userId: 'u1',
      response: 'pending',
      changeKind: 'added',
      changedBy: 'admin',
      at: JAN,
    })
    expect(entry.note).toBeNull()
  })
})

describe('attendance intervals', () => {
  // The pair one change writes: the close and the open share ONE instant, so
  // the intervals abut exactly. This is the invariant the single db.batch
  // exists to guarantee — deriving the two timestamps separately would leave
  // a gap or an overlap here.
  it('picks exactly one row at the instant one supersedes another', () => {
    const before = row({ response: 'pending', effectiveFrom: JAN, effectiveTo: FEB })
    const after = row({ response: 'going', changeKind: 'updated', effectiveFrom: FEB })
    expect(selectRowsAsOf([before, after], FEB)).toEqual([after])
  })

  it('leaves at most one open row per (meetingId, userId) after a change', () => {
    const closed = row({ effectiveFrom: JAN, effectiveTo: FEB })
    const open = row({ changeKind: 'updated', effectiveFrom: FEB, effectiveTo: null })
    const stillOpen = [closed, open].filter((r) => r.effectiveTo === null)
    expect(stillOpen).toHaveLength(1)
  })

  it('does not let one person’s interval close another’s', () => {
    const mine = row({ userId: 'u1', effectiveFrom: JAN })
    const theirs = row({ userId: 'u2', effectiveFrom: JAN })
    expect(selectRowsAsOf([mine, theirs], MAR)).toHaveLength(2)
  })
})

describe('attendanceAsOf', () => {
  it('lists who was on the meeting with the RSVP they held then', () => {
    const rows = [
      row({ userId: 'u1', response: 'going' }),
      row({ userId: 'u2', response: 'maybe' }),
    ]
    expect(attendanceAsOf(rows, MAR)).toEqual([
      { userId: 'u1', response: 'going' },
      { userId: 'u2', response: 'maybe' },
    ])
  })

  it('shows the RSVP in force at the date, not the latest one', () => {
    const rows = [
      row({ response: 'pending', effectiveFrom: JAN, effectiveTo: MAR }),
      row({ response: 'going', changeKind: 'updated', effectiveFrom: MAR }),
    ]
    expect(attendanceAsOf(rows, FEB)).toEqual([{ userId: 'u1', response: 'pending' }])
    expect(attendanceAsOf(rows, MAR)).toEqual([{ userId: 'u1', response: 'going' }])
  })

  // A tombstone is in force like any other row — that is what makes "they
  // were NOT on this meeting then" a recorded fact rather than an absence —
  // but a removed person is not an attendee, so it is dropped from the roster.
  it('drops the tombstone from the roster while it is still in force', () => {
    const rows = [
      row({ response: 'going', effectiveFrom: JAN, effectiveTo: FEB }),
      row({ response: 'going', changeKind: 'removed', effectiveFrom: FEB }),
    ]
    expect(attendanceAsOf(rows, JAN)).toEqual([{ userId: 'u1', response: 'going' }])
    expect(attendanceAsOf(rows, MAR)).toEqual([])
  })

  it('keeps history of an attendance that was later removed — the past still happened', () => {
    const rows = [
      row({ response: 'going', effectiveFrom: JAN, effectiveTo: FEB }),
      row({ response: 'going', changeKind: 'removed', effectiveFrom: FEB }),
    ]
    // Before the removal instant they were on the meeting, and no later
    // removal can rewrite that.
    expect(attendanceAsOf(rows, new Date('2026-01-15T00:00:00.000Z'))).toEqual([
      { userId: 'u1', response: 'going' },
    ])
  })

  it('re-adding after a removal puts them back', () => {
    const rows = [
      row({ effectiveFrom: JAN, effectiveTo: FEB }),
      row({ changeKind: 'removed', effectiveFrom: FEB, effectiveTo: MAR }),
      row({ response: 'going', changeKind: 'added', effectiveFrom: MAR }),
    ]
    expect(attendanceAsOf(rows, MAR)).toEqual([{ userId: 'u1', response: 'going' }])
  })

  it('returns nothing for a date before any history exists', () => {
    expect(attendanceAsOf([row({ effectiveFrom: FEB })], JAN)).toEqual([])
  })

  it('handles empty input', () => {
    expect(attendanceAsOf([], MAR)).toEqual([])
  })
})
