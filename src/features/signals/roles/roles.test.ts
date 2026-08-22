import { describe, expect, it } from 'vitest'
import { architectScorecard, type ArchitectScorecardInput } from './architect'
import { leadScorecard, type LeadScorecardInput } from './lead'
import { memberScorecard, type MemberScorecardInput } from './member'
import { pmScorecard, type PmScorecardInput } from './pm'
import { perWorkingDay, share, type SignalWindow } from './shared'
import type { Figure } from '../figure'

const WINDOW: SignalWindow = { from: '2026-08-03', to: '2026-08-14', workingDays: 11 }
const AS_OF = new Date('2026-08-14T12:00:00Z')

const find = (figures: Figure[], key: string): Figure => {
  const figure = figures.find((f) => f.key === key)
  if (!figure) throw new Error(`no figure ${key}`)
  return figure
}

const pmInput = (over: Partial<PmScorecardInput> = {}): PmScorecardInput => ({
  userId: 'pm1',
  window: WINDOW,
  asOf: AS_OF,
  committed: [],
  followups: [],
  checkins: [],
  blocked: [],
  checkinStaleDays: 5,
  ...over,
})

const leadInput = (over: Partial<LeadScorecardInput> = {}): LeadScorecardInput => ({
  userId: 'lead1',
  window: WINDOW,
  asOf: AS_OF,
  reviews: [],
  completions: [],
  assignments: [],
  ownInProgress: 0,
  reopened: 0,
  ...over,
})

const architectInput = (over: Partial<ArchitectScorecardInput> = {}): ArchitectScorecardInput => ({
  userId: 'arch1',
  window: WINDOW,
  decisions: 0,
  commentsOnCommitted: 0,
  meetings: [],
  committedReviewed: 0,
  committedTotal: 0,
  followupsAuthored: 0,
  appsTouched: 0,
  ...over,
})

const memberInput = (over: Partial<MemberScorecardInput> = {}): MemberScorecardInput => ({
  userId: 'm1',
  window: WINDOW,
  completions: [],
  commits: 0,
  commitsUnavailable: null,
  minutesByCategory: {},
  expectedMinutes: 5_280,
  allocationPct: 100,
  ...over,
})

describe('fairness rule 4: no scorecard can be ranked against another', () => {
  const cards = [
    pmScorecard(pmInput()),
    leadScorecard(leadInput()),
    architectScorecard(architectInput()),
    memberScorecard(memberInput()),
  ]

  it('exposes no top-level number to sort on', () => {
    // Structural, not stylistic. The moment two scorecards share a numeric
    // field they can be put in one ranked list, and the numbers stop
    // describing two different jobs and start describing a race between them.
    for (const card of cards) {
      const numeric = Object.entries(card).filter(([, v]) => typeof v === 'number')
      expect(numeric).toEqual([])
    }
  })

  it('tags every card with its role, so a mixed list is obvious', () => {
    expect(cards.map((c) => c.role)).toEqual(['pm', 'lead', 'architect', 'member'])
  })

  it('never emits a figure key belonging to another role', () => {
    for (const card of cards) {
      for (const figure of card.figures) expect(figure.key.startsWith(`${card.role}.`)).toBe(true)
    }
  })
})

describe('empty windows say so instead of scoring zero', () => {
  it('reports every unmeasurable figure with a reason a person can act on', () => {
    const cards = [
      pmScorecard(pmInput()),
      leadScorecard(leadInput()),
      architectScorecard(architectInput()),
    ]
    for (const card of cards) {
      for (const figure of card.figures) {
        // The invariant: blank AND silent is the failure the type exists to
        // prevent. Exactly one of value/unavailable is set, always.
        expect(figure.value === null).toBe(figure.unavailable !== null)
        if (figure.unavailable !== null) expect(figure.unavailable.length).toBeGreaterThan(10)
      }
    }
  })
})

