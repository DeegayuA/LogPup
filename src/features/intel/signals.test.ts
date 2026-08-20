import { describe, expect, it } from 'vitest'
import { FOLLOWUP_STALE_DAYS } from '@/features/people/followup-split'
import {
  buildSignals,
  capacitySignals,
  overdueTaskSignal,
  OVERDUE_ALERT_DAYS,
  QUIET_APP_DAYS,
  quietAppSignals,
  remainingWorkingDays,
  sprintRiskSignals,
  staleFollowupSignal,
  unwrittenMeetingSignal,
  worklogGapSignal,
  WORKLOG_GAP_ALERT_DAYS,
  type SignalInput,
} from '@/features/intel/signals'

/**
 * These detectors are the whole product when there is no Gemini key, so the
 * tests are about the two things a reader can be misled by: which side of a
 * threshold a number falls on, and whether the sentence beside it says the
 * number out loud. Wording is asserted only where it carries a fact — a count,
 * an age, a date — never for its adjectives.
 *
 * TODAY is Friday 21 August 2026, chosen because the days around it are clean:
 * Saturday the 22nd is a half day, Sunday the 23rd is off, and the next
 * mercantile holidays (26th and 27th) are far enough away not to smuggle
 * themselves into a sprint window by accident.
 */
const TODAY = '2026-08-21'
const FRIDAY = TODAY
const SATURDAY = '2026-08-22'
const SUNDAY = '2026-08-23'
const MONDAY = '2026-08-24'
const THURSDAY = '2026-08-20'
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
    quietApps: [],
    ...over,
  }
}

function sprint(over: Partial<SignalInput['sprints'][number]> = {}) {
  return {
    id: 'sprint-1',
    appSlug: 'aurora',
    name: 'Aurora W3',
    endsOn: MONDAY,
    openTasks: 1,
    totalTasks: 10,
    ...over,
  }
}

describe('overdueTaskSignal', () => {
  it('says nothing when nothing is late', () => {
    expect(overdueTaskSignal(input())).toBeNull()
  })

  it('is a watch one day short of the alert threshold', () => {
    const signal = overdueTaskSignal(
      input({ tasks: { overdue: 4, oldestOverdueDays: OVERDUE_ALERT_DAYS - 1, dueSoon: 0 } }),
    )
    expect(signal?.severity).toBe('watch')
  })

  it('is an alert AT the threshold, not one past it', () => {
    const signal = overdueTaskSignal(
      input({ tasks: { overdue: 4, oldestOverdueDays: OVERDUE_ALERT_DAYS, dueSoon: 0 } }),
    )
    expect(signal?.severity).toBe('alert')
  })

  it('counts the tasks, not the days', () => {
    const signal = overdueTaskSignal(
      input({ tasks: { overdue: 4, oldestOverdueDays: 9, dueSoon: 3 } }),
    )
    expect(signal?.count).toBe(4)
    expect(signal?.detail).toBe('You have 4 overdue tasks, and the oldest is 9 days late.')
    expect(signal?.href).toBe('/people/user-me')
  })

  it('speaks in the singular for one task one day late', () => {
    const signal = overdueTaskSignal(
      input({ tasks: { overdue: 1, oldestOverdueDays: 1, dueSoon: 0 } }),
    )
    expect(signal?.title).toBe('1 task is overdue')
    expect(signal?.detail).toBe('Your one overdue task is 1 day late.')
  })

  it('pluralizes the age at two days', () => {
    const signal = overdueTaskSignal(
      input({ tasks: { overdue: 2, oldestOverdueDays: 2, dueSoon: 0 } }),
    )
    expect(signal?.title).toBe('2 tasks are overdue')
    expect(signal?.detail).toBe('You have 2 overdue tasks, and the oldest is 2 days late.')
  })

  it('states only what it knows when no age came back', () => {
    const signal = overdueTaskSignal(
      input({ tasks: { overdue: 2, oldestOverdueDays: null, dueSoon: 0 } }),
    )
    expect(signal?.severity).toBe('watch')
    expect(signal?.detail).toBe('You have 2 tasks past their due date.')
  })
})

