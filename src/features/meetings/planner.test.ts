import { describe, expect, it } from 'vitest'
import {
  assembleMeetingPlan,
  buildAgenda,
  type AssembleMeetingPlanInput,
} from '@/features/meetings/planner'

const ALPHA = 'app-alpha'
const BETA = 'app-beta'
const NADEESHA = 'user-nadeesha'
const KASUN = 'user-kasun'
const TODAY = '2026-08-20'

function input(overrides: Partial<AssembleMeetingPlanInput> = {}): AssembleMeetingPlanInput {
  return {
    projects: [
      { appId: ALPHA, name: 'Alpha', slug: 'alpha', healthLevel: 'on-track', healthReasons: [] },
    ],
    people: [
      { userId: NADEESHA, name: 'Nadeesha', avatarUrl: null },
      { userId: KASUN, name: 'Kasun', avatarUrl: null },
    ],
    roles: [],
    attendeeIds: [],
    openTasks: [],
    runningSprints: [],
    sprintTasks: [],
    checkins: [],
    followups: [],
    todayIso: TODAY,
    ...overrides,
  }
}

const askKeys = (plan: ReturnType<typeof assembleMeetingPlan>, userId: string) =>
  plan.candidates.find((c) => c.userId === userId)?.asks.map((a) => a.key) ?? []

describe('assembleMeetingPlan — overdue work', () => {
  const overdueTask = {
    appId: ALPHA,
    sprintId: null,
    assigneeId: NADEESHA,
    status: 'todo' as const,
    dueDate: '2026-08-01',
  }

  it('counts past-due tasks once per person per project and links to that filter', () => {
    const plan = assembleMeetingPlan(
      input({ openTasks: [overdueTask, { ...overdueTask, dueDate: '2026-08-02' }] }),
    )
    const [ask] = plan.candidates.find((c) => c.userId === NADEESHA)!.asks
    expect(ask.kind).toBe('overdue')
    expect(ask.text).toBe('2 tasks past due on Alpha')
    expect(ask.href).toContain(`who=${NADEESHA}`)
    expect(ask.href).toContain('overdue=1')
  })

  it('does not count a task due today — the same rule as getAppCounts', () => {
    const plan = assembleMeetingPlan(input({ openTasks: [{ ...overdueTask, dueDate: TODAY }] }))
    expect(plan.candidates).toEqual([])
  })

  it('drops the line entirely once the task is done — nothing is stored to go stale', () => {
    const plan = assembleMeetingPlan(
      input({ openTasks: [{ ...overdueTask, status: 'done' as const }] }),
    )
    expect(plan.candidates).toEqual([])
  })

  it('ignores a task on a project this meeting is not on', () => {
    const plan = assembleMeetingPlan(input({ openTasks: [{ ...overdueTask, appId: BETA }] }))
    expect(plan.candidates).toEqual([])
  })
})

describe('assembleMeetingPlan — check-ins against the board', () => {
  const sprint = { sprintId: 'sprint-1', name: 'Sprint 4', appId: ALPHA }
  const sprintTasks = [
    { appId: ALPHA, sprintId: 'sprint-1', assigneeId: NADEESHA, status: 'done' as const, dueDate: null },
    { appId: ALPHA, sprintId: 'sprint-1', assigneeId: NADEESHA, status: 'todo' as const, dueDate: null },
  ]

  it('raises a line when the report runs ahead of the board', () => {
    const plan = assembleMeetingPlan(
      input({
        runningSprints: [sprint],
        sprintTasks,
        checkins: [{ sprintId: 'sprint-1', userId: NADEESHA, percent: 90 }],
      }),
    )
    const [ask] = plan.candidates.find((c) => c.userId === NADEESHA)!.asks
    expect(ask.kind).toBe('checkin')
    expect(ask.gap).toBe('ahead')
    expect(ask.text).toBe('Said 90% on Sprint 4, the board says 50%')
  })

  it('says nothing when the report and the board agree', () => {
    const plan = assembleMeetingPlan(
      input({
        runningSprints: [sprint],
        sprintTasks,
        checkins: [{ sprintId: 'sprint-1', userId: NADEESHA, percent: 50 }],
      }),
    )
    expect(plan.candidates).toEqual([])
  })

  it('states "no tasks to compare" in words rather than rendering it as agreement', () => {
    const plan = assembleMeetingPlan(
      input({
        runningSprints: [sprint],
        sprintTasks: [],
        checkins: [{ sprintId: 'sprint-1', userId: KASUN, percent: 40 }],
      }),
    )
    const [ask] = plan.candidates.find((c) => c.userId === KASUN)!.asks
    expect(ask.gap).toBe('unknown')
    expect(ask.text).toContain('no tasks on that board to compare against')
  })
})

