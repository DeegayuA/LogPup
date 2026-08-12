import { describe, it, expect } from 'vitest'
import {
  resolveSpeakerUserId,
  normalizeDueDate,
  suggestionToTaskPayload,
  orderNoteSegments,
  shouldAutoAssign,
  partitionAutoAssign,
  canUndoAutoAssign,
  buildAutoAssignNotification,
  AUTO_ASSIGN_CONFIDENCE,
  MAX_AUTO_TASKS_PER_MEETING,
  type OrderableSegment,
  type AutoAssignCandidate,
  type AutoAssignedTaskFields,
} from './notes'

describe('resolveSpeakerUserId', () => {
  const attendees = [
    { id: 'u1', name: 'Nadeesha Perera' },
    { id: 'u2', name: 'Kasun Silva' },
  ]

  it('returns null for a null/empty label', () => {
    expect(resolveSpeakerUserId(null, [], attendees)).toBeNull()
    expect(resolveSpeakerUserId('', [], attendees)).toBeNull()
  })

  it('uses an explicit mapping when one exists', () => {
    const mappings = [{ label: 'Speaker 1', userId: 'u2' }]
    expect(resolveSpeakerUserId('Speaker 1', mappings, attendees)).toBe('u2')
  })

  it('honors an explicit "not a listed attendee" mapping (null) without falling back to name-matching', () => {
    const mappings = [{ label: 'Nadeesha Perera', userId: null }]
    expect(resolveSpeakerUserId('Nadeesha Perera', mappings, attendees)).toBeNull()
  })

  it('falls back to matching the label as a name when no mapping exists', () => {
    expect(resolveSpeakerUserId('Kasun Silva', [], attendees)).toBe('u2')
  })

  it('falls back to matching an unambiguous first name', () => {
    expect(resolveSpeakerUserId('Kasun', [], attendees)).toBe('u2')
  })

  it('returns null for a generic "Speaker N" label with no mapping and no name match', () => {
    expect(resolveSpeakerUserId('Speaker 2', [], attendees)).toBeNull()
  })

  it('prefers the mapping for one label over a same-meeting mapping for a different label', () => {
    const mappings = [
      { label: 'Speaker 1', userId: 'u1' },
      { label: 'Speaker 2', userId: 'u2' },
    ]
    expect(resolveSpeakerUserId('Speaker 2', mappings, attendees)).toBe('u2')
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

describe('shouldAutoAssign', () => {
  const eligible: AutoAssignCandidate = {
    confidence: 0.95,
    resolvedUserId: 'u1',
    hasApp: true,
  }

  it('auto-assigns when confidence, assignee, and app all hold', () => {
    expect(shouldAutoAssign(eligible)).toBe(true)
  })

  it('accepts confidence exactly at the threshold', () => {
    expect(shouldAutoAssign({ ...eligible, confidence: AUTO_ASSIGN_CONFIDENCE })).toBe(true)
  })

  it('rejects confidence just below the threshold', () => {
    expect(shouldAutoAssign({ ...eligible, confidence: AUTO_ASSIGN_CONFIDENCE - 0.01 })).toBe(false)
  })

  it('rejects a null confidence — silence is not confidence', () => {
    expect(shouldAutoAssign({ ...eligible, confidence: null })).toBe(false)
  })

  it('rejects a non-finite confidence', () => {
    expect(shouldAutoAssign({ ...eligible, confidence: NaN })).toBe(false)
    expect(shouldAutoAssign({ ...eligible, confidence: Infinity })).toBe(false)
  })

  it('rejects an unresolved assignee', () => {
    expect(shouldAutoAssign({ ...eligible, resolvedUserId: null })).toBe(false)
  })

  it('rejects a meeting with no linked app', () => {
    expect(shouldAutoAssign({ ...eligible, hasApp: false })).toBe(false)
  })

  it('rejects when every condition fails at once', () => {
    expect(shouldAutoAssign({ confidence: 0.1, resolvedUserId: null, hasApp: false })).toBe(false)
  })
})

describe('partitionAutoAssign', () => {
  function eligible(): AutoAssignCandidate {
    return { confidence: 0.9, resolvedUserId: 'u1', hasApp: true }
  }

  it('auto-accepts every eligible candidate under the cap', () => {
    const candidates = [eligible(), eligible(), eligible()]
    const decisions = partitionAutoAssign(candidates, 10)
    expect(decisions).toEqual([
      { autoAccept: true, capped: false },
      { autoAccept: true, capped: false },
      { autoAccept: true, capped: false },
    ])
  })

  it('11 eligible candidates against the default cap of 10 auto-accepts 10 and caps 1', () => {
    const candidates = Array.from({ length: 11 }, eligible)
    const decisions = partitionAutoAssign(candidates)
    expect(decisions.length).toBe(11)
    expect(decisions.filter((d) => d.autoAccept)).toHaveLength(MAX_AUTO_TASKS_PER_MEETING)
    expect(decisions.filter((d) => d.capped)).toHaveLength(1)
    // The cap applies in order — the LAST one is the one held back.
    expect(decisions.slice(0, 10).every((d) => d.autoAccept)).toBe(true)
    expect(decisions[10]).toEqual({ autoAccept: false, capped: true })
  })

  it('an ineligible candidate is neither auto-accepted nor counted as capped', () => {
    const candidates = [
      eligible(),
      { confidence: 0.1, resolvedUserId: null, hasApp: true } as AutoAssignCandidate,
    ]
    const decisions = partitionAutoAssign(candidates, 10)
    expect(decisions[1]).toEqual({ autoAccept: false, capped: false })
  })

  it('a custom cap of 0 caps every eligible candidate', () => {
    const decisions = partitionAutoAssign([eligible(), eligible()], 0)
    expect(decisions).toEqual([
      { autoAccept: false, capped: true },
      { autoAccept: false, capped: true },
    ])
  })

  it('returns an empty array given no candidates', () => {
    expect(partitionAutoAssign([])).toEqual([])
  })
})

describe('canUndoAutoAssign', () => {
  const original: AutoAssignedTaskFields = {
    status: 'todo',
    title: 'Ship the roadmap',
    assigneeId: 'u1',
    dueDate: '2026-08-20',
  }

  it('allows undo when the task is still todo and unmodified', () => {
    expect(canUndoAutoAssign(original, original)).toBe(true)
  })

  it('refuses undo once the task has moved past todo', () => {
    expect(canUndoAutoAssign({ ...original, status: 'in_progress' }, original)).toBe(false)
    expect(canUndoAutoAssign({ ...original, status: 'done' }, original)).toBe(false)
  })

  it('refuses undo once the title was edited', () => {
    expect(canUndoAutoAssign({ ...original, title: 'Ship the Q3 roadmap' }, original)).toBe(false)
  })

  it('refuses undo once it was reassigned', () => {
    expect(canUndoAutoAssign({ ...original, assigneeId: 'u2' }, original)).toBe(false)
    expect(canUndoAutoAssign({ ...original, assigneeId: null }, original)).toBe(false)
  })

  it('refuses undo once the due date was changed', () => {
    expect(canUndoAutoAssign({ ...original, dueDate: '2026-09-01' }, original)).toBe(false)
    expect(canUndoAutoAssign({ ...original, dueDate: null }, original)).toBe(false)
  })
})

describe('buildAutoAssignNotification', () => {
  const base = {
    assigneeId: 'u2',
    recorderId: 'u1',
    recorderName: 'Nadeesha Perera',
    taskTitle: 'Ship the roadmap',
    meetingId: 'm1',
    meetingTitle: 'Weekly sync',
  }

  it('builds a mention-shaped notification for the assignee', () => {
    const payload = buildAutoAssignNotification(base)
    expect(payload).toEqual({
      userId: 'u2',
      actorId: 'u1',
      type: 'mention',
      title: 'Nadeesha Perera assigned you a task',
      body: '“Ship the roadmap” — from “Weekly sync”',
      link: '/meetings',
      meetingId: 'm1',
    })
  })

  it('returns null when the assignee is the recorder — no self-notification', () => {
    expect(buildAutoAssignNotification({ ...base, assigneeId: 'u1' })).toBeNull()
  })

  it('falls back to "Someone" when the recorder has no name', () => {
    const payload = buildAutoAssignNotification({ ...base, recorderName: null })
    expect(payload?.title).toBe('Someone assigned you a task')
  })
})