describe('staleFollowupSignal', () => {
  it('says nothing when nothing is owed', () => {
    expect(staleFollowupSignal(input())).toBeNull()
  })

  it('stays quiet on a follow-up that is not stale yet', () => {
    const signal = staleFollowupSignal(
      input({ followupsOwed: 3, oldestOwedDays: FOLLOWUP_STALE_DAYS - 1 }),
    )
    expect(signal).toBeNull()
  })

  it('fires AT the shared stale threshold', () => {
    const signal = staleFollowupSignal(
      input({ followupsOwed: 3, oldestOwedDays: FOLLOWUP_STALE_DAYS }),
    )
    expect(signal?.severity).toBe('watch')
    expect(signal?.detail).toContain(`past the ${FOLLOWUP_STALE_DAYS}-day mark`)
  })

  it('is still a watch one day short of twice stale', () => {
    const signal = staleFollowupSignal(
      input({ followupsOwed: 3, oldestOwedDays: FOLLOWUP_STALE_DAYS * 2 - 1 }),
    )
    expect(signal?.severity).toBe('watch')
  })

  it('escalates to alert at twice stale', () => {
    const signal = staleFollowupSignal(
      input({ followupsOwed: 3, oldestOwedDays: FOLLOWUP_STALE_DAYS * 2 }),
    )
    expect(signal?.severity).toBe('alert')
    expect(signal?.count).toBe(3)
  })

  it('does not say "the oldest" of a single item', () => {
    const signal = staleFollowupSignal(input({ followupsOwed: 1, oldestOwedDays: 20 }))
    expect(signal?.title).toBe('1 follow-up waiting on you')
    expect(signal?.detail).toBe(
      'The one follow-up you owe has been open 20 days, past the 14-day mark.',
    )
  })
})

describe('capacitySignals', () => {
  it('ignores anyone with room to spare', () => {
    expect(capacitySignals(input({ capacities: [{ userId: 'u1', name: 'Ann', pct: 79 }] }))).toEqual(
      [],
    )
  })

  it('watches someone at the near threshold', () => {
    const [signal] = capacitySignals(
      input({ capacities: [{ userId: 'u1', name: 'Ann', pct: 80 }] }),
    )
    expect(signal.kind).toBe('capacity.near')
    expect(signal.severity).toBe('watch')
    expect(signal.detail).toBe('Ann is allocated 80% across apps, with 20% left.')
  })

  it('does not call an exactly-full person over capacity', () => {
    const [signal] = capacitySignals(
      input({ capacities: [{ userId: 'u1', name: 'Ann', pct: 100 }] }),
    )
    expect(signal.kind).toBe('capacity.near')
    expect(signal.detail).toBe('Ann is allocated 100% across apps, with no room left.')
  })

  it('alerts from one point over', () => {
    const [signal] = capacitySignals(
      input({ capacities: [{ userId: 'u1', name: 'Ann', pct: 101 }] }),
    )
    expect(signal.kind).toBe('capacity.over')
    expect(signal.severity).toBe('alert')
    expect(signal.id).toBe('capacity.over:u1')
    expect(signal.count).toBe(101)
    expect(signal.detail).toBe('Ann is allocated 101% across apps, 1% past a full workload.')
    expect(signal.href).toBe('/people/u1')
  })

  it('addresses the reader as "you" rather than by name', () => {
    const [signal] = capacitySignals(
      input({ capacities: [{ userId: ME, name: 'Nuwan Perera', pct: 130 }] }),
    )
    expect(signal.title).toBe('You are over capacity')
    expect(signal.detail).toBe('You are allocated 130% across apps, 30% past a full workload.')
  })

  it('emits one row per person', () => {
    const signals = capacitySignals(
      input({
        capacities: [
          { userId: 'u1', name: 'Ann', pct: 120 },
          { userId: 'u2', name: 'Bo', pct: 90 },
          { userId: 'u3', name: 'Cal', pct: 10 },
        ],
      }),
    )
    expect(signals.map((s) => s.id)).toEqual(['capacity.over:u1', 'capacity.near:u2'])
  })
})

describe('remainingWorkingDays', () => {
  it('counts today itself, so a sprint ending today still has a day', () => {
    expect(remainingWorkingDays(FRIDAY, FRIDAY)).toBe(1)
  })

  it('counts Saturday as half a day', () => {
    expect(remainingWorkingDays(SATURDAY, SATURDAY)).toBe(0.5)
    expect(remainingWorkingDays(FRIDAY, SATURDAY)).toBe(1.5)
  })

  it('gives Sunday nothing', () => {
    expect(remainingWorkingDays(FRIDAY, SUNDAY)).toBe(1.5)
  })

  it('gives a mercantile holiday nothing, even mid-week', () => {
    // 26 and 27 August 2026 are gazetted holidays that excuse work, so a
    // window spanning them is shorter than its calendar length suggests.
    expect(remainingWorkingDays('2026-08-25', '2026-08-28')).toBe(2)
  })

  it('is zero once the end date has passed', () => {
    expect(remainingWorkingDays(FRIDAY, THURSDAY)).toBe(0)
  })
})

