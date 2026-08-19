import { describe, expect, it } from 'vitest'
import { userRole } from '@/db/schema'
import {
  ROLE_GRANTS,
  USER_ROLES,
  can,
  isAdminRole,
  roleLabel,
  type Action,
  type Actor,
  type UserRole,
} from '@/features/auth/capabilities'

const actor = (role: UserRole, over: string[] = []): Actor => ({
  id: 'actor-1',
  role,
  scopeAppIds: new Set(over),
})

describe('USER_ROLES', () => {
  // capabilities.ts stays client-importable, so it declares the role union
  // itself rather than importing the pg enum. This test is the only thing
  // stopping the two from drifting apart.
  it('matches the user_role pg enum exactly', () => {
    expect([...USER_ROLES].sort()).toEqual([...userRole.enumValues].sort())
  })
})

describe('ROLE_GRANTS', () => {
  it('gives every role a grant for every action', () => {
    const actions = Object.keys(ROLE_GRANTS) as Action[]
    for (const action of actions) {
      for (const role of USER_ROLES) {
        expect(ROLE_GRANTS[action][role], `${role} x ${action}`).toBeDefined()
      }
    }
  })

  it('has no worklog.write.any action, for anybody', () => {
    // A worklog is a first-person record. A manager writing that number turns a
    // self-report into a managed metric, at which point it measures nothing.
    expect(Object.keys(ROLE_GRANTS)).not.toContain('worklog.write.any')
  })

  it('gives auditor no write capability at all', () => {
    const writes = (Object.keys(ROLE_GRANTS) as Action[]).filter((a) =>
      /\.(create|edit|delete|grant|approve|assign|restore|purge|manage|deactivate|write|dbclear|offboard|backfill|withdraw)/.test(
        a,
      ),
    )
    expect(writes.length).toBeGreaterThan(10)
    for (const action of writes) {
      expect(ROLE_GRANTS[action].auditor, `auditor x ${action}`).toBe('none')
    }
  })

  it('denies stakeholder the people directory and every worklog', () => {
    expect(ROLE_GRANTS['user.view.directory'].stakeholder).toBe('none')
    expect(ROLE_GRANTS['worklog.view'].stakeholder).toBe('none')
    expect(ROLE_GRANTS['coverage.view'].stakeholder).toBe('none')
  })

  it('separates admin from superadmin on exactly three powers', () => {
    for (const action of [
      'danger.dbclear',
      'trash.purge',
      'user.role.grant.superadmin',
    ] as const) {
      expect(ROLE_GRANTS[action].superadmin).toBe('all')
      expect(ROLE_GRANTS[action].admin).toBe('none')
    }
  })

  it('refuses an editor every delete', () => {
    for (const action of ['task.delete', 'meeting.delete', 'trash.restore'] as const) {
      expect(ROLE_GRANTS[action].editor).toBe('none')
    }
  })

  it('keeps manager out of workspace-widening acts', () => {
    expect(ROLE_GRANTS['user.create'].manager).toBe('none')
    expect(ROLE_GRANTS['user.approve'].manager).toBe('none')
    expect(ROLE_GRANTS['user.role.grant'].manager).toBe('none')
  })

  it('lets only superadmin review their own request', () => {
    expect(ROLE_GRANTS['request.review.self'].superadmin).toBe('own')
    for (const role of USER_ROLES.filter((r) => r !== 'superadmin')) {
      expect(ROLE_GRANTS['request.review.self'][role], role).toBe('none')
    }
  })

  it('gives meeting.admin no scope branch, preserving today reach', () => {
    // rsvp/share/followup checks are creator-or-admin today with no managesApp
    // arm. A 'scoped' anywhere in this row would silently hand every PM three
    // powers they do not currently hold.
    expect(Object.values(ROLE_GRANTS['meeting.admin'])).not.toContain('scoped')
  })
})

describe('the widening tripwire', () => {
  it('fails at compile time if the union grows without this file being read', () => {
    // A green suite proves nothing for this bug class: every role check in the
    // app passes its tests today because the fixtures hand it a literal. This
    // assertion is type-level on purpose — add an eighth seat and tsc fails
    // here, before anyone discovers it as things quietly missing from a UI.
    const exhaustive: Record<UserRole, true> = {
      superadmin: true,
      admin: true,
      manager: true,
      editor: true,
      member: true,
      stakeholder: true,
      auditor: true,
    }
    expect(Object.keys(exhaustive).sort()).toEqual([...USER_ROLES].sort())
  })

  it('shows superadmin no less than admin, anywhere', () => {
    // The failure this whole sweep exists to prevent: a check written for
    // 'admin' going silently false for the seat above it.
    const RANK: Record<string, number> = { none: 0, own: 1, scoped: 2, all: 3 }
    for (const action of Object.keys(ROLE_GRANTS) as Action[]) {
      expect(
        RANK[ROLE_GRANTS[action].superadmin],
        `superadmin must not trail admin on ${action}`,
      ).toBeGreaterThanOrEqual(RANK[ROLE_GRANTS[action].admin])
    }
  })
})

