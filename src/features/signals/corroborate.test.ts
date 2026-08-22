import { describe, expect, it } from 'vitest'
import {
  CHECKED_CHANNELS,
  QUIET_RUN_DAYS,
  corroborateDay,
  corroborateRange,
  findQuietRuns,
  findUnclaimedDays,
  summarize,
  type DayInput,
} from './corroborate'
import type { Observation, ObservationKind } from './observe'

const day = (over: Partial<DayInput> = {}): DayInput => ({
  userId: 'u1',
  day: '2026-08-18',
  claimedMinutes: 480,
  onLeave: false,
  workingFraction: 1,
  allocationPct: 100,
  ...over,
})

const obs = (kind: ObservationKind, over: Partial<Observation> = {}): Observation => ({
  userId: 'u1',
  day: '2026-08-18',
  kind,
  appId: null,
  at: new Date('2026-08-18T09:00:00Z'),
  ...over,
})

describe("the golden case: a tech lead's Tuesday", () => {
  // Four meetings, two reviews, one production incident, ZERO tickets closed.
  // This is the case the obvious design gets wrong, and the reason this
  // module exists. The schema comment on worklog_entries says it outright:
  // counting only task-linked output computes their honest full day as zero —
  // "the app calling somebody lazy for doing their job".
  const tuesday = [
    obs('meeting.attended'),
    obs('meeting.attended'),
    obs('meeting.attended'),
    obs('meeting.attended'),
    obs('meeting.spoke'),
    obs('review.approved'),
    obs('review.rejected'),
    obs('bug.triaged'),
  ]

  it('reads as a corroborated day, not an empty one', () => {
    const result = corroborateDay(day(), tuesday)
    expect(result.verdict).toBe('strong')
  })

  it('is never counted as quiet', () => {
    expect(findQuietRuns([corroborateDay(day(), tuesday)])).toEqual([])
  })

  it('still corroborates when nothing was decided, only discussed', () => {
    // Strip the reviews and the triage: now it is four meetings and forty
    // minutes of arguing. meeting-load/participation.ts already ruled on
    // this — output count is a proxy for value, and discussion overrules the
    // proxy. So: engaged, not silent.
    const discussionOnly = [obs('meeting.attended'), obs('meeting.spoke')]
    expect(corroborateDay(day(), discussionOnly).verdict).toBe('partial')
  })
})

describe('one day at a time', () => {
  it('is strong when anything finished', () => {
    expect(corroborateDay(day(), [obs('task.completed')]).verdict).toBe('strong')
    expect(corroborateDay(day(), [obs('commit')]).verdict).toBe('strong')
  })

  it('is partial when somebody was present without finishing anything', () => {
    expect(corroborateDay(day(), [obs('task.moved')]).verdict).toBe('partial')
  })

  it('counts a written worklog note as the weakest real trace', () => {
    // Not proof, and fully under the control of the person being measured.
    // Here anyway: the alternative reads "wrote down what they did" as
    // identical to "said nothing", which rates the honest reporter as silence.
    expect(corroborateDay(day(), [obs('worklog.scored')]).verdict).toBe('partial')
  })

  it('is none when hours were claimed and nothing at all was seen', () => {
    expect(corroborateDay(day(), []).verdict).toBe('none')
  })

  it('is none for an empty expected day even with no hours claimed', () => {
    // Otherwise the person who logs nothing at all becomes invisible to the
    // detector — the exact opposite of what it is for.
    expect(corroborateDay(day({ claimedMinutes: 0 }), []).verdict).toBe('none')
  })
})

describe('when nothing was expected', () => {
  it('is not-applicable on approved leave', () => {
    const result = corroborateDay(day({ claimedMinutes: 0, onLeave: true }), [])
    expect(result.verdict).toBe('not-applicable')
    expect(result.expected).toBe(false)
  })

  it('is not-applicable on a Sunday or a holiday', () => {
    expect(corroborateDay(day({ claimedMinutes: 0, workingFraction: 0 }), []).expected).toBe(false)
  })

  it('still expects work on a Saturday half day', () => {
    // Saturday is half a working day at this studio, not a day off — one
    // definition, in working-days.ts, and this feature does not fork it.
    expect(corroborateDay(day({ workingFraction: 0.5 }), []).expected).toBe(true)
  })

  it('expects nothing from somebody with no allocation', () => {
    // Zero allocation means nobody gave them anything to do. Firing on that
    // would report a management failure as a personal one.
    expect(corroborateDay(day({ allocationPct: 0 }), []).expected).toBe(false)
  })
})

