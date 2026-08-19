import { describe, expect, it } from 'vitest'
import { orgHolidaySet } from '@/features/worklog/org-holidays'

describe('orgHolidaySet', () => {
  it('includes a holiday that was never cancelled', () => {
    expect(orgHolidaySet([{ day: '2026-08-26', revokedFrom: null }]).has('2026-08-26')).toBe(true)
  })

  it('KEEPS a holiday people already took, even after it is cancelled', () => {
    // The whole reason revocation exists as a date rather than a delete.
    // Dropping this day would hand a missing day, retroactively, to everyone
    // who was correctly excused on it — months later, unexplained.
    const set = orgHolidaySet([{ day: '2026-08-26', revokedFrom: '2026-11-01' }])
    expect(set.has('2026-08-26')).toBe(true)
  })

  it('drops a future holiday that was called off', () => {
    const set = orgHolidaySet([{ day: '2026-12-24', revokedFrom: '2026-11-01' }])
    expect(set.has('2026-12-24')).toBe(false)
  })

  it('calls off a holiday cancelled on the day itself', () => {
    // An operator cancelling "today" means today too.
    const set = orgHolidaySet([{ day: '2026-11-01', revokedFrom: '2026-11-01' }])
    expect(set.has('2026-11-01')).toBe(false)
  })

  it('handles a mixed list without cross-contamination', () => {
    const set = orgHolidaySet([
      { day: '2026-08-26', revokedFrom: '2026-11-01' },
      { day: '2026-12-24', revokedFrom: '2026-11-01' },
      { day: '2026-12-25', revokedFrom: null },
    ])
    expect([...set].sort()).toEqual(['2026-08-26', '2026-12-25'])
  })
})
