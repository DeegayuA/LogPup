import { describe, expect, it } from 'vitest'
import { scopeSourceFor } from '@/features/auth/capabilities'

describe('scopeSourceFor', () => {
  it('reads manager scope from app_role_history, never from assignments', () => {
    // managesApp() regex-matches free-text assignments.role and returns false
    // for a lead. Scope decided by a typed string is not auditable.
    expect(scopeSourceFor('manager')).toBe('app_role_history')
  })

  it('reads editor and member scope from assignments', () => {
    expect(scopeSourceFor('editor')).toBe('assignments')
    expect(scopeSourceFor('member')).toBe('assignments')
  })

  it('reads stakeholder scope from explicit grants only', () => {
    expect(scopeSourceFor('stakeholder')).toBe('app_grants')
  })

  it('never queries for workspace-wide roles', () => {
    for (const role of ['superadmin', 'admin', 'auditor'] as const) {
      expect(scopeSourceFor(role)).toBe('none')
    }
  })
})
