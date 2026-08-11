import { describe, it, expect } from 'vitest'
import {
  resolveSpeakerUserId,
  normalizeDueDate,
  suggestionToTaskPayload,
  orderNoteSegments,
  type OrderableSegment,
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
