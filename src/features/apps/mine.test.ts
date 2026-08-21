import { describe, expect, it } from 'vitest'

import { MINE_LABEL, isMine, mineKind, type MembershipRow } from './mine'

const ME = 'user-me'
const OTHER = 'user-other'

const app = (over: Partial<MembershipRow> = {}): MembershipRow => ({
  leadId: OTHER,
  pmId: OTHER,
  members: [],
  ...over,
})

describe('mineKind', () => {
  it('is null when nobody is signed in', () => {
    expect(mineKind(app({ pmId: ME }), null)).toBeNull()
    expect(mineKind(app({ pmId: ME }), undefined)).toBeNull()
  })

  it('is null when this person is not attached at all', () => {
    expect(mineKind(app({ members: [{ userId: OTHER, role: 'dev' }] }), ME)).toBeNull()
  })

  it('names each way of being attached', () => {
    expect(mineKind(app({ pmId: ME }), ME)).toBe('pm')
    expect(mineKind(app({ leadId: ME }), ME)).toBe('lead')
    expect(mineKind(app({ members: [{ userId: ME, role: 'dev' }] }), ME)).toBe('member')
  })

  it('reports the STRONGER relationship when there are two', () => {
    // The discriminating case: a PM who is also assigned must not read as
    // "you're on this" — that understates what they are to the project.
    expect(mineKind(app({ pmId: ME, members: [{ userId: ME, role: 'dev' }] }), ME)).toBe('pm')
    expect(mineKind(app({ leadId: ME, members: [{ userId: ME, role: 'dev' }] }), ME)).toBe('lead')
    // ...and PM outranks lead when somebody holds both.
    expect(mineKind(app({ pmId: ME, leadId: ME }), ME)).toBe('pm')
  })

  it('handles an app with no lead, which the schema permits', () => {
    expect(mineKind(app({ leadId: null, pmId: ME }), ME)).toBe('pm')
    expect(mineKind(app({ leadId: null }), ME)).toBeNull()
  })
})

describe('isMine', () => {
  it('agrees with mineKind', () => {
    expect(isMine(app({ pmId: ME }), ME)).toBe(true)
    expect(isMine(app(), ME)).toBe(false)
    expect(isMine(app({ pmId: ME }), null)).toBe(false)
  })
})

describe('MINE_LABEL', () => {
  it('has a word for every kind, so colour never carries it alone', () => {
    const kinds = ['pm', 'lead', 'member'] as const
    for (const kind of kinds) expect(MINE_LABEL[kind]).toBeTruthy()
    expect(Object.keys(MINE_LABEL).sort()).toEqual([...kinds].sort())
  })
})
