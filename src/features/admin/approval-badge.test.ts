import { describe, expect, it } from 'vitest'

import {
  APPROVAL_BADGE_MAX,
  NO_APPROVALS,
  approvalBadgeLabel,
  approvalBadgeText,
  approvalTotal,
  showApprovals,
} from './approval-badge'

const counts = (users = 0, requests = 0, absences = 0) => ({ users, requests, absences })

describe('whether the row appears', () => {
  it('stays hidden when nothing is waiting', () => {
    // A permanent "Approvals 0" is how somebody learns to stop reading that
    // part of the sidebar — the exact habit a badge needs them not to have.
    expect(showApprovals(NO_APPROVALS)).toBe(false)
    expect(showApprovals(counts(0, 0, 0))).toBe(false)
  })

  it('appears for any one kind on its own', () => {
    expect(showApprovals(counts(1, 0, 0))).toBe(true)
    expect(showApprovals(counts(0, 1, 0))).toBe(true)
    expect(showApprovals(counts(0, 0, 1))).toBe(true)
  })
})

describe('the number', () => {
  it('is the three kinds added up', () => {
    expect(approvalTotal(counts(2, 3, 4))).toBe(9)
    expect(approvalBadgeText(counts(2, 3, 4))).toBe('9')
  })

  it('caps itself so a count cannot widen the column', () => {
    expect(approvalBadgeText(counts(APPROVAL_BADGE_MAX, 0, 0))).toBe('99')
    expect(approvalBadgeText(counts(APPROVAL_BADGE_MAX + 1, 0, 0))).toBe('99+')
    expect(approvalBadgeText(counts(80, 40, 20))).toBe('99+')
  })
})

describe('what a screen reader hears', () => {
  it('names what the number counts, not just the number', () => {
    expect(approvalBadgeLabel(counts(2, 1, 0))).toBe(
      'Approvals: 2 people waiting to join, 1 change request',
    )
  })

  it('says only the kinds that are actually waiting', () => {
    expect(approvalBadgeLabel(counts(0, 0, 3))).toBe('Approvals: 3 leave requests')
  })

  it('gets the singular right for every kind', () => {
    expect(approvalBadgeLabel(counts(1, 0, 0))).toBe('Approvals: 1 person waiting to join')
    expect(approvalBadgeLabel(counts(0, 1, 0))).toBe('Approvals: 1 change request')
    expect(approvalBadgeLabel(counts(0, 0, 1))).toBe('Approvals: 1 leave request')
  })

  it('has something to say even at zero, for a caller that renders it anyway', () => {
    expect(approvalBadgeLabel(NO_APPROVALS)).toBe('Approvals, nothing waiting')
  })
})
