import { describe, expect, it } from 'vitest'
import {
  activityDaySummary,
  activityPhrase,
  activityPhraseParts,
  groupActivityByDay,
  groupActivityBursts,
} from './format'
import type { ActivityRow } from './types'

function row(overrides: Partial<ActivityRow>): ActivityRow {
  return {
    id: 'r1',
    actorId: 'u1',
    actorName: 'Someone',
    actorAvatarUrl: null,
    verb: 'created',
    entityType: 'task',
    entityId: 'e1',
    entityLabel: 'Thing',
    appId: null,
    appName: null,
    pagePath: null,
    detail: null,
    metadata: null,
    createdAt: new Date('2026-08-12T04:00:00.000Z'),
    ...overrides,
  }
}

describe('activityPhrase', () => {
  it('composes verb + entity type', () => {
    expect(activityPhrase({ verb: 'moved', entityType: 'task' })).toBe('moved task')
    expect(activityPhrase({ verb: 'rsvp', entityType: 'meeting' })).toBe(
      'responded to meeting',
    )
  })

  it('drops the entity type for comments — the label is the thing commented on', () => {
    expect(activityPhrase({ verb: 'commented', entityType: 'comment' })).toBe('commented on')
  })

  it('passes an unknown verb through verbatim', () => {
    expect(activityPhrase({ verb: 'archived', entityType: 'app' })).toBe('archived app')
  })
})

describe('groupActivityByDay', () => {
  // Business timezone is Asia/Colombo (+05:30): 2026-08-12T04:00Z is 09:30
  // on the 12th there, and 2026-08-11T20:00Z is already 01:30 on the 12th.
  const now = new Date('2026-08-12T06:00:00.000Z')

  it('buckets by Colombo calendar day, not UTC day', () => {
    const groups = groupActivityByDay(
      [
        row({ id: 'a', createdAt: new Date('2026-08-12T04:00:00.000Z') }),
        row({ id: 'b', createdAt: new Date('2026-08-11T20:00:00.000Z') }), // 12th in Colombo
        row({ id: 'c', createdAt: new Date('2026-08-11T10:00:00.000Z') }),
      ],
      now,
    )
    expect(groups.map((g) => [g.dayIso, g.rows.length])).toEqual([
      ['2026-08-12', 2],
      ['2026-08-11', 1],
    ])
  })

  it('labels today and yesterday relative to the given now', () => {
    const groups = groupActivityByDay(
      [
        row({ id: 'a', createdAt: new Date('2026-08-12T04:00:00.000Z') }),
        row({ id: 'b', createdAt: new Date('2026-08-11T10:00:00.000Z') }),
        row({ id: 'c', createdAt: new Date('2026-08-01T10:00:00.000Z') }),
      ],
      now,
    )
    expect(groups.map((g) => g.relativeLabel)).toEqual(['Today', 'Yesterday', ''])
  })

  it('returns no groups for no rows', () => {
    expect(groupActivityByDay([], now)).toEqual([])
  })
})

describe('activityPhraseParts', () => {
  it('keeps verb and entity type separable so the type can be a filter link', () => {
    expect(activityPhraseParts({ verb: 'moved', entityType: 'task' })).toEqual({
      verb: 'moved',
      entityType: 'task',
    })
  })

  it('has no type to link for a comment — the label is the thing commented on', () => {
    expect(activityPhraseParts({ verb: 'commented', entityType: 'comment' })).toEqual({
      verb: 'commented on',
      entityType: null,
    })
  })

  it('stays consistent with activityPhrase for every shape', () => {
    for (const input of [
      { verb: 'moved', entityType: 'task' },
      { verb: 'commented', entityType: 'comment' },
      { verb: 'archived', entityType: 'app' },
    ]) {
      const parts = activityPhraseParts(input)
      const joined = parts.entityType ? `${parts.verb} ${parts.entityType}` : parts.verb
      expect(joined).toBe(activityPhrase(input))
    }
  })
})

