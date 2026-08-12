import { describe, expect, it } from 'vitest'
import { rankContributors } from '@/features/apps/contribution-queries'

function person(name: string, actions: number, tasksDone: number) {
  return { name, actions, tasksDone }
}

describe('rankContributors', () => {
  it('puts the most active member first', () => {
    const ranked = [person('Quiet', 2, 0), person('Busy', 40, 0)].sort(rankContributors)
    expect(ranked.map((p) => p.name)).toEqual(['Busy', 'Quiet'])
  })

  it('breaks an action tie on tasks closed — activity is volume, done is outcome', () => {
    const ranked = [person('Talker', 10, 1), person('Finisher', 10, 9)].sort(rankContributors)
    expect(ranked.map((p) => p.name)).toEqual(['Finisher', 'Talker'])
  })

  it('breaks a total tie on name, so the order cannot change between renders', () => {
    const ranked = [person('Zoe', 5, 5), person('Adam', 5, 5)].sort(rankContributors)
    expect(ranked.map((p) => p.name)).toEqual(['Adam', 'Zoe'])
  })

  it('keeps assigned-but-idle members, ranked last rather than dropped', () => {
    // The point of the panel: "allocated, and has done nothing here" is a
    // finding, not a row to hide.
    const ranked = [person('Idle', 0, 0), person('Active', 1, 0)].sort(rankContributors)
    expect(ranked.map((p) => p.name)).toEqual(['Active', 'Idle'])
    expect(ranked).toHaveLength(2)
  })

  it('orders a realistic team deterministically', () => {
    const ranked = [
      person('Dana', 0, 0),
      person('Ben', 12, 3),
      person('Ada', 12, 7),
      person('Cy', 30, 1),
    ].sort(rankContributors)
    expect(ranked.map((p) => p.name)).toEqual(['Cy', 'Ada', 'Ben', 'Dana'])
  })
})
