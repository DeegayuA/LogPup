import { describe, it, expect } from 'vitest'
import {
  buildFollowupRows,
  matchPersonToAttendee,
  selectCarriedForward,
  filterValidIds,
  type OpenFollowupItem,
} from './followups'

describe('buildFollowupRows', () => {
  // These names ARE the source meeting's attendees. Using them as the model's
  // output is the whole point of the guard: an exact name match must not
  // attribute the item.
  const ATTENDEE_NAMES = ['Nadeesha Perera', 'Kasun Silva']

  // THE REGRESSION GUARD. deriveAndInsertFollowups used to name-match the
  // model's perPerson[].name against the attendees, so a person the meeting
  // merely TALKED ABOUT was recorded as owing the work — and it carried
  // forward to every future meeting they attended. Only a confirmed
  // meeting_speakers mapping may attribute a follow-up.
  it('returns null userId for an unconfirmed name that EXACTLY matches an attendee', () => {
    const [exactAttendeeName] = ATTENDEE_NAMES
    expect(exactAttendeeName).toBe('Nadeesha Perera')
    const rows = buildFollowupRows(
      'm1',
      [{ name: exactAttendeeName, actionItems: ['Send the contract'] }],
      [],
      [],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].userId).toBeNull()
  })

  it('keeps the raw guess in personName so nothing the model observed is lost', () => {
    const rows = buildFollowupRows('m1', [{ name: 'Irushi Anupama', actionItems: ['Follow up'] }], [], [])
    expect(rows[0].personName).toBe('Irushi Anupama')
    expect(rows[0].userId).toBeNull()
  })

  it('attributes only through a confirmed speaker mapping', () => {
    const rows = buildFollowupRows(
      'm1',
      [{ name: 'Kasun Silva', actionItems: ['Deploy the fix'] }],
      [],
      [{ label: 'Kasun Silva', userId: 'u2' }],
    )
    expect(rows[0].userId).toBe('u2')
  })

  it('honors a mapping that explicitly resolves to nobody', () => {
    const rows = buildFollowupRows(
      'm1',
      [{ name: 'Kasun Silva', actionItems: ['Deploy the fix'] }],
      [],
      [{ label: 'Kasun Silva', userId: null }],
    )
    expect(rows[0].userId).toBeNull()
  })

  it('builds question rows as well as action rows', () => {
    const rows = buildFollowupRows(
      'm1',
      [{ name: 'A', actionItems: ['do it'] }],
      [{ person: 'B', questions: ['why?'] }],
      [],
    )
    expect(rows.map((r) => r.kind)).toEqual(['action', 'question'])
    expect(rows.map((r) => r.text)).toEqual(['do it', 'why?'])
  })

  it('expands multiple items per person and carries sourceMeetingId', () => {
    const rows = buildFollowupRows(
      'meeting-9',
      [{ name: 'A', actionItems: ['one', 'two'] }],
      [],
      [],
    )
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.sourceMeetingId === 'meeting-9')).toBe(true)
  })

  it('skips entries with no name and items with no text', () => {
    const rows = buildFollowupRows(
      'm1',
      [
        { name: '', actionItems: ['orphan'] },
        { name: 'A', actionItems: ['', 'real'] },
      ],
      [{ person: '', questions: ['orphan'] }],
      [],
    )
    expect(rows.map((r) => r.text)).toEqual(['real'])
  })

  it('handles a person with no actionItems at all', () => {
    expect(buildFollowupRows('m1', [{ name: 'A' }], [], [])).toEqual([])
  })

  it('returns nothing for empty input', () => {
    expect(buildFollowupRows('m1', [], [], [])).toEqual([])
  })
})

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
