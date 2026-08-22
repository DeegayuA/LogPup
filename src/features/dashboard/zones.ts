import {
  USER_ROLES,
  effectiveGrant,
  type Action,
  type Actor,
  type GrantLevel,
  type UserRole,
} from '@/features/auth/capabilities'

/**
 * WHICH ZONES A DASHBOARD IS MADE OF, AND WHO GETS WHICH.
 *
 * The page used to gate its last two zones on one boolean — `isAdminRole` —
 * which with seven seats collapsed manager, editor, member, stakeholder and
 * auditor into a single "not admin" view: a stakeholder landed on a page built
 * around personal tasks they do not have, and an auditor, whose whole job is
 * the trail, got no trail. Worse, comparing roles is the exact pattern
 * capabilities.ts exists to forbid.
 *
 * So a dashboard is a LIST OF ZONES CHOSEN BY WHAT THE VIEWER CAN DO. A role
 * influences it in exactly one way that is not a capability: the order the
 * zones come in — what this person came here to look at first.
 *
 * PURE by construction — no `@/db`, no React, no `new Date()`. Every input is
 * the `Actor` the caller already loaded, so composition can be unit-tested by
 * value and the page has nothing left to decide.
 */

export const ZONE_IDS = [
  'my-day',
  'my-work',
  'team',
  'coverage',
  'portfolio',
  'approvals',
  'trail',
  'ai-usage',
] as const

export type ZoneId = (typeof ZONE_IDS)[number]

/** A grant that admits a zone. `none` is the absence of one. */
export type AdmittingGrant = Exclude<GrantLevel, 'none'>

export type ZoneDefinition = {
  id: ZoneId
  /**
   * The capability that makes this zone meaningful, or null for the two zones
   * every actor holds because they read nothing but that actor's own rows.
   */
  action: Action | null
  /**
   * The weakest grant that admits the zone. `own` for most — an `own` grant
   * still gives the zone something true to show, namely your own rows. The
   * portfolio is the exception: there is no such thing as owning a slice of
   * the app portfolio, so a hypothetical `own` grant must not open it.
   */
  minGrant: AdmittingGrant
  /** The zone's heading, rendered by the page above the zone. */
  label: string
  /**
   * The heading is for screen readers only. Set where the zone's own cards
   * carry the visible titles and a second heading above them would be noise.
   */
  labelHidden?: boolean
}

/**
 * The registry. Order here is the FALLBACK order — the order zones appear in
 * for an actor whose role ordering hint does not mention them.
 *
 * Action spellings are the real keys from capabilities.ts. A typo is a compile
 * error rather than a zone that silently never renders, which is why `action`
 * is typed as `Action` and not as a string.
 */
export const DASHBOARD_ZONES: readonly ZoneDefinition[] = [
  {
    id: 'my-day',
    // Everyone has a day. The zone's own cards are capability-filtered
    // internally — a stakeholder's my-day is meetings and mentions with no
    // task or worklog content — which is why an always-on zone does not leak.
    action: null,
    minGrant: 'own',
    label: 'My Day',
    labelHidden: true,
  },
  {
    id: 'my-work',
    action: 'task.edit',
    minGrant: 'own',
    label: 'My Work by Project',
  },
  {
    id: 'team',
    action: 'user.view.directory',
    minGrant: 'own',
    label: 'Team Capacity & Sprints',
  },
  {
    id: 'coverage',
    action: 'coverage.view',
    minGrant: 'own',
    label: 'Coverage & Absence',
  },
  {
    id: 'portfolio',
    action: 'app.view',
    minGrant: 'scoped',
    label: 'App Portfolio',
  },
  {
    id: 'approvals',
    action: 'user.approve',
    minGrant: 'own',
    label: 'Waiting on You',
  },
  {
    id: 'trail',
    // activity.view, NOT audit.view. This zone renders the shared feed of what
    // changed; the compliance surface — the same table unfiltered, with
    // trashed rows and self-approval metadata — is a different question and,
    // if it ever belongs here, a different zone rather than this one widened.
    action: 'activity.view',
    minGrant: 'own',
    label: 'Activity Trail',
  },
  {
    id: 'ai-usage',
    // Own data: this person's ledger and their own key pool. There is no
    // org-wide version of it to gate.
    action: null,
    minGrant: 'own',
    label: 'AI Engine & Model Routing',
  },
]

const ZONE_BY_ID: Record<ZoneId, ZoneDefinition> = Object.fromEntries(
  DASHBOARD_ZONES.map((zone) => [zone.id, zone]),
) as Record<ZoneId, ZoneDefinition>

/**
 * What each seat came to the dashboard to look at, in order.
 *
 * A HINT, NEVER A PERMISSION. Nothing here can add a zone the capability
 * matrix refused, and a zone this table forgets is still shown — at the end —
 * so a role that GAINS a capability gains its zone with no edit to this table
 * and none to the page.
 */