describe('PM', () => {
  it('measures commitments against the ORIGINAL date, not the current one', () => {
    // A hit rate computed against the latest due date can be made perfect by
    // editing due dates, which is why original_due_date exists at all.
    const card = pmScorecard(
      pmInput({
        committed: [
          { originalDueDate: '2026-08-10', completedAt: new Date('2026-08-09T05:00:00Z'), dueChangedCount: 0 },
          { originalDueDate: '2026-08-10', completedAt: new Date('2026-08-13T05:00:00Z'), dueChangedCount: 3 },
        ],
      }),
    )
    expect(find(card.figures, 'pm.commitment-integrity').value).toBe(50)
  })

  it('surfaces deadline moves as the counter to that hit rate', () => {
    const card = pmScorecard(
      pmInput({
        committed: [
          { originalDueDate: '2026-08-10', completedAt: new Date('2026-08-13T05:00:00Z'), dueChangedCount: 3 },
        ],
      }),
    )
    expect(find(card.figures, 'pm.commitment-integrity').counter).toBe('pm.due-changes')
    expect(find(card.figures, 'pm.due-changes').value).toBe(3)
  })

  it('counts a follow-up closed with no answer written', () => {
    // The fastest possible closing time is the one where nobody wrote what
    // came of it, so speed alone is not readable.
    const card = pmScorecard(
      pmInput({
        followups: [
          { openedAt: new Date('2026-08-03T00:00:00Z'), resolvedAt: new Date('2026-08-05T00:00:00Z'), resolutionNote: 'Client confirmed' },
          { openedAt: new Date('2026-08-03T00:00:00Z'), resolvedAt: new Date('2026-08-04T00:00:00Z'), resolutionNote: null },
        ],
      }),
    )
    expect(find(card.figures, 'pm.followup-latency').value).toBe(1.5)
    expect(find(card.figures, 'pm.followup-unanswered').value).toBe(50)
  })

  it('reports the OLDEST stuck assignment, not how many there are', () => {
    // Ten cards a day old is a backlog. One card assigned and untouched for
    // six weeks is a person quietly blocked, and a mean hides it in the first.
    const card = pmScorecard(
      pmInput({
        blocked: [
          { createdAt: new Date('2026-08-13T00:00:00Z') },
          { createdAt: new Date('2026-07-05T00:00:00Z') },
        ],
      }),
    )
    expect(find(card.figures, 'pm.oldest-blocked').value).toBe(40)
  })
})

describe('Tech Lead', () => {
  it('pairs review speed with what escaped', () => {
    const card = leadScorecard(
      leadInput({
        reviews: Array.from({ length: 22 }, () => ({ at: AS_OF, verdict: 'approved' as const })),
        completions: [
          { taskId: 't1', createdAt: new Date('2026-08-03T00:00:00Z'), completedAt: new Date('2026-08-05T00:00:00Z'), defectsAfter: 2 },
          { taskId: 't2', createdAt: new Date('2026-08-03T00:00:00Z'), completedAt: new Date('2026-08-06T00:00:00Z'), defectsAfter: 0 },
        ],
      }),
    )
    expect(find(card.figures, 'lead.review-throughput').value).toBe(2)
    expect(find(card.figures, 'lead.review-throughput').counter).toBe('lead.defect-escape')
    expect(find(card.figures, 'lead.defect-escape').value).toBe(50)
  })

  it('labels defect escape as inferred, because proximity is not causation', () => {
    const card = leadScorecard(
      leadInput({
        completions: [{ taskId: 't1', createdAt: AS_OF, completedAt: AS_OF, defectsAfter: 1 }],
      }),
    )
    expect(find(card.figures, 'lead.defect-escape').basis).toBe('inferred')
  })

  it('reports the slow tail alongside the median, never instead of it', () => {
    // A board with a healthy middle and a horrifying tail reads as fine if
    // only p50 ships.
    const mk = (days: number) => ({
      taskId: `t${days}`,
      createdAt: new Date('2026-08-01T00:00:00Z'),
      completedAt: new Date(Date.UTC(2026, 7, 1 + days)),
      defectsAfter: 0,
    })
    const card = leadScorecard(leadInput({ completions: [1, 1, 2, 2, 3, 40].map(mk) }))
    expect(find(card.figures, 'lead.cycle-p50').value).toBe(2)
    expect(find(card.figures, 'lead.cycle-p90').value).toBe(40)
  })

  it('makes the lead being the bottleneck a headline figure', () => {
    const card = leadScorecard(leadInput({ ownInProgress: 9 }))
    expect(find(card.figures, 'lead.personal-wip').value).toBe(9)
  })
})

