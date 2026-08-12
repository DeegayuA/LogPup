import { describe, expect, it } from 'vitest'
import { activityPhrase, groupActivityByDay } from './format'
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