describe('assembleMeetingPlan — project-level lines', () => {
  it('renders appHealth reasons verbatim and addresses them to the lead', () => {
    const plan = assembleMeetingPlan(
      input({
        projects: [
          {
            appId: ALPHA,
            name: 'Alpha',
            slug: 'alpha',
            healthLevel: 'at-risk',
            healthReasons: ['Sprint “Sprint 4” ended 3 days ago and is still open'],
          },
        ],
        roles: [
          { appId: ALPHA, userId: KASUN, role: 'pm', assumedAtMigration: false },
          { appId: ALPHA, userId: NADEESHA, role: 'lead', assumedAtMigration: true },
        ],
      }),
    )
    const lead = plan.candidates.find((c) => c.userId === NADEESHA)!
    expect(lead.asks.map((a) => a.text)).toEqual([
      'Sprint “Sprint 4” ended 3 days ago and is still open',
    ])
    expect(lead.roles[0].assumedAtMigration).toBe(true)
    expect(askKeys(plan, KASUN)).toEqual([])
  })

  it('falls back to the PM when the project has no lead', () => {
    const plan = assembleMeetingPlan(
      input({
        projects: [
          { appId: ALPHA, name: 'Alpha', slug: 'alpha', healthLevel: 'watch', healthReasons: ['No lead'] },
        ],
        roles: [{ appId: ALPHA, userId: KASUN, role: 'pm', assumedAtMigration: false }],
      }),
    )
    expect(plan.candidates.find((c) => c.userId === KASUN)!.asks[0].text).toBe('No lead')
  })

  it('gives unassigned sprint work to the PM, never to an individual', () => {
    const plan = assembleMeetingPlan(
      input({
        roles: [{ appId: ALPHA, userId: KASUN, role: 'pm', assumedAtMigration: false }],
        runningSprints: [{ sprintId: 'sprint-1', name: 'Sprint 4', appId: ALPHA }],
        sprintTasks: [
          { appId: ALPHA, sprintId: 'sprint-1', assigneeId: null, status: 'todo', dueDate: null },
        ],
      }),
    )
    const [ask] = plan.candidates.find((c) => c.userId === KASUN)!.asks
    expect(ask.kind).toBe('unassigned')
    expect(ask.text).toBe('1 task in Sprint 4 with nobody on it')
  })
})

describe('assembleMeetingPlan — follow-ups', () => {
  const followup = {
    followupId: 'f1',
    userId: NADEESHA,
    text: 'Send the client the revised scope',
    sourceMeetingId: 'meeting-earlier',
    sourceMeetingTitle: 'Kickoff',
  }

  it('files a follow-up under the one project its source meeting shares', () => {
    const plan = assembleMeetingPlan(input({ followups: [{ ...followup, sharedAppIds: [ALPHA] }] }))
    const [ask] = plan.candidates.find((c) => c.userId === NADEESHA)!.asks
    expect(ask.appId).toBe(ALPHA)
    expect(ask.href).toBe('/print/meetings/meeting-earlier')
    expect(ask.context).toContain('Kickoff')
  })

  it('sends it to the cross-project group when its source shares more than one', () => {
    const plan = assembleMeetingPlan(
      input({
        projects: [
          { appId: ALPHA, name: 'Alpha', slug: 'alpha', healthLevel: 'on-track', healthReasons: [] },
          { appId: BETA, name: 'Beta', slug: 'beta', healthLevel: 'on-track', healthReasons: [] },
        ],
        followups: [{ ...followup, sharedAppIds: [ALPHA, BETA] }],
      }),
    )
    expect(plan.candidates.find((c) => c.userId === NADEESHA)!.asks[0].appId).toBeNull()
  })
})

describe('assembleMeetingPlan — the one reason phrase', () => {
  it('prefers the role somebody holds over whatever their board says today', () => {
    const plan = assembleMeetingPlan(
      input({
        roles: [{ appId: ALPHA, userId: KASUN, role: 'pm', assumedAtMigration: false }],
        openTasks: [
          { appId: ALPHA, sprintId: null, assigneeId: KASUN, status: 'todo', dueDate: '2026-08-01' },
        ],
      }),
    )
    expect(plan.candidates.find((c) => c.userId === KASUN)!.reason).toBe('PM of Alpha')
  })

  it('otherwise names the strongest open item', () => {
    const plan = assembleMeetingPlan(
      input({
        followups: [
          {
            followupId: 'f1',
            userId: NADEESHA,
            text: 'Confirm the invoice',
            sourceMeetingId: 'm',
            sourceMeetingTitle: 'Kickoff',
            sharedAppIds: [ALPHA],
          },
        ],
      }),
    )
    expect(plan.candidates.find((c) => c.userId === NADEESHA)!.reason).toBe(
      'owes 1 follow-up from earlier meetings',
    )
  })
})

describe('assembleMeetingPlan — invite state', () => {
  it('marks who already holds a meeting_attendees row without inventing one', () => {
    const plan = assembleMeetingPlan(
      input({
        attendeeIds: [NADEESHA],
        roles: [
          { appId: ALPHA, userId: NADEESHA, role: 'pm', assumedAtMigration: false },
          { appId: ALPHA, userId: KASUN, role: 'lead', assumedAtMigration: false },
        ],
      }),
    )
    expect(plan.candidates.find((c) => c.userId === NADEESHA)!.onInvite).toBe(true)
    expect(plan.candidates.find((c) => c.userId === KASUN)!.onInvite).toBe(false)
  })

  it('never names a candidate it has no users row for', () => {
    const plan = assembleMeetingPlan(
      input({
        people: [],
        roles: [{ appId: ALPHA, userId: KASUN, role: 'pm', assumedAtMigration: false }],
      }),
    )
    expect(plan.candidates).toEqual([])
  })
})

describe('buildAgenda', () => {
  const plan = assembleMeetingPlan(
    input({
      openTasks: [
        { appId: ALPHA, sprintId: null, assigneeId: NADEESHA, status: 'todo', dueDate: '2026-08-01' },
      ],
    }),
  )

  it('leaves out anyone the organiser has not accepted', () => {
    expect(buildAgenda(plan, new Set(), new Set())).toEqual([])
  })

  it('groups an accepted person’s asks under their project', () => {
    const [group] = buildAgenda(plan, new Set([NADEESHA]), new Set())
    expect(group.appId).toBe(ALPHA)
    expect(group.title).toBe('Alpha')
    expect(group.entries[0].asks).toHaveLength(1)
  })

  it('drops a single line without dropping the person, and empties the group with it', () => {
    const key = plan.candidates[0].asks[0].key
    expect(buildAgenda(plan, new Set([NADEESHA]), new Set([key]))).toEqual([])
  })
})
