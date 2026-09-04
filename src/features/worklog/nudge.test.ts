import { describe, expect, it } from 'vitest'
import { MAX_BACKFILL_DAYS } from '@/features/worklog/missing-days'
import {
  NUDGE_MIN_OWED,
  nudgeBody,
  planWorklogNudges,
  type NudgeInput,
} from '@/features/worklog/nudge'

const person = (owed: string[], userId = 'u1'): NudgeInput => ({
  userId,
  name: 'Prabuddha',
  owed,
})

describe('who gets a message', () => {
  it('notifies somebody with a real backlog', () => {
    const nudges = planWorklogNudges([person(['2026-08-30', '2026-09-01', '2026-09-02'])])
    expect(nudges).toHaveLength(1)
    expect(nudges[0].owed).toBe(3)
    expect(nudges[0].oldestDay).toBe('2026-08-30')
  })

  /* Yesterday gets logged this morning by most people most days. A nightly
     message about one day trains everyone to ignore the channel before the
     five-day message ever arrives. */
  it('says nothing about a single missing day', () => {
    expect(planWorklogNudges([person(['2026-09-02'])])).toEqual([])
  })

  it('says nothing to somebody up to date', () => {
    expect(planWorklogNudges([person([])])).toEqual([])
  })

  it('takes a caller-supplied threshold', () => {
    expect(planWorklogNudges([person(['2026-09-02'])], { minOwed: 1 })).toHaveLength(1)
  })

  it('has a default threshold of more than one day', () => {
    expect(NUDGE_MIN_OWED).toBeGreaterThan(1)
  })

  it('keeps the roster order it was given', () => {
    const nudges = planWorklogNudges([
      person(['2026-09-01', '2026-09-02'], 'b'),
      person(['2026-09-01', '2026-09-02'], 'a'),
    ])
    expect(nudges.map((n) => n.userId)).toEqual(['b', 'a'])
  })
})

describe('the ladder rung', () => {
  /* THE WHOLE POINT OF THE RUNG. Armed on the run date, an untouched backlog
     would send a message every night forever. */
  it('arms on the oldest unlogged day, not on the count or the date', () => {
    const nudge = planWorklogNudges([person(['2026-08-30', '2026-09-01'])])[0]
    expect(nudge.armedOn).toBe('2026-08-30')
  })

  it('re-arms when a new gap opens in front of the old one', () => {
    const before = planWorklogNudges([person(['2026-09-01', '2026-09-02'])])[0]
    const after = planWorklogNudges([person(['2026-08-30', '2026-09-01', '2026-09-02'])])[0]
    expect(after.armedOn).not.toBe(before.armedOn)
  })

  /* Same oldest day, one more recent day added: the situation has not changed
     in the way a person needs telling about again. */
  it('stays on the same rung when the backlog only grows at the near end', () => {
    const before = planWorklogNudges([person(['2026-08-30', '2026-09-01'])])[0]
    const after = planWorklogNudges([person(['2026-08-30', '2026-09-01', '2026-09-02'])])[0]
    expect(after.armedOn).toBe(before.armedOn)
  })

  it('finds the oldest day even from a caller that sorted the other way', () => {
    const nudge = planWorklogNudges([person(['2026-09-02', '2026-09-01', '2026-08-30'])])[0]
    expect(nudge.armedOn).toBe('2026-08-30')
    expect(nudge.oldestDay).toBe('2026-08-30')
  })
})

describe('the count it reports', () => {
  /* Telling somebody they are 60 days behind when the ledger offers them 14 to
     fill in is a number they cannot act on. */
  it('caps at what the catch-up ledger will actually show', () => {
    const many = Array.from(
      { length: 60 },
      (_, i) => `2026-06-${String((i % 28) + 1).padStart(2, '0')}`,
    )
    expect(planWorklogNudges([person(many)])[0].owed).toBe(MAX_BACKFILL_DAYS)
  })

  it('reports the real number below the cap', () => {
    expect(planWorklogNudges([person(['2026-09-01', '2026-09-02'])])[0].owed).toBe(2)
  })
})

describe('the message', () => {
  const label = (iso: string) => `label(${iso})`

  it('names the count and the oldest day', () => {
    const nudge = planWorklogNudges([person(['2026-08-30', '2026-09-01'])])[0]
    const body = nudgeBody(nudge, label)
    expect(body).toContain('2 days')
    expect(body).toContain('label(2026-08-30)')
  })

  it('stays grammatical at one day', () => {
    const nudge = planWorklogNudges([person(['2026-09-01'])], { minOwed: 1 })[0]
    expect(nudgeBody(nudge, label)).toContain('1 day without')
  })

  /* A blank day is not a fault — people take leave and spend days on other
     work. The message is a reminder and must never read as a reprimand. */
  it('does not scold', () => {
    const nudge = planWorklogNudges([person(['2026-08-30', '2026-09-01'])])[0]
    const body = nudgeBody(nudge, label).toLowerCase()
    for (const word of ['fail', 'overdue', 'must', 'required', 'warning', 'behind schedule']) {
      expect(body).not.toContain(word)
    }
  })

  it('points at the one-paragraph route rather than at a form', () => {
    const nudge = planWorklogNudges([person(['2026-08-30', '2026-09-01'])])[0]
    expect(nudgeBody(nudge, label)).toContain('one go')
  })
})