describe('activityDaySummary', () => {
  it('counts changes and DISTINCT people', () => {
    expect(
      activityDaySummary([
        row({ id: 'a', actorId: 'u1' }),
        row({ id: 'b', actorId: 'u1' }),
        row({ id: 'c', actorId: 'u2' }),
      ]),
    ).toEqual({ changes: 3, people: 2 })
  })

  it('is zero for an empty day', () => {
    expect(activityDaySummary([])).toEqual({ changes: 0, people: 0 })
  })
})

describe('groupActivityBursts', () => {
  it('collapses a consecutive run by one actor on one entity', () => {
    const entries = groupActivityBursts([
      row({ id: 'a', actorId: 'u1', entityType: 'meeting', entityId: 'm1' }),
      row({ id: 'b', actorId: 'u1', entityType: 'meeting', entityId: 'm1' }),
      row({ id: 'c', actorId: 'u1', entityType: 'meeting', entityId: 'm1' }),
    ])
    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe('burst')
    expect(entries[0].kind === 'burst' && entries[0].rows.map((r) => r.id)).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('does NOT collapse the same actor across different entities', () => {
    const entries = groupActivityBursts([
      row({ id: 'a', actorId: 'u1', entityType: 'task', entityId: 't1' }),
      row({ id: 'b', actorId: 'u1', entityType: 'task', entityId: 't2' }),
    ])
    expect(entries.map((e) => e.kind)).toEqual(['event', 'event'])
  })

  it('does NOT collapse the same entity across different actors', () => {
    const entries = groupActivityBursts([
      row({ id: 'a', actorId: 'u1', entityType: 'task', entityId: 't1' }),
      row({ id: 'b', actorId: 'u2', entityType: 'task', entityId: 't1' }),
    ])
    expect(entries.map((e) => e.kind)).toEqual(['event', 'event'])
  })

  it('does NOT collapse the same id under different entity types', () => {
    const entries = groupActivityBursts([
      row({ id: 'a', actorId: 'u1', entityType: 'task', entityId: 'x' }),
      row({ id: 'b', actorId: 'u1', entityType: 'comment', entityId: 'x' }),
    ])
    expect(entries.map((e) => e.kind)).toEqual(['event', 'event'])
  })

  it('breaks a run when someone else changes something in the middle', () => {
    const entries = groupActivityBursts([
      row({ id: 'a', actorId: 'u1', entityType: 'meeting', entityId: 'm1' }),
      row({ id: 'b', actorId: 'u1', entityType: 'meeting', entityId: 'm1' }),
      row({ id: 'c', actorId: 'u2', entityType: 'meeting', entityId: 'm1' }),
      row({ id: 'd', actorId: 'u1', entityType: 'meeting', entityId: 'm1' }),
      row({ id: 'e', actorId: 'u1', entityType: 'meeting', entityId: 'm1' }),
    ])
    expect(entries.map((e) => e.kind)).toEqual(['burst', 'event', 'burst'])
    expect(entries.map((e) => e.key)).toEqual(['a', 'c', 'd'])
  })

  it('leaves a run of one as an ordinary event', () => {
    const entries = groupActivityBursts([row({ id: 'a' })])
    expect(entries).toEqual([{ kind: 'event', key: 'a', row: row({ id: 'a' }) }])
  })

  it('preserves stream order and loses no row', () => {
    const rows = [
      row({ id: 'a', actorId: 'u1', entityId: 'e1' }),
      row({ id: 'b', actorId: 'u1', entityId: 'e1' }),
      row({ id: 'c', actorId: 'u2', entityId: 'e2' }),
      row({ id: 'd', actorId: 'u3', entityId: 'e3' }),
      row({ id: 'e', actorId: 'u3', entityId: 'e3' }),
      row({ id: 'f', actorId: 'u3', entityId: 'e3' }),
    ]
    const flattened = groupActivityBursts(rows).flatMap((entry) =>
      entry.kind === 'event' ? [entry.row] : entry.rows,
    )
    expect(flattened.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })

  it('returns no entries for no rows', () => {
    expect(groupActivityBursts([])).toEqual([])
  })
})
