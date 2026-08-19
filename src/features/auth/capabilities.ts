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

/** What is being acted on. Both fields optional; a missing one fails closed. */
export type Resource = {
  ownerId?: string | null
  appId?: string | null
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
  'worklog.correct.request':    { superadmin: S, admin: A, manager: S, editor: S, member: N, stakeholder: N, auditor: N },
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
export function can(actor: Actor, action: Action, resource?: Resource): boolean {
  const level: GrantLevel = ROLE_GRANTS[action][actor.role]
  if (level === 'none') return false
  if (level === 'all') return true

  const owns = resource?.ownerId != null && resource.ownerId === actor.id
  if (level === 'own') return owns
  if (owns) return true
  return resource?.appId != null && actor.scopeAppIds.has(resource.appId)
}
