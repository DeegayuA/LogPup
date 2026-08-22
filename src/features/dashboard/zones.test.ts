import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_ZONES,
  ZONE_IDS,
  ZONE_ORDER,
  composeDashboard,
  zoneScope,
  type ZoneId,
} from '@/features/dashboard/zones'
import {
  USER_ROLES,
  type Actor,
  type EmploymentType,
  type UserRole,
} from '@/features/auth/capabilities'

/**
 * Composition, by value. Every expectation here is a literal list of zone ids
 * or a literal grant level — no mocks, and nothing that asserts a function was
 * called. If the ordering table or the capability matrix moves, these lists
 * are what says so out loud.
 */

function actorFor(
  role: string,
  options: { scopeAppIds?: string[]; employmentType?: EmploymentType; id?: string } = {},
): Actor {
  return {
    id: options.id ?? 'user-1',
    // `as UserRole` so the unknown-role case can be constructed at all: that
    // is exactly the cast `loadActor` makes against users.role, and the whole
    // reason composeDashboard checks the role is real at runtime.
    role: role as UserRole,
    scopeAppIds: new Set(options.scopeAppIds ?? []),
    employmentType: options.employmentType,
  }
}

const zoneIds = (actor: Actor): ZoneId[] => composeDashboard(actor).map((zone) => zone.id)

const grantOf = (actor: Actor, id: ZoneId) =>
  composeDashboard(actor).find((zone) => zone.id === id)?.grant ?? null

describe('composeDashboard — the seven seats', () => {
  // Superadmin and admin hold the same rows in every action these zones read,
  // so they compose identically. Written out twice rather than looped, because
  // the day they diverge this test should name which one moved.
  it('superadmin opens on what is waiting on a signature', () => {
    expect(zoneIds(actorFor('superadmin'))).toEqual([
      'approvals', 'team', 'coverage', 'portfolio', 'trail', 'my-day', 'ai-usage',
      // task.edit is 'all' for this seat, so my-work is ADMITTED even though
      // the ordering hint never mentions it — and an unlisted zone goes last.
      'my-work',
    ])
  })

  it('admin composes the same as superadmin', () => {
    expect(zoneIds(actorFor('admin'))).toEqual([
      'approvals', 'team', 'coverage', 'portfolio', 'trail', 'my-day', 'ai-usage', 'my-work',
    ])
  })

  it('manager opens on the projects they run', () => {
    expect(zoneIds(actorFor('manager', { scopeAppIds: ['app-1'] }))).toEqual([
      'team', 'coverage', 'portfolio', 'my-day', 'my-work', 'ai-usage',
      // activity.view is 'all' for a manager; the hint does not list it.
      'trail',
    ])
  })

  it('editor opens on the work itself', () => {
    expect(zoneIds(actorFor('editor', { scopeAppIds: ['app-1'] }))).toEqual([
      'my-day', 'my-work', 'portfolio', 'ai-usage', 'team', 'coverage', 'trail',
    ])
  })

  it('member opens on their own day', () => {
    expect(zoneIds(actorFor('member', { scopeAppIds: ['app-1'] }))).toEqual([
      'my-day', 'my-work', 'ai-usage', 'team', 'coverage', 'portfolio', 'trail',
    ])
  })

  it('stakeholder gets project outcomes and nothing about the studio', () => {
    const stakeholder = actorFor('stakeholder', { scopeAppIds: ['app-1'] })
    expect(zoneIds(stakeholder)).toEqual(['portfolio', 'my-day', 'ai-usage'])
    // Spelled out as absences, because each one is a deliberate refusal: no
    // directory, no worklog rollup, no board, and no watching the studio work.
    for (const withheld of ['team', 'coverage', 'my-work', 'trail', 'approvals'] as ZoneId[]) {
      expect(zoneIds(stakeholder)).not.toContain(withheld)
    }
  })

  it('auditor opens on what happened, and never gets a board', () => {
    expect(zoneIds(actorFor('auditor'))).toEqual([
      'trail', 'coverage', 'portfolio', 'my-day', 'ai-usage',
      // user.view.directory is 'all' for an auditor; the hint does not list it.
      'team',
    ])
    // task.edit is 'none' for an auditor: reading everything is not editing
    // anything, and my-work is a board.
    expect(zoneIds(actorFor('auditor'))).not.toContain('my-work')
  })

  it('every seat keeps my-day and ai-usage — they read only your own rows', () => {
    for (const role of USER_ROLES) {
      expect(zoneIds(actorFor(role)), role).toContain('my-day')
      expect(zoneIds(actorFor(role)), role).toContain('ai-usage')
    }
  })
})

describe('composeDashboard — the grant that admitted the zone', () => {
  it('reports the level, not merely a yes', () => {
    expect(grantOf(actorFor('admin'), 'portfolio')).toBe('all')
    expect(grantOf(actorFor('manager'), 'coverage')).toBe('scoped')
    expect(grantOf(actorFor('member'), 'coverage')).toBe('own')
    expect(grantOf(actorFor('member'), 'my-work')).toBe('own')
    expect(grantOf(actorFor('editor'), 'my-work')).toBe('scoped')
    // The always-on zones are 'own' by construction: their subject is you.
    expect(grantOf(actorFor('stakeholder'), 'ai-usage')).toBe('own')
  })

  it('never hands a zone a grant of none', () => {
    for (const role of USER_ROLES) {
      for (const zone of composeDashboard(actorFor(role))) {
        expect(zone.grant, `${role}/${zone.id}`).not.toBe('none')
      }
    }
  })
})

