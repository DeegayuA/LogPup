import { describe, expect, it } from 'vitest'
import type { Actor, UserRole } from '@/features/auth/capabilities'
import { canViewPerson } from '@/features/people/visibility'

const actor = (role: UserRole, id: string, scope: string[] = []): Actor => ({
  id,
  role,
  scopeAppIds: new Set(scope),
})

describe('canViewPerson', () => {
  it('lets a scoped seat with no shared app see their OWN page', () => {
    const me = actor('member', 'u-1', [])
    expect(canViewPerson(me, { id: 'u-1', appIds: ['app-9'] })).toBe(true)
  })

  it('lets admin see anyone', () => {
    const admin = actor('admin', 'u-admin')
    expect(canViewPerson(admin, { id: 'u-2', appIds: ['app-9'] })).toBe(true)
  })

  it("lets manager ('all') see anyone", () => {
    const manager = actor('manager', 'u-manager')
    expect(canViewPerson(manager, { id: 'u-2', appIds: ['app-9'] })).toBe(true)
  })

  it('lets a member see a person on a SHARED app', () => {
    const member = actor('member', 'u-3', ['app-1', 'app-2'])
    expect(canViewPerson(member, { id: 'u-4', appIds: ['app-2'] })).toBe(true)
  })

  it('refuses a member with NO shared app', () => {
    const member = actor('member', 'u-3', ['app-1'])
    expect(canViewPerson(member, { id: 'u-4', appIds: ['app-9'] })).toBe(false)
  })

  it('refuses stakeholder outright', () => {
    const stakeholder = actor('stakeholder', 'u-5', ['app-1'])
    expect(canViewPerson(stakeholder, { id: 'u-4', appIds: ['app-1'] })).toBe(false)
  })

  it("lets auditor ('all', read-only) see anyone", () => {
    const auditor = actor('auditor', 'u-6')
    expect(canViewPerson(auditor, { id: 'u-4', appIds: ['app-9'] })).toBe(true)
  })
})
