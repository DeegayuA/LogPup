import { describe, expect, it } from 'vitest'
import {
  MIN_COHORT,
  cannotSay,
  inferred,
  isSuppressed,
  measured,
  median,
  percentile,
  suppressIfSmall,
} from './figure'

const base = { key: 'k', label: 'Label', unit: 'count' as const, sources: ['tasks'] }

describe('null and zero are different facts', () => {
  it('keeps a real zero as a number', () => {
    const figure = measured({ ...base, value: 0 })
    expect(figure.value).toBe(0)
    expect(figure.unavailable).toBeNull()
  })

  it('gives an unmeasurable figure a reason instead of a zero', () => {
    // "Wrote no code" and "we cannot see their code" are different sentences
    // about a person, and only one of them is true.
    const figure = cannotSay({ ...base, reason: 'No GitHub account linked.' })
    expect(figure.value).toBeNull()
    expect(figure.unavailable).toBe('No GitHub account linked.')
  })

  it('never leaves a figure blank AND silent', () => {
    for (const figure of [measured({ ...base, value: 3 }), cannotSay({ ...base, reason: 'None.' })]) {
      expect(figure.value === null).toBe(figure.unavailable !== null)
    }
  })
})

describe('provenance', () => {
  it('marks a counted figure measured and a proxy inferred', () => {
    expect(measured({ ...base, value: 1 }).basis).toBe('measured')
    expect(inferred({ ...base, value: 1 }).basis).toBe('inferred')
  })

  it('carries the sources so a dispute can be settled', () => {
    expect(measured({ ...base, value: 1 }).sources).toEqual(['tasks'])
  })
})

describe('k-anonymity', () => {
  it('suppresses a group figure covering one person', () => {
    // A figure covering one person IS that person, however it is labelled.
    // In a studio this size most projects have exactly one PM and one lead,
    // so this is the common path, not the corner.
    const result = suppressIfSmall(1, () => ({ cycleTime: 4 }))
    expect(isSuppressed(result)).toBe(true)
    if (isSuppressed(result)) expect(result.reason).toContain('one person')
  })

  it('reports at the threshold', () => {
    expect(isSuppressed(suppressIfSmall(MIN_COHORT, () => ({ cycleTime: 4 })))).toBe(false)
  })

  it('says nobody is here rather than naming a person, for an empty group', () => {
    const result = suppressIfSmall(0, () => ({ cycleTime: 4 }))
    if (isSuppressed(result)) expect(result.reason).toContain('Nobody')
  })
})

describe('median and percentile', () => {
  it('returns null for an empty list rather than zero', () => {
    expect(median([])).toBeNull()
    expect(percentile([], 90)).toBeNull()
  })

  it('takes the midpoint of an even list', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  it('resists a single outlier, which a mean would not', () => {
    // One six-week task drags a mean past every number a reader could act on,
    // and the person it misrepresents is whoever owned the hard thing.
    expect(median([1, 1, 2, 2, 60])).toBe(2)
  })

  it('names a real observation at p90, never an interpolated one', () => {
    // Nearest-rank: "p90 cycle time of 11.4 days" describes no task anybody
    // worked on. This always names one that actually took that long.
    expect(percentile([1, 1, 2, 2, 3, 40], 90)).toBe(40)
    expect([1, 1, 2, 2, 3, 40]).toContain(percentile([1, 1, 2, 2, 3, 40], 90))
  })

  it('clamps rather than running off either end', () => {
    expect(percentile([5], 0)).toBe(5)
    expect(percentile([5], 100)).toBe(5)
  })
})
