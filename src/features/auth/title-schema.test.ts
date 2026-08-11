import { describe, expect, it } from 'vitest'
import { jobRoleInput } from './title-schema'
import { JOB_ROLE_MAX_LENGTH } from '@/lib/job-roles'

describe('jobRoleInput', () => {
  it('accepts an empty string (clears the job role)', () => {
    const parsed = jobRoleInput.safeParse('')
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data).toBe('')
  })

  it('trims surrounding whitespace', () => {
    const parsed = jobRoleInput.safeParse('  Software Engineer  ')
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data).toBe('Software Engineer')
  })

  it('accepts exactly the cap', () => {
    const value = 'A'.repeat(JOB_ROLE_MAX_LENGTH)
    const parsed = jobRoleInput.safeParse(value)
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data).toBe(value)
  })

  it('rejects one character over the cap', () => {
    const parsed = jobRoleInput.safeParse('A'.repeat(JOB_ROLE_MAX_LENGTH + 1))
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe(
        `Job role must be ${JOB_ROLE_MAX_LENGTH} characters or fewer`,
      )
    }
  })

  it('measures the cap after trimming, not before', () => {
    // Exactly-cap real characters padded with whitespace that trim() removes first.
    const value = `  ${'B'.repeat(JOB_ROLE_MAX_LENGTH)}  `
    const parsed = jobRoleInput.safeParse(value)
    expect(parsed.success).toBe(true)
  })

  it('rejects non-string payloads — a direct action call can send anything', () => {
    expect(jobRoleInput.safeParse(null).success).toBe(false)
    expect(jobRoleInput.safeParse(42).success).toBe(false)
    expect(jobRoleInput.safeParse({ title: 'CEO' }).success).toBe(false)
  })
})
