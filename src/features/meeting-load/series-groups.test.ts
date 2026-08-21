import { describe, expect, it } from 'vitest'
import { groupIntoSeries, type SeriesOccurrenceInput } from './series-groups'

const NOW = new Date('2026-08-21T09:00:00Z')
const daysBefore = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)

function occurrence(over: Partial<SeriesOccurrenceInput> & { meetingId: string }): SeriesOccurrenceInput {
  const startsAt = over.startsAt ?? daysBefore(1)
  return {
    title: 'Vela standup',
    appId: 'app-1',
    startsAt,
    endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000),
    createdBy: 'user-1',
    inviteUserIds: ['a', 'b'],
    ...over,
  }
}

describe('groupIntoSeries — the establishment window', () => {
  it('establishes on two occurrences 179 days apart — both are inside the window', () => {
    const groups = groupIntoSeries([
      occurrence({ meetingId: 'm1', startsAt: daysBefore(0) }),
      occurrence({ meetingId: 'm2', startsAt: daysBefore(179) }),
    ], NOW)
    expect(groups).toHaveLength(1)
    expect(groups[0].occurrences).toHaveLength(2)
    expect(groups[0].established).toBe(true)
  })

  it('does not establish at 181 days — the older one falls out and one is not a series', () => {
    const groups = groupIntoSeries([
      occurrence({ meetingId: 'm1', startsAt: daysBefore(0) }),
      occurrence({ meetingId: 'm2', startsAt: daysBefore(181) }),
    ], NOW)
    expect(groups[0].occurrences).toHaveLength(1)
    expect(groups[0].established).toBe(false)
  })

  it('keeps only the six most recent occurrences', () => {
    const groups = groupIntoSeries(
      [0, 1, 2, 3, 4, 5, 6].map((n) => occurrence({ meetingId: `m${n}`, startsAt: daysBefore(n * 7) })),
      NOW,
    )
    expect(groups[0].occurrences).toHaveLength(6)
    // Newest first, and it is the newest six that survive — not the first six seen.
    expect(groups[0].occurrences[0].meetingId).toBe('m0')
    expect(groups[0].occurrences.map((o) => o.meetingId)).not.toContain('m6')
  })
})

describe('groupIntoSeries — identity', () => {
  it('groups two app-less meetings with the same title together', () => {
    // The JS-Map-vs-SQL-NULL trap: `NULL != NULL` in SQL would split these into
    // two singletons that could never establish. The '__none__' sentinel is
    // what makes this side behave like the JS equality a reader expects.
    const groups = groupIntoSeries([
      occurrence({ meetingId: 'm1', appId: null }),
      occurrence({ meetingId: 'm2', appId: null, startsAt: daysBefore(7) }),
    ], NOW)
    expect(groups).toHaveLength(1)
    expect(groups[0].established).toBe(true)
    expect(groups[0].mergeable).toBe(false)
  })

  it('never merges the same title across two different projects', () => {
    const groups = groupIntoSeries([
      occurrence({ meetingId: 'm1', appId: 'app-1' }),
      occurrence({ meetingId: 'm2', appId: 'app-2' }),
    ], NOW)
    expect(groups).toHaveLength(2)
    for (const group of groups) expect(group.established).toBe(false)
  })

  it('forks identity when a title edit changes the normalised key', () => {
    // Documented behaviour, not a bug: the old occurrences and the new ones are
    // judged separately, and the abandoned half ages out through activeRecently.
    const groups = groupIntoSeries([
      occurrence({ meetingId: 'm1', title: 'Vela standup', startsAt: daysBefore(21) }),
      occurrence({ meetingId: 'm2', title: 'Vela standup', startsAt: daysBefore(14) }),
      occurrence({ meetingId: 'm3', title: 'Vela retro', startsAt: daysBefore(7) }),
    ], NOW)
    expect(groups).toHaveLength(2)
    expect(groups.map((g) => g.occurrences.length).sort()).toEqual([1, 2])
  })

  it('excludes a title that reduces to nothing nameable', () => {
    // Not a one-occurrence series — a title this product cannot read at all.
    const groups = groupIntoSeries([
      occurrence({ meetingId: 'm1', title: '12/08' }),
      occurrence({ meetingId: 'm2', title: '#42' }),
    ], NOW)
    expect(groups).toEqual([])
  })

  it('is ordered totally, so two renders of unchanged data agree', () => {
    const rows = [
      occurrence({ meetingId: 'm1', title: 'Zeta sync' }),
      occurrence({ meetingId: 'm2', title: 'Alpha sync' }),
    ]
    expect(groupIntoSeries(rows, NOW).map((g) => g.groupKey))
      .toEqual(groupIntoSeries([...rows].reverse(), NOW).map((g) => g.groupKey))
  })
})

describe('groupIntoSeries — the activity gate', () => {
  it('is active at 44 days and stale at 46', () => {
    const fresh = groupIntoSeries([
      occurrence({ meetingId: 'm1', startsAt: daysBefore(44) }),
      occurrence({ meetingId: 'm2', startsAt: daysBefore(60) }),
    ], NOW)
    expect(fresh[0].activeRecently).toBe(true)

    const stale = groupIntoSeries([
      occurrence({ meetingId: 'm1', startsAt: daysBefore(46) }),
      occurrence({ meetingId: 'm2', startsAt: daysBefore(60) }),
    ], NOW)
    expect(stale[0].activeRecently).toBe(false)
  })

  it('names the newest occurrence’s creator as the organizer', () => {
    const groups = groupIntoSeries([
      occurrence({ meetingId: 'm1', startsAt: daysBefore(1), createdBy: 'newest' }),
      occurrence({ meetingId: 'm2', startsAt: daysBefore(9), createdBy: 'older' }),
    ], NOW)
    expect(groups[0].organizerId).toBe('newest')
  })
})
