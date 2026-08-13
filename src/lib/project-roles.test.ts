import { describe, expect, it } from 'vitest'
import { isProjectManagerRole, isReviewerRole, roleBadgeTone } from './project-roles'

describe('isProjectManagerRole', () => {
  it('matches the manager family from the curated list', () => {
    for (const role of [
      'Project Manager',
      'Product Manager',
      'Delivery Manager',
      'Program Manager',
      'Engineering Manager',
      'Technical Program Manager',
      'Product Owner',
      'Scrum Master',
      'PM',
    ]) {
      expect(isProjectManagerRole(role), role).toBe(true)
    }
  })

  it('does not match managers-of-nothing or lookalikes', () => {
    for (const role of ['Software Engineer', 'Management Trainee', 'Tech Lead', null, undefined, '']) {
      expect(isProjectManagerRole(role), String(role)).toBe(false)
    }
  })
})

describe('isReviewerRole', () => {
  it('matches leads, architects and the C-suite', () => {
    for (const role of ['Tech Lead', 'Team Lead', 'Software Architect', 'Principal Engineer', 'CTO', 'Director']) {
      expect(isReviewerRole(role), role).toBe(true)
    }
  })

  it('does not match ordinary hands-on roles', () => {
    for (const role of ['Backend Developer', 'QA Engineer', 'Intern', null]) {
      expect(isReviewerRole(role), String(role)).toBe(false)
    }
  })
})

describe('roleBadgeTone', () => {
  it('manager wins over reviewer when a title is both', () => {
    expect(roleBadgeTone('Engineering Manager')).toBe('manager')
  })

  it('classifies the three tiers', () => {
    expect(roleBadgeTone('Project Manager')).toBe('manager')
    expect(roleBadgeTone('Software Architect')).toBe('reviewer')
    expect(roleBadgeTone('Frontend Developer')).toBe('member')
  })
})
