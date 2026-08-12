import { describe, it, expect } from 'vitest'
import { buildPersonStats, type PersonStat, type PersonStatsInput } from './person-stats'

function input(over: Partial<PersonStatsInput> = {}): PersonStatsInput {
  return {
    totalPct: 60,
    assignmentCount: 2,
    tasks: { open: 3, overdue: 0, dueSoon: 1, oldestOverdueDays: null, apps: 2 },
    doneCount: 12,
    totalTaskCount: 15,
    meetingsAttended: 4,
    meetingsWindowDays: 30,
    followupsOwed: 0,
    followupsAwaiting: 0,
    followupsOldestOwedDays: null,
    ...over,
  }
}

function stat(stats: PersonStat[], key: string): PersonStat {
  const found = stats.find((entry) => entry.key === key)
  if (!found) throw new Error(`no stat ${key}`)
  return found
}

describe('buildPersonStats', () => {
  it('reports headroom for a normally loaded person', () => {
    const allocation = stat(buildPersonStats(input({ totalPct: 60 })), 'allocation')
    expect(allocation.value).toBe(60)
    expect(allocation.suffix).toBe('%')
    expect(allocation.tone).toBe('normal')
    expect(allocation.meta).toBe('40% headroom')
  })

  it('warns in the near-capacity band and says so in words', () => {
    const allocation = stat(buildPersonStats(input({ totalPct: 90 })), 'allocation')
    expect(allocation.tone).toBe('warn')
    expect(allocation.meta).toBe('near capacity')
  })

  it('alerts over capacity and names the overage rather than leaving it to be counted', () => {
    const allocation = stat(buildPersonStats(input({ totalPct: 130 })), 'allocation')
    expect(allocation.tone).toBe('alert')
    expect(allocation.meta).toBe('over by 30%')
  })

  it('says a person with no assignments is unassigned, not "100% headroom"', () => {
    const allocation = stat(
      buildPersonStats(input({ totalPct: 0, assignmentCount: 0 })),
      'allocation',
    )
    expect(allocation.meta).toBe('not assigned')
    expect(allocation.tone).toBe('normal')
  })

  it('alerts on overdue work and ages the worst item', () => {
    const stats = buildPersonStats(
      input({
        tasks: { open: 5, overdue: 2, dueSoon: 1, oldestOverdueDays: 9, apps: 2 },
      }),
    )
    expect(stat(stats, 'overdue').tone).toBe('alert')
    expect(stat(stats, 'overdue').meta).toBe('oldest 9 days late')
  })

  it('singularises a one-day-late item', () => {
    const stats = buildPersonStats(
      input({ tasks: { open: 1, overdue: 1, dueSoon: 0, oldestOverdueDays: 1, apps: 1 } }),
    )
    expect(stat(stats, 'overdue').meta).toBe('oldest 1 day late')
  })

  it('stays calm when nothing is late', () => {
    const stats = buildPersonStats(input())
    expect(stat(stats, 'overdue').tone).toBe('normal')
    expect(stat(stats, 'overdue').meta).toBe('nothing late')
  })

  it('falls back to what they are waiting on when they owe nothing', () => {
    expect(
      stat(buildPersonStats(input({ followupsOwed: 0, followupsAwaiting: 3 })), 'followups').meta,
    ).toBe('waiting on 3')
    expect(stat(buildPersonStats(input()), 'followups').meta).toBe('all settled')
    expect(stat(buildPersonStats(input()), 'followups').tone).toBe('normal')
  })

  it('grades open debt by age instead of turning red on the first item', () => {
    // A follow-up raised in this morning's standup is a heads-up, not an
    // emergency — spending the danger token on it would leave the tile red on
    // nearly every page, at which point red stops carrying information.
    const fresh = stat(
      buildPersonStats(input({ followupsOwed: 2, followupsOldestOwedDays: 3 })),
      'followups',
    )
    expect(fresh.tone).toBe('warn')
    expect(fresh.meta).toBe('oldest 3 days open')
  })

  it('alerts once the oldest debt crosses the same threshold the card flags', () => {
    const stale = stat(
      buildPersonStats(input({ followupsOwed: 1, followupsOldestOwedDays: 14 })),
      'followups',
    )
    expect(stale.tone).toBe('alert')
    expect(stale.meta).toBe('oldest 14 days open')
  })

  it('singularises a one-day-old debt', () => {
    expect(
      stat(buildPersonStats(input({ followupsOwed: 1, followupsOldestOwedDays: 1 })), 'followups')
        .meta,
    ).toBe('oldest 1 day open')
  })

  it('states that the meetings figure is "not declined", not attendance', () => {
    // meeting_attendees.response defaults to 'pending' and most people never
    // touch it, so a bare "last 30 days" would be read as a register.
    expect(stat(buildPersonStats(input()), 'meetings').meta).toBe('not declined, 30d')
  })

  it('labels done work as a lifetime figure, never as a rate', () => {
    const done = stat(buildPersonStats(input({ doneCount: 12, totalTaskCount: 15 })), 'done')
    expect(done.meta).toBe('of 15 ever assigned')
  })

  it('handles a brand-new person with nothing anywhere', () => {
    const stats = buildPersonStats(
      input({
        totalPct: 0,
        assignmentCount: 0,
        tasks: { open: 0, overdue: 0, dueSoon: 0, oldestOverdueDays: null, apps: 0 },
        doneCount: 0,
        totalTaskCount: 0,
        meetingsAttended: 0,
      }),
    )
    expect(stats.every((entry) => entry.value === 0)).toBe(true)
    expect(stats.every((entry) => entry.tone === 'normal')).toBe(true)
    expect(stat(stats, 'done').meta).toBe('never assigned a task')
    expect(stat(stats, 'open').meta).toBe('nothing on their plate')
  })

  it('gives every tile a stable key and a label', () => {
    const stats = buildPersonStats(input())
    expect(new Set(stats.map((entry) => entry.key)).size).toBe(stats.length)
    expect(stats.every((entry) => entry.label.length > 0)).toBe(true)
  })
})
