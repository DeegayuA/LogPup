import { describe, expect, it } from 'vitest'
import {
  appHealth,
  completionPct,
  dayDiff,
  daysSince,
  inclusiveDayCount,
  parseCalendarDate,
  pickCurrentSprint,
  pickNextSprint,
  sprintDayProgress,
  summarizePortfolio,
  type AppHealthInput,
  type AppSprintSnapshot,
  type AppTaskCounts,
  type SummarizableApp,
} from '@/features/apps/app-health'

const TODAY = '2026-08-12'

function tasks(partial: Partial<AppTaskCounts> = {}): AppTaskCounts {
  const base = { todo: 0, in_progress: 0, done: 0, overdue: 0, ...partial }
  return { ...base, total: base.todo + base.in_progress + base.done }
}

function sprint(partial: Partial<AppSprintSnapshot> = {}): AppSprintSnapshot {
  return {
    id: 's1',
    name: 'Sprint 1',
    startDate: '2026-08-10',
    endDate: '2026-08-16',
    status: 'active',
    ...partial,
  }
}

function healthInput(partial: Partial<AppHealthInput> = {}): AppHealthInput {
  return {
    status: 'active',
    tasks: tasks({ todo: 2, done: 8 }),
    currentSprint: sprint(),
    sprintCount: 1,
    memberCount: 3,
    leadId: 'lead-1',
    lastActivityOn: TODAY,
    ...partial,
  }
}

describe('calendar-date helpers', () => {
  it('counts whole days between dates in both directions', () => {
    expect(dayDiff('2026-08-10', '2026-08-12')).toBe(2)
    expect(dayDiff('2026-08-12', '2026-08-10')).toBe(-2)
    expect(dayDiff('2026-08-12', '2026-08-12')).toBe(0)
  })

  it('counts a single day as one inclusive day', () => {
    expect(inclusiveDayCount('2026-08-12', '2026-08-12')).toBe(1)
    expect(inclusiveDayCount('2026-08-10', '2026-08-16')).toBe(7)
  })

  it('crosses month and year boundaries', () => {
    expect(dayDiff('2026-01-31', '2026-02-01')).toBe(1)
    expect(dayDiff('2025-12-31', '2026-01-01')).toBe(1)
  })

  it('distinguishes "never" from "today" in daysSince', () => {
    expect(daysSince(null, TODAY)).toBeNull()
    expect(daysSince(TODAY, TODAY)).toBe(0)
    expect(daysSince('2026-07-13', TODAY)).toBe(30)
  })

  it('parses a date column at local noon so the day never shifts', () => {
    const date = parseCalendarDate('2026-08-12')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(7)
    expect(date.getDate()).toBe(12)
    expect(date.getHours()).toBe(12)
  })
})

describe('sprintDayProgress', () => {
  it('reports a sprint that has not started', () => {
    const progress = sprintDayProgress('2026-08-20', '2026-08-26', TODAY)
    expect(progress.phase).toBe('upcoming')
    expect(progress.elapsedDays).toBe(0)
    expect(progress.pct).toBe(0)
    expect(progress.remainingDays).toBe(14)
  })

  it('reports mid-sprint progress inclusively', () => {
    // 10th → 16th is 7 days; on the 12th we are on day 3.
    const progress = sprintDayProgress('2026-08-10', '2026-08-16', TODAY)
    expect(progress.phase).toBe('running')
    expect(progress.totalDays).toBe(7)
    expect(progress.elapsedDays).toBe(3)
    expect(progress.pct).toBe(43)
    expect(progress.remainingDays).toBe(4)
  })

  it('pins an overrun sprint to 100% with negative days remaining', () => {
    const progress = sprintDayProgress('2026-08-01', '2026-08-07', TODAY)
    expect(progress.phase).toBe('ended')
    expect(progress.pct).toBe(100)
    expect(progress.elapsedDays).toBe(progress.totalDays)
    expect(progress.remainingDays).toBe(-5)
  })

  it('treats a one-day sprint as fully running on its only day', () => {
    const progress = sprintDayProgress(TODAY, TODAY, TODAY)
    expect(progress.phase).toBe('running')
    expect(progress.totalDays).toBe(1)
    expect(progress.pct).toBe(100)
    expect(progress.remainingDays).toBe(0)
  })

  it('never divides by zero on an inverted range', () => {
    const progress = sprintDayProgress('2026-08-16', '2026-08-10', TODAY)
    expect(Number.isFinite(progress.pct)).toBe(true)
    expect(progress.totalDays).toBe(1)
  })
})

