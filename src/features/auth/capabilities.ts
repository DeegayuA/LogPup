/**
 * The one place that answers "may this person do this?".
 *
 * PURE AND SYNCHRONOUS ON PURPOSE. This module is imported by client
 * components (board-column.tsx) and called per row inside maps
 * (task-actions.ts), so an async check would mean either a database round trip
 * per row or a capability that cannot run on the client at all. Everything
 * needing the database — resolving which apps an actor reaches — happens once
 * per request in actor.ts and arrives here as a plain Set.
 *
 * NOT A ROLE LADDER. Grants are per (action, role). The levels nest for a
 * single action — own is a subset of scoped is a subset of all — but nothing
 * anywhere may compare two roles. `role >= X` is the bug this table exists to
 * prevent, and the reason the seats are a matrix rather than an integer.
 */

export const USER_ROLES = [
  'superadmin',
  'admin',
  'manager',
  'editor',
  'member',
  'stakeholder',
  'auditor',
] as const

export type UserRole = (typeof USER_ROLES)[number]

/** Reach over ONE action. Never a comparison between roles. */
export type GrantLevel = 'none' | 'own' | 'scoped' | 'all'

export type Actor = {
  id: string
  role: UserRole
  /** Apps this actor reaches. Resolved once per request by `loadActor`. */
  scopeAppIds: ReadonlySet<string>
}

/**
 * What is being acted on. Every field optional; a missing one fails closed.
 *
 * `appIds` exists because a resource may belong to more than one project — a
 * meeting spanning several apps is the live case. A scoped actor reaches the
 * resource if their scope covers ANY of them: being PM of one of the projects
 * a meeting serves is enough to manage that meeting, and requiring all of
 * them would mean a joint meeting could only be managed by someone who runs
 * every project in it.
 */
export type Resource = {
  ownerId?: string | null
  appId?: string | null
  appIds?: readonly string[] | null
}

const N = 'none'
const O = 'own'
const S = 'scoped'
const A = 'all'

type Row = Record<UserRole, GrantLevel>

/**
 * Action-major, so one line reads as one capability across the whole org.
 * Column order is fixed: superadmin, admin, manager, editor, member,
 * stakeholder, auditor.
 */
