import { describe, it, expect } from 'vitest'
import {
  resolveSpeakerUserId,
  resolveSpeakerName,
  resolveSpeakerNameForLabel,
  normalizeDueDate,
  planSpeakerAssignment,
  suggestionToTaskPayload,
  orderNoteSegments,
  shouldAutoAssign,
  partitionAutoAssign,
  canUndoAutoAssign,
  buildAutoAssignNotification,
  resolveSuggestedAppId,
  assembleMeetingPrep,
  AUTO_ASSIGN_CONFIDENCE,
  MAX_AUTO_TASKS_PER_MEETING,
  type OrderableSegment,
  type AutoAssignCandidate,
  type AutoAssignedTaskFields,
} from './notes'

// No attendee fixture here on purpose: resolution no longer consults the
// attendee list at all. "Kasun Silva" below is a name that IS a real attendee
// in this file's other fixtures — that is exactly the point of the guard.
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

describe('resolveSpeakerName', () => {
  it('prefers the mapped user name over a typed name and the label', () => {
    expect(
      resolveSpeakerName({ userName: 'Kasun Silva', displayName: 'Kas', label: 'Speaker 1' }),
    ).toBe('Kasun Silva')
  })

  it('falls back to the typed name when no user is mapped', () => {
    expect(
      resolveSpeakerName({ userName: null, displayName: 'Ravi (client)', label: 'Speaker 2' }),
    ).toBe('Ravi (client)')
  })

  it('falls back to the raw label when neither is set', () => {
    expect(resolveSpeakerName({ userName: null, displayName: null, label: 'Speaker 3' })).toBe(
      'Speaker 3',
    )
  })

  it('treats blank names as absent rather than blanking out the label', () => {
    expect(resolveSpeakerName({ userName: '   ', displayName: '', label: 'Speaker 1' })).toBe(
      'Speaker 1',
    )
  })

  it('trims the name it returns', () => {
    expect(resolveSpeakerName({ displayName: '  Ravi  ' })).toBe('Ravi')
  })

  it('returns null when nothing at all is known', () => {
    expect(resolveSpeakerName({})).toBeNull()
    expect(resolveSpeakerName({ userName: null, displayName: null, label: null })).toBeNull()
  })
})

