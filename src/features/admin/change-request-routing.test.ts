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

describe('mayReview — app-entity requests', () => {
  const appRequest = (requesterId: string, leadId: string | null, appId = 'app-1') => ({
    requesterId, appId, entityType: 'app', status: 'pending', leadId,
  })

  it('refuses a co-PM: scoped to the app but not its lead', () => {
    // The generic tail (`can(actor,'request.review',{appId})`) would have
    // allowed this — a manager scoped to app-1 — which is exactly the gap
    // the app branch closes.
    const coPm = actor('m2', 'manager', ['app-1'])
    expect(mayReview(coPm, appRequest('u1', 'lead-1'))).toBe(false)
  })

  it('lets the named lead sign', () => {
    const lead = actor('lead-1', 'manager', ['app-1'])
    expect(mayReview(lead, appRequest('u1', 'lead-1'))).toBe(true)
  })

  it('routes a requester who is also the lead through request.review.self, not the lead branch', () => {
    // If the lead branch ran first it would grant this via the scoped
    // 'request.review' check; the self-check above it runs first instead,
    // and request.review.self is 'own' for a superadmin only — a manager
    // gets refused even though they are the named lead.
    const managerLead = actor('lead-1', 'manager', ['app-1'])
    expect(mayReview(managerLead, appRequest('lead-1', 'lead-1'))).toBe(false)
  })

  it('caps a trainee lead out — falls to the admin family, not the seat', () => {
    const traineeLead: Actor = { ...actor('lead-1', 'manager', ['app-1']), employmentType: 'trainee' }
    expect(mayReview(traineeLead, appRequest('u1', 'lead-1'))).toBe(false)
    expect(mayReview(actor('a1', 'admin'), appRequest('u1', 'lead-1'))).toBe(true)
  })

  it('always allows an admin or superadmin, lead or not', () => {
    expect(mayReview(actor('a1', 'admin'), appRequest('u1', 'lead-1'))).toBe(true)
    expect(mayReview(actor('s1', 'superadmin'), appRequest('u1', 'lead-1'))).toBe(true)
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