describe('sprintRiskSignals', () => {
  it('says nothing about a sprint with room to finish', () => {
    // Friday through Monday is 2.5 working days; one open task is not close.
    expect(sprintRiskSignals(input({ sprints: [sprint({ openTasks: 1 })] }))).toEqual([])
  })

  it('watches a sprint within 20 percent of its remaining capacity', () => {
    const [signal] = sprintRiskSignals(input({ sprints: [sprint({ openTasks: 2 })] }))
    expect(signal.severity).toBe('watch')
    expect(signal.count).toBe(2)
  })

  it('alerts once the open work exceeds the days left', () => {
    const [signal] = sprintRiskSignals(input({ sprints: [sprint({ openTasks: 3 })] }))
    expect(signal.severity).toBe('alert')
    expect(signal.href).toBe('/apps/aurora')
  })

  /**
   * The half day is the whole point of routing this through working-days.ts.
   * Both sprints below carry the same ratio of work to CALENDAR days; only the
   * Saturday one runs out of studio time, and a naive day count would mark it
   * healthy on the Friday before it misses.
   */
  it('lets Saturday being a half day flip the verdict', () => {
    const signals = sprintRiskSignals(
      input({
        sprints: [
          sprint({ id: 's-fri', name: 'Ends Friday', endsOn: FRIDAY, openTasks: 1 }),
          sprint({ id: 's-sat', name: 'Ends Saturday', endsOn: SATURDAY, openTasks: 2 }),
        ],
      }),
    )
    const byId = new Map(signals.map((s) => [s.id, s]))
    expect(byId.get('sprint.at-risk:s-fri')?.severity).toBe('watch')
    // 1.5 working days, not 2: the Saturday counts half, so two open tasks no
    // longer fit and the sprint is an alert rather than a watch.
    expect(byId.get('sprint.at-risk:s-sat')?.severity).toBe('alert')
    expect(byId.get('sprint.at-risk:s-fri')?.detail).toBe(
      'Ends Friday has 1 task open of 10, with 1 working day left before it ends on 2026-08-21.',
    )
  })

  it('states the half day in the sentence a reader sees', () => {
    const [signal] = sprintRiskSignals(
      input({ todayIso: SATURDAY, sprints: [sprint({ endsOn: SATURDAY, openTasks: 1 })] }),
    )
    expect(signal.detail).toBe(
      'Aurora W3 has 1 task open of 10, with 0.5 working days left before it ends on 2026-08-22.',
    )
  })

  it('alerts on a sprint that ended yesterday with work still open', () => {
    const [signal] = sprintRiskSignals(
      input({ sprints: [sprint({ endsOn: THURSDAY, openTasks: 3 })] }),
    )
    expect(signal.severity).toBe('alert')
    expect(signal.title).toBe('Aurora W3 ended with work open')
    expect(signal.detail).toBe('Aurora W3 ended on 2026-08-20 with 3 tasks of 10 still open.')
  })

  it('leaves a sprint that ended cleanly alone', () => {
    expect(
      sprintRiskSignals(input({ sprints: [sprint({ endsOn: THURSDAY, openTasks: 0 })] })),
    ).toEqual([])
  })
})

describe('worklogGapSignal', () => {
  it('says nothing when every day is logged', () => {
    expect(worklogGapSignal(input())).toBeNull()
  })

  it('watches a single missed day', () => {
    const signal = worklogGapSignal(input({ worklogGapDays: ['2026-08-18'] }))
    expect(signal?.severity).toBe('watch')
    expect(signal?.title).toBe('1 working day not logged')
    expect(signal?.detail).toBe('You have not logged 2026-08-18 yet.')
    expect(signal?.href).toBe('/worklog')
  })

  it('is still a watch one day short of the alert threshold', () => {
    const days = ['2026-08-18', '2026-08-19']
    expect(days).toHaveLength(WORKLOG_GAP_ALERT_DAYS - 1)
    expect(worklogGapSignal(input({ worklogGapDays: days }))?.severity).toBe('watch')
  })

  it('alerts at the third missed day and names the oldest', () => {
    const signal = worklogGapSignal(
      input({ worklogGapDays: ['2026-08-19', '2026-08-17', '2026-08-18'] }),
    )
    expect(signal?.severity).toBe('alert')
    expect(signal?.count).toBe(3)
    // Passed newest-first on purpose: the oldest is found here, not assumed
    // from the caller's ordering.
    expect(signal?.detail).toBe(
      'You have 3 working days with no work log entry, the oldest of them 2026-08-17.',
    )
  })
})

