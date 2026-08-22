import { describe, expect, it } from 'vitest'
import {
  classifyActivity,
  groupByUserDay,
  isOutcome,
  observationsFromActivity,
  observationsFromSelfScores,
  observationsFromWitnesses,
  type ActivityRow,
} from './observe'

const row = (over: Partial<ActivityRow> = {}): ActivityRow => ({
  actorId: 'u1',
  verb: 'completed',
  entityType: 'task',
  appId: 'app1',
  createdAt: new Date('2026-08-18T09:00:00Z'),
  day: '2026-08-18',
  ...over,
})

describe('what counts as evidence', () => {
  it('reads a finished task as an outcome', () => {
    expect(classifyActivity(row())).toBe('task.completed')
    expect(isOutcome('task.completed')).toBe(true)
  })

  it('reads a moved card as presence, not as an outcome', () => {
    expect(classifyActivity(row({ verb: 'moved' }))).toBe('task.moved')
    expect(isOutcome('task.moved')).toBe(false)
  })

  it('does not treat reopening as a thing finishing', () => {
    // Undoing a completion is work, but it is not an outcome — and counting
    // it as one would let a done/reopen loop manufacture evidence.
    expect(isOutcome(classifyActivity(row({ verb: 'reopened' })) ?? 'commit')).toBe(false)
  })

  it('ignores verbs that change nothing a colleague can see', () => {
    // Signing in, exporting, and reading somebody else's board all write rows
    // here. Counting them would make the busiest-looking person the one who
    // clicks around most.
    expect(classifyActivity(row({ verb: 'exported', entityType: 'app' }))).toBeNull()
    expect(classifyActivity(row({ verb: 'created', entityType: 'session' }))).toBeNull()
  })

  it('does not accept an RSVP as attendance', () => {
    // Otherwise a whole week corroborates by clicking Yes on invitations.
    expect(classifyActivity(row({ verb: 'rsvp', entityType: 'meeting' }))).toBeNull()
    expect(classifyActivity(row({ verb: 'attended', entityType: 'meeting' }))).toBe(
      'meeting.attended',
    )
  })

  it('is case- and whitespace-tolerant about the free-text columns', () => {
    // verb and entity_type are plain text shared with every other feature.
    expect(classifyActivity(row({ verb: ' Completed ', entityType: ' Task ' }))).toBe(
      'task.completed',
    )
  })

  it('drops unclassifiable rows rather than bucketing them somewhere', () => {
    expect(observationsFromActivity([row(), row({ verb: 'yeeted', entityType: 'app' })])).toHaveLength(1)
  })
})

describe('the two witnesses that never reach activity_log', () => {
  it('carries commits and voice turns', () => {
    const out = observationsFromWitnesses({
      commits: [{ userId: 'u1', day: '2026-08-18', appId: null, at: new Date() }],
      voiceTurns: [{ userId: 'u1', day: '2026-08-18', appId: null, at: new Date() }],
    })
    expect(out.map((o) => o.kind)).toEqual(['commit', 'meeting.spoke'])
  })

  it('rates a commit as an outcome and speaking as presence', () => {
    expect(isOutcome('commit')).toBe(true)
    expect(isOutcome('meeting.spoke')).toBe(false)
  })
})

describe('a self-score as the weakest honest trace', () => {
  it('counts a score WITH a note', () => {
    const out = observationsFromSelfScores([
      { userId: 'u1', day: '2026-08-18', note: 'Spent the day on the migration', at: new Date() },
    ])
    expect(out).toHaveLength(1)
    expect(isOutcome(out[0].kind)).toBe(false)
  })

  it('does not count a bare number', () => {
    // A score with no note is a click. A sentence is an account somebody can
    // be held to, which is the whole difference.
    expect(
      observationsFromSelfScores([
        { userId: 'u1', day: '2026-08-18', note: null, at: new Date() },
        { userId: 'u1', day: '2026-08-19', note: '   ', at: new Date() },
      ]),
    ).toEqual([])
  })
})

describe('grouping', () => {
  it('keeps people and days apart', () => {
    const grouped = groupByUserDay([
      ...observationsFromActivity([row(), row({ day: '2026-08-19' }), row({ actorId: 'u2' })]),
    ])
    expect(grouped.get('u1|2026-08-18')).toHaveLength(1)
    expect(grouped.get('u1|2026-08-19')).toHaveLength(1)
    expect(grouped.get('u2|2026-08-18')).toHaveLength(1)
  })
})
