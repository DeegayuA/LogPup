import { describe, expect, it } from 'vitest'
import { FOLLOWUP_STALE_DAYS } from '@/features/people/followup-split'
import { buildMyDayStats } from './my-day-stats'
import type { TaskLoad } from '@/features/people/task-workload'

const QUIET_TASKS: TaskLoad = { open: 0, overdue: 0, dueSoon: 0, oldestOverdueDays: null, apps: 0 }

const QUIET = {
  tasks: QUIET_TASKS,
  followupsOwed: 0,
  oldestOwedDays: null,
  meetingsToday: 0,
}

describe('buildMyDayStats', () => {
  it('is all-normal and reassuring on a quiet day', () => {
    const stats = buildMyDayStats(QUIET)
    expect(stats.map((s) => s.key)).toEqual(['due-soon', 'overdue', 'owed', 'meetings-today'])
    expect(stats.every((s) => s.tone === 'normal')).toBe(true)
    expect(stats.map((s) => s.meta)).toEqual([
      'nothing pressing',
      'nothing late',
      'all answered',
      'clear calendar',
    ])
  })

  it('warns on due-soon work and alerts on overdue work, with the age in words', () => {
    const stats = buildMyDayStats({
      ...QUIET,
      tasks: { open: 5, overdue: 2, dueSoon: 3, oldestOverdueDays: 9, apps: 2 },
    })
    const [dueSoon, overdue] = stats
    expect(dueSoon.tone).toBe('warn')
    expect(dueSoon.value).toBe(3)
    expect(overdue.tone).toBe('alert')
    expect(overdue.meta).toBe('oldest 9 days late')
  })

  it('escalates owed follow-ups from warn to alert only once the oldest goes stale', () => {
    const fresh = buildMyDayStats({ ...QUIET, followupsOwed: 2, oldestOwedDays: 1 })
    expect(fresh[2].tone).toBe('warn')

    const stale = buildMyDayStats({
      ...QUIET,
      followupsOwed: 2,
      oldestOwedDays: FOLLOWUP_STALE_DAYS,
    })
    expect(stale[2].tone).toBe('alert')
    expect(stale[2].meta).toContain('oldest')
  })

  it('never puts tone on the meeting count — a busy calendar is not an incident', () => {
    const stats = buildMyDayStats({ ...QUIET, meetingsToday: 6 })
    expect(stats[3].value).toBe(6)
    expect(stats[3].tone).toBe('normal')
  })
})