describe('pickCurrentSprint / pickNextSprint', () => {
  it('prefers the soonest-closing running sprint', () => {
    const picked = pickCurrentSprint(
      [
        sprint({ id: 'late', endDate: '2026-08-30' }),
        sprint({ id: 'soon', endDate: '2026-08-14' }),
      ],
      TODAY,
    )
    expect(picked?.id).toBe('soon')
  })

  it('keeps an active sprint whose end date has already passed', () => {
    const picked = pickCurrentSprint(
      [sprint({ id: 'overrun', startDate: '2026-07-01', endDate: '2026-07-07' })],
      TODAY,
    )
    expect(picked?.id).toBe('overrun')
  })

  it('ignores done sprints and future ones', () => {
    expect(
      pickCurrentSprint(
        [
          sprint({ id: 'done', status: 'done' }),
          sprint({ id: 'future', status: 'planned', startDate: '2026-09-01', endDate: '2026-09-07' }),
        ],
        TODAY,
      ),
    ).toBeNull()
  })

  it('counts a planned sprint whose dates already contain today as running', () => {
    const picked = pickCurrentSprint([sprint({ id: 'p', status: 'planned' })], TODAY)
    expect(picked?.id).toBe('p')
  })

  it('picks the soonest not-yet-started sprint as next', () => {
    const picked = pickNextSprint(
      [
        sprint({ id: 'later', status: 'planned', startDate: '2026-10-01', endDate: '2026-10-07' }),
        sprint({ id: 'sooner', status: 'planned', startDate: '2026-09-01', endDate: '2026-09-07' }),
        sprint({ id: 'past', status: 'done', startDate: '2026-01-01', endDate: '2026-01-07' }),
      ],
      TODAY,
    )
    expect(picked?.id).toBe('sooner')
  })
})

describe('completionPct', () => {
  it('is zero for an app with no tasks rather than NaN', () => {
    expect(completionPct(tasks())).toBe(0)
  })

  it('rounds to whole percent', () => {
    expect(completionPct(tasks({ done: 1, todo: 2 }))).toBe(33)
    expect(completionPct(tasks({ done: 3 }))).toBe(100)
  })
})

