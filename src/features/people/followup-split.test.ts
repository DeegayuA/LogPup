import { describe, it, expect } from 'vitest'
import { splitPersonFollowups, type PersonFollowupRow } from './followup-split'

const TODAY = '2026-08-12'
const ME = 'user-me'
const OTHER = 'user-other'

function followup(over: Partial<PersonFollowupRow> = {}): PersonFollowupRow {
  return {
    id: 'f1',
    text: 'Send the client the revised timeline',
    kind: 'action',
    ownerUserId: ME,
    ownerName: 'Me',
    createdById: null,
    createdByName: null,
    meetingId: 'm1',
    meetingTitle: 'Weekly sync',
    meetingStartsAt: new Date('2026-08-10T04:30:00.000Z'),
    responseNote: null,
    deferReason: null,
    ...over,
  }
}

describe('a follow-up that already became a task', () => {
  // suggestTasksFromFollowups sets resolvedByTaskId and leaves status 'open' on
  // purpose — the commitment is not resolved, it moved to the board. Every
  // reader filtered on status alone, so the same commitment rendered twice on
  // the dashboard: once as a task, once as a follow-up, different orderings,
  // no hint they were one thing. Closing the task then silently resolved a row
  // the person was still looking at.
  it('is not listed again as a follow-up', () => {
    const result = splitPersonFollowups(
      [followup({ resolvedByLiveTaskId: 'task-1' })],
      ME,
      TODAY,
    )
    expect(result.owed).toEqual([])
    expect(result.oldestOwedDays).toBeNull()
  })

  it('is hidden on the awaiting side too, not just the owed side', () => {
    const result = splitPersonFollowups(
      [followup({ id: 'f2', ownerUserId: OTHER, createdById: ME, resolvedByLiveTaskId: 't2' })],
      ME,
      TODAY,
    )
    expect(result.awaiting).toEqual([])
  })

  it('COMES BACK when that task is trashed, so deleting a task cannot erase a debt', () => {
    // The query left-joins liveTasks, so a trashed task yields null here. If
    // this suppressed on the raw id instead, deleting the task would remove the
    // commitment from BOTH lists and the person would simply stop being asked.
    const result = splitPersonFollowups(
      [followup({ resolvedByLiveTaskId: null })],
      ME,
      TODAY,
    )
    expect(result.owed.map((i) => i.id)).toEqual(['f1'])
  })

  it('leaves an unmatched follow-up alone when the field is absent entirely', () => {
    // Older callers build rows without the field. Absent must read as "never
    // matched", never as "already handled" — the failure direction that hides
    // work is the one worth pinning.
    const { resolvedByLiveTaskId: _omitted, ...withoutField } = followup()
    void _omitted
    const result = splitPersonFollowups([withoutField as PersonFollowupRow], ME, TODAY)
    expect(result.owed.map((i) => i.id)).toEqual(['f1'])
  })

  it('does not drop the OTHER follow-ups in the same list', () => {
    const result = splitPersonFollowups(
      [followup({ id: 'f1', resolvedByLiveTaskId: 'task-1' }), followup({ id: 'f3' })],
      ME,
      TODAY,
    )
    expect(result.owed.map((i) => i.id)).toEqual(['f3'])
  })
})

describe('splitPersonFollowups', () => {
  it('puts items assigned to the person in owed', () => {
    const result = splitPersonFollowups([followup({ ownerUserId: ME })], ME, TODAY)
    expect(result.owed.map((i) => i.id)).toEqual(['f1'])
    expect(result.awaiting).toEqual([])
  })

  it('puts items they raised for someone else in awaiting', () => {
    const result = splitPersonFollowups(
      [followup({ id: 'f2', ownerUserId: OTHER, ownerName: 'Nuwan', createdById: ME })],
      ME,
      TODAY,
    )
    expect(result.awaiting.map((i) => i.id)).toEqual(['f2'])
    expect(result.owed).toEqual([])
  })

  it('counts a self-raised item as debt only, never as both', () => {
    const result = splitPersonFollowups(
      [followup({ id: 'f3', ownerUserId: ME, createdById: ME })],
      ME,
      TODAY,
    )
    expect(result.owed.map((i) => i.id)).toEqual(['f3'])
    expect(result.awaiting).toEqual([])
  })

  it('keeps an unassigned item they raised in awaiting', () => {
    // The AI could not match the spoken name to one attendee, so nobody owes
    // it — but the person who asked still needs to see it hanging.
    const result = splitPersonFollowups(
      [followup({ id: 'f4', ownerUserId: null, ownerName: 'Sam', createdById: ME })],
      ME,
      TODAY,
    )
    expect(result.awaiting.map((i) => i.id)).toEqual(['f4'])
    expect(result.owed).toEqual([])
  })

  it('ignores an item that is neither theirs nor raised by them', () => {
    const result = splitPersonFollowups(
      [followup({ ownerUserId: OTHER, createdById: OTHER })],
      ME,
      TODAY,
    )
    expect(result).toEqual({ owed: [], awaiting: [], oldestOwedDays: null })
  })

  it('ages items from their source meeting, oldest debt first', () => {
    const result = splitPersonFollowups(
      [
        followup({ id: 'recent', meetingStartsAt: new Date('2026-08-11T04:30:00.000Z') }),
        followup({ id: 'ancient', meetingStartsAt: new Date('2026-07-01T04:30:00.000Z') }),
      ],
      ME,
      TODAY,
    )
    expect(result.owed.map((i) => i.id)).toEqual(['ancient', 'recent'])
    expect(result.owed.map((i) => i.ageDays)).toEqual([42, 1])
  })

  it('resolves the meeting day in the business timezone', () => {
    // 20:00 UTC on the 11th is already the 12th in Colombo, so this is today —
    // age 0, not 1.
    const result = splitPersonFollowups(
      [followup({ meetingStartsAt: new Date('2026-08-11T20:00:00.000Z') })],
      ME,
      TODAY,
    )
    expect(result.owed[0].ageDays).toBe(0)
  })

  it('never reports a negative age for a future meeting', () => {
    const result = splitPersonFollowups(
      [followup({ meetingStartsAt: new Date('2026-09-01T04:30:00.000Z') })],
      ME,
      TODAY,
    )
    expect(result.owed[0].ageDays).toBe(0)
  })

  it('reports the age of the worst debt, and reports it as the first owed row', () => {
    // The stat strip tones the "Owes" tile off this number and the card flags
    // rows off the same threshold, so the summary has to be the very item the
    // reader sees at the top of the list — not a separately computed maximum
    // that could drift from it.
    const result = splitPersonFollowups(
      [
        followup({ id: 'recent', meetingStartsAt: new Date('2026-08-11T04:30:00.000Z') }),
        followup({ id: 'ancient', meetingStartsAt: new Date('2026-07-01T04:30:00.000Z') }),
      ],
      ME,
      TODAY,
    )
    expect(result.oldestOwedDays).toBe(42)
    expect(result.oldestOwedDays).toBe(result.owed[0].ageDays)
  })

  it('reports no oldest debt when the only open item is one they are awaiting', () => {
    const result = splitPersonFollowups(
      [followup({ ownerUserId: OTHER, ownerName: 'Nuwan', createdById: ME })],
      ME,
      TODAY,
    )
    expect(result.awaiting).toHaveLength(1)
    expect(result.oldestOwedDays).toBeNull()
  })

  it('returns two empty lists for a person with nothing outstanding', () => {
    expect(splitPersonFollowups([], ME, TODAY)).toEqual({
      owed: [],
      awaiting: [],
      oldestOwedDays: null,
    })
  })
})
