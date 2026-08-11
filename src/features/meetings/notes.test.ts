import { describe, it, expect } from 'vitest'
import {
  resolveSpeakerUserId,
  normalizeDueDate,
  planSpeakerAssignment,
  suggestionToTaskPayload,
  orderNoteSegments,
  type OrderableSegment,
} from './notes'

describe('resolveSpeakerUserId', () => {
  // These are the meeting's attendees. Their names are used as LABELS below
  // on purpose: the point of every "returns null" case is that a label
  // matching a real attendee's name is still only a guess.
  const ATTENDEE_NAMES = ['Nadeesha Perera', 'Kasun Silva']

  // Structural half of the regression guard. The function does not take the
  // attendee list at all, so it cannot name-match even by accident — a
  // behavioural assertion alone could be satisfied by a fallback that simply
  // wasn't handed any attendees. Re-adding that parameter is the regression,
  // and this fails the moment someone does.
  it('cannot see the attendee list — it takes only a label and mappings', () => {
    expect(resolveSpeakerUserId.length).toBe(2)
  })

  it('returns null for a null/empty label', () => {
    expect(resolveSpeakerUserId(null, [])).toBeNull()
    expect(resolveSpeakerUserId('', [])).toBeNull()
  })

  it('uses an explicit mapping when one exists', () => {
    const mappings = [{ label: 'Speaker 1', userId: 'u2' }]
    expect(resolveSpeakerUserId('Speaker 1', mappings)).toBe('u2')
  })

  it('honors an explicit "not a listed attendee" mapping (null)', () => {
    const mappings = [{ label: 'Nadeesha Perera', userId: null }]
    expect(resolveSpeakerUserId('Nadeesha Perera', mappings)).toBeNull()
  })

  // THE REGRESSION GUARD. A speaker label is a model guess — the analysis
  // prompt asks Gemini to map speakers to attendee names, so a label matching
  // an attendee's name is evidence of nothing. This function used to
  // name-match here, which rendered a guess as fact: in production a note was
  // attributed to someone who was talked ABOUT, not talking, and the same
  // call pre-assigned a real task to them. No mapping row, no person. Ever.
  it('returns null for an unmapped label that EXACTLY matches an attendee name', () => {
    const [exactAttendeeName] = ATTENDEE_NAMES
    expect(exactAttendeeName).toBe('Nadeesha Perera')
    expect(resolveSpeakerUserId(exactAttendeeName, [])).toBeNull()
  })

  it('returns null for an unmapped label matching an attendee first name', () => {
    expect(ATTENDEE_NAMES[1].startsWith('Kasun')).toBe(true)
    expect(resolveSpeakerUserId('Kasun', [])).toBeNull()
  })

  it('returns null for a generic "Speaker N" label with no mapping', () => {
    expect(resolveSpeakerUserId('Speaker 2', [])).toBeNull()
  })

  it('ignores a mapping for a DIFFERENT label rather than treating it as a near-miss', () => {
    const mappings = [{ label: 'Speaker 1', userId: 'u1' }]
    expect(resolveSpeakerUserId('Speaker 2', mappings)).toBeNull()
  })

  it('picks the right mapping when several labels are mapped in the same meeting', () => {
    const mappings = [
      { label: 'Speaker 1', userId: 'u1' },
      { label: 'Speaker 2', userId: 'u2' },
    ]
    expect(resolveSpeakerUserId('Speaker 2', mappings)).toBe('u2')
  })
})

