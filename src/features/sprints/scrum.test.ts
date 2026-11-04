import { describe, expect, it } from 'vitest'
import {
  defaultStandupDay,
  hasStandupContent,
  isIsoDay,
  isRealBlocker,
  isStandupDayAllowed,
  parseCeremony,
  parseScrumView,
  retroTaskTitle,
  splitReviewTasks,
} from './scrum'

const sprint = { startDate: '2026-11-02', endDate: '2026-11-13' }

describe('isIsoDay', () => {
  it('accepts real days only', () => {
    expect(isIsoDay('2026-11-02')).toBe(true)
    expect(isIsoDay('2026-02-30')).toBe(false)
    expect(isIsoDay('2026-1-2')).toBe(false)
    expect(isIsoDay(20261102)).toBe(false)
  })
})

describe('isStandupDayAllowed', () => {
  it('allows sprint days up to today', () => {
    expect(isStandupDayAllowed('2026-11-05', sprint, '2026-11-05')).toBe(true)
    expect(isStandupDayAllowed('2026-11-02', sprint, '2026-11-05')).toBe(true)
  })

  it('refuses the future, days outside the sprint and garbage', () => {
    expect(isStandupDayAllowed('2026-11-06', sprint, '2026-11-05')).toBe(false)
    expect(isStandupDayAllowed('2026-11-01', sprint, '2026-11-05')).toBe(false)
    expect(isStandupDayAllowed('2026-11-14', sprint, '2026-11-20')).toBe(false)
    expect(isStandupDayAllowed('not-a-day', sprint, '2026-11-05')).toBe(false)
  })
})

describe('defaultStandupDay', () => {
  it('clamps today into the sprint', () => {
    expect(defaultStandupDay(sprint, '2026-11-05')).toBe('2026-11-05')
    expect(defaultStandupDay(sprint, '2026-10-01')).toBe('2026-11-02')
    expect(defaultStandupDay(sprint, '2026-12-01')).toBe('2026-11-13')
  })
})

describe('splitReviewTasks', () => {
  it('splits done, not done, released, bugs and QA counts', () => {
    const tasks = [
      { id: 'a', status: 'done', type: 'task' },
      { id: 'b', status: 'released', type: 'story' },
      { id: 'c', status: 'qa', type: 'bug' },
      { id: 'd', status: 'qa', type: 'task' },
      { id: 'e', status: 'done', type: 'bug' },
    ]
    const r = splitReviewTasks(tasks)
    expect(r.completed.map((t) => t.id)).toEqual(['a', 'e'])
    expect(r.incomplete.map((t) => t.id)).toEqual(['b', 'c', 'd'])
    expect(r.released.map((t) => t.id)).toEqual(['b'])
    expect(r.bugs.map((t) => t.id)).toEqual(['c', 'e'])
    expect(r.qaCounts.find((q) => q.status === 'qa')?.count).toBe(2)
    expect(r.qaCounts.find((q) => q.status === 'rework')?.count).toBe(0)
  })
})

describe('retroTaskTitle', () => {
  it('flattens to one line and caps at 140', () => {
    expect(retroTaskTitle('  fix\n the   build ')).toBe('fix the build')
    const long = retroTaskTitle('x'.repeat(300))
    expect(long).toHaveLength(140)
    expect(long.endsWith('…')).toBe(true)
  })
})

describe('parseScrumView', () => {
  it('accepts a known view and falls back to standup', () => {
    expect(parseScrumView('retro')).toBe('retro')
    expect(parseScrumView(['review'])).toBe('review')
    expect(parseScrumView('nope')).toBe('standup')
    expect(parseScrumView(undefined)).toBe('standup')
  })
})

describe('parseCeremony', () => {
  it('accepts only known ceremonies', () => {
    expect(parseCeremony('retro')).toBe('retro')
    expect(parseCeremony('party')).toBeNull()
    expect(parseCeremony(null)).toBeNull()
  })
})

describe('standup helpers', () => {
  it('needs at least one answer', () => {
    expect(hasStandupContent({ yesterday: ' ', today: null, blockers: '' })).toBe(false)
    expect(hasStandupContent({ yesterday: null, today: 'Login page', blockers: null })).toBe(true)
  })

  it('ignores "none"-style blockers', () => {
    expect(isRealBlocker('None')).toBe(false)
    expect(isRealBlocker(' - ')).toBe(false)
    expect(isRealBlocker('Waiting on API keys')).toBe(true)
  })
})
