import { describe, expect, it } from 'vitest'
import {
  CHECKIN_GAP_THRESHOLD,
  checkinGap,
  computeTaskProgress,
  type TaskForProgress,
} from './checkins'

const ME = 'a2e920a6-2612-45a3-b0a4-cfd7a44a5a41'
const SOMEONE_ELSE = '5d9861f2-40de-46bb-9585-0e6a4e46f4e5'

function task(assigneeId: string | null, status: string): TaskForProgress {
  return { assigneeId, status }
}

describe('computeTaskProgress', () => {
  it('returns percent null on an empty board — "no tasks" is not "0% done"', () => {
    expect(computeTaskProgress([], ME)).toEqual({ done: 0, total: 0, percent: null })
  })

  it('returns percent null when every task belongs to someone else', () => {
    const tasks = [task(SOMEONE_ELSE, 'done'), task(SOMEONE_ELSE, 'todo')]
    expect(computeTaskProgress(tasks, ME)).toEqual({ done: 0, total: 0, percent: null })
  })

  it('never counts unassigned tasks toward anyone', () => {
    const tasks = [task(null, 'done'), task(ME, 'todo')]
    expect(computeTaskProgress(tasks, ME)).toEqual({ done: 0, total: 1, percent: 0 })
  })

  it('returns percent 0 (not null) when my tasks exist but none are done', () => {
    const tasks = [task(ME, 'todo'), task(ME, 'in_progress')]
    expect(computeTaskProgress(tasks, ME)).toEqual({ done: 0, total: 2, percent: 0 })
  })

  it('returns 100 when every one of my tasks is done', () => {
    const tasks = [task(ME, 'done'), task(ME, 'done'), task(SOMEONE_ELSE, 'todo')]
    expect(computeTaskProgress(tasks, ME)).toEqual({ done: 2, total: 2, percent: 100 })
  })

  it('counts in_progress as not-done — only status "done" is finished', () => {
    const tasks = [task(ME, 'done'), task(ME, 'in_progress'), task(ME, 'todo'), task(ME, 'todo')]
    expect(computeTaskProgress(tasks, ME)).toEqual({ done: 1, total: 4, percent: 25 })
  })

  it('rounds to a whole percent (1/3 -> 33, 2/3 -> 67)', () => {
    const oneOfThree = [task(ME, 'done'), task(ME, 'todo'), task(ME, 'todo')]
    expect(computeTaskProgress(oneOfThree, ME).percent).toBe(33)
    const twoOfThree = [task(ME, 'done'), task(ME, 'done'), task(ME, 'todo')]
    expect(computeTaskProgress(twoOfThree, ME).percent).toBe(67)
  })

  it('only counts tasks assigned to the exact user asked about', () => {
    const tasks = [task(ME, 'done'), task(SOMEONE_ELSE, 'done'), task(null, 'done')]
    expect(computeTaskProgress(tasks, ME)).toEqual({ done: 1, total: 1, percent: 100 })
  })
})

describe('CHECKIN_GAP_THRESHOLD', () => {
  it('is 15 points — one task of slack on a typical-size board', () => {
    expect(CHECKIN_GAP_THRESHOLD).toBe(15)
  })
})

describe('checkinGap', () => {
  it("is 'unknown' when there is nothing computed to compare against", () => {
    expect(checkinGap(50, { percent: null })).toBe('unknown')
  })

  it("is 'unknown' even at the extremes of the reported range", () => {
    // The report alone can't produce a gap — 0 and 100 are as comparable to
    // "no tasks" as 50 is.
    expect(checkinGap(0, { percent: null })).toBe('unknown')
    expect(checkinGap(100, { percent: null })).toBe('unknown')
  })

  it("is 'none' when report and board agree exactly", () => {
    expect(checkinGap(40, { percent: 40 })).toBe('none')
  })

  it("is 'none' at exactly the threshold in either direction (strict >, not >=)", () => {
    expect(checkinGap(40 + CHECKIN_GAP_THRESHOLD, { percent: 40 })).toBe('none')
    expect(checkinGap(40 - CHECKIN_GAP_THRESHOLD, { percent: 40 })).toBe('none')
  })

  it("is 'ahead' one point past the threshold above the board", () => {
    expect(checkinGap(40 + CHECKIN_GAP_THRESHOLD + 1, { percent: 40 })).toBe('ahead')
  })

  it("is 'behind' one point past the threshold below the board", () => {
    expect(checkinGap(40 - CHECKIN_GAP_THRESHOLD - 1, { percent: 40 })).toBe('behind')
  })

  it('flags the extremes: reporting 100 against an empty-progress board, and 0 against a done one', () => {
    expect(checkinGap(100, { percent: 0 })).toBe('ahead')
    expect(checkinGap(0, { percent: 100 })).toBe('behind')
  })
})
