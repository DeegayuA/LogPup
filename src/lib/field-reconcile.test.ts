import { describe, expect, it } from 'vitest'

import {
  FIELD_REASON_SENTENCE,
  reconcileAttendees,
  reconcileMeeting,
  reconcileScalar,
  type FieldReason,
  type SyncSnapshot,
} from './field-reconcile'

const AT = Date.UTC(2026, 7, 19, 9, 0)
const HOUR = 60 * 60 * 1000

const snap = (over: Partial<SyncSnapshot> = {}): SyncSnapshot => ({
  title: 'Kestrel weekly sync',
  agenda: 'Roadmap, then blockers',
  startsAtMs: AT,
  endsAtMs: AT + HOUR,
  attendeeEmails: ['nimal@example.test', 'shanika@example.test'],
  ...over,
})

describe('a field resolves only when exactly one side moved', () => {
  it('is unchanged when both agree, whatever the base said', () => {
    expect(reconcileScalar('title', 'old', 'new', 'new')).toEqual({
      field: 'title',
      verdict: 'unchanged',
      reason: 'identical',
      value: 'new',
    })
  })

  it('takes the local edit when only local moved', () => {
    const d = reconcileScalar('title', 'base', 'mine', 'base')
    expect(d.verdict).toBe('take-local')
    expect(d.value).toBe('mine')
  })

  it('takes the remote edit when only remote moved', () => {
    const d = reconcileScalar('title', 'base', 'base', 'theirs')
    expect(d.verdict).toBe('take-remote')
    expect(d.value).toBe('theirs')
  })

  it('CONFLICTS when both moved, and offers no value to write', () => {
    // The case last-write-wins gets wrong: one of these edits would vanish
    // with nothing recording that it ever existed.
    const d = reconcileScalar('title', 'base', 'mine', 'theirs')
    expect(d.verdict).toBe('conflict')
    expect(d.reason).toBe('both-changed')
    expect(d.value).toBeUndefined()
  })

  it('CONFLICTS when there is no baseline, rather than guessing a direction', () => {
    // First sync of an imported event: an empty Google description must not be
    // allowed to erase a local agenda just because it arrived second.
    expect(reconcileScalar('agenda', undefined, 'a real agenda', '')).toEqual({
      field: 'agenda',
      verdict: 'conflict',
      reason: 'no-baseline',
    })
  })
})

describe('attendees merge as sets, because two editors usually are not disagreeing', () => {
  const base = ['a@x.test', 'b@x.test']

  it('merges disjoint edits instead of calling them a conflict', () => {
    // Local added a designer; remote removed somebody who left. Both meant it,
    // and neither touched the other's person.
    const m = reconcileAttendees(base, ['a@x.test', 'b@x.test', 'c@x.test'], ['a@x.test'])
    expect(m.verdict).not.toBe('conflict')
    expect(m.reason).toBe('disjoint-membership')
    expect(m.value).toEqual(['a@x.test', 'c@x.test'])
  })

  it('takes one side when only that side touched the roster', () => {
    const m = reconcileAttendees(base, ['a@x.test', 'b@x.test', 'c@x.test'], base)
    expect(m.verdict).toBe('take-local')
    expect(m.reason).toBe('only-local-changed')
    expect(m.value).toEqual(['a@x.test', 'b@x.test', 'c@x.test'])
  })

  it('can never contest, because added and removed are disjoint by construction', () => {
    // Proved rather than asserted: an address cannot be absent from base (so
    // one side "added" it) and present in base (so the other "removed" it).
    // An earlier version had a contested branch for this; deleting it failed
    // no test, which is how it was found.
    const m = reconcileAttendees(['c@x.test'], ['c@x.test', 'd@x.test'], [])
    expect(m.verdict).not.toBe('conflict')
    expect(m.reason).toBe('disjoint-membership')
    expect(m.value).toEqual(['d@x.test'])
  })

  it('treats a one-sided removal as a merge, not a contest', () => {
    const m = reconcileAttendees(base, ['a@x.test', 'b@x.test'], ['a@x.test'])
    expect(m.verdict).toBe('take-remote')
    expect(m.value).toEqual(['a@x.test'])
  })

  it('is unchanged when the rosters match apart from case and spacing', () => {
    expect(
      reconcileAttendees(base, [' A@x.test ', 'b@x.test'], ['a@x.test', 'B@x.test']).verdict,
    ).toBe('unchanged')
  })

  it('CONFLICTS without a baseline', () => {
    expect(reconcileAttendees(undefined, ['a@x.test'], ['b@x.test']).verdict).toBe('conflict')
  })
})

describe('reconcileMeeting', () => {
  it('needs nobody when the two sides agree entirely', () => {
    const r = reconcileMeeting(snap(), snap(), snap())
    expect(r.needsPerson).toBe(false)
    expect(r.decisions.every((d) => d.verdict === 'unchanged')).toBe(true)
  })

  it('resolves independent edits on different fields without asking', () => {
    // THE case a record-level timestamp would have called a conflict: a title
    // edit here and a time change there never disagreed with each other.
    const r = reconcileMeeting(
      snap(),
      snap({ title: 'Kestrel sync — renamed' }),
      snap({ startsAtMs: AT + 30 * 60 * 1000, endsAtMs: AT + 30 * 60 * 1000 + HOUR }),
    )
    expect(r.needsPerson).toBe(false)
    const byField = Object.fromEntries(r.decisions.map((d) => [d.field, d]))
    expect(byField.title.verdict).toBe('take-local')
    expect(byField.startsAtMs.verdict).toBe('take-remote')
  })

  it('needs a person when one field is contested, and writes nothing for it', () => {
    const r = reconcileMeeting(snap(), snap({ title: 'Mine' }), snap({ title: 'Theirs' }))
    expect(r.needsPerson).toBe(true)
    const title = r.decisions.find((d) => d.field === 'title')
    expect(title?.verdict).toBe('conflict')
    expect((title as { value?: unknown }).value).toBeUndefined()
  })

  it('treats a null agenda and an empty one as the same absence', () => {
    // Google returns '' where we store null; counting that as an edit would
    // make every sync of an agenda-less meeting look like a change.
    const r = reconcileMeeting(snap({ agenda: null }), snap({ agenda: null }), snap({ agenda: '' }))
    expect(r.decisions.find((d) => d.field === 'agenda')?.verdict).toBe('unchanged')
  })

  it('conflicts only on the differing fields when there is no baseline', () => {
    const r = reconcileMeeting(undefined, snap(), snap({ title: 'Different' }))
    expect(r.needsPerson).toBe(true)
    expect(r.decisions.find((d) => d.field === 'title')?.reason).toBe('no-baseline')
    // Fields that already match still resolve: an absent baseline is not a
    // reason to arbitrate things nobody disagrees about.
    expect(r.decisions.find((d) => d.field === 'agenda')?.verdict).toBe('unchanged')
  })
})

describe('every reason can be explained to the person arbitrating', () => {
  it('has a sentence for each', () => {
    const reasons: FieldReason[] = [
      'identical',
      'only-local-changed',
      'only-remote-changed',
      'both-changed',
      'no-baseline',
      'disjoint-membership',
    ]
    for (const reason of reasons) expect(FIELD_REASON_SENTENCE[reason]).toBeTruthy()
    expect(Object.keys(FIELD_REASON_SENTENCE).sort()).toEqual([...reasons].sort())
  })
})
