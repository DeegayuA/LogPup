import { describe, it, expect } from 'vitest'
import { addEveryone, applyTeamPrefill } from './attendee-prefill'

const roster = ['ana', 'ben', 'cho', 'dev', 'eli']

describe('applyTeamPrefill', () => {
  it('fills an empty selection with the team', () => {
    const next = applyTeamPrefill({ attendeeIds: [], prefilledIds: [] }, ['ana', 'ben'], roster)
    expect(next).toEqual({ attendeeIds: ['ana', 'ben'], prefilledIds: ['ana', 'ben'] })
  })

  it('swaps the previous prefill for the new team but keeps manual picks', () => {
    // App A prefilled ana+ben, the user added dev by hand, then switched to
    // app B (cho only): A's team goes, dev stays.
    const next = applyTeamPrefill(
      { attendeeIds: ['ana', 'ben', 'dev'], prefilledIds: ['ana', 'ben'] },
      ['cho'],
      roster,
    )
    expect(next).toEqual({ attendeeIds: ['dev', 'cho'], prefilledIds: ['cho'] })
  })

  it('retracts the prefill when no team is offered ("No app")', () => {
    const next = applyTeamPrefill(
      { attendeeIds: ['ana', 'dev'], prefilledIds: ['ana'] },
      [],
      roster,
    )
    expect(next).toEqual({ attendeeIds: ['dev'], prefilledIds: [] })
  })

  it('keeps a manually-added team member manual across app changes', () => {
    // dev was added by hand; the new team also contains dev. dev must not be
    // re-tagged as prefilled, or the NEXT app change would remove them.
    const next = applyTeamPrefill(
      { attendeeIds: ['dev'], prefilledIds: [] },
      ['dev', 'eli'],
      roster,
    )
    expect(next).toEqual({ attendeeIds: ['dev', 'eli'], prefilledIds: ['eli'] })
    const after = applyTeamPrefill(next, ['ana'], roster)
    expect(after.attendeeIds).toContain('dev')
  })

  it('drops team ids outside the roster (deactivated accounts)', () => {
    const next = applyTeamPrefill(
      { attendeeIds: [], prefilledIds: [] },
      ['ana', 'ghost'],
      roster,
    )
    expect(next.attendeeIds).toEqual(['ana'])
  })

  it('does not resurrect a prefilled person the user removed', () => {
    // ana was prefilled and then removed by hand; re-applying the same team
    // is a fresh suggestion, so ana IS offered again — but a different team
    // without ana never brings her back.
    const removed = { attendeeIds: ['ben'], prefilledIds: ['ana', 'ben'] }
    const other = applyTeamPrefill(removed, ['cho'], roster)
    expect(other.attendeeIds).toEqual(['cho'])
  })

  it('dedupes a duplicated team id', () => {
    const next = applyTeamPrefill({ attendeeIds: [], prefilledIds: [] }, ['ana', 'ana'], roster)
    expect(next.attendeeIds).toEqual(['ana'])
  })

  it('keeps manual order first, then team order', () => {
    const next = applyTeamPrefill(
      { attendeeIds: ['eli', 'dev'], prefilledIds: [] },
      ['ben', 'ana'],
      roster,
    )
    expect(next.attendeeIds).toEqual(['eli', 'dev', 'ben', 'ana'])
  })
})

describe('addEveryone', () => {
  it('appends the missing roster in roster order after existing picks', () => {
    expect(addEveryone(['cho'], roster)).toEqual(['cho', 'ana', 'ben', 'dev', 'eli'])
  })

  it('is idempotent', () => {
    const once = addEveryone([], roster)
    expect(addEveryone(once, roster)).toEqual(once)
  })
})
