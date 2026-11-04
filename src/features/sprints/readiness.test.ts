import { describe, expect, it } from 'vitest'
import { definitionOfReady, readinessScore, type ReadinessFacts } from './readiness'

const empty: ReadinessFacts = {
  description: null,
  criteriaCount: 0,
  storyPoints: null,
  attachmentCount: 0,
  linkCount: 0,
  productApproved: false,
}

describe('definitionOfReady', () => {
  it('meets nothing for a bare item', () => {
    expect(readinessScore(definitionOfReady(empty))).toEqual({ met: 0, total: 6 })
  })

  it('meets everything for a fully refined story', () => {
    const checks = definitionOfReady({
      description: 'As a shopper…',
      criteriaCount: 2,
      storyPoints: 0,
      attachmentCount: 1,
      linkCount: 1,
      productApproved: true,
    })
    expect(checks.every((c) => c.met)).toBe(true)
  })

  it('does not count a whitespace description, and counts a zero estimate', () => {
    const checks = definitionOfReady({ ...empty, description: '   ', storyPoints: 0 })
    expect(checks.find((c) => c.key === 'description')?.met).toBe(false)
    expect(checks.find((c) => c.key === 'estimate')?.met).toBe(true)
  })
})
