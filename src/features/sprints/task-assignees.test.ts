import { describe, expect, it, vi } from 'vitest'

/**
 * The rules this file protects are the ones that decide who is accountable
 * for a task, and every one of them is decidable without a database — which
 * is why they live in exported pure functions rather than inside the server
 * action that writes them. These need a database about as much as arithmetic
 * does — which is the point: the rule about who is accountable should be
 * checkable without one.
 *
 * @/db is stubbed only for import hygiene: task-assignees.ts imports the
 * client module, and the real one pulls in the neon driver and the write
 * freeze for a suite that never issues a query. Same vi.hoisted + vi.mock
 * idiom as src/features/transcription/live-token.test.ts.
 */
const { dbStub } = vi.hoisted(() => ({ dbStub: {} }))
vi.mock('@/db', () => ({ db: dbStub }))

const {
  diffAssignees,
  normalizeAssigneeIds,
  orderAssignees,
  primaryAssigneeId,
  withPrimaryAssignee,
} = await import(
  './task-assignees'
)

const ANA = '11111111-1111-4111-8111-111111111111'
const BEN = '22222222-2222-4222-8222-222222222222'
const CAI = '33333333-3333-4333-8333-333333333333'

describe('normalizeAssigneeIds', () => {
  it('keeps the FIRST mention of a repeated person, because that is the accountable slot', () => {
    expect(normalizeAssigneeIds([ANA, BEN, ANA])).toEqual([ANA, BEN])
  })

  it('leaves an already-clean set exactly as it was given', () => {
    expect(normalizeAssigneeIds([CAI, ANA, BEN])).toEqual([CAI, ANA, BEN])
  })

  it('drops blanks and nullish entries instead of sending them to the database', () => {
    expect(normalizeAssigneeIds([null, ' ', ANA, undefined, ''])).toEqual([ANA])
  })

  it('trims, so a padded id and the same id are one person', () => {
    expect(normalizeAssigneeIds([` ${ANA} `, ANA])).toEqual([ANA])
  })
})

describe('primaryAssigneeId', () => {
  it('is the first id of the set', () => {
    expect(primaryAssigneeId([BEN, ANA, CAI])).toBe(BEN)
  })

  it('is null for an empty set — removing the last assignee means unassigned', () => {
    expect(primaryAssigneeId([])).toBeNull()
  })

  it('is null when every entry was blank, not the blank itself', () => {
    expect(primaryAssigneeId(['', null])).toBeNull()
  })

  it('moves when the same people are reordered', () => {
    expect(primaryAssigneeId([ANA, BEN])).toBe(ANA)
    expect(primaryAssigneeId([BEN, ANA])).toBe(BEN)
  })

  it('is the first mention when a duplicate would otherwise claim the slot', () => {
    expect(primaryAssigneeId([ANA, BEN, ANA])).toBe(ANA)
  })
})

describe('orderAssignees', () => {
  it('orders by when somebody joined, not by id', () => {
    const rows = [
      { userId: ANA, addedAt: new Date('2026-03-02T09:00:00Z') },
      { userId: CAI, addedAt: new Date('2026-01-05T09:00:00Z') },
      { userId: BEN, addedAt: new Date('2026-02-01T09:00:00Z') },
    ]
    expect(orderAssignees(rows).map((row) => row.userId)).toEqual([CAI, BEN, ANA])
  })

  it('breaks a tied timestamp by id, so one unchanged task renders the same twice', () => {
    const sameInstant = new Date('2026-03-02T09:00:00Z')
    const rows = [
      { userId: CAI, addedAt: sameInstant },
      { userId: ANA, addedAt: sameInstant },
      { userId: BEN, addedAt: sameInstant },
    ]
    expect(orderAssignees(rows).map((row) => row.userId)).toEqual([ANA, BEN, CAI])
  })

  it('accepts the string timestamps a driver may hand back', () => {
    const rows = [
      { userId: ANA, addedAt: '2026-03-02T09:00:00Z' },
      { userId: BEN, addedAt: '2026-01-05T09:00:00Z' },
    ]
    expect(orderAssignees(rows).map((row) => row.userId)).toEqual([BEN, ANA])
  })

  it('does not mutate the rows it was handed', () => {
    const rows = [
      { userId: ANA, addedAt: new Date('2026-03-02T09:00:00Z') },
      { userId: BEN, addedAt: new Date('2026-01-05T09:00:00Z') },
    ]
    orderAssignees(rows)
    expect(rows.map((row) => row.userId)).toEqual([ANA, BEN])
  })
})

