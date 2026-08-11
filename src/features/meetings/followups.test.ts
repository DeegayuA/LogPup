import { describe, it, expect } from 'vitest'
import {
  matchPersonToAttendee,
  selectCarriedForward,
  filterValidIds,
  type OpenFollowupItem,
} from './followups'

describe('matchPersonToAttendee', () => {
  const attendees = [
    { id: 'u1', name: 'Nadeesha Perera' },
    { id: 'u2', name: 'Kasun Silva' },
    { id: 'u3', name: 'John Doe' },
    { id: 'u4', name: 'John Smith' },
  ]

  it('matches an exact full name', () => {
    expect(matchPersonToAttendee('Nadeesha Perera', attendees)).toBe('u1')
  })

  it('matches case-insensitively', () => {
    expect(matchPersonToAttendee('nadeesha perera', attendees)).toBe('u1')
    expect(matchPersonToAttendee('KASUN SILVA', attendees)).toBe('u2')
  })

  it('matches an unambiguous first name', () => {
    expect(matchPersonToAttendee('Kasun', attendees)).toBe('u2')
  })

  it('returns null for an ambiguous first name shared by multiple attendees', () => {
    expect(matchPersonToAttendee('John', attendees)).toBeNull()
  })

  it('returns null when nothing matches', () => {
    expect(matchPersonToAttendee('Someone Else', attendees)).toBeNull()
  })

  it('returns null for an empty name', () => {
    expect(matchPersonToAttendee('  ', attendees)).toBeNull()
  })

  it('returns null when two attendees share the exact same full name', () => {
    const dupes = [
      { id: 'a', name: 'Sam Fernando' },
      { id: 'b', name: 'Sam Fernando' },
    ]
    expect(matchPersonToAttendee('Sam Fernando', dupes)).toBeNull()
  })
})

describe('selectCarriedForward', () => {
  function item(overrides: Partial<OpenFollowupItem>): OpenFollowupItem {
    return {
      id: 'f1',
      userId: 'u1',
      personName: 'Nadeesha',
      text: 'Follow up on the API contract',
      kind: 'question',
      sourceMeetingId: 'm1',
      sourceMeetingTitle: 'Sprint planning',
      sourceMeetingStartsAt: new Date('2026-08-01T09:00:00'),
      ...overrides,
    }
  }

  it('drops items whose userId is not an attendee of the target meeting', () => {
    const items = [item({ id: 'f1', userId: 'u1' }), item({ id: 'f2', userId: 'u9' })]
    const groups = selectCarriedForward(items, ['u1'])
    expect(groups).toHaveLength(1)
    expect(groups[0].items.map((i) => i.id)).toEqual(['f1'])
  })

  it('drops items with no resolved userId', () => {
    const items = [item({ id: 'f1', userId: null })]
    expect(selectCarriedForward(items, ['u1'])).toEqual([])
  })

  it('groups multiple items for the same person together', () => {
    const items = [
      item({ id: 'f1', userId: 'u1', text: 'Question one' }),
      item({ id: 'f2', userId: 'u1', text: 'Question two' }),
    ]
    const groups = selectCarriedForward(items, ['u1'])
    expect(groups).toHaveLength(1)
    expect(groups[0].items.map((i) => i.text)).toEqual(['Question one', 'Question two'])
  })

  it('keeps separate groups per attendee', () => {
    const items = [item({ id: 'f1', userId: 'u1' }), item({ id: 'f2', userId: 'u2', personName: 'Kasun' })]
    const groups = selectCarriedForward(items, ['u1', 'u2'])
    expect(groups.map((g) => g.userId).sort()).toEqual(['u1', 'u2'])
  })

  it('returns an empty array given no open items', () => {
    expect(selectCarriedForward([], ['u1'])).toEqual([])
  })

  it('returns an empty array given no attendee ids', () => {
    const items = [item({ id: 'f1', userId: 'u1' })]
    expect(selectCarriedForward(items, [])).toEqual([])
  })
})

describe('filterValidIds', () => {
  it('keeps only ids present in the valid set', () => {
    expect(filterValidIds(['a', 'b', 'c'], ['a', 'c'])).toEqual(['a', 'c'])
  })

  it('ignores invented ids the model was never given', () => {
    expect(filterValidIds(['a', 'invented'], ['a', 'b'])).toEqual(['a'])
  })

  it('dedupes repeated ids', () => {
    expect(filterValidIds(['a', 'a', 'b'], ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterValidIds(['x', 'y'], ['a', 'b'])).toEqual([])
  })

  it('returns an empty array given no candidates', () => {
    expect(filterValidIds([], ['a', 'b'])).toEqual([])
  })
})
