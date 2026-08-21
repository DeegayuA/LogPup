import { describe, expect, it } from 'vitest'
import { deriveBriefing } from '@/features/intel/briefing-fallback'
import { buildSignals, type SignalInput } from '@/features/intel/signals'

/**
 * The AI-free briefing is the one most people will actually read, so these
 * tests are about whether a person would have written it: plurals that agree,
 * clauses that vanish at zero instead of printing a nought, and a quiet day
 * that reads quiet. Every case goes through `buildSignals` rather than a
 * hand-made signal list, so the paragraph is always tested against the same
 * rows the page renders beside it.
 */
const TODAY = '2026-08-21'
const THURSDAY = '2026-08-20'
const MONDAY = '2026-08-24'
const ME = 'user-me'

function input(over: Partial<SignalInput> = {}): SignalInput {
  return {
    todayIso: TODAY,
    me: { id: ME, name: 'Nuwan Perera' },
    tasks: { overdue: 0, oldestOverdueDays: null, dueSoon: 0 },
    followupsOwed: 0,
    oldestOwedDays: null,
    capacities: [],
    sprints: [],
    worklogGapDays: [],
    unwrittenMeetings: [],
    mergeableMeetings: null,
  quietApps: [],
    ...over,
  }
}

function derive(over: Partial<SignalInput> = {}) {
  const snapshot = input(over)
  return deriveBriefing(snapshot, buildSignals(snapshot))
}

describe('deriveBriefing on a quiet workspace', () => {
  it('says something true and calm rather than inventing urgency', () => {
    const briefing = derive()
    expect(briefing.headline).toBe('All clear, Nuwan.')
    expect(briefing.body).toBe(
      'Nothing is overdue, nobody is near capacity, and your work log has no gaps.',
    )
    expect(briefing.priorities).toEqual([])
  })

  it('never prints a zero', () => {
    const briefing = derive()
    expect(`${briefing.headline} ${briefing.body}`).not.toMatch(/\b0\b/)
  })

  it('falls back to a bare greeting when the name is missing', () => {
    expect(derive({ me: { id: ME, name: '' } }).headline).toBe('All clear.')
  })

  /**
   * Work due later this week raises no signal, so the calm branch is the only
   * place it can be mentioned — and it has to be, or the briefing claims an
   * empty day to somebody with three deadlines on Thursday.
   */
  it('still names work that is merely due soon', () => {
    const briefing = derive({ tasks: { overdue: 0, oldestOverdueDays: null, dueSoon: 3 } })
    expect(briefing.headline).toBe('Nothing is late.')
    expect(briefing.body).toBe(
      'You have 3 tasks due this week — and that is the whole list: nothing overdue, nobody near capacity, no gaps in your work log.',
    )
    expect(briefing.priorities).toEqual([])
  })

  it('agrees with itself about a single task due soon', () => {
    expect(derive({ tasks: { overdue: 0, oldestOverdueDays: null, dueSoon: 1 } }).body).toContain(
      'You have 1 task due this week',
    )
  })

  /**
   * A follow-up owed since yesterday is below the stale threshold, so it
   * raises no row at all. The calm branch is then the only thing standing
   * between the reader and a briefing that says the day is empty while two
   * people wait on them.
   */
  it('names follow-ups that are owed but not yet stale', () => {
    const briefing = derive({ followupsOwed: 2, oldestOwedDays: 1 })
    expect(briefing.headline).toBe('Nothing is late.')
    expect(briefing.body).toBe(
      'You have 2 follow-ups to answer — and that is the whole list: nothing overdue, nobody near capacity, no gaps in your work log.',
    )
  })

  it('always reports itself as derived', () => {
    expect(derive().source).toBe('derived')
    expect(derive({ worklogGapDays: ['2026-08-18'] }).source).toBe('derived')
  })
})

