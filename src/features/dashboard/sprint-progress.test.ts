import { describe, it, expect } from 'vitest'
import { sprintProgress, daysRemaining } from './sprint-progress'

describe('sprintProgress', () => {
  it('returns 0 for a sprint with no tasks', () => {
    expect(sprintProgress({ todo: 0, in_progress: 0, done: 0 })).toBe(0)
  })

  it('computes done / total', () => {
    expect(sprintProgress({ todo: 2, in_progress: 1, done: 1 })).toBe(0.25)
  })

  it('returns 1 when everything is done', () => {
    expect(sprintProgress({ todo: 0, in_progress: 0, done: 4 })).toBe(1)
  })
})

describe('daysRemaining', () => {
  const now = new Date('2026-08-10T09:00:00')

  it('returns a positive count for a future end date', () => {
    expect(daysRemaining('2026-08-15', now)).toBe(5)
  })

  it('returns 0 when the sprint ends today', () => {
    expect(daysRemaining('2026-08-10', now)).toBe(0)
  })

  it('returns a negative count for an overdue sprint', () => {
    expect(daysRemaining('2026-08-05', now)).toBe(-5)
  })
})
