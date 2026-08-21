import { describe, expect, it } from 'vitest'
import { inviteChurnBetween, seriesChurnCount } from './churn'

const occ = (meetingId: string, inviteUserIds: string[]) => ({ meetingId, inviteUserIds })

describe('inviteChurnBetween', () => {
  it('counts everyone who joined plus everyone who left', () => {
    expect(inviteChurnBetween(occ('m1', ['a', 'b', 'c']), occ('m2', ['a', 'b', 'd']))).toBe(2)
  })

  it('is zero for a settled invite list', () => {
    expect(inviteChurnBetween(occ('m1', ['a', 'b']), occ('m2', ['b', 'a']))).toBe(0)
  })

  it('counts a whole list arriving or leaving', () => {
    expect(inviteChurnBetween(occ('m1', []), occ('m2', ['a', 'b']))).toBe(2)
    expect(inviteChurnBetween(occ('m1', ['a', 'b']), occ('m2', []))).toBe(2)
  })
})

describe('seriesChurnCount', () => {
  it('sums over each consecutive pair', () => {
    expect(seriesChurnCount([
      occ('m3', ['a', 'b', 'd']),
      occ('m2', ['a', 'b', 'c']),
      occ('m1', ['a', 'b', 'c']),
    ])).toBe(2)
  })

  it('is zero for a single occurrence, without indexing past its input', () => {
    // A one-element array must not throw on occurrences[1]. Zero churn here is
    // not "a settled invite list" — it is "no pair to compare" — and the
    // surface says which by showing the occurrence count beside it.
    expect(seriesChurnCount([occ('m1', ['a'])])).toBe(0)
  })

  it('is zero for no occurrences', () => {
    expect(seriesChurnCount([])).toBe(0)
  })

  it('shortens the chain when a middle occurrence was filtered out upstream', () => {
    expect(seriesChurnCount([occ('m3', ['a', 'b']), occ('m1', ['a'])])).toBe(1)
  })
})
