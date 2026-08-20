import { describe, expect, it } from 'vitest'

import {
  applyPhrasing,
  buildEntryCheckPrompt,
  isSafePhrasing,
  PHRASE_MAX_CHARS,
} from './entry-check-prompt'
import type { Observation } from './entry-check'

// ---------------------------------------------------------------------------
// The model is asked ONLY to reword what findDiscrepancies already found. Every
// test here is about that boundary holding: no prompt without observations, no
// observation the function did not produce, no number nobody computed.
// ---------------------------------------------------------------------------

const short: Observation = {
  kind: 'under-scheduled',
  severity: 'note',
  message: 'That day accounts for 4 hours, against 8 hours scheduled.',
  facts: { loggedMinutes: 240, scheduledMinutes: 480, differenceMinutes: 240 },
}

const meeting: Observation = {
  kind: 'meeting-unaccounted',
  severity: 'question',
  message: 'That day has 2 hours of recorded meetings, with no meeting time logged.',
  facts: {
    attendedMinutes: 120,
    loggedMeetingMinutes: 0,
    shortfallMinutes: 120,
    meetings: ['Sprint planning', 'Design review'],
  },
}

const reply = (lines: { id: number; message: string }[]) =>
  JSON.stringify({ observations: lines })

describe('buildEntryCheckPrompt', () => {
  it('THROWS when there is nothing to say, so silence can never reach a model', () => {
    // Silence is the common case. If this ever returns a prompt instead, the
    // caller's early return has become an optimisation somebody can delete.
    expect(() => buildEntryCheckPrompt({ name: 'Nadeesha', day: '2026-08-20', observations: [] }))
      .toThrow(/do not call the model/i)
  })

  it('carries each observation with its kind, facts and current wording', () => {
    const prompt = buildEntryCheckPrompt({
      name: 'Nadeesha',
      day: '2026-08-20',
      observations: [short, meeting],
    })
    expect(prompt).toContain('kind=under-scheduled')
    expect(prompt).toContain('kind=meeting-unaccounted')
    expect(prompt).toContain('loggedMinutes=240')
    expect(prompt).toContain('Sprint planning | Design review')
    expect(prompt).toContain(short.message)
    expect(prompt).toContain(meeting.message)
  })

  it('numbers the observations from 1, which is the contract applyPhrasing reads back', () => {
    const prompt = buildEntryCheckPrompt({
      name: 'Nadeesha',
      day: '2026-08-20',
      observations: [short, meeting],
    })
    expect(prompt).toContain('1. kind=under-scheduled')
    expect(prompt).toContain('2. kind=meeting-unaccounted')
  })

  it('forbids adding, merging, splitting or judging, and says the numbers are hours not a score', () => {
    const prompt = buildEntryCheckPrompt({ name: 'Nadeesha', day: '2026-08-20', observations: [short] })
    expect(prompt).toMatch(/do not merge/i)
    expect(prompt).toMatch(/for NO other id/i)
    expect(prompt).toMatch(/never introduce a number/i)
    expect(prompt).toMatch(/observational, never accusatory/i)
    // percent (a self-scored judgement) and hours (time) are different
    // questions; a prompt that blurs them invites the model to blur them too.
    expect(prompt).toMatch(/not a score and not a percentage/i)
  })

  it('shows the model the observations and NOTHING else about the day', () => {
    const prompt = buildEntryCheckPrompt({ name: 'Nadeesha', day: '2026-08-20', observations: [short] })
    // No entries, no activity log, no transcript, no keyframes — the model has
    // nothing to reason from even if it were asked to.
    expect(prompt).not.toMatch(/transcript|keyframe|screenshot/i)
  })
})

