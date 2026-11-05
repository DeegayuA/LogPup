import { describe, expect, it } from 'vitest'
import { averageVelocity, computeSprintMetrics, planLoad, sprintDays, type MetricTask } from './sprint-metrics'

const at = (iso: string) => new Date(`${iso}T06:00:00Z`) // midday in Sri Lanka

const task = (over: Partial<MetricTask>): MetricTask => ({
  points: 3,
  status: 'todo',
  completedAt: null,
  type: 'task',
  ...over,
})

const sprint = { startDate: '2026-11-02', endDate: '2026-11-06', status: 'active' as const }
const noQa = { intoQa: 0, intoQaFailed: 0 }

describe('sprintDays', () => {
  it('lists every day, both ends included', () => {
    expect(sprintDays('2026-11-30', '2026-12-02')).toEqual(['2026-11-30', '2026-12-01', '2026-12-02'])
  })
})

describe('computeSprintMetrics', () => {
  const tasks = [
    task({ points: 5, status: 'done', completedAt: at('2026-11-03') }),
    task({ points: 3, status: 'blocked' }),
    task({ points: null, status: 'in_progress', type: 'bug' }),
    task({ points: 2, status: 'qa' }),
  ]

  it('totals points and counts', () => {
    const m = computeSprintMetrics({ sprint, tasks, qa: noQa, today: '2026-11-04' })
    expect(m.scopePoints).toBe(10)
    expect(m.completedPoints).toBe(5)
    expect(m.remainingPoints).toBe(5)
    expect(m.completionRate).toBe(0.25)
    expect(m.blockedCount).toBe(1)
    expect(m.blockedPoints).toBe(3)
    expect(m.bugCount).toBe(1)
    expect(m.unestimatedCount).toBe(1)
    expect(m.carryOver).toBeNull()
  })

  it('burns down on the day work completes and stops at today', () => {
    const m = computeSprintMetrics({ sprint, tasks, qa: noQa, today: '2026-11-04' })
    expect(m.burn.map((b) => b.remaining)).toEqual([10, 5, 5, null, null])
    expect(m.burn.map((b) => b.completed)).toEqual([0, 5, 5, null, null])
    expect(m.burn[0].ideal).toBe(10)
    expect(m.burn[4].ideal).toBe(0)
  })

  it('counts work finished before the sprint, or with no time, from day one', () => {
    const m = computeSprintMetrics({
      sprint,
      tasks: [
        task({ points: 2, status: 'done', completedAt: at('2026-10-20') }),
        task({ points: 1, status: 'done', completedAt: null }),
      ],
      qa: noQa,
      today: '2026-11-02',
    })
    expect(m.burn[0].remaining).toBe(0)
  })

  it('reports carry-over and the whole burn once the sprint is done', () => {
    const m = computeSprintMetrics({
      sprint: { ...sprint, status: 'done' },
      tasks,
      qa: noQa,
      today: '2026-11-20',
    })
    expect(m.carryOver).toEqual({ count: 3, points: 5 })
    expect(m.burn.every((b) => b.remaining !== null)).toBe(true)
  })

  it('rates QA rejections per move into QA, and says nothing without any', () => {
    expect(computeSprintMetrics({ sprint, tasks, qa: { intoQa: 4, intoQaFailed: 1 }, today: '2026-11-04' }).qaRejectionRate).toBe(0.25)
    expect(computeSprintMetrics({ sprint, tasks, qa: noQa, today: '2026-11-04' }).qaRejectionRate).toBeNull()
  })

  it('handles an empty sprint', () => {
    const m = computeSprintMetrics({ sprint, tasks: [], qa: noQa, today: '2026-11-04' })
    expect(m.completionRate).toBeNull()
    expect(m.scopePoints).toBe(0)
  })
})

describe('planLoad', () => {
  it('measures the commitment against capacity once locked', () => {
    expect(planLoad(80, 72, 90)).toEqual({ planned: 72, plannedIs: 'committed', load: 0.9, state: 'full' })
  })

  it('falls back to current scope before the sprint is committed', () => {
    expect(planLoad(80, null, 40)).toMatchObject({ planned: 40, plannedIs: 'scope', state: 'under' })
  })

  it('flags over-commitment', () => {
    expect(planLoad(20, 25, 25).state).toBe('over')
  })

  it('says unset without a capacity', () => {
    expect(planLoad(null, 10, 10)).toMatchObject({ load: null, state: 'unset' })
  })
})

describe('averageVelocity', () => {
  it('averages completed points', () => {
    expect(
      averageVelocity([
        { sprintId: 'a', name: 'S1', completedPoints: 20 },
        { sprintId: 'b', name: 'S2', completedPoints: 25 },
      ]),
    ).toBe(22.5)
  })

  it('is null with no finished sprints', () => {
    expect(averageVelocity([])).toBeNull()
  })
})