describe('composeDashboard — a capability removed', () => {
  it('drops the approvals zone when the employment stage withholds the sign-off', () => {
    // A trainee holds no sign-off of any kind, whatever seat they sit in.
    const trainee = actorFor('admin', { employmentType: 'trainee' })
    expect(zoneIds(trainee)).not.toContain('approvals')
    // And nothing else moved: the rest of the admin dashboard is intact and in
    // the same order, just without the queue they cannot sign.
    expect(zoneIds(trainee)).toEqual([
      'team', 'coverage', 'portfolio', 'trail', 'my-day', 'ai-usage', 'my-work',
    ])
  })

  it('drops it for a contractor too — admitting people is not project work', () => {
    expect(zoneIds(actorFor('admin', { employmentType: 'contract' }))).not.toContain('approvals')
  })

  it('keeps it on probation: user.approve is reversible, so no stage caps it', () => {
    expect(zoneIds(actorFor('admin', { employmentType: 'probation' }))).toContain('approvals')
  })

  it('a stage that withholds nothing composes exactly as a bare seat does', () => {
    expect(zoneIds(actorFor('manager', { employmentType: 'permanent' }))).toEqual(
      zoneIds(actorFor('manager')),
    )
  })
})

describe('zoneScope — narrow by grant level, never by scope emptiness', () => {
  it('an auditor with an EMPTY scope still gets the whole portfolio', () => {
    // The inversion this rule exists to prevent: an auditor's scopeAppIds is
    // empty because their grant is 'all' and never consults scope. Filtering
    // on the set would hand the compliance seat an empty portfolio.
    const auditor = actorFor('auditor')
    expect(auditor.scopeAppIds.size).toBe(0)
    const portfolio = grantOf(auditor, 'portfolio')
    expect(portfolio).toBe('all')
    expect(zoneScope('all', auditor)).toEqual({ kind: 'all' })
  })

  it('an admin with an EMPTY scope still gets the whole team', () => {
    const admin = actorFor('admin')
    expect(admin.scopeAppIds.size).toBe(0)
    expect(grantOf(admin, 'team')).toBe('all')
    expect(zoneScope('all', admin)).toEqual({ kind: 'all' })
  })

  it('a scoped grant narrows to the actor’s apps', () => {
    const manager = actorFor('manager', { scopeAppIds: ['app-1', 'app-2'] })
    expect(zoneScope('scoped', manager)).toEqual({
      kind: 'apps',
      appIds: new Set(['app-1', 'app-2']),
    })
  })

  it('a scoped grant over an empty scope means nothing to show, not everything', () => {
    const scope = zoneScope('scoped', actorFor('editor'))
    expect(scope.kind).toBe('apps')
    expect(scope.kind === 'apps' && scope.appIds.size).toBe(0)
  })

  it('an own grant narrows to the person, not to their apps', () => {
    expect(zoneScope('own', actorFor('member', { id: 'u-7', scopeAppIds: ['app-1'] }))).toEqual({
      kind: 'own',
      userId: 'u-7',
    })
  })

  it('the same zone narrows differently as the grant goes from all to scoped', () => {
    // app.view is 'all' for an admin and 'scoped' for an editor. Both get the
    // portfolio zone; only one of them gets the whole portfolio.
    const admin = actorFor('admin', { scopeAppIds: [] })
    const editor = actorFor('editor', { scopeAppIds: ['app-1'] })
    expect(grantOf(admin, 'portfolio')).toBe('all')
    expect(grantOf(editor, 'portfolio')).toBe('scoped')
    expect(zoneScope('all', admin).kind).toBe('all')
    expect(zoneScope('scoped', editor)).toEqual({ kind: 'apps', appIds: new Set(['app-1']) })
  })
})

describe('composeDashboard — a role this build has never heard of', () => {
  it('fails closed to my-day, never to the admin ordering', () => {
    const zones = composeDashboard(actorFor('overlord'))
    expect(zones.map((z) => z.id)).toEqual(['my-day'])
    expect(zones[0].grant).toBe('own')
  })

  it('an unknown role gets no approvals queue and no trail', () => {
    const ids = zoneIds(actorFor('' as UserRole))
    expect(ids).not.toContain('approvals')
    expect(ids).not.toContain('trail')
  })
})

describe('the registry itself', () => {
  it('defines every declared zone id exactly once', () => {
    expect(DASHBOARD_ZONES.map((z) => z.id).sort()).toEqual([...ZONE_IDS].sort())
  })

  it('orders only zones that exist, and never twice', () => {
    for (const role of USER_ROLES) {
      const hint = ZONE_ORDER[role]
      expect(new Set(hint).size, role).toBe(hint.length)
      for (const id of hint) {
        expect(ZONE_IDS, `${role}/${id}`).toContain(id)
      }
    }
  })

  it('every zone the hint forgets is still composed, at the end', () => {
    // The property the ordering table depends on being safe to edit: dropping
    // a zone from a hint costs it its position, never its existence.
    for (const role of USER_ROLES) {
      const composed = zoneIds(actorFor(role, { scopeAppIds: ['app-1'] }))
      const hinted = ZONE_ORDER[role].filter((id) => composed.includes(id))
      expect(composed.slice(0, hinted.length), role).toEqual(hinted)
    }
  })

  it('carries a heading for every zone, so the page never invents one', () => {
    for (const zone of DASHBOARD_ZONES) {
      expect(zone.label.length, zone.id).toBeGreaterThan(0)
    }
  })
})