describe('planSpeakerAssignment', () => {
  it('plans nothing to add for "not a listed attendee"', () => {
    expect(
      planSpeakerAssignment({
        userId: null,
        attendeeIds: ['u1'],
        appId: 'app1',
        assignedAppIds: [],
      }),
    ).toEqual({ userId: null, addAttendee: false, addAssignment: false })
  })

  it('adds nothing for an attendee already assigned to the meeting’s app', () => {
    expect(
      planSpeakerAssignment({
        userId: 'u1',
        attendeeIds: ['u1', 'u2'],
        appId: 'app1',
        assignedAppIds: ['app1'],
      }),
    ).toEqual({ userId: 'u1', addAttendee: false, addAssignment: false })
  })

  // The non-attendee cascade: naming someone who isn't on the meeting is a
  // claim they were in the room AND doing that app's work, so both rows are
  // needed. This is the case that lands rows in all three tables.
  it('adds both attendee and assignment for someone on neither', () => {
    expect(
      planSpeakerAssignment({
        userId: 'u9',
        attendeeIds: ['u1'],
        appId: 'app1',
        assignedAppIds: [],
      }),
    ).toEqual({ userId: 'u9', addAttendee: true, addAssignment: true })
  })

  it('adds only the attendee row when they already carry the app', () => {
    expect(
      planSpeakerAssignment({
        userId: 'u9',
        attendeeIds: ['u1'],
        appId: 'app1',
        assignedAppIds: ['app1'],
      }),
    ).toEqual({ userId: 'u9', addAttendee: true, addAssignment: false })
  })

  it('adds no assignment when the meeting is not linked to an app', () => {
    expect(
      planSpeakerAssignment({
        userId: 'u9',
        attendeeIds: [],
        appId: null,
        assignedAppIds: [],
      }),
    ).toEqual({ userId: 'u9', addAttendee: true, addAssignment: false })
  })

  it('does not confuse an assignment on a DIFFERENT app for one on this app', () => {
    const plan = planSpeakerAssignment({
      userId: 'u9',
      attendeeIds: ['u9'],
      appId: 'app1',
      assignedAppIds: ['app2', 'app3'],
    })
    expect(plan).toEqual({ userId: 'u9', addAttendee: false, addAssignment: true })
  })
})

describe('normalizeDueDate', () => {
  it('passes through a well-formed ISO date', () => {
    expect(normalizeDueDate('2026-08-15')).toBe('2026-08-15')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeDueDate('  2026-08-15  ')).toBe('2026-08-15')
  })

  it('returns null for null/undefined/empty', () => {
    expect(normalizeDueDate(null)).toBeNull()
    expect(normalizeDueDate(undefined)).toBeNull()
    expect(normalizeDueDate('')).toBeNull()
  })

  it('returns null for a free-text phrase instead of ISO', () => {
    expect(normalizeDueDate('next friday')).toBeNull()
    expect(normalizeDueDate('end of sprint')).toBeNull()
  })

  it('returns null for a malformed date that matches the shape but not a real calendar day', () => {
    expect(normalizeDueDate('2026-13-40')).toBeNull()
  })
})

describe('suggestionToTaskPayload', () => {
  const context = { appId: 'app1', sprintId: 'sprint1' }

  it('maps a plain suggestion with no overrides', () => {
    const payload = suggestionToTaskPayload(
      { text: 'Ship the roadmap', suggestedUserId: 'u1', suggestedDueDate: '2026-08-20' },
      context,
    )
    expect(payload).toEqual({
      appId: 'app1',
      sprintId: 'sprint1',
      title: 'Ship the roadmap',
      assigneeId: 'u1',
      dueDate: '2026-08-20',
      priority: 0,
      status: 'todo',
    })
  })

  it('handles the null cases: no suggested assignee, no suggested due date', () => {
    const payload = suggestionToTaskPayload(
      { text: 'Follow up with design', suggestedUserId: null, suggestedDueDate: null },
      context,
    )
    expect(payload.assigneeId).toBeNull()
    expect(payload.dueDate).toBeNull()
  })

  it('drops an unparseable suggested due date to null', () => {
    const payload = suggestionToTaskPayload(
      { text: 'Investigate the flaky test', suggestedUserId: null, suggestedDueDate: 'sometime soon' },
      context,
    )
    expect(payload.dueDate).toBeNull()
  })

  it('an override wins over the original suggestion', () => {
    const payload = suggestionToTaskPayload(
      { text: 'Ship the roadmap', suggestedUserId: 'u1', suggestedDueDate: '2026-08-20' },
      context,
      { title: 'Ship the Q3 roadmap', assigneeId: 'u2', dueDate: '2026-09-01', priority: 2 },
    )
    expect(payload).toEqual({
      appId: 'app1',
      sprintId: 'sprint1',
      title: 'Ship the Q3 roadmap',
      assigneeId: 'u2',
      dueDate: '2026-09-01',
      priority: 2,
      status: 'todo',
    })
  })

  it('an override explicitly clearing the assignee/due date to null is respected, not treated as "unset"', () => {
    const payload = suggestionToTaskPayload(
      { text: 'Ship the roadmap', suggestedUserId: 'u1', suggestedDueDate: '2026-08-20' },
      context,
      { assigneeId: null, dueDate: null },
    )
    expect(payload.assigneeId).toBeNull()
    expect(payload.dueDate).toBeNull()
  })

  it('trims a title override', () => {
    const payload = suggestionToTaskPayload(
      { text: 'Ship the roadmap', suggestedUserId: null, suggestedDueDate: null },
      context,
      { title: '  Ship it  ' },
    )
    expect(payload.title).toBe('Ship it')
  })
})

