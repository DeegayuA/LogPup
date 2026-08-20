import { describe, expect, it } from 'vitest'

import {
  CHECK_THRESHOLDS,
  findDiscrepancies,
  type CheckEntry,
  type DayEvidence,
  type ObservationKind,
} from './entry-check'

// ---------------------------------------------------------------------------
// EVERY observation type is tested here with NO MODEL IN THE LOOP. That is the
// point of the module: the AI is asked only to phrase what this function
// found, so if a discrepancy is not computable here it cannot be said at all.
// ---------------------------------------------------------------------------

const FULL_DAY = 480

const evidence = (over: Partial<DayEvidence> = {}): DayEvidence => ({
  meetingsAttended: [],
  // Non-zero by default so the whole-day 'unaccounted-gap' rule does not fire
  // in every unrelated test; the gap tests set it back to 0 explicitly.
  activityCount: 4,
  scheduledMinutes: FULL_DAY,
  tasksTouched: [],
  ...over,
})

const meeting = (title: string, startIso: string, endIso: string) => ({
  title,
  startedAt: new Date(startIso),
  endedAt: new Date(endIso),
})

const kinds = (obs: { kind: ObservationKind }[]) => obs.map((o) => o.kind)
const find = (obs: ReturnType<typeof findDiscrepancies>, kind: ObservationKind) =>
  obs.find((o) => o.kind === kind)

describe('silence is the common case', () => {
  it('finds nothing in an ordinary, well-matched day', () => {
    const entries: CheckEntry[] = [
      { minutes: 300, category: 'task', taskId: 't1', taskTitle: 'Ship the calendar' },
      { minutes: 120, category: 'meeting' },
      { minutes: 60, category: 'review' },
    ]
    const found = findDiscrepancies(entries, evidence({
      meetingsAttended: [meeting('Standup', '2026-08-20T03:30:00Z', '2026-08-20T05:30:00Z')],
      tasksTouched: ['t1'],
    }))
    expect(found).toEqual([])
  })

  it('says nothing at all about a day with no entries — that is an empty day, not a discrepancy', () => {
    // The calendar's own 'Missing' state already says this plainly; repeating
    // it here would make every unopened day generate observations.
    expect(findDiscrepancies([], evidence())).toEqual([])
  })
})

