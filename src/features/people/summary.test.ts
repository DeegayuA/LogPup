import { describe, expect, it } from 'vitest'

import {
  buildPersonSummaryPrompt,
  derivePersonSummary,
  type PersonSummaryFacts,
} from './summary'

const facts = (over: Partial<PersonSummaryFacts> = {}): PersonSummaryFacts => ({
  name: 'Amara',
  title: 'Engineer',
  apps: [
    { name: 'Kestrel', isLead: true },
    { name: 'Osprey', isLead: false },
  ],
  totalPct: 75,
  activeTaskCount: 4,
  doneTaskCount: 9,
  overdueTaskCount: 0,
  meetingsAttended: 3,
  meetingsWindowDays: 14,
  followupsOwed: 0,
  followupsOldestOwedDays: null,
  ...over,
})

describe('derivePersonSummary', () => {
  it('separates what they lead from what they work on', () => {
    const text = derivePersonSummary(facts())
    expect(text).toContain('leads Kestrel')
    expect(text).toContain('works on Osprey')
    expect(text).toContain('75%')
  })

  it('says unassigned instead of straining to summarise nothing', () => {
    const text = derivePersonSummary(
      facts({ apps: [], totalPct: 0, activeTaskCount: 0, doneTaskCount: 0, meetingsAttended: 0 }),
    )
    expect(text).toBe('Amara has no project assignments right now.')
  })

  it('mentions overdue work only when some exists', () => {
    expect(derivePersonSummary(facts())).not.toContain('overdue')
    expect(derivePersonSummary(facts({ overdueTaskCount: 2 }))).toContain('2 are overdue')
    expect(derivePersonSummary(facts({ overdueTaskCount: 1 }))).toContain('1 is overdue')
  })

  it('gives an owed follow-up its age, but only when it has one', () => {
    expect(derivePersonSummary(facts({ followupsOwed: 2, followupsOldestOwedDays: 5 }))).toContain(
      'Owes 2 follow-ups, the oldest 5 days old.',
    )
    expect(derivePersonSummary(facts({ followupsOwed: 1, followupsOldestOwedDays: 0 }))).toContain(
      'Owes 1 follow-up.',
    )
  })
})

describe('buildPersonSummaryPrompt', () => {
  it('carries every fact and marks who leads', () => {
    const prompt = buildPersonSummaryPrompt(facts())
    expect(prompt).toContain('Kestrel (lead)')
    expect(prompt).toContain('Osprey')
    expect(prompt).not.toContain('Osprey (lead)')
    expect(prompt).toContain('Allocation: 75%')
    expect(prompt).toContain('Tasks: 4 open, 9 done, 0 overdue')
  })

  it('omits the title line rather than sending "Title: null"', () => {
    expect(buildPersonSummaryPrompt(facts({ title: null }))).not.toContain('Title:')
    expect(buildPersonSummaryPrompt(facts())).toContain('Title: Engineer')
  })

  it('forbids invention in the instructions it sends', () => {
    // The one property that matters most about this prompt: the model is
    // told to stay inside the sheet. If somebody rewrites the preamble and
    // drops the constraint, colleagues start reading fiction.
    const prompt = buildPersonSummaryPrompt(facts())
    expect(prompt).toContain('ONLY the facts below')
    expect(prompt).toContain('no praise')
  })
})