describe('diffAssignees', () => {
  it('computes the minimal insert and delete, leaving the people who stay alone', () => {
    const change = diffAssignees([ANA, BEN], [ANA, CAI], ANA)
    expect(change.add).toEqual([CAI])
    expect(change.remove).toEqual([BEN])
    expect(change.primary).toBe(ANA)
    expect(change.unchanged).toBe(false)
  })

  it('writing the same set twice is a no-op, not a churn of delete and insert', () => {
    const change = diffAssignees([ANA, BEN], [ANA, BEN], ANA)
    expect(change).toEqual({ add: [], remove: [], primary: ANA, unchanged: true })
  })

  it('treats a reorder of the same people as a primary change and nothing else', () => {
    const change = diffAssignees([ANA, BEN], [BEN, ANA], ANA)
    expect(change.add).toEqual([])
    expect(change.remove).toEqual([])
    expect(change.primary).toBe(BEN)
    expect(change.unchanged).toBe(false)
  })

  it('makes the first of the new set primary even when everyone is new', () => {
    const change = diffAssignees([], [BEN, CAI], null)
    expect(change.add).toEqual([BEN, CAI])
    expect(change.remove).toEqual([])
    expect(change.primary).toBe(BEN)
  })

  it('removing the last assignee is legal and leaves a null primary', () => {
    const change = diffAssignees([ANA], [], ANA)
    expect(change.add).toEqual([])
    expect(change.remove).toEqual([ANA])
    expect(change.primary).toBeNull()
    expect(change.unchanged).toBe(false)
  })

  it('an already-empty task asked for nobody is unchanged', () => {
    expect(diffAssignees([], [], null).unchanged).toBe(true)
  })

  it('dedups the incoming set before diffing, so a repeat is not a second insert', () => {
    const change = diffAssignees([], [ANA, ANA, BEN], null)
    expect(change.add).toEqual([ANA, BEN])
    expect(change.primary).toBe(ANA)
  })

  it('notices a stale column even when the membership is right', () => {
    // The join says Ana leads; tasks.assignee_id still says Ben. The write
    // has to happen — this is exactly the drift the column is repaired from.
    const change = diffAssignees([ANA, BEN], [ANA, BEN], BEN)
    expect(change.unchanged).toBe(false)
    expect(change.primary).toBe(ANA)
    expect(change.add).toEqual([])
    expect(change.remove).toEqual([])
  })
})


describe('withPrimaryAssignee — what a board drag means', () => {
  it('makes the dropped-on person accountable without removing anyone else', () => {
    // Dropping a card into someone's column says "this is now their task",
    // not "take everyone else off it". Replacing the set would silently
    // unassign two people as a side effect of a drag.
    expect(withPrimaryAssignee(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c'])
  })

  it('adds somebody who was not on the task at all', () => {
    expect(withPrimaryAssignee(['a', 'b'], 'z')).toEqual(['z', 'a', 'b'])
  })

  it('is a no-op when the person is already accountable', () => {
    expect(withPrimaryAssignee(['a', 'b'], 'a')).toEqual(['a', 'b'])
  })

  it('empties the set when dropped on Unassigned', () => {
    // The one case that IS a removal — "unassigned" means nobody, so leaving
    // the others behind would contradict the column the card now sits in.
    expect(withPrimaryAssignee(['a', 'b'], null)).toEqual([])
  })

  it('never duplicates a person already on the task', () => {
    expect(withPrimaryAssignee(['a', 'b', 'a'], 'a')).toEqual(['a', 'b'])
  })

  it('keeps the join containing the accountable person, which is the invariant', () => {
    const next = withPrimaryAssignee([], 'a')
    expect(next).toContain('a')
    expect(primaryAssigneeId(next)).toBe('a')
  })
})