describe('unwrittenMeetingSignal', () => {
  it('says nothing when everything is written up', () => {
    expect(unwrittenMeetingSignal(input())).toBeNull()
  })

  it('is only an info when the single meeting ended today', () => {
    const signal = unwrittenMeetingSignal(
      input({
        unwrittenMeetings: [
          { id: 'm1', title: 'Weekly sync', endedIso: '2026-08-21T09:00:00.000Z' },
        ],
      }),
    )
    expect(signal?.severity).toBe('info')
    expect(signal?.title).toBe('1 meeting has no notes')
    expect(signal?.detail).toBe('One meeting from today, “Weekly sync”, still has no notes.')
    expect(signal?.href).toBe('/meetings')
  })

  /**
   * 20:00 UTC is already the next morning in Colombo. Slicing the timestamp
   * would file this meeting under yesterday and escalate a today-meeting to a
   * watch, so the day has to be resolved in the business timezone.
   */
  it('resolves the meeting day in Colombo, not UTC', () => {
    const signal = unwrittenMeetingSignal(
      input({
        unwrittenMeetings: [
          { id: 'm1', title: 'Late call', endedIso: '2026-08-20T20:00:00.000Z' },
        ],
      }),
    )
    expect(signal?.severity).toBe('info')
  })

  it('escalates to a watch once the meeting is not from today', () => {
    const signal = unwrittenMeetingSignal(
      input({
        unwrittenMeetings: [{ id: 'm1', title: 'Kickoff', endedIso: '2026-08-19T04:30:00.000Z' }],
      }),
    )
    expect(signal?.severity).toBe('watch')
    expect(signal?.detail).toBe(
      'One past meeting, “Kickoff” on 2026-08-19, still has no notes.',
    )
  })

  it('is a watch for two meetings even when both ended today', () => {
    const signal = unwrittenMeetingSignal(
      input({
        unwrittenMeetings: [
          { id: 'm1', title: 'Standup', endedIso: '2026-08-21T04:00:00.000Z' },
          { id: 'm2', title: 'Retro', endedIso: '2026-08-21T09:00:00.000Z' },
        ],
      }),
    )
    expect(signal?.severity).toBe('watch')
    expect(signal?.count).toBe(2)
    expect(signal?.title).toBe('2 meetings have no notes')
    expect(signal?.detail).toBe(
      '2 past meetings still have no notes, the oldest “Standup” on 2026-08-21.',
    )
  })
})

describe('quietAppSignals', () => {
  it('stays quiet one day short of the threshold', () => {
    expect(
      quietAppSignals(
        input({
          quietApps: [{ slug: 'aurora', name: 'Aurora', lastActivityIso: '2026-08-08T06:00:00.000Z' }],
        }),
      ),
    ).toEqual([])
  })

  it('speaks at exactly a fortnight', () => {
    const [signal] = quietAppSignals(
      input({
        quietApps: [{ slug: 'aurora', name: 'Aurora', lastActivityIso: '2026-08-07T06:00:00.000Z' }],
      }),
    )
    expect(signal.severity).toBe('info')
    expect(signal.count).toBe(QUIET_APP_DAYS)
    expect(signal.title).toBe('Aurora has gone quiet')
    expect(signal.detail).toBe('Aurora has had no activity for 14 days, since 2026-08-07.')
    expect(signal.href).toBe('/apps/aurora')
  })

  /**
   * A null last-activity is an app nothing has EVER happened on, which is the
   * same row a five-minute-old app produces. There is no elapsed time to
   * report and no way to tell neglect from newness, so it says nothing.
   */
  it('skips an app that has never had any activity', () => {
    expect(
      quietAppSignals(
        input({ quietApps: [{ slug: 'new', name: 'Brand New', lastActivityIso: null }] }),
      ),
    ).toEqual([])
  })

  it('keeps a very long name inside the title budget', () => {
    const [signal] = quietAppSignals(
      input({
        quietApps: [
          {
            slug: 'long',
            name: 'The Extremely Long Internal Platform Name Nobody Ever Shortened',
            lastActivityIso: '2026-07-01T06:00:00.000Z',
          },
        ],
      }),
    )
    expect(signal.title.length).toBeLessThanOrEqual(60)
    expect(signal.title.endsWith('…')).toBe(true)
  })
})