export const ROLE_GRANTS = {
  // People
  'user.view.directory':        { superadmin: A, admin: A, manager: A, editor: A, member: A, stakeholder: N, auditor: A },
  'user.view.detail':           { superadmin: A, admin: A, manager: A, editor: S, member: S, stakeholder: N, auditor: A },
  'user.create':                { superadmin: A, admin: A, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  'user.approve':               { superadmin: A, admin: A, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  'user.deactivate':            { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'user.profile.edit':          { superadmin: A, admin: A, manager: S, editor: O, member: O, stakeholder: O, auditor: N },
  'user.role.grant':            { superadmin: A, admin: A, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  'user.role.grant.superadmin': { superadmin: A, admin: N, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  'user.schedule.edit':         { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'user.offboard':              { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  // Apps
  'app.view':                   { superadmin: A, admin: A, manager: A, editor: S, member: S, stakeholder: S, auditor: A },
  'app.create':                 { superadmin: A, admin: A, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  'app.edit':                   { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'app.archive':                { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'app.assign':                 { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'app.role.assign':            { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'app.grant.stakeholder':      { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  // Worklog. There is deliberately no worklog.write.any at any level.
  'worklog.view':               { superadmin: A, admin: A, manager: S, editor: S, member: O, stakeholder: N, auditor: A },
  'worklog.write.own':          { superadmin: O, admin: O, manager: O, editor: O, member: O, stakeholder: N, auditor: N },
  'worklog.backfill':           { superadmin: O, admin: O, manager: O, editor: O, member: O, stakeholder: N, auditor: N },
  'worklog.correct.request':    { superadmin: A, admin: A, manager: S, editor: S, member: N, stakeholder: N, auditor: N },
  'coverage.view':              { superadmin: A, admin: A, manager: S, editor: S, member: O, stakeholder: N, auditor: A },
  // Tasks and sprints
  'task.create':                { superadmin: A, admin: A, manager: S, editor: S, member: S, stakeholder: N, auditor: N },
  'task.edit':                  { superadmin: A, admin: A, manager: S, editor: S, member: O, stakeholder: N, auditor: N },
  'task.move':                  { superadmin: A, admin: A, manager: S, editor: S, member: O, stakeholder: N, auditor: N },
  'task.delete':                { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'sprint.manage':              { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'checkin.delete':             { superadmin: A, admin: A, manager: S, editor: O, member: O, stakeholder: N, auditor: N },
  // Meetings
  'meeting.manage':             { superadmin: A, admin: A, manager: S, editor: S, member: O, stakeholder: N, auditor: N },
  'meeting.intel.view':         { superadmin: A, admin: A, manager: S, editor: S, member: S, stakeholder: S, auditor: A },
  'meeting.delete':             { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  // Deliberately no 'scoped' anywhere in this row: the seven inline checks it
  // replaces are creator-or-admin today with no managesApp arm, and a scope
  // branch here would silently widen them to every PM.
  'meeting.admin':              { superadmin: A, admin: A, manager: O, editor: O, member: O, stakeholder: N, auditor: N },
  'followup.delete':            { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  // Change requests
  'request.create':             { superadmin: O, admin: O, manager: O, editor: O, member: O, stakeholder: N, auditor: N },
  'request.withdraw':           { superadmin: O, admin: O, manager: O, editor: O, member: O, stakeholder: N, auditor: N },
  'request.review':             { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  // The one exception to separation of duties: a sole-superadmin workspace
  // could otherwise never approve anything. Logged as metadata.selfApproved.
  'request.review.self':        { superadmin: O, admin: N, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  // Absences and calendar
  'absence.create':             { superadmin: O, admin: O, manager: O, editor: O, member: O, stakeholder: N, auditor: N },
  'absence.view':               { superadmin: A, admin: A, manager: S, editor: S, member: O, stakeholder: N, auditor: A },
  'absence.approve':            { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'holiday.manage':             { superadmin: A, admin: A, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  // Trash
  'trash.view':                 { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: A },
  'trash.restore':              { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'trash.purge':                { superadmin: A, admin: N, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  // Audit and danger
  // TWO DIFFERENT QUESTIONS, deliberately two actions.
  //
  // 'activity.view' is /activity — the org's shared memory of what changed.
  // Every signed-in person sees it today and keeps seeing it; narrowing that
  // would be a product change smuggled in as plumbing. Stakeholder is the one
  // exception: a client seat must not watch the studio work.
  //
  // 'audit.view' is the admin audit surface: the same table, but unfiltered,
  // including trashed rows and self-approval metadata, with actor/entity/date
  // filters. That is a compliance instrument, not a feed.
  'activity.view':              { superadmin: A, admin: A, manager: A, editor: A, member: A, stakeholder: N, auditor: A },
  'audit.view':                 { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: A },
  'admin.view':                 { superadmin: A, admin: A, manager: A, editor: N, member: N, stakeholder: N, auditor: A },
  'danger.dbclear':             { superadmin: A, admin: N, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
} satisfies Record<string, Row>

export type Action = keyof typeof ROLE_GRANTS

/**
 * Fails closed. An `own` or `scoped` action asked without the resource it
 * needs is a denial, never an allow — a caller that forgot to pass the
 * resource must be told no rather than accidentally granted everything.
 */
/**
 * Where a role's app scope comes from.
 *
 * Lives here, beside the matrix, rather than in actor.ts: it is pure role
 * knowledge, and keeping it out of the module that imports next-auth is what
 * lets it be tested and imported anywhere.
 */
export type ScopeSource = 'none' | 'app_role_history' | 'assignments' | 'app_grants'

export function scopeSourceFor(role: UserRole): ScopeSource {
  switch (role) {
    case 'manager':
      // NOT managesApp(). That helper regex-matches the free-text
      // assignments.role string ('manager', 'pm', product owner, scrum
      // master) and returns FALSE for a lead. Scope decided by whatever
      // somebody typed into an assignment is not auditable, and auditability
      // is the whole reason these seats exist.
      return 'app_role_history'
    case 'editor':
    case 'member':
      // Deliberately a different source than manager: broader membership,
      // narrower power — edit inside the scope, request outside it.
      return 'assignments'
    case 'stakeholder':
      return 'app_grants'
    case 'superadmin':
    case 'admin':
    case 'auditor':
      return 'none'
  }
}

export function can(actor: Actor, action: Action, resource?: Resource): boolean {
  const level: GrantLevel = ROLE_GRANTS[action][actor.role]
  if (level === 'none') return false
  if (level === 'all') return true

  const owns = resource?.ownerId != null && resource.ownerId === actor.id
  if (level === 'own') return owns
  if (owns) return true

  if (resource?.appId != null && actor.scopeAppIds.has(resource.appId)) return true
  // Any-of, not all-of — see the Resource comment.
  return resource?.appIds?.some((id) => actor.scopeAppIds.has(id)) ?? false
}

/**
 * The admin FAMILY, for the handful of places that legitimately ask about a
 * label rather than a power: nav sections, badges, "who is staff".
 *
 * PREFER `can(actor, action, resource)`. If the check gates something — a
 * control, a route, a mutation — it is asking about a capability, and asking
 * about a role instead is how the two drift apart. This exists for the
 * remainder, where the question really is "is this person staff".
 *
 * It exists at all because widening the enum turned every surviving
 * `role === 'admin'` into a silent false for superadmin: still compiling,
 * still typechecking, just quietly hiding things from the highest-privilege
 * seat. A predicate makes that class of bug a one-line fix instead of a hunt.
 */
export function isAdminRole(role: UserRole): boolean {
  return role === 'superadmin' || role === 'admin'
}

/**
 * Human-readable seat names, for badges and pickers.
 *
 * Needed because a widened enum otherwise renders a superadmin's own badge as
 * whatever the old two-value ternary fell through to — reading as a demotion
 * to the person looking at it.
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  manager: 'Manager',
  editor: 'Editor',
  member: 'Member',
  stakeholder: 'Stakeholder',
  auditor: 'Auditor',
}

export function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role] ?? role
}
