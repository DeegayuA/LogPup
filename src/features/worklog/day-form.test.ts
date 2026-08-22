import { describe, expect, it } from 'vitest'
import { dayFormProblem } from '@/features/worklog/day-form'

describe('dayFormProblem', () => {
  it('is silent once there is a score and something to store', () => {
    expect(dayFormProblem({ percent: 80, dirty: true })).toBeNull()
  })

  // THE BUG. This was the state after dictating or drafting a whole paragraph:
  // Save disabled, and not one word on the screen about the score being what
  // was missing.
  it('names the missing score rather than leaving a dead button', () => {
    expect(dayFormProblem({ percent: null, dirty: true })).toBe(
      'Score the day first — a note on its own is not a log.',
    )
  })

  // A different sentence on purpose: "not answered yet" and "answered and
  // already stored" are different facts, and one disabled button for both is
  // how "did my note save?" stops being answerable.
  it('distinguishes nothing-to-save from nothing-answered', () => {
    expect(dayFormProblem({ percent: 80, dirty: false })).toBe(
      'Nothing to save — this is what is already stored.',
    )
  })

  it('asks for the score first when both are missing', () => {
    expect(dayFormProblem({ percent: null, dirty: false })).toBe(
      'Score the day first — a note on its own is not a log.',
    )
  })
})
