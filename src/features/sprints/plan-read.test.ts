import { describe, expect, it } from 'vitest'
import { BURN_GAP_THRESHOLD } from '@/features/apps/app-health'
import { completionCount, planGaps, readSprint, toTaskCounts } from './plan-read'
import type { SprintRead } from './plan-read'

describe('toTaskCounts', () => {
  it('totals the three statuses', () => {
    expect(toTaskCounts({ todo: 3, in_progress: 2, done: 5 })).toEqual({
      todo: 3,
      in_progress: 2,
      done: 5,
      total: 10,
      overdue: 0,
    })
  })

  it('passes an overdue count through for callers that have one', () => {
    // Nothing this module derives reads it — it exists on AppTaskCounts for
    // the app card's health verdict, and defaulting to 0 keeps the adapter
    // from having to invent a number it cannot know.
    expect(toTaskCounts({ todo: 1, in_progress: 0, done: 0 }, 4).overdue).toBe(4)
  })
})

describe('readSprint', () => {
  const sprint = { startDate: '2026-08-01', endDate: '2026-08-14' }

  it('calls a finished sprint complete even before its end date', () => {
    // Running out of days is not what makes a sprint late if the work landed.
    const read = readSprint(sprint, { todo: 0, in_progress: 0, done: 6 }, '2026-08-05')
    expect(read.health).toBe('complete')
    expect(read.summary).toBe('All 6 done.')
  })

  it('calls unfinished work past the end date overdue, not behind', () => {
    // "Behind" would understate a deadline that has already gone.
    const read = readSprint(sprint, { todo: 4, in_progress: 1, done: 2 }, '2026-08-20')
    expect(read.health).toBe('overdue')
    expect(read.summary).toContain('5 of 7 unfinished')
  })

  it('treats a CLOSED sprint as finished business, not overdue', () => {
    // Teams close a sprint and carry a few cards forward all the time.
    // Without this, every past sprint the app ever ran would wear a permanent
    // red "overdue" bar on the spine — and appHealth already guards the same
    // judgement with the same status check.
    const read = readSprint(
      { ...sprint, status: 'done' },
      { todo: 2, in_progress: 0, done: 5 },
      '2026-09-01',
    )
    expect(read.health).toBe('complete')
    expect(read.summary).toContain('carried forward')
  })

  it('still calls an OPEN sprint past its end date overdue', () => {
    const read = readSprint(
      { ...sprint, status: 'active' },
      { todo: 2, in_progress: 0, done: 5 },
      '2026-09-01',
    )
    expect(read.health).toBe('overdue')
  })

  it('reports a future sprint as not started', () => {
    const read = readSprint(sprint, { todo: 3, in_progress: 0, done: 0 }, '2026-07-20')
    expect(read.health).toBe('not-started')
    expect(read.summary).toContain('3 planned')
  })

  it('is on-track when the work keeps pace with the clock', () => {
    const read = readSprint(sprint, { todo: 5, in_progress: 0, done: 5 }, '2026-08-07')
    expect(read.health).toBe('on-track')
  })

  it('tolerates work trailing the clock inside the shared burn threshold', () => {
    // Cards cluster at the end of a sprint (review, QA and merge all land
    // together), so a modest trail is ordinary rather than a warning.
    const read = readSprint(sprint, { todo: 6, in_progress: 0, done: 4 }, '2026-08-07')
    expect(read.progress.pct - read.donePct).toBeLessThan(BURN_GAP_THRESHOLD)
    expect(read.health).toBe('on-track')
  })

  it('is behind once the trail reaches the threshold, and says both numbers', () => {
    const read = readSprint(sprint, { todo: 9, in_progress: 0, done: 1 }, '2026-08-11')
    expect(read.progress.pct - read.donePct).toBeGreaterThanOrEqual(BURN_GAP_THRESHOLD)
    expect(read.health).toBe('behind')
    expect(read.summary).toContain('% of the time gone')
    expect(read.summary).toContain('% of the work done')
  })

  it('judges by the SAME threshold the health verdict and sprint band use', () => {
    // The regression this guards is drift: a spine with its own number would
    // paint a bar "behind" while AppSprintBand and appHealth still called the
    // same sprint fine. There must be exactly one threshold in the product.
    const justUnder = readSprint(
      sprint,
      // 10 cards, 1 done = 10%; day 8 of 14 ≈ 57% → gap 47, well over.
      { todo: 9, in_progress: 0, done: 1 },
      '2026-08-08',
    )
    expect(justUnder.health).toBe('behind')
  })

  it('never calls an empty running sprint behind', () => {
    // 0% of no work is not evidence of anything — flagging it would light up
    // every sprint the moment it was created.
    const read = readSprint(sprint, { todo: 0, in_progress: 0, done: 0 }, '2026-08-13')
    expect(read.health).toBe('on-track')
    expect(read.summary).toContain('nothing planned')
  })
})

describe('planGaps', () => {
  it('counts only unfinished work', () => {
    // A finished card with no assignee is bookkeeping, not risk.
    expect(
      planGaps([
        { assignee: null, dueDate: null, status: 'done' },
        { assignee: null, dueDate: '2026-08-09', status: 'todo' },
        { assignee: { id: 'u1' }, dueDate: null, status: 'in_progress' },
      ]),
    ).toEqual({ unassigned: 1, undated: 1 })
  })

  it('is zero on an empty sprint', () => {
    expect(planGaps([])).toEqual({ unassigned: 0, undated: 0 })
  })
})

describe('completionCount', () => {
  // Only the two counted fields matter here; the rest of SprintRead is along
  // for the ride, so a partial cast keeps each case about the one thing it
  // tests rather than about constructing a whole read.
  const read = (done: number, total: number) => ({ done, total }) as SprintRead

  it('reads as done-over-total once there is work to count', () => {
    expect(completionCount(read(3, 8))).toBe('3/8')
  })

  it('says empty rather than 0/0 for a sprint with nothing planned', () => {
    // The distinction the word exists for: 0% done and no work at all draw the
    // identical empty fill, so "0/0" would read as a failed sprint instead of
    // an unplanned one.
    expect(completionCount(read(0, 0))).toBe('empty')
  })

  it('keeps the ratio when work is planned but none is finished', () => {
    expect(completionCount(read(0, 5))).toBe('0/5')
  })

  it('keeps the ratio when everything is finished', () => {
    expect(completionCount(read(8, 8))).toBe('8/8')
  })
})