describe('buildSignals', () => {
  it('produces nothing at all from an empty workspace', () => {
    expect(buildSignals(input())).toEqual([])
  })

  it('ranks alert before watch before info', () => {
    const signals = buildSignals(
      input({
        tasks: { overdue: 2, oldestOverdueDays: 5, dueSoon: 0 },
        worklogGapDays: ['2026-08-18'],
        quietApps: [{ slug: 'aurora', name: 'Aurora', lastActivityIso: '2026-07-01T06:00:00.000Z' }],
      }),
    )
    expect(signals.map((s) => s.severity)).toEqual(['alert', 'watch', 'info'])
  })

  it('breaks a severity tie by the bigger number', () => {
    const signals = buildSignals(
      input({
        capacities: [
          { userId: 'u-small', name: 'Small', pct: 110 },
          { userId: 'u-big', name: 'Big', pct: 140 },
        ],
      }),
    )
    expect(signals.map((s) => s.id)).toEqual(['capacity.over:u-big', 'capacity.over:u-small'])
  })

  it('breaks a full tie by id, whatever order the input arrived in', () => {
    const people = [
      { userId: 'u-c', name: 'Cal', pct: 120 },
      { userId: 'u-a', name: 'Ann', pct: 120 },
      { userId: 'u-b', name: 'Bo', pct: 120 },
    ]
    const forwards = buildSignals(input({ capacities: people })).map((s) => s.id)
    const backwards = buildSignals(input({ capacities: [...people].reverse() })).map((s) => s.id)
    expect(forwards).toEqual(['capacity.over:u-a', 'capacity.over:u-b', 'capacity.over:u-c'])
    expect(backwards).toEqual(forwards)
  })

  it('gives every row a unique id across a realistic mixed workspace', () => {
    const signals = buildSignals(
      input({
        tasks: { overdue: 4, oldestOverdueDays: 6, dueSoon: 2 },
        followupsOwed: 3,
        oldestOwedDays: 30,
        capacities: [
          { userId: ME, name: 'Nuwan Perera', pct: 115 },
          { userId: 'u2', name: 'Bo', pct: 95 },
          { userId: 'u3', name: 'Cal', pct: 40 },
        ],
        sprints: [
          sprint({ id: 's1', openTasks: 9 }),
          sprint({ id: 's2', appSlug: 'beacon', name: 'Beacon W1', endsOn: THURSDAY, openTasks: 4 }),
        ],
        worklogGapDays: ['2026-08-17', '2026-08-18', '2026-08-19'],
        unwrittenMeetings: [
          { id: 'm1', title: 'Standup', endedIso: '2026-08-19T04:00:00.000Z' },
          { id: 'm2', title: 'Retro', endedIso: '2026-08-20T09:00:00.000Z' },
        ],
        quietApps: [
          { slug: 'aurora', name: 'Aurora', lastActivityIso: '2026-07-01T06:00:00.000Z' },
          { slug: 'beacon', name: 'Beacon', lastActivityIso: '2026-06-01T06:00:00.000Z' },
        ],
      }),
    )
    const ids = signals.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBe(10)
  })

  it('keeps every title inside the 60-character budget the contract sets', () => {
    const signals = buildSignals(
      input({
        tasks: { overdue: 4, oldestOverdueDays: 6, dueSoon: 2 },
        followupsOwed: 3,
        oldestOwedDays: 30,
        capacities: [{ userId: 'u1', name: 'Wickramasinghe Abeywardena Jayasuriya Gunawardena', pct: 130 }],
        sprints: [sprint({ name: 'Aurora Platform Consolidation Wave Three', openTasks: 9 })],
        worklogGapDays: ['2026-08-17', '2026-08-18'],
        unwrittenMeetings: [{ id: 'm1', title: 'Kickoff', endedIso: '2026-08-19T04:00:00.000Z' }],
        quietApps: [{ slug: 'beacon', name: 'Beacon', lastActivityIso: '2026-06-01T06:00:00.000Z' }],
      }),
    )
    expect(signals.length).toBeGreaterThan(0)
    for (const signal of signals) {
      expect(signal.title.length).toBeLessThanOrEqual(60)
    }
  })
})