describe('the day against its schedule', () => {
  it('notices a total far ABOVE the scheduled day', () => {
    const found = findDiscrepancies([{ minutes: 700, category: 'other' }], evidence())
    const obs = find(found, 'over-scheduled')
    expect(obs).toBeDefined()
    expect(obs?.facts).toMatchObject({ loggedMinutes: 700, scheduledMinutes: FULL_DAY })
  })

  it('notices a total far BELOW the scheduled day', () => {
    const found = findDiscrepancies([{ minutes: 120, category: 'other' }], evidence())
    expect(find(found, 'under-scheduled')).toBeDefined()
  })

  it('stays quiet inside the slack — recall at the end of a day is approximate', () => {
    const found = findDiscrepancies(
      [{ minutes: FULL_DAY - 30, category: 'other' }],
      evidence(),
    )
    expect(kinds(found)).not.toContain('under-scheduled')
    expect(kinds(found)).not.toContain('over-scheduled')
  })

  it('renders the under-scheduled message as a FACT, never as an accusation', () => {
    const obs = find(findDiscrepancies([{ minutes: 120, category: 'other' }], evidence()), 'under-scheduled')
    expect(obs?.message).toBe('That day accounts for 2 hours, against 8 hours scheduled.')
    expect(obs?.message).not.toMatch(/you|didn't|did not|fail|should/i)
  })

  it('stays grammatical at 1 hour — these strings ship verbatim when the model is unavailable', () => {
    // "1 hour are accounted for" and "a 8 hours day" are both reachable from
    // innocent templates, and this is real product copy, not prompt input.
    const obs = find(findDiscrepancies([{ minutes: 60, category: 'other' }], evidence()), 'under-scheduled')
    expect(obs?.message).toBe('That day accounts for 1 hour, against 8 hours scheduled.')
  })

  it('SKIPS both schedule observations when the day length is unknown', () => {
    // There is no minutes-per-full-day constant in this repo, so null is a
    // real and expected value. Inventing a denominator would produce "you are
    // three hours short" from a number nobody chose.
    const found = findDiscrepancies(
      [{ minutes: 60, category: 'other' }],
      evidence({ scheduledMinutes: null }),
    )
    expect(kinds(found)).not.toContain('under-scheduled')
    expect(kinds(found)).not.toContain('over-scheduled')
  })

  it('skips them on a zero-length day rather than dividing by nothing', () => {
    const found = findDiscrepancies(
      [{ minutes: 120, category: 'other' }],
      evidence({ scheduledMinutes: 0 }),
    )
    expect(kinds(found)).not.toContain('under-scheduled')
    expect(kinds(found)).not.toContain('over-scheduled')
  })
})

describe('a meeting attended with no time accounted for', () => {
  it('notices meetings recorded against no logged meeting time', () => {
    const found = findDiscrepancies(
      [{ minutes: 420, category: 'task', taskId: 't1' }],
      evidence({
        meetingsAttended: [meeting('Sprint review', '2026-08-20T04:00:00Z', '2026-08-20T06:00:00Z')],
        tasksTouched: ['t1'],
      }),
    )
    const obs = find(found, 'meeting-unaccounted')
    expect(obs).toBeDefined()
    expect(obs?.facts).toMatchObject({ attendedMinutes: 120, loggedMeetingMinutes: 0 })
    expect(obs?.facts.meetings).toEqual(['Sprint review'])
  })

  it('notices a partial shortfall, naming both numbers', () => {
    const found = findDiscrepancies(
      [{ minutes: 30, category: 'meeting' }],
      evidence({
        meetingsAttended: [meeting('Planning', '2026-08-20T04:00:00Z', '2026-08-20T06:00:00Z')],
      }),
    )
    expect(find(found, 'meeting-unaccounted')?.facts).toMatchObject({ shortfallMinutes: 90 })
  })

  it('stays quiet when the logged meeting time matches what was attended', () => {
    const found = findDiscrepancies(
      [{ minutes: 120, category: 'meeting' }, { minutes: 360, category: 'task', taskId: 't1' }],
      evidence({
        meetingsAttended: [meeting('Planning', '2026-08-20T04:00:00Z', '2026-08-20T06:00:00Z')],
        tasksTouched: ['t1'],
      }),
    )
    expect(kinds(found)).not.toContain('meeting-unaccounted')
  })

  it('MERGES overlapping meetings — a double-booking is not two hours in two rooms', () => {
    // Summing durations would report 120 attended minutes and manufacture a
    // shortfall the person never had. That would be a discrepancy the app
    // invented, which is the exact failure this module exists to prevent.
    const found = findDiscrepancies(
      [{ minutes: 60, category: 'meeting' }],
      evidence({
        meetingsAttended: [
          meeting('Design sync', '2026-08-20T04:00:00Z', '2026-08-20T05:00:00Z'),
          meeting('Client call', '2026-08-20T04:00:00Z', '2026-08-20T05:00:00Z'),
        ],
      }),
    )
    expect(kinds(found)).not.toContain('meeting-unaccounted')
  })

  it('merges a partial overlap without losing the tail', () => {
    const found = findDiscrepancies(
      [{ minutes: 0 + 1, category: 'meeting' }],
      evidence({
        meetingsAttended: [
          meeting('A', '2026-08-20T04:00:00Z', '2026-08-20T05:00:00Z'),
          meeting('B', '2026-08-20T04:30:00Z', '2026-08-20T06:00:00Z'),
        ],
      }),
    )
    // 04:00–06:00 merged = 120 minutes, not 60 + 90.
    expect(find(found, 'meeting-unaccounted')?.facts).toMatchObject({ attendedMinutes: 120 })
  })

  it('ignores a zero-length or backwards meeting rather than subtracting time from the day', () => {
    const found = findDiscrepancies(
      [{ minutes: 480, category: 'other' }],
      evidence({
        meetingsAttended: [meeting('Ghost', '2026-08-20T05:00:00Z', '2026-08-20T05:00:00Z')],
      }),
    )
    expect(kinds(found)).not.toContain('meeting-unaccounted')
  })

  it('stays quiet for a shortfall inside the slack', () => {
    const found = findDiscrepancies(
      [{ minutes: 105, category: 'meeting' }],
      evidence({
        meetingsAttended: [meeting('Planning', '2026-08-20T04:00:00Z', '2026-08-20T06:00:00Z')],
      }),
    )
    expect(kinds(found)).not.toContain('meeting-unaccounted')
  })
})

describe('hours logged against a task with no activity that day', () => {
  it('notices a task with no activity', () => {
    const found = findDiscrepancies(
      [{ minutes: 180, category: 'task', taskId: 't1', taskTitle: 'Refactor the parser' }],
      evidence({ tasksTouched: ['t2'] }),
    )
    const obs = find(found, 'task-without-activity')
    expect(obs).toBeDefined()
    expect(obs?.facts).toMatchObject({ taskId: 't1', minutes: 180 })
  })

  it('carries the reassurance in the message itself, not in a prompt', () => {
    const obs = find(
      findDiscrepancies(
        [{ minutes: 180, category: 'task', taskId: 't1', taskTitle: 'Refactor the parser' }],
        evidence({ tasksTouched: [] }),
      ),
      'task-without-activity',
    )
    expect(obs?.message).toContain('normal for heads-down work')
    expect(obs?.severity).toBe('note')
  })

  it('stays quiet when the task was touched', () => {
    const found = findDiscrepancies(
      [{ minutes: 180, category: 'task', taskId: 't1' }],
      evidence({ tasksTouched: ['t1'] }),
    )
    expect(kinds(found)).not.toContain('task-without-activity')
  })

  it('sums a task split across two entries before reporting it', () => {
    const found = findDiscrepancies(
      [
        { minutes: 60, category: 'task', taskId: 't1', taskTitle: 'Parser' },
        { minutes: 90, category: 'task', taskId: 't1', taskTitle: 'Parser' },
      ],
      evidence({ tasksTouched: [] }),
    )
    expect(find(found, 'task-without-activity')?.facts).toMatchObject({ minutes: 150 })
  })

  it('reports one observation per untouched task, not one per entry', () => {
    const found = findDiscrepancies(
      [
        { minutes: 60, category: 'task', taskId: 't1' },
        { minutes: 60, category: 'task', taskId: 't2' },
      ],
      evidence({ tasksTouched: [] }),
    )
    expect(found.filter((o) => o.kind === 'task-without-activity')).toHaveLength(2)
  })
})

describe('a multi-hour gap with no evidence at all', () => {
  it('notices hours logged on a day with no activity and no meetings', () => {
    const found = findDiscrepancies(
      [{ minutes: CHECK_THRESHOLDS.gapMinutes, category: 'admin' }],
      evidence({ activityCount: 0, meetingsAttended: [], scheduledMinutes: null }),
    )
    const obs = find(found, 'unaccounted-gap')
    expect(obs).toBeDefined()
    expect(obs?.severity).toBe('note')
    expect(obs?.message).toContain('normal for heads-down work')
  })

  it('stays quiet below the multi-hour threshold — a short unrecorded stretch is nothing', () => {
    const found = findDiscrepancies(
      [{ minutes: CHECK_THRESHOLDS.gapMinutes - 1, category: 'admin' }],
      evidence({ activityCount: 0, meetingsAttended: [], scheduledMinutes: null }),
    )
    expect(kinds(found)).not.toContain('unaccounted-gap')
  })

  it('stays quiet when there WAS activity, however little', () => {
    const found = findDiscrepancies(
      [{ minutes: 300, category: 'admin' }],
      evidence({ activityCount: 1, meetingsAttended: [], scheduledMinutes: null }),
    )
    expect(kinds(found)).not.toContain('unaccounted-gap')
  })

  it('stays quiet when a meeting anchors the day even with no activity rows', () => {
    const found = findDiscrepancies(
      [{ minutes: 300, category: 'meeting' }],
      evidence({
        activityCount: 0,
        meetingsAttended: [meeting('Workshop', '2026-08-20T04:00:00Z', '2026-08-20T09:00:00Z')],
        scheduledMinutes: null,
      }),
    )
    expect(kinds(found)).not.toContain('unaccounted-gap')
  })

  it('covers non-task categories, which have no task to check', () => {
    // This is what makes it distinct from task-without-activity: a day of
    // 'support' and 'admin' has no taskId anywhere to compare against.
    const found = findDiscrepancies(
      [{ minutes: 240, category: 'support' }],
      evidence({ activityCount: 0, meetingsAttended: [], scheduledMinutes: null }),
    )
    expect(kinds(found)).toContain('unaccounted-gap')
  })
})

describe('the same task logged twice', () => {
  it('notices a task on two entries', () => {
    const found = findDiscrepancies(
      [
        { minutes: 60, category: 'task', taskId: 't1', taskTitle: 'Parser' },
        { minutes: 60, category: 'task', taskId: 't1', taskTitle: 'Parser' },
      ],
      evidence({ tasksTouched: ['t1'] }),
    )
    const obs = find(found, 'duplicate-task')
    expect(obs).toBeDefined()
    expect(obs?.facts).toMatchObject({ taskId: 't1', entryCount: 2, minutes: 120 })
  })

  it('offers both explanations instead of asserting a mistake', () => {
    const obs = find(
      findDiscrepancies(
        [
          { minutes: 60, category: 'task', taskId: 't1', taskTitle: 'Parser' },
          { minutes: 60, category: 'task', taskId: 't1', taskTitle: 'Parser' },
        ],
        evidence({ tasksTouched: ['t1'] }),
      ),
      'duplicate-task',
    )
    expect(obs?.message).toContain('two sessions, or one entry saved twice?')
    expect(obs?.severity).toBe('question')
  })

  it('stays quiet for two entries on two different tasks', () => {
    const found = findDiscrepancies(
      [
        { minutes: 60, category: 'task', taskId: 't1' },
        { minutes: 60, category: 'task', taskId: 't2' },
      ],
      evidence({ tasksTouched: ['t1', 't2'] }),
    )
    expect(kinds(found)).not.toContain('duplicate-task')
  })

  it('does not treat several task-less entries as duplicates of each other', () => {
    // Three meetings and two reviews in one day is an ordinary Tuesday.
    const found = findDiscrepancies(
      [
        { minutes: 60, category: 'meeting' },
        { minutes: 60, category: 'meeting' },
        { minutes: 60, category: 'review' },
      ],
      evidence({
        meetingsAttended: [meeting('All hands', '2026-08-20T04:00:00Z', '2026-08-20T06:00:00Z')],
      }),
    )
    expect(kinds(found)).not.toContain('duplicate-task')
  })
})

describe('severity split: the quiet ones are the ones about doing too little', () => {
  it('puts every "might not have logged enough" observation in the quiet bucket', () => {
    const found = findDiscrepancies(
      [{ minutes: 200, category: 'task', taskId: 't1', taskTitle: 'Parser' }],
      evidence({ activityCount: 0, meetingsAttended: [] }),
    )
    const quiet: ObservationKind[] = ['under-scheduled', 'task-without-activity', 'unaccounted-gap']
    for (const kind of quiet) {
      const obs = find(found, kind)
      if (obs) expect(obs.severity).toBe('note')
    }
    // All three of them actually fired, so the assertion above was not vacuous.
    expect(kinds(found).sort()).toEqual(quiet.sort())
  })

  it('never emits a blocking severity — saving always succeeds', () => {
    const found = findDiscrepancies(
      [{ minutes: 900, category: 'other' }],
      evidence({ activityCount: 0 }),
    )
    for (const obs of found) expect(['note', 'question']).toContain(obs.severity)
  })
})