describe('runs of quiet days', () => {
  const quietDays = (days: string[], over: Partial<DayInput> = {}) =>
    corroborateRange(days.map((d) => day({ day: d, ...over })), [])

  it('says nothing about one or two quiet days', () => {
    // A quiet Wednesday is a hard bug, not a problem. Anything that fired here
    // would be hostile and would be turned off within a week.
    expect(findQuietRuns(quietDays(['2026-08-18']))).toEqual([])
    expect(findQuietRuns(quietDays(['2026-08-18', '2026-08-19']))).toEqual([])
  })

  it('raises a run at the threshold', () => {
    const runs = findQuietRuns(quietDays(['2026-08-18', '2026-08-19', '2026-08-20']))
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ userId: 'u1', from: '2026-08-18', to: '2026-08-20', days: 3 })
    expect(QUIET_RUN_DAYS).toBe(3)
  })

  it('always carries what was checked, so "nothing" can be audited', () => {
    // "Nothing was found" is a claim about the observer too. Somebody asked
    // why their week looks empty is entitled to the list of places searched.
    const [run] = findQuietRuns(quietDays(['2026-08-18', '2026-08-19', '2026-08-20']))
    expect(run.checkedChannels).toBe(CHECKED_CHANNELS)
    expect(run.checkedChannels.length).toBeGreaterThan(5)
  })

  it('treats a weekend as a gap, not a reset', () => {
    // Thursday, Friday, then Monday. Consecutive WORKING days — if the
    // weekend reset the count nobody could ever accumulate a run.
    const days = corroborateRange(
      [
        day({ day: '2026-08-20' }),
        day({ day: '2026-08-21' }),
        day({ day: '2026-08-23', workingFraction: 0, claimedMinutes: 0 }),
        day({ day: '2026-08-24' }),
      ],
      [],
    )
    expect(findQuietRuns(days)).toHaveLength(1)
  })

  it('never fires across approved leave', () => {
    // The single worst failure available to this feature: flagging the person
    // who filed their leave correctly.
    const days = corroborateRange(
      [
        day({ day: '2026-08-18', onLeave: true, claimedMinutes: 0 }),
        day({ day: '2026-08-19', onLeave: true, claimedMinutes: 0 }),
        day({ day: '2026-08-20', onLeave: true, claimedMinutes: 0 }),
        day({ day: '2026-08-21', onLeave: true, claimedMinutes: 0 }),
      ],
      [],
    )
    expect(findQuietRuns(days)).toEqual([])
  })

  it('breaks a run on a single corroborated day', () => {
    const days = corroborateRange(
      ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21'].map((d) =>
        day({ day: d }),
      ),
      [obs('commit', { day: '2026-08-19' })],
    )
    expect(findQuietRuns(days)).toEqual([])
  })

  it('sorts unsorted input rather than inventing runs from it', () => {
    const days = corroborateRange(
      [day({ day: '2026-08-20' }), day({ day: '2026-08-18' }), day({ day: '2026-08-19' })],
      [],
    )
    const [run] = findQuietRuns(days)
    expect(run.from).toBe('2026-08-18')
    expect(run.to).toBe('2026-08-20')
  })

  it('keeps two people apart', () => {
    const days = corroborateRange(
      [
        day({ userId: 'a', day: '2026-08-18' }),
        day({ userId: 'b', day: '2026-08-19' }),
        day({ userId: 'a', day: '2026-08-19' }),
        day({ userId: 'a', day: '2026-08-20' }),
      ],
      [],
    )
    const runs = findQuietRuns(days)
    expect(runs).toHaveLength(1)
    expect(runs[0].userId).toBe('a')
  })
})

describe('looking the other way', () => {
  it('finds days that were worked and never logged', () => {
    // The mirror, and it ships from the same pass on purpose. A tool that only
    // ever detects under-reporting of effort is not a measurement tool.
    const days = corroborateRange([day({ claimedMinutes: 0 })], [obs('task.completed')])
    const unclaimed = findUnclaimedDays(days)
    expect(unclaimed).toHaveLength(1)
    expect(unclaimed[0]).toMatchObject({ userId: 'u1', day: '2026-08-18', observations: 1 })
  })

  it('needs no run threshold, unlike quiet days', () => {
    // One blank day is immediately actionable and costs nobody anything to be
    // wrong about — the asymmetry with QUIET_RUN_DAYS is deliberate.
    expect(findUnclaimedDays(corroborateRange([day({ claimedMinutes: 0 })], [obs('commit')])))
      .toHaveLength(1)
  })

  it('ignores days that were already logged', () => {
    expect(findUnclaimedDays(corroborateRange([day()], [obs('commit')]))).toEqual([])
  })
})

describe('summary', () => {
  it('counts each verdict and reports the expected-day denominator', () => {
    const days = corroborateRange(
      [
        day({ day: '2026-08-18' }),
        day({ day: '2026-08-19' }),
        day({ day: '2026-08-23', workingFraction: 0, claimedMinutes: 0 }),
      ],
      [obs('task.completed', { day: '2026-08-18' }), obs('task.moved', { day: '2026-08-19' })],
    )
    expect(summarize(days)).toEqual({
      strong: 1,
      partial: 1,
      none: 0,
      notApplicable: 1,
      expectedDays: 2,
    })
  })
})