describe('applyPhrasing', () => {
  it('uses the reworded sentence when it is safe', () => {
    const out = applyPhrasing([short], reply([
      { id: 1, message: 'Those entries come to 4 hours on a day scheduled for 8.' },
    ]))
    expect(out[0].message).toBe('Those entries come to 4 hours on a day scheduled for 8.')
  })

  it('never changes anything except the wording', () => {
    const out = applyPhrasing([short, meeting], reply([
      { id: 1, message: 'Only 4 hours are accounted for against 8 scheduled.' },
      { id: 2, message: '2 hours of meetings are recorded with none logged.' },
    ]))
    expect(out).toHaveLength(2)
    expect(out.map((o) => o.kind)).toEqual(['under-scheduled', 'meeting-unaccounted'])
    expect(out.map((o) => o.severity)).toEqual(['note', 'question'])
    expect(out[0].facts).toEqual(short.facts)
    expect(out[1].facts).toEqual(meeting.facts)
  })

  it('DROPS an id nobody asked about rather than rendering it', () => {
    // An extra id is the model deciding something about somebody's working day
    // on its own — the exact failure the pure function exists to prevent.
    const out = applyPhrasing([short], reply([
      { id: 1, message: 'Four of eight scheduled hours are accounted for.' },
      { id: 2, message: 'You also seem to have skipped lunch.' },
    ]))
    expect(out).toHaveLength(1)
    expect(out[0].message).not.toMatch(/lunch/)
  })

  it('keeps the computed sentence when the model skipped that id', () => {
    const out = applyPhrasing([short, meeting], reply([{ id: 2, message: 'Two hours of meetings went unlogged.' }]))
    expect(out[0].message).toBe(short.message)
    expect(out[1].message).toBe('Two hours of meetings went unlogged.')
  })

  it('takes the FIRST answer for a duplicated id', () => {
    const out = applyPhrasing([short], reply([
      { id: 1, message: 'Four hours logged against eight scheduled.' },
      { id: 1, message: 'Second thoughts about 4 hours.' },
    ]))
    expect(out[0].message).toBe('Four hours logged against eight scheduled.')
  })

  it('falls back to every computed sentence when the reply is not JSON', () => {
    expect(applyPhrasing([short, meeting], 'sorry, I cannot help with that'))
      .toEqual([short, meeting])
  })

  it('falls back when the JSON is the wrong shape', () => {
    expect(applyPhrasing([short], JSON.stringify({ notes: ['hello'] }))).toEqual([short])
    expect(applyPhrasing([short], JSON.stringify({ observations: 'hello' }))).toEqual([short])
    expect(applyPhrasing([short], JSON.stringify({ observations: [{ id: '1', message: 'x' }] })))
      .toEqual([short])
  })

  it('returns an empty list unchanged and asks nothing of the reply', () => {
    expect(applyPhrasing([], reply([{ id: 1, message: 'anything' }]))).toEqual([])
  })
})

describe('isSafePhrasing — the invention guard', () => {
  it('rejects a sentence carrying a number nobody computed', () => {
    // 11 appears in neither the facts nor the original sentence. A fabricated
    // figure about somebody's hours is the one thing they cannot check.
    expect(isSafePhrasing(short, 'That day adds up to 11 hours against 8 scheduled.')).toBe(false)
    expect(applyPhrasing([short], reply([{ id: 1, message: '11 hours, against 8 scheduled.' }]))[0].message)
      .toBe(short.message)
  })

  it('accepts the raw minutes as well as the hours, since both were computed', () => {
    expect(isSafePhrasing(short, '240 minutes of a 480 minute day are accounted for.')).toBe(true)
  })

  it('accepts a sentence with no digits at all', () => {
    expect(isSafePhrasing(short, 'Rather less than the scheduled day is accounted for.')).toBe(true)
  })

  it('accepts numbers found inside a string fact, like a meeting title', () => {
    const sprint12: Observation = {
      ...meeting,
      facts: { ...meeting.facts, meetings: ['Sprint 12 planning'] },
    }
    expect(isSafePhrasing(sprint12, 'Sprint 12 planning is recorded with no meeting time logged.'))
      .toBe(true)
  })

  it('rejects accusatory wording even when every number checks out', () => {
    expect(isSafePhrasing(short, 'You logged the wrong hours: 4 against 8.')).toBe(false)
    expect(isSafePhrasing(short, 'You should have logged 8 hours.')).toBe(false)
  })

  it('rejects an empty or whitespace-only rewrite', () => {
    expect(isSafePhrasing(short, '   ')).toBe(false)
  })

  it('rejects a rewrite that ran long instead of truncating it', () => {
    expect(isSafePhrasing(short, 'a'.repeat(PHRASE_MAX_CHARS + 1))).toBe(false)
  })

  it('collapses whitespace rather than rejecting a multi-line answer', () => {
    const out = applyPhrasing([short], reply([{ id: 1, message: '  Four hours\n  of eight.  ' }]))
    expect(out[0].message).toBe('Four hours of eight.')
  })
})