describe('orderNoteSegments', () => {
  function seg(overrides: Partial<OrderableSegment>): OrderableSegment {
    return {
      id: 's1',
      source: 'typed',
      startedAtMs: null,
      createdAt: new Date('2026-08-10T10:00:00Z'),
      ...overrides,
    }
  }

  it('orders typed/ai segments by createdAt', () => {
    const early = seg({ id: 'a', source: 'typed', createdAt: new Date('2026-08-10T09:00:00Z') })
    const late = seg({ id: 'b', source: 'ai', createdAt: new Date('2026-08-10T11:00:00Z') })
    expect(orderNoteSegments([late, early]).map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('orders same-createdAt voice segments by startedAtMs', () => {
    const sameTime = new Date('2026-08-10T10:00:00Z')
    const second = seg({ id: 'b', source: 'voice', createdAt: sameTime, startedAtMs: 5000 })
    const first = seg({ id: 'a', source: 'voice', createdAt: sameTime, startedAtMs: 1000 })
    expect(orderNoteSegments([second, first]).map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('is stable — preserves input order when createdAt and startedAtMs both tie (or are both missing)', () => {
    const sameTime = new Date('2026-08-10T10:00:00Z')
    const a = seg({ id: 'a', source: 'typed', createdAt: sameTime })
    const b = seg({ id: 'b', source: 'typed', createdAt: sameTime })
    const c = seg({ id: 'c', source: 'typed', createdAt: sameTime })
    expect(orderNoteSegments([a, b, c]).map((s) => s.id)).toEqual(['a', 'b', 'c'])
    expect(orderNoteSegments([c, b, a]).map((s) => s.id)).toEqual(['c', 'b', 'a'])
  })

  it('falls back to stable order for a voice segment missing startedAtMs among same-createdAt siblings', () => {
    const sameTime = new Date('2026-08-10T10:00:00Z')
    const noOffset = seg({ id: 'a', source: 'voice', createdAt: sameTime, startedAtMs: null })
    const withOffset = seg({ id: 'b', source: 'voice', createdAt: sameTime, startedAtMs: 1000 })
    // The offset-bearing segment carries real ordering info; the one missing
    // it doesn't displace it — input order otherwise decides.
    expect(orderNoteSegments([noOffset, withOffset]).map((s) => s.id)).toEqual(['b', 'a'])
    expect(orderNoteSegments([withOffset, noOffset]).map((s) => s.id)).toEqual(['b', 'a'])
  })

  it('interleaves typed, voice, and ai segments purely by createdAt', () => {
    const typedFirst = seg({ id: 'typed', source: 'typed', createdAt: new Date('2026-08-10T09:00:00Z') })
    const voiceMid = seg({
      id: 'voice',
      source: 'voice',
      createdAt: new Date('2026-08-10T09:30:00Z'),
      startedAtMs: 0,
    })
    const aiLast = seg({ id: 'ai', source: 'ai', createdAt: new Date('2026-08-10T10:00:00Z') })
    expect(orderNoteSegments([aiLast, typedFirst, voiceMid]).map((s) => s.id)).toEqual([
      'typed',
      'voice',
      'ai',
    ])
  })

  it('returns an empty array given no segments', () => {
    expect(orderNoteSegments([])).toEqual([])
  })
})