describe('resolveSpeakerNameForLabel', () => {
  const speakers = [
    { label: 'Speaker 1', userId: 'u2', userName: 'Kasun Silva', displayName: null },
    { label: 'Speaker 2', userId: null, userName: null, displayName: 'Ravi (client)' },
    { label: 'Speaker 3', userId: null, userName: null, displayName: null },
  ]

  it('resolves a mapped user by label', () => {
    expect(resolveSpeakerNameForLabel('Speaker 1', speakers)).toBe('Kasun Silva')
  })

  it('resolves a typed name by label', () => {
    expect(resolveSpeakerNameForLabel('Speaker 2', speakers)).toBe('Ravi (client)')
  })

  it('keeps the label for a mapping that names nobody', () => {
    expect(resolveSpeakerNameForLabel('Speaker 3', speakers)).toBe('Speaker 3')
  })

  it('keeps the label when no mapping exists yet', () => {
    expect(resolveSpeakerNameForLabel('Speaker 9', speakers)).toBe('Speaker 9')
  })

  it('returns null for a missing label', () => {
    expect(resolveSpeakerNameForLabel(null, speakers)).toBeNull()
    expect(resolveSpeakerNameForLabel(undefined, speakers)).toBeNull()
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

describe('resolveSuggestedAppId', () => {
  const apps = [
    { id: 'a1', name: 'LogPup' },
    { id: 'a2', name: 'Fleet Tracker' },
  ]

  it('returns null for null/undefined/empty/whitespace names', () => {
    expect(resolveSuggestedAppId(null, apps)).toBeNull()
    expect(resolveSuggestedAppId(undefined, apps)).toBeNull()
    expect(resolveSuggestedAppId('', apps)).toBeNull()
    expect(resolveSuggestedAppId('   ', apps)).toBeNull()
  })

  it('resolves an exact name match', () => {
    expect(resolveSuggestedAppId('LogPup', apps)).toBe('a1')
    expect(resolveSuggestedAppId('  Fleet Tracker  ', apps)).toBe('a2')
  })

  it('prefers the exact-case match when a differently-cased sibling also exists', () => {
    const cased = [...apps, { id: 'a3', name: 'logpup' }]
    expect(resolveSuggestedAppId('LogPup', cased)).toBe('a1')
    expect(resolveSuggestedAppId('logpup', cased)).toBe('a3')
  })

  it('falls back to an unambiguous case-insensitive match', () => {
    expect(resolveSuggestedAppId('logpup', apps)).toBe('a1')
    expect(resolveSuggestedAppId('FLEET TRACKER', apps)).toBe('a2')
  })

  it('returns null when case-insensitive matching is ambiguous', () => {
    const cased = [...apps, { id: 'a3', name: 'logpup' }]
    // 'LOGPUP' matches neither exactly; two DISTINCT apps match loosely.
    expect(resolveSuggestedAppId('LOGPUP', cased)).toBeNull()
  })

  it('returns null when two different apps share the exact same name', () => {
    const dupes = [...apps, { id: 'a9', name: 'LogPup' }]
    expect(resolveSuggestedAppId('LogPup', dupes)).toBeNull()
  })

  it('does not treat the SAME app listed twice (union across attendees) as ambiguous', () => {
    const union = [...apps, { id: 'a1', name: 'LogPup' }]
    expect(resolveSuggestedAppId('LogPup', union)).toBe('a1')
  })

  it('returns null for a name the model invented', () => {
    expect(resolveSuggestedAppId('Payroll', apps)).toBeNull()
  })
})

describe('assembleMeetingPrep', () => {
  const attendees = [
    { id: 'u1', name: 'Nadeesha Perera' },
    { id: 'u2', name: 'Kasun Silva' },
  ]
  const assignments = [
    { userId: 'u1', appId: 'a1', appName: 'LogPup', appSlug: 'logpup' },
    { userId: 'u1', appId: 'a2', appName: 'Fleet Tracker', appSlug: 'fleet' },
  ]
  const sprints = [
    {
      sprintId: 's1',
      sprintName: 'Sprint 4',
      appId: 'a1',
      appName: 'LogPup',
      appSlug: 'logpup',
      startDate: '2026-08-03',
    },
    {
      sprintId: 's2',
      sprintName: 'Sprint 9',
      appId: 'a2',
      appName: 'Fleet Tracker',
      appSlug: 'fleet',
      startDate: '2026-08-01',
    },
  ]
  const today = '2026-08-12'

  const base = { attendees, assignments, sprints, tasks: [], checkins: [], todayIso: today }

  it('returns empty apps, no check-in, no target for an attendee linked to nothing', () => {
    const [, kasun] = assembleMeetingPrep(base)
    expect(kasun.userId).toBe('u2')
    expect(kasun.apps).toEqual([])
    expect(kasun.checkin).toBeNull()
    expect(kasun.checkinTarget).toBeNull()
  })

  it('counts open and overdue tasks in the current sprint — done excluded, due-today not overdue', () => {
    const tasks = [
      { sprintId: 's1', assigneeId: 'u1', status: 'todo' as const, dueDate: '2026-08-10' },
      { sprintId: 's1', assigneeId: 'u1', status: 'in_progress' as const, dueDate: today },
      { sprintId: 's1', assigneeId: 'u1', status: 'done' as const, dueDate: '2026-08-01' },
      // Someone else's task never lands in u1's counts.
      { sprintId: 's1', assigneeId: 'u2', status: 'todo' as const, dueDate: '2026-08-01' },
    ]
    const [nadeesha] = assembleMeetingPrep({ ...base, tasks })
    const logpup = nadeesha.apps.find((app) => app.appId === 'a1')
    expect(logpup).toMatchObject({ sprintId: 's1', openCount: 2, overdueCount: 1 })
  })

  it('discovers an app from current-sprint tasks even without an assignment row', () => {
    const tasks = [{ sprintId: 's1', assigneeId: 'u2', status: 'todo' as const, dueDate: null }]
    const [, kasun] = assembleMeetingPrep({ ...base, tasks })
    expect(kasun.apps.map((app) => app.appId)).toEqual(['a1'])
  })

  it('sorts apps by name and reports null sprint (zero counts) for an app with nothing running', () => {
    const noFleetSprint = sprints.filter((sprint) => sprint.appId !== 'a2')
    const [nadeesha] = assembleMeetingPrep({ ...base, sprints: noFleetSprint })
    expect(nadeesha.apps.map((app) => app.appName)).toEqual(['Fleet Tracker', 'LogPup'])
    expect(nadeesha.apps[0]).toMatchObject({ sprintId: null, openCount: 0, overdueCount: 0 })
  })

  it('treats the most recently started sprint as THE current sprint when two overlap', () => {
    const overlapping = [
      ...sprints,
      {
        sprintId: 's3',
        sprintName: 'Sprint 5',
        appId: 'a1',
        appName: 'LogPup',
        appSlug: 'logpup',
        startDate: '2026-08-10',
      },
    ]
    const [nadeesha] = assembleMeetingPrep({ ...base, sprints: overlapping })
    expect(nadeesha.apps.find((app) => app.appId === 'a1')?.sprintId).toBe('s3')
  })

  it('picks the latest check-in by updatedAt and derives the gap against that sprint', () => {
    const tasks = [
      { sprintId: 's1', assigneeId: 'u1', status: 'done' as const, dueDate: null },
      { sprintId: 's1', assigneeId: 'u1', status: 'todo' as const, dueDate: null },
    ]
    const checkins = [
      {
        sprintId: 's2',
        userId: 'u1',
        percent: 20,
        note: null,
        updatedAt: new Date('2026-08-10T09:00:00Z'),
      },
      {
        sprintId: 's1',
        userId: 'u1',
        percent: 90,
        note: 'nearly there',
        updatedAt: new Date('2026-08-11T09:00:00Z'),
      },
    ]
    const [nadeesha] = assembleMeetingPrep({ ...base, tasks, checkins })
    // Board says 50 (1 of 2 done); saying 90 is more than 15 points ahead.
    expect(nadeesha.checkin).toMatchObject({
      sprintId: 's1',
      percent: 90,
      note: 'nearly there',
      computedPercent: 50,
      gap: 'ahead',
    })
    // The target follows the existing check-in — update, don't scatter.
    expect(nadeesha.checkinTarget).toMatchObject({ sprintId: 's1', computedPercent: 50 })
  })

  it('reports gap "unknown" when the board has no tasks for the person', () => {
    const checkins = [
      { sprintId: 's1', userId: 'u1', percent: 40, note: null, updatedAt: new Date() },
    ]
    const [nadeesha] = assembleMeetingPrep({ ...base, checkins })
    expect(nadeesha.checkin).toMatchObject({ computedPercent: null, gap: 'unknown' })
  })

  it('ignores a check-in on a sprint that is not one of their apps’ current sprints', () => {
    const checkins = [
      { sprintId: 's-old', userId: 'u1', percent: 100, note: null, updatedAt: new Date() },
    ]
    const [nadeesha] = assembleMeetingPrep({ ...base, checkins })
    expect(nadeesha.checkin).toBeNull()
  })

  it('falls back to the first app (alphabetically) with a running sprint as the check-in target', () => {
    const [nadeesha] = assembleMeetingPrep(base)
    // Fleet Tracker sorts before LogPup; its sprint s2 becomes the target.
    expect(nadeesha.checkinTarget).toMatchObject({
      sprintId: 's2',
      sprintName: 'Sprint 9',
      appName: 'Fleet Tracker',
      computedPercent: null,
    })
    expect(nadeesha.checkin).toBeNull()
  })
})