describe('isAdminRole', () => {
  it('includes superadmin, which is the whole point', () => {
    // Widening the enum turned every surviving `role === 'admin'` into a
    // silent false for superadmin — compiling, typechecking, and quietly
    // hiding things from the highest-privilege seat.
    expect(isAdminRole('superadmin')).toBe(true)
    expect(isAdminRole('admin')).toBe(true)
  })

  it('is staff-only, not a ladder — the seats either side of it', () => {
    // Testing only 'admin' cannot tell "staff predicate" from "rank >= admin".
    expect(isAdminRole('superadmin')).toBe(true) // above
    expect(isAdminRole('manager')).toBe(false) // immediately below, and NOT staff
    expect(isAdminRole('editor')).toBe(false)
  })

  it('excludes every non-staff seat', () => {
    for (const role of ['manager', 'editor', 'member', 'stakeholder', 'auditor'] as const) {
      expect(isAdminRole(role), role).toBe(false)
    }
  })
})

describe('roleLabel', () => {
  it('names every seat, so no badge falls through to a wrong default', () => {
    for (const role of USER_ROLES) {
      expect(roleLabel(role), role).toMatch(/^[A-Z]/)
    }
    expect(roleLabel('superadmin')).toBe('Superadmin')
  })
})

describe('can', () => {
  it('resolves all without needing a resource', () => {
    expect(can(actor('admin'), 'user.create')).toBe(true)
  })

  it('resolves none whatever the resource', () => {
    expect(can(actor('member'), 'user.create', { ownerId: 'actor-1', appId: 'app-1' })).toBe(false)
  })

  it('resolves own against ownerId', () => {
    expect(can(actor('member'), 'worklog.write.own', { ownerId: 'actor-1' })).toBe(true)
    expect(can(actor('member'), 'worklog.write.own', { ownerId: 'someone-else' })).toBe(false)
  })

  it('resolves scoped against the actor scope set', () => {
    const manager = actor('manager', ['app-1'])
    expect(can(manager, 'app.edit', { appId: 'app-1' })).toBe(true)
    expect(can(manager, 'app.edit', { appId: 'app-2' })).toBe(false)
  })

  it('lets scoped fall back to ownership', () => {
    // own is a subset of scoped: your own row is inside your scope even when
    // the row carries no appId at all.
    expect(can(actor('manager'), 'task.edit', { ownerId: 'actor-1', appId: null })).toBe(true)
  })

  it('resolves scoped against ANY app when a resource spans several', () => {
    // A meeting can serve more than one project. Being PM of one of them is
    // enough; requiring all of them would mean a joint meeting could only be
    // managed by someone who runs every project in it.
    const manager = actor('manager', ['app-2'])
    expect(can(manager, 'meeting.manage', { appIds: ['app-1', 'app-2'] })).toBe(true)
    expect(can(manager, 'meeting.manage', { appIds: ['app-1', 'app-3'] })).toBe(false)
  })

  it('fails closed on an empty or absent appIds list', () => {
    const manager = actor('manager', ['app-1'])
    expect(can(manager, 'meeting.manage', { appIds: [] })).toBe(false)
    expect(can(manager, 'meeting.manage', { appIds: null })).toBe(false)
  })

  it('fails closed when own or scoped is asked without a resource', () => {
    expect(can(actor('member'), 'worklog.write.own')).toBe(false)
    expect(can(actor('manager', ['app-1']), 'app.edit')).toBe(false)
  })
})

describe('meeting.admin preserves today reach', () => {
  const creator = actor('member')
  const pm = { id: 'u2', role: 'manager' as const, scopeAppIds: new Set(['app-1']) }

  it('lets the creator act on their own meeting', () => {
    expect(can(creator, 'meeting.admin', { ownerId: 'actor-1', appId: 'app-1' })).toBe(true)
  })

  it('does NOT let a pm act on a meeting they did not create', () => {
    expect(can(pm, 'meeting.admin', { ownerId: 'u1', appId: 'app-1' })).toBe(false)
  })

  it('still lets a pm manage the same meeting through meeting.manage', () => {
    expect(can(pm, 'meeting.manage', { ownerId: 'u1', appId: 'app-1' })).toBe(true)
  })
})

describe('the editor delete path', () => {
  it('leaves an editor with request.create as the only route', () => {
    const editor = actor('editor', ['app-1'])
    expect(can(editor, 'task.delete', { appId: 'app-1' })).toBe(false)
    expect(can(editor, 'request.create', { ownerId: 'actor-1' })).toBe(true)
  })
})
