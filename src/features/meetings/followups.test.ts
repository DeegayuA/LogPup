import { describe, it, expect } from 'vitest'
import {
  buildFollowupRows,
  matchPersonToAttendee,
  selectCarriedForward,
  selectUnattributed,
  filterValidIds,
  followupTaskSimilarity,
  findMatchingFollowup,
  decideFollowupResolutionOnTaskStatusChange,
  MAX_CARRIED_PER_PERSON,
  CARRY_STALE_DAYS,
  FOLLOWUP_TASK_MATCH_THRESHOLD,
  type OpenFollowupItem,
  type FollowupMatchCandidate,
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
  const NOW = new Date('2026-08-12T09:00:00')

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

  function daysAgo(n: number): Date {
    return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000)
  }

  it('drops items whose userId is not an attendee of the target meeting', () => {
    const items = [item({ id: 'f1', userId: 'u1' }), item({ id: 'f2', userId: 'u9' })]
    const groups = selectCarriedForward(items, ['u1'], NOW)
    expect(groups).toHaveLength(1)
    expect(groups[0].items.map((i) => i.id)).toEqual(['f1'])
  })

  it('drops items with no resolved userId', () => {
    const items = [item({ id: 'f1', userId: null })]
    expect(selectCarriedForward(items, ['u1'], NOW)).toEqual([])
  })

  it('groups multiple items for the same person together', () => {
    const items = [
      item({ id: 'f1', userId: 'u1', text: 'Question one', sourceMeetingStartsAt: daysAgo(3) }),
      item({ id: 'f2', userId: 'u1', text: 'Question two', sourceMeetingStartsAt: daysAgo(1) }),
    ]
    const groups = selectCarriedForward(items, ['u1'], NOW)
    expect(groups).toHaveLength(1)
    expect(groups[0].items.map((i) => i.text)).toEqual(['Question one', 'Question two'])
  })

  it('keeps separate groups per attendee', () => {
    const items = [item({ id: 'f1', userId: 'u1' }), item({ id: 'f2', userId: 'u2', personName: 'Kasun' })]
    const groups = selectCarriedForward(items, ['u1', 'u2'], NOW)
    expect(groups.map((g) => g.userId).sort()).toEqual(['u1', 'u2'])
  })

  it('returns an empty array given no open items', () => {
    expect(selectCarriedForward([], ['u1'], NOW)).toEqual([])
  })

  it('returns an empty array given no attendee ids', () => {
    const items = [item({ id: 'f1', userId: 'u1' })]
    expect(selectCarriedForward(items, [], NOW)).toEqual([])
  })

  it('sorts a person’s items oldest source meeting first', () => {
    const items = [
      item({ id: 'newest', userId: 'u1', sourceMeetingStartsAt: daysAgo(1) }),
      item({ id: 'oldest', userId: 'u1', sourceMeetingStartsAt: daysAgo(10) }),
      item({ id: 'middle', userId: 'u1', sourceMeetingStartsAt: daysAgo(5) }),
    ]
    const groups = selectCarriedForward(items, ['u1'], NOW)
    expect(groups[0].items.map((i) => i.id)).toEqual(['oldest', 'middle', 'newest'])
  })

  it('reports each item’s age in calendar days from its source meeting to `now`', () => {
    const items = [item({ id: 'f1', userId: 'u1', sourceMeetingStartsAt: daysAgo(4) })]
    const groups = selectCarriedForward(items, ['u1'], NOW)
    expect(groups[0].items[0].ageDays).toBe(4)
  })

  it('caps a person’s visible items at MAX_CARRIED_PER_PERSON and reports the rest as overflow', () => {
    const items = Array.from({ length: MAX_CARRIED_PER_PERSON + 3 }, (_, i) =>
      item({ id: `f${i}`, userId: 'u1', sourceMeetingStartsAt: daysAgo(i + 1) }),
    )
    const groups = selectCarriedForward(items, ['u1'], NOW)
    expect(groups[0].items).toHaveLength(MAX_CARRIED_PER_PERSON)
    expect(groups[0].overflowCount).toBe(3)
    // The oldest ones (highest daysAgo) are what survives the cap.
    expect(groups[0].items.map((i) => i.id)).toEqual(['f7', 'f6', 'f5', 'f4', 'f3'])
  })

  it('reports zero overflow when a person is at or under the cap', () => {
    const items = [item({ id: 'f1', userId: 'u1' })]
    const groups = selectCarriedForward(items, ['u1'], NOW)
    expect(groups[0].overflowCount).toBe(0)
  })

  it('flags an item stale once it reaches CARRY_STALE_DAYS, and not the day before', () => {
    const items = [
      item({ id: 'juststale', userId: 'u1', sourceMeetingStartsAt: daysAgo(CARRY_STALE_DAYS) }),
      item({ id: 'notyet', userId: 'u1', sourceMeetingStartsAt: daysAgo(CARRY_STALE_DAYS - 1) }),
    ]
    const groups = selectCarriedForward(items, ['u1'], NOW)
    const byId = Object.fromEntries(groups[0].items.map((i) => [i.id, i]))
    expect(byId.juststale.stale).toBe(true)
    expect(byId.notyet.stale).toBe(false)
  })
})