describe('Architect', () => {
  it('carries its caveat with the numbers, not in a footnote', () => {
    const card = architectScorecard(architectInput())
    expect(card.caveat).toContain('least machine-readable trace')
  })

  it('treats voice as the primary output', () => {
    const card = architectScorecard(
      architectInput({
        meetings: [
          { meetingId: 'm1', voiceTurns: 30, totalTurns: 100, transcribed: true },
          { meetingId: 'm2', voiceTurns: 10, totalTurns: 100, transcribed: true },
        ],
      }),
    )
    expect(find(card.figures, 'architect.voice-share').value).toBe(20)
  })

  it('does not punish an architect for meetings nobody recorded', () => {
    // An untranscribed meeting is not one where nobody spoke. Folding those
    // in would make somebody's score depend on whether a colleague pressed
    // record.
    const card = architectScorecard(
      architectInput({
        meetings: [{ meetingId: 'm1', voiceTurns: 0, totalTurns: 0, transcribed: false }],
      }),
    )
    const voice = find(card.figures, 'architect.voice-share')
    expect(voice.value).toBeNull()
    expect(voice.unavailable).toContain('recorded')
  })

  it('treats breadth as a warning rather than an achievement', () => {
    const card = architectScorecard(architectInput({ decisions: 4, appsTouched: 11 }))
    expect(find(card.figures, 'architect.decisions').counter).toBe('architect.breadth')
    expect(find(card.figures, 'architect.breadth').value).toBe(11)
  })
})

describe('IC / member', () => {
  it('says "cannot see" rather than zero when GitHub is not linked', () => {
    // "Wrote no code" and "we cannot see their code" are different sentences
    // about a person, and only one of them is true.
    const card = memberScorecard(
      memberInput({ commits: null, commitsUnavailable: 'No GitHub account linked on /profile.' }),
    )
    const commits = find(card.figures, 'member.commits')
    expect(commits.value).toBeNull()
    expect(commits.unavailable).toContain('GitHub')
  })

  it('still reports a real zero as zero', () => {
    expect(find(memberScorecard(memberInput({ commits: 0 })).figures, 'member.commits').value).toBe(0)
  })

  it('reports the effort mix without judging it', () => {
    // A quarter mostly on support is an on-call rotation. Scoring 'task'
    // above 'review' would be telling seniors to stop reviewing.
    const card = memberScorecard(
      memberInput({ minutesByCategory: { task: 300, review: 600, support: 100 } }),
    )
    expect(find(card.figures, 'member.effort-task-share').value).toBe(30)
  })
})

describe('denominators', () => {
  it('divides by working days minus leave, never calendar days', () => {
    // A fortnight is eleven working days here, not fourteen. Dividing by
    // fourteen makes everybody look less productive in exact proportion to
    // how much they rested.
    expect(perWorkingDay(22, 11)).toBe(2)
  })

  it('returns null, not zero, for a window with no working days', () => {
    // A fortnight of approved leave has no working days, and "0 a day" on
    // that scorecard is a zero printed over somebody's holiday.
    expect(perWorkingDay(0, 0)).toBeNull()
    expect(share(0, 0)).toBeNull()
  })
})
