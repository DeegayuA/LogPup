import { describe, expect, it } from 'vitest'
import { coverageOf, deadlinesCount, partitionByModel, splitOutputs } from './density'

describe('deadlinesCount', () => {
  it('counts an array', () => {
    expect(deadlinesCount([{ text: 'a' }, { text: 'b' }, { text: 'c' }])).toBe(3)
    expect(deadlinesCount([])).toBe(0)
  })

  it('is zero for anything that is not an array, and never throws', () => {
    // jsonb: an older model version could have written any shape here, and a
    // count that threw would take down the whole board.
    expect(deadlinesCount(null)).toBe(0)
    expect(deadlinesCount(undefined)).toBe(0)
    expect(deadlinesCount({ deadlines: 3 })).toBe(0)
    expect(deadlinesCount('two')).toBe(0)
    expect(deadlinesCount(7)).toBe(0)
  })
})

describe('splitOutputs', () => {
  const facts = {
    meetingId: 'm1',
    model: 'gemini-2.5',
    aiDerivedFollowups: 2,
    manualFollowups: 4,
    acceptedTaskSuggestions: 1,
    deadlinesJson: [{ due: 'friday' }],
  }

  it('adds up everything the analysis found', () => {
    expect(splitOutputs(facts).aiDerived).toBe(4) // 2 + 1 + 1
  })

  it('never lets a manual follow-up count as an AI output', () => {
    // The anti-gaming fix: if manual items cleared R1, a series could be
    // immunised against review by one person typing one item after each
    // occurrence.
    const manualOnly = {
      ...facts, aiDerivedFollowups: 0, acceptedTaskSuggestions: 0, deadlinesJson: null,
      manualFollowups: 12,
    }
    const result = splitOutputs(manualOnly)
    expect(result.aiDerived).toBe(0)
    expect(result.manual).toBe(12)
  })

  it('carries the model through, since no rule may compare across one', () => {
    expect(splitOutputs(facts).model).toBe('gemini-2.5')
  })
})

describe('coverageOf', () => {
  it('is the analysed fraction', () => {
    expect(coverageOf(2, 4)).toBe(0.5)
    expect(coverageOf(1, 4)).toBe(0.25)
  })

  it('is zero rather than a division by zero dressed up as a percentage', () => {
    expect(coverageOf(0, 0)).toBe(0)
  })
})

describe('partitionByModel', () => {
  const occ = (meetingId: string, model: string) => ({ meetingId, model, aiDerived: 0, manual: 0 })

  it('splits a newest-first list at each model boundary', () => {
    const segments = partitionByModel([
      occ('m1', 'gemini-2.5'), occ('m2', 'gemini-2.5'),
      occ('m3', 'gemini-2.0'), occ('m4', 'gemini-2.0'),
    ])
    expect(segments).toHaveLength(2)
    expect(segments.map((s) => s.occurrences.length)).toEqual([2, 2])
    expect(segments.map((s) => s.model)).toEqual(['gemini-2.5', 'gemini-2.0'])
  })

  it('returns one segment for one occurrence', () => {
    expect(partitionByModel([occ('m1', 'gemini-2.5')])).toHaveLength(1)
  })

  it('returns nothing for nothing', () => {
    expect(partitionByModel([])).toEqual([])
  })

  it('offers no cross-segment number for anyone to compare by accident', () => {
    // A consumer that wanted to compare two model runs has to write that
    // comparison itself, in the open — proposing somebody shorten a meeting
    // because their model changed is the kind of wrong that poisons every
    // other suggestion.
    const [segment] = partitionByModel([occ('m1', 'gemini-2.5')])
    expect(Object.keys(segment).sort()).toEqual(['model', 'occurrences'])
  })
})
