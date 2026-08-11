import { describe, expect, it } from 'vitest'
import { JOB_ROLE_GROUPS, JOB_ROLES } from './job-roles'

describe('JOB_ROLE_GROUPS', () => {
  it('has no duplicate role values across groups', () => {
    const allRoles = JOB_ROLE_GROUPS.flatMap((group) => group.roles)
    const unique = new Set(allRoles)
    expect(unique.size).toBe(allRoles.length)
  })

  it('has no empty group labels or role strings', () => {
    for (const group of JOB_ROLE_GROUPS) {
      expect(group.label.trim().length).toBeGreaterThan(0)
      for (const role of group.roles) {
        expect(role.trim().length).toBeGreaterThan(0)
      }
    }
  })
})

describe('JOB_ROLES', () => {
  it('matches the flattened grouped source exactly (same roles, same order)', () => {
    const expected = JOB_ROLE_GROUPS.flatMap((group) => group.roles)
    expect(JOB_ROLES).toEqual(expected)
  })

  it('has no duplicates', () => {
    expect(new Set(JOB_ROLES).size).toBe(JOB_ROLES.length)
  })
})