describe('selectUnattributed', () => {
  function item(overrides: Partial<OpenFollowupItem>): OpenFollowupItem {
    return {
      id: 'f1',
      userId: null,
      personName: 'Someone the model heard',
      text: 'Send over the updated numbers',
      kind: 'action',
      sourceMeetingId: 'm1',
      sourceMeetingTitle: 'Client sync',
      sourceMeetingStartsAt: new Date('2026-08-01T09:00:00'),
      ...overrides,
    }
  }

  it('keeps only items with no resolved userId', () => {
    const items = [item({ id: 'f1', userId: null }), item({ id: 'f2', userId: 'u1' })]
    expect(selectUnattributed(items).map((i) => i.id)).toEqual(['f1'])
  })

  it('returns an empty array when everything is attributed', () => {
    expect(selectUnattributed([item({ id: 'f1', userId: 'u1' })])).toEqual([])
  })

  it('returns an empty array given no items', () => {
    expect(selectUnattributed([])).toEqual([])
  })
})

describe('followupTaskSimilarity', () => {
  it('scores near-identical rewordings highly', () => {
    const score = followupTaskSimilarity(
      'Update the onboarding doc for new hires',
      'Update onboarding doc for new hires',
    )
    expect(score).toBeGreaterThanOrEqual(FOLLOWUP_TASK_MATCH_THRESHOLD)
  })

  it('is case and punctuation insensitive', () => {
    const score = followupTaskSimilarity(
      'Send the client the revised proposal!!',
      'SEND THE CLIENT THE REVISED PROPOSAL',
    )
    expect(score).toBe(1)
  })

  it('scores unrelated text near zero', () => {
    const score = followupTaskSimilarity(
      'Confirm the venue booking for the offsite',
      'Update the API rate-limit documentation',
    )
    expect(score).toBeLessThan(FOLLOWUP_TASK_MATCH_THRESHOLD)
  })

  it('returns 0 for empty input on either side', () => {
    expect(followupTaskSimilarity('', 'Send the proposal')).toBe(0)
    expect(followupTaskSimilarity('Send the proposal', '')).toBe(0)
    expect(followupTaskSimilarity('', '')).toBe(0)
  })

  it('returns 0 when input is only stopwords/punctuation', () => {
    expect(followupTaskSimilarity('the a of', '...???')).toBe(0)
  })
})

describe('findMatchingFollowup', () => {
  function candidate(overrides: Partial<FollowupMatchCandidate>): FollowupMatchCandidate {
    return { id: 'c1', userId: 'u1', text: 'Send the client the revised proposal', ...overrides }
  }

  it('matches a paraphrase owed by the same person', () => {
    const result = findMatchingFollowup(
      { assigneeId: 'u1', text: 'Send revised proposal to client' },
      [candidate({ id: 'c1' })],
    )
    expect(result).toBe('c1')
  })

  it('never matches when the suggestion has no assignee', () => {
    const result = findMatchingFollowup(
      { assigneeId: null, text: 'Send revised proposal to client' },
      [candidate({ id: 'c1', userId: null })],
    )
    expect(result).toBeNull()
  })

  it('ignores a textually-similar candidate owed by a different person', () => {
    const result = findMatchingFollowup(
      { assigneeId: 'u1', text: 'Send revised proposal to client' },
      [candidate({ id: 'c1', userId: 'u2' })],
    )
    expect(result).toBeNull()
  })

  it('rejects unrelated text even for the same person', () => {
    const result = findMatchingFollowup(
      { assigneeId: 'u1', text: 'Update the API rate-limit documentation' },
      [candidate({ id: 'c1', text: 'Confirm the venue booking for the offsite' })],
    )
    expect(result).toBeNull()
  })

  it('picks the highest-scoring candidate among several', () => {
    const result = findMatchingFollowup(
      { assigneeId: 'u1', text: 'Send revised proposal to client' },
      [
        candidate({ id: 'weak', text: 'Send an email to the client' }),
        candidate({ id: 'strong', text: 'Send the client the revised proposal' }),
      ],
    )
    expect(result).toBe('strong')
  })

  it('returns null given no candidates', () => {
    expect(findMatchingFollowup({ assigneeId: 'u1', text: 'Send revised proposal' }, [])).toBeNull()
  })
})

describe('decideFollowupResolutionOnTaskStatusChange', () => {
  it('resolves when a task moves into done', () => {
    expect(decideFollowupResolutionOnTaskStatusChange('in_progress', 'done')).toBe('resolve')
    expect(decideFollowupResolutionOnTaskStatusChange('todo', 'done')).toBe('resolve')
  })

  it('reopens when a task moves out of done', () => {
    expect(decideFollowupResolutionOnTaskStatusChange('done', 'todo')).toBe('reopen')
    expect(decideFollowupResolutionOnTaskStatusChange('done', 'in_progress')).toBe('reopen')
  })

  it('does nothing for a transition that never touches done', () => {
    expect(decideFollowupResolutionOnTaskStatusChange('todo', 'in_progress')).toBe('none')
    expect(decideFollowupResolutionOnTaskStatusChange('in_progress', 'todo')).toBe('none')
  })

  it('does nothing when status is resent unchanged', () => {
    expect(decideFollowupResolutionOnTaskStatusChange('done', 'done')).toBe('none')
    expect(decideFollowupResolutionOnTaskStatusChange('todo', 'todo')).toBe('none')
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