describe('appHealth', () => {
  it('never scores an archived app', () => {
    const health = appHealth(healthInput({ status: 'archived', tasks: tasks({ overdue: 9, todo: 9 }) }), TODAY)
    expect(health).toEqual({ level: 'dormant', score: 0, reasons: [] })
  })

  it('treats an app with nothing on it as setup, not as an emergency', () => {
    const health = appHealth(
      healthInput({
        tasks: tasks(),
        currentSprint: null,
        sprintCount: 0,
        memberCount: 0,
        leadId: null,
        lastActivityOn: null,
      }),
      TODAY,
    )
    expect(health.level).toBe('watch')
    expect(health.score).toBe(0)
    expect(health.reasons).toEqual(['Nothing tracked here yet'])
  })

  it('calls a healthy app on track with no reasons', () => {
    const health = appHealth(healthInput(), TODAY)
    expect(health.level).toBe('on-track')
    expect(health.reasons).toEqual([])
  })

  it('flags an overrun sprint as at risk and says how late it is', () => {
    const health = appHealth(
      healthInput({
        currentSprint: sprint({ startDate: '2026-08-01', endDate: '2026-08-07' }),
      }),
      TODAY,
    )
    expect(health.level).toBe('at-risk')
    expect(health.reasons[0]).toContain('ended 5 days ago')
  })

  it('does not flag a sprint that is merely finished', () => {
    const health = appHealth(
      healthInput({
        currentSprint: sprint({ status: 'done', startDate: '2026-08-01', endDate: '2026-08-07' }),
      }),
      TODAY,
    )
    expect(health.reasons.some((reason) => reason.includes('still open'))).toBe(false)
  })

  it('caps the overdue-task contribution so one app cannot dominate', () => {
    // 2 overdue = 10 points; 50% done against 43% elapsed is no burn gap.
    const two = appHealth(healthInput({ tasks: tasks({ todo: 5, done: 5, overdue: 2 }) }), TODAY)
    // 20 overdue would be 100 points uncapped; 20% done against 43% elapsed
    // is a 23-point gap, still under the burn threshold — so the whole score
    // is the capped overdue contribution and nothing else.
    const twenty = appHealth(healthInput({ tasks: tasks({ todo: 20, done: 5, overdue: 20 }) }), TODAY)
    expect(two.score).toBe(10)
    expect(twenty.score).toBe(30)
  })

  it('flags work running behind the sprint clock', () => {
    const health = appHealth(
      healthInput({
        // Day 3 of 7 = 43% elapsed, 0% done.
        tasks: tasks({ todo: 10 }),
      }),
      TODAY,
    )
    expect(health.reasons).toContain('43% of the sprint gone, 0% of tasks done')
  })

  it('does not demand a sprint or recent movement from a paused app', () => {
    const paused = appHealth(
      healthInput({
        status: 'paused',
        currentSprint: null,
        sprintCount: 0,
        lastActivityOn: '2026-01-01',
      }),
      TODAY,
    )
    const active = appHealth(
      healthInput({ currentSprint: null, sprintCount: 0, lastActivityOn: '2026-01-01' }),
      TODAY,
    )
    expect(paused.score).toBe(0)
    expect(active.score).toBe(20)
    expect(active.reasons).toContain('No sprint planned')
  })

  it('stacks unassigned + no lead into a watch, not an alarm', () => {
    const health = appHealth(healthInput({ memberCount: 0, leadId: null }), TODAY)
    expect(health.score).toBe(15)
    expect(health.level).toBe('watch')
    expect(health.reasons).toEqual(['Nobody is assigned', 'No lead'])
  })

  it('treats a long-quiet active app as drifting', () => {
    const health = appHealth(healthInput({ lastActivityOn: '2026-06-01' }), TODAY)
    expect(health.reasons).toContain('Nothing has happened for 72 days')
  })
})

describe('summarizePortfolio', () => {
  function entry(partial: Partial<SummarizableApp> = {}): SummarizableApp {
    return {
      status: 'active',
      health: { level: 'on-track', score: 0, reasons: [] },
      members: [{}],
      stats: {
        tasks: tasks({ todo: 2, in_progress: 1, done: 4, overdue: 1 }),
        currentSprint: sprint(),
        meetings: { thisWeek: 1 },
      },
      ...partial,
    }
  }

  it('adds up open, overdue, sprints and at-risk across live apps', () => {
    const summary = summarizePortfolio([
      entry(),
      entry({ health: { level: 'at-risk', score: 45, reasons: ['x'] } }),
    ])
    expect(summary.apps).toBe(2)
    expect(summary.live).toBe(2)
    expect(summary.openTasks).toBe(6)
    expect(summary.overdueTasks).toBe(2)
    expect(summary.activeSprints).toBe(2)
    expect(summary.meetingsThisWeek).toBe(2)
    expect(summary.atRisk).toBe(1)
  })

  it('excludes archived apps from every figure except the total and meetings', () => {
    const summary = summarizePortfolio([entry(), entry({ status: 'archived' })])
    expect(summary.apps).toBe(2)
    expect(summary.live).toBe(1)
    expect(summary.openTasks).toBe(3)
    expect(summary.overdueTasks).toBe(1)
    expect(summary.activeSprints).toBe(1)
    // Meetings this week is a calendar fact, not a health one — a meeting
    // still on the books for an archived app is still on someone's Tuesday.
    expect(summary.meetingsThisWeek).toBe(2)
  })

  it('counts apps with nobody on them', () => {
    const summary = summarizePortfolio([entry({ members: [] }), entry()])
    expect(summary.unassigned).toBe(1)
  })

  it('is all zeroes for an empty workspace', () => {
    expect(summarizePortfolio([])).toEqual({
      apps: 0,
      live: 0,
      openTasks: 0,
      overdueTasks: 0,
      activeSprints: 0,
      meetingsThisWeek: 0,
      atRisk: 0,
      unassigned: 0,
    })
  })
})
