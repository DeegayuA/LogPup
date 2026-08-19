import { describe, expect, it } from 'vitest'
import { mayReview } from '@/features/admin/change-request-routing'
import { can, type Actor, type UserRole } from '@/features/auth/capabilities'

const actor = (id: string, role: UserRole, apps: string[] = []): Actor => ({
  id, role, scopeAppIds: new Set(apps),
})
const request = (requesterId: string, appId: string | null = 'app-1') => ({
  requesterId, appId, entityType: 'task', status: 'pending',
})

describe('mayReview', () => {
  it('lets an admin review anyone else request', () => {
    expect(mayReview(actor('a1', 'admin'), request('u1'))).toBe(true)
  })

  it('lets a manager review inside their scope only', () => {
    expect(mayReview(actor('m1', 'manager', ['app-1']), request('u1', 'app-1'))).toBe(true)
    expect(mayReview(actor('m1', 'manager', ['app-1']), request('u1', 'app-2'))).toBe(false)
  })

  it('refuses a manager their own request', () => {
    expect(mayReview(actor('m1', 'manager', ['app-1']), request('m1', 'app-1'))).toBe(false)
  })

  it('refuses an admin their own request', () => {
    expect(mayReview(actor('a1', 'admin'), request('a1'))).toBe(false)
  })

  it('allows a superadmin their own request', () => {
    // Otherwise a sole-superadmin workspace could never approve anything.
    expect(mayReview(actor('s1', 'superadmin'), request('s1'))).toBe(true)
  })

  it('refuses an editor, a member and a stakeholder outright', () => {
    for (const role of ['editor', 'member', 'stakeholder'] as const) {
      expect(mayReview(actor('x', role, ['app-1']), request('u1', 'app-1'))).toBe(false)
    }
  })

  it('routes a worklog correction to the row owner, not the scope chain', () => {
    const req = { ...request('m1'), entityType: 'worklog', ownerId: 'u9' }
    expect(mayReview(actor('a1', 'admin'), req)).toBe(false)
    expect(mayReview(actor('s1', 'superadmin'), req)).toBe(false)
    expect(mayReview(actor('u9', 'member'), req)).toBe(true)
  })

  it('refuses review of anything not pending', () => {
    for (const status of ['approved', 'rejected', 'withdrawn']) {
      expect(mayReview(actor('a1', 'admin'), { ...request('u1'), status })).toBe(false)
    }
  })
})

describe('the editor delete path', () => {
  it('leaves an editor with request.create as the only route', () => {
    // Proven at the matrix level: an editor cannot delete, and can file. The
    // server action therefore has nowhere else to send them.
    const editor = actor('e1', 'editor', ['app-1'])
    expect(can(editor, 'task.delete', { appId: 'app-1' })).toBe(false)
    expect(can(editor, 'meeting.delete', { appId: 'app-1' })).toBe(false)
    expect(can(editor, 'request.create', { ownerId: 'e1' })).toBe(true)
  })
})
