import { describe, expect, it } from 'vitest'
import {
  autoScoreFromHours,
  mayAutoScore,
  scoreSourceLabel,
  SCORE_SOURCES,
} from '@/features/worklog/auto-score'
import { PERCENT_MAX } from '@/features/worklog/worklog-day'

describe('the score hours imply', () => {
  it('scores a full day at 100', () => {
    expect(autoScoreFromHours(480, 480)).toBe(100)
  })

  it('scores a part day proportionally', () => {
    expect(autoScoreFromHours(240, 480)).toBe(50)
    expect(autoScoreFromHours(384, 480)).toBe(80)
  })

  it('scores a half Saturday against the half day it actually was', () => {
    expect(autoScoreFromHours(240, 240)).toBe(100)
  })

  /* Snapped like every other score in the product. An unsnapped 63% would look
     more precise than a human 65%, when it is the opposite. */
  it('snaps to fives', () => {
    expect(autoScoreFromHours(300, 480)).toBe(65)
    expect(autoScoreFromHours(305, 480)).toBe(65)
  })

  /* accountedFraction reports 1.25 for a ten-hour day and that is correct
     there. Here the column means "of what I planned" and is validated 0..100. */
  it('clamps a long day at 100 rather than reporting 125', () => {
    expect(autoScoreFromHours(600, 480)).toBe(PERCENT_MAX)
  })
})

describe('when the hours imply nothing', () => {
  /* There is deliberately no `?? 480` in this repo — how long a full day is
     remains an open product question, and answering it here would answer it
     for the whole app. */
  it('refuses to score a day with no known length', () => {
    expect(autoScoreFromHours(240, null)).toBeNull()
  })

  it('refuses to score a day scheduled to zero', () => {
    expect(autoScoreFromHours(240, 0)).toBeNull()
  })

  /* Zero minutes is an UNLOGGED day, not a 0% day. A derived 0% would clear it
     off the ledger while asserting the person achieved nothing. */
  it('refuses to call an empty day zero percent', () => {
    expect(autoScoreFromHours(0, 480)).toBeNull()
  })

  it('refuses nonsense rather than propagating it', () => {
    expect(autoScoreFromHours(Number.NaN, 480)).toBeNull()
    expect(autoScoreFromHours(240, Number.NaN)).toBeNull()
    expect(autoScoreFromHours(-60, 480)).toBeNull()
  })
})

describe('whose number it is', () => {
  it('scores a day nobody has said anything about', () => {
    expect(mayAutoScore(null)).toBe(true)
  })

  it('rescores a day it scored itself', () => {
    expect(mayAutoScore({ source: 'from_hours' })).toBe(true)
  })

  /* THE GUARD. A person who scored their own Tuesday at 40% keeps that number
     however many hours they log against it afterwards. A measurement silently
     replacing somebody's judgement of their own day is worse than the gap this
     whole feature exists to close. */
  it('never overwrites a score the person typed', () => {
    expect(mayAutoScore({ source: 'self' })).toBe(false)
  })

  it('names both sources so a derived score is never read as a claim', () => {
    expect(SCORE_SOURCES).toEqual(['self', 'from_hours'])
    expect(scoreSourceLabel('from_hours')).toContain('hours')
    expect(scoreSourceLabel('self')).not.toContain('hours')
  })
})