export const ZONE_ORDER: Record<UserRole, readonly ZoneId[]> = {
  // The whole org's exceptions first: what is waiting on a signature, then who
  // is over capacity, then whether anybody is missing.
  superadmin: ['approvals', 'team', 'coverage', 'portfolio', 'trail', 'my-day', 'ai-usage'],
  admin: ['approvals', 'team', 'coverage', 'portfolio', 'trail', 'my-day', 'ai-usage'],
  // The projects they run.
  manager: ['team', 'coverage', 'portfolio', 'my-day', 'my-work', 'ai-usage'],
  // The work itself.
  editor: ['my-day', 'my-work', 'portfolio', 'ai-usage'],
  // Their own day.
  member: ['my-day', 'my-work', 'ai-usage'],
  // Project outcomes. No team, no coverage, no trail — a client seat does not
  // watch the studio work.
  stakeholder: ['portfolio', 'my-day', 'ai-usage'],
  // What happened.
  auditor: ['trail', 'coverage', 'portfolio', 'my-day', 'ai-usage'],
}

/** A zone the actor may see, with the grant level that admitted it. */
export type DashboardZone = ZoneDefinition & { grant: AdmittingGrant }

/**
 * Levels nest for a single action — own ⊂ scoped ⊂ all — which is the ONLY
 * comparison this module makes. Roles are never compared to each other.
 * Restated here rather than imported because capabilities.ts keeps its own
 * copy private, and a second reader of that ordering is not a second rule.
 */
const GRANT_RANK: Record<GrantLevel, number> = { none: 0, own: 1, scoped: 2, all: 3 }

function isKnownRole(role: string): role is UserRole {
  return (USER_ROLES as readonly string[]).includes(role)
}

/**
 * The grant that admits this zone, or null when it does not.
 *
 * `effectiveGrant`, NOT `can()`. `can` fails closed for a `scoped` or `own`
 * action asked without the resource it needs — correct for a mutation, fatal
 * here: asked that way it would answer no for a manager's `task.edit` and
 * delete the my-work zone from every seat below admin. A zone is admitted by
 * the LEVEL of the grant; narrowing to the rows that level reaches is the
 * zone's own job, and `zoneScope` below is how it asks.
 *
 * Employment caps ride along inside `effectiveGrant`, so an admin still on
 * probation or in a trainee stage loses the approvals zone rather than
 * rendering a queue they cannot sign.
 */
function grantForZone(actor: Actor, zone: ZoneDefinition): AdmittingGrant | null {
  if (zone.action === null) return 'own'
  const grant = effectiveGrant(actor.role, actor.employmentType, zone.action)
  if (GRANT_RANK[grant] < GRANT_RANK[zone.minGrant]) return null
  return grant as AdmittingGrant
}

/**
 * The ordered zones this actor may see.
 *
 * Two passes, deliberately: the role's hint first, then everything admitted
 * that the hint did not mention, in registry order. The second pass is what
 * makes the ordering table safe to edit — forgetting a zone there costs it its
 * position, never its existence.
 */
export function composeDashboard(actor: Actor): DashboardZone[] {
  // FAILS CLOSED on a role this build has never heard of. `loadActor` casts
  // `users.role` straight from the database (`user.role as UserRole`), so a
  // seat added to the enum ahead of the code really can arrive here — and the
  // one answer that must never be reached by accident is the admin ordering.
  // One zone, reading nothing but this person's own rows.
  if (!isKnownRole(actor.role)) {
    return [{ ...ZONE_BY_ID['my-day'], grant: 'own' }]
  }

  const admitted = new Map<ZoneId, DashboardZone>()
  for (const zone of DASHBOARD_ZONES) {
    const grant = grantForZone(actor, zone)
    if (grant) admitted.set(zone.id, { ...zone, grant })
  }

  const ordered: DashboardZone[] = []
  for (const id of ZONE_ORDER[actor.role]) {
    const zone = admitted.get(id)
    if (!zone) continue
    ordered.push(zone)
    admitted.delete(id)
  }
  for (const zone of DASHBOARD_ZONES) {
    const remaining = admitted.get(zone.id)
    if (remaining) ordered.push(remaining)
  }
  return ordered
}

/**
 * How far a zone may read.
 *
 * THE TRAP THIS TYPE EXISTS TO CLOSE: `scopeAppIds` is empty for superadmin,
 * admin and auditor — not because they reach nothing, but because their grants
 * are `all` and never consult scope. A zone that filtered on `scopeAppIds`
 * without checking the grant first would show an auditor an empty portfolio
 * and an admin an empty team: the exact inversion of what those seats are for.
 *
 * So zones are handed one of these instead of the raw set, and there is no
 * shape here that lets them narrow an `all` grant by accident.
 */
export type ZoneScope =
  | { kind: 'all' }
  /** Narrow to these apps. Empty genuinely means nothing to show. */
  | { kind: 'apps'; appIds: ReadonlySet<string> }
  /** Narrow to this person's own rows. */
  | { kind: 'own'; userId: string }

export function zoneScope(grant: AdmittingGrant, actor: Actor): ZoneScope {
  switch (grant) {
    case 'all':
      return { kind: 'all' }
    case 'scoped':
      return { kind: 'apps', appIds: actor.scopeAppIds }
    case 'own':
      return { kind: 'own', userId: actor.id }
  }
}
