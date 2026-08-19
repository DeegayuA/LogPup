import { describe, expect, it } from 'vitest'
import {
  NON_TRANSFERABLE,
  TRANSFERABLE_GROUPS,
  splitAllocation,
} from '@/features/people/handover-inventory'

describe('TRANSFERABLE_GROUPS', () => {
  it('covers every kind of open work a person can hold', () => {
    expect(TRANSFERABLE_GROUPS).toEqual([
      'assignments',
      'app_roles',
      'tasks',
      'meetings',
      'followups',
      'change_requests',
      'absences',
      'app_grants',
    ])
  })
})

describe('NON_TRANSFERABLE', () => {
  it('names what can never move, and why', () => {
    expect(NON_TRANSFERABLE.map((n) => n.table)).toEqual([
      'daily_worklogs',
      'sprint_checkins',
      'webauthn_credentials',
      'gemini_keys',
    ])
  })

  it('gives every entry a real reason, not a label', () => {
    for (const entry of NON_TRANSFERABLE) {
      expect(entry.reason.length, entry.table).toBeGreaterThan(30)
    }
  })
})

describe('splitAllocation', () => {
  it('preserves the total when dividing across successors', () => {
    expect(splitAllocation(100, [
      { userId: 'a', pct: 60 },
      { userId: 'b', pct: 40 },
    ])).toEqual([{ userId: 'a', pct: 60 }, { userId: 'b', pct: 40 }])
  })

  it('refuses a split that does not add up, naming both numbers', () => {
    expect(() => splitAllocation(100, [
      { userId: 'a', pct: 60 },
      { userId: 'b', pct: 30 },
    ])).toThrow(/90.*100/)
  })

  it('allows a deliberate drop to nobody', () => {
    // Leaving a group unassigned is a choice the preview states explicitly,
    // never a silent skip.
    expect(splitAllocation(100, [])).toEqual([])
  })

  it('refuses a negative or zero share rather than silently dropping it', () => {
    expect(() => splitAllocation(100, [{ userId: 'a', pct: 100 }, { userId: 'b', pct: 0 }]))
      .toThrow(/0%/)
  })

  it('refuses the same successor twice', () => {
    expect(() => splitAllocation(100, [{ userId: 'a', pct: 50 }, { userId: 'a', pct: 50 }]))
      .toThrow(/twice/)
  })
})