describe('deriveBriefing headline', () => {
  it('counts the alerts, not the rows', () => {
    const briefing = derive({
      tasks: { overdue: 2, oldestOverdueDays: 9, dueSoon: 0 },
      worklogGapDays: ['2026-08-18'],
    })
    expect(briefing.headline).toBe('1 thing needs you today.')
  })

  it('pluralizes at two alerts', () => {
    const briefing = derive({
      tasks: { overdue: 2, oldestOverdueDays: 9, dueSoon: 0 },
      capacities: [{ userId: 'u1', name: 'Ann', pct: 130 }],
    })
    expect(briefing.headline).toBe('2 things need you today.')
  })

  it('stays unalarmed when nothing is an alert', () => {
    const briefing = derive({ worklogGapDays: ['2026-08-18'] })
    expect(briefing.headline).toBe('Nothing urgent — 1 thing worth a look.')
  })

  it('pluralizes the unalarmed headline too', () => {
    const briefing = derive({
      worklogGapDays: ['2026-08-18'],
      capacities: [{ userId: 'u1', name: 'Ann', pct: 90 }],
    })
    expect(briefing.headline).toBe('Nothing urgent — 2 things worth a look.')
  })
})

describe('deriveBriefing body', () => {
  it('drops every clause whose number is zero', () => {
    const briefing = derive({ tasks: { overdue: 1, oldestOverdueDays: 1, dueSoon: 0 } })
    expect(briefing.body).toBe('You have 1 overdue task.')
  })

  it('joins two clauses with "and", not a comma', () => {
    const briefing = derive({
      tasks: { overdue: 2, oldestOverdueDays: 4, dueSoon: 3 },
    })
    expect(briefing.body).toBe('You have 2 overdue tasks and 3 tasks due this week.')
  })

  it('writes a three-clause list the way a person would', () => {
    const briefing = derive({
      tasks: { overdue: 2, oldestOverdueDays: 4, dueSoon: 3 },
      followupsOwed: 1,
      oldestOwedDays: 20,
    })
    expect(briefing.body).toBe(
      'You have 2 overdue tasks, 3 tasks due this week and 1 follow-up to answer.',
    )
  })

  it('separates what is yours from what is the team’s', () => {
    const briefing = derive({
      tasks: { overdue: 1, oldestOverdueDays: 5, dueSoon: 0 },
      capacities: [
        { userId: 'u1', name: 'Ann', pct: 130 },
        { userId: 'u2', name: 'Bo', pct: 120 },
      ],
      sprints: [
        { id: 's1', appSlug: 'aurora', name: 'Aurora W3', endsOn: MONDAY, openTasks: 9, totalTasks: 10 },
      ],
    })
    expect(briefing.body).toBe(
      'You have 1 overdue task. Across the team, 2 people are over capacity and 1 sprint is at risk.',
    )
  })

  it('uses the singular verb for one person over capacity', () => {
    const briefing = derive({ capacities: [{ userId: 'u1', name: 'Ann', pct: 130 }] })
    expect(briefing.body).toBe('Across the team, 1 person is over capacity.')
  })

  /**
   * Someone at 95% is worth a row but is NOT over capacity, and the body must
   * not round them up into one — the band comes from `capacityBand`, the same
   * function the meter uses.
   */
  it('does not count a near-capacity person as over', () => {
    const briefing = derive({ capacities: [{ userId: 'u1', name: 'Ann', pct: 95 }] })
    expect(briefing.body).toBe('Across the team, 1 person is near capacity.')
    expect(briefing.body).not.toContain('over capacity')
  })

  it('reports the two capacity bands as separate clauses', () => {
    const briefing = derive({
      capacities: [
        { userId: 'u1', name: 'Ann', pct: 130 },
        { userId: 'u2', name: 'Bo', pct: 95 },
        { userId: 'u3', name: 'Cal', pct: 88 },
      ],
    })
    expect(briefing.body).toBe(
      'Across the team, 1 person is over capacity and 2 people are near capacity.',
    )
  })

  it('counts unlogged days and unwritten meetings as the reader’s own', () => {
    const briefing = derive({
      worklogGapDays: ['2026-08-18', '2026-08-19'],
      unwrittenMeetings: [{ id: 'm1', title: 'Kickoff', endedIso: '2026-08-19T04:30:00.000Z' }],
    })
    expect(briefing.body).toBe(
      'You have 2 working days unlogged and 1 meeting still to write up.',
    )
  })

  it('reports quiet apps as a team fact', () => {
    const briefing = derive({
      quietApps: [
        { slug: 'aurora', name: 'Aurora', lastActivityIso: '2026-07-01T06:00:00.000Z' },
        { slug: 'beacon', name: 'Beacon', lastActivityIso: '2026-06-01T06:00:00.000Z' },
      ],
    })
    expect(briefing.body).toBe('Across the team, 2 apps have gone quiet.')
  })
})

describe('deriveBriefing priorities', () => {
  it('takes at most three, in the ranked order', () => {
    const briefing = derive({
      tasks: { overdue: 4, oldestOverdueDays: 6, dueSoon: 2 },
      followupsOwed: 3,
      oldestOwedDays: 30,
      capacities: [{ userId: 'u1', name: 'Ann', pct: 130 }],
      worklogGapDays: ['2026-08-17', '2026-08-18', '2026-08-19'],
      quietApps: [{ slug: 'aurora', name: 'Aurora', lastActivityIso: '2026-07-01T06:00:00.000Z' }],
    })
    expect(briefing.priorities).toHaveLength(3)
    // The ranked list leads with the biggest alert, which is the 130% person.
    expect(briefing.priorities[0]).toBe('Move work off Ann, now at 130%.')
  })

  it('writes every line in the imperative', () => {
    const briefing = derive({
      tasks: { overdue: 4, oldestOverdueDays: 6, dueSoon: 0 },
      followupsOwed: 3,
      oldestOwedDays: 30,
      worklogGapDays: ['2026-08-17', '2026-08-18', '2026-08-19'],
    })
    expect(briefing.priorities).toEqual([
      'Clear 4 overdue tasks.',
      'Answer 3 follow-ups you owe.',
      'Fill in 3 missing work log days.',
    ])
  })

  it('pluralizes a single-item priority', () => {
    const briefing = derive({
      tasks: { overdue: 1, oldestOverdueDays: 6, dueSoon: 0 },
      followupsOwed: 1,
      oldestOwedDays: 30,
      worklogGapDays: ['2026-08-17'],
      unwrittenMeetings: [{ id: 'm1', title: 'Kickoff', endedIso: '2026-08-19T04:30:00.000Z' }],
    })
    // Four rows tie at a count of 1, so the ranking falls through to id
    // order: both alerts first (followup before task), then the watches.
    expect(briefing.priorities).toEqual([
      'Answer 1 follow-up you owe.',
      'Clear 1 overdue task.',
      'Write up 1 meeting with no notes.',
    ])
  })

  it('names the sprint it wants re-scoped', () => {
    const briefing = derive({
      sprints: [
        { id: 's1', appSlug: 'aurora', name: 'Aurora W3', endsOn: THURSDAY, openTasks: 9, totalTasks: 10 },
      ],
    })
    expect(briefing.priorities).toEqual(['Re-scope Aurora W3 — 9 tasks still open.'])
  })

  it('names the app it wants checked on', () => {
    const briefing = derive({
      quietApps: [{ slug: 'aurora', name: 'Aurora', lastActivityIso: '2026-07-01T06:00:00.000Z' }],
    })
    expect(briefing.priorities).toEqual(['Check in on Aurora — quiet for 51 days.'])
  })

  it('warns off loading someone who is merely near capacity', () => {
    const briefing = derive({ capacities: [{ userId: 'u1', name: 'Ann', pct: 95 }] })
    expect(briefing.priorities).toEqual(['Give Ann nothing new — already at 95%.'])
  })

  it('tells the reader to write up their own meetings', () => {
    const briefing = derive({
      unwrittenMeetings: [
        { id: 'm1', title: 'Kickoff', endedIso: '2026-08-19T04:30:00.000Z' },
        { id: 'm2', title: 'Retro', endedIso: '2026-08-20T04:30:00.000Z' },
      ],
    })
    expect(briefing.priorities).toEqual(['Write up 2 meetings with no notes.'])
  })
})
