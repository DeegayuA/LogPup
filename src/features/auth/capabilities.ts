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

export const EMPLOYMENT_TYPES = ['permanent', 'probation', 'trainee', 'intern', 'contract'] as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

export type Actor = {
  id: string
  role: UserRole
  /** Apps this actor reaches. Resolved once per request by `loadActor`. */
  scopeAppIds: ReadonlySet<string>
  /**
   * Where they are in their employment. OPTIONAL, and absent means
   * 'permanent' — every Actor constructed before this field existed keeps
   * behaving exactly as it did.
   */
  employmentType?: EmploymentType
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
  // Removing somebody from the workspace entirely — they can no longer sign
  // in and stop appearing anywhere work is handed out. Strictly heavier than
  // user.deactivate, which leaves the account able to sign in and be told it
  // is deactivated, so it does NOT inherit deactivate's scoped arm: a manager
  // may stand their own team down, but deciding somebody is no longer part of
  // the studio is not project work. Reversible from admin Trash, so it is
  // absent from IRREVERSIBLE_ACTIONS.
  'user.remove':                { superadmin: A, admin: A, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  'user.profile.edit':          { superadmin: A, admin: A, manager: S, editor: O, member: O, stakeholder: O, auditor: N },
  'user.password.reset':        { superadmin: A, admin: A, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  'user.role.grant':            { superadmin: A, admin: A, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  'user.role.grant.superadmin': { superadmin: A, admin: N, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  'user.schedule.edit':         { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'user.offboard':              { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  // Apps
  'app.view':                   { superadmin: A, admin: A, manager: A, editor: S, member: S, stakeholder: S, auditor: A },
  'app.create':                 { superadmin: A, admin: A, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  'app.edit':                   { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'app.archive':                { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  // Deleting is NOT archiving with a stronger word, so it does not inherit
  // archive's scoped arm. A manager retires a project they run — that is
  // project work. Removing one from the workspace entirely, along with every
  // board, meeting and comment hanging off it, is a workspace decision, and a
  // scoped seat cannot see what else depended on the app they are deleting.
  // Reversible through admin Trash, which is why it is absent from
  // IRREVERSIBLE_ACTIONS below; trash.purge is the one that ends it.
  'app.delete':                 { superadmin: A, admin: A, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  'app.assign':                 { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'app.role.assign':            { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'app.grant.stakeholder':      { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  // Bug reports. Filing is the ONE write in this file granted 'all' to a
  // member: a bug is reported by whoever hit it, and a scoped grant would
  // mean the person best placed to describe a break — someone outside the
  // project who tripped over it — is the one person who cannot say so.
  // Reading and triaging stay scoped, because a bug list is project work.
  'bug.report':                 { superadmin: A, admin: A, manager: A, editor: A, member: A, stakeholder: N, auditor: N },
  'bug.view':                   { superadmin: A, admin: A, manager: A, editor: S, member: S, stakeholder: N, auditor: A },
  // Triage is deciding a bug's severity and status on the project's behalf,
  // so it follows sprint.manage's shape rather than task.edit's.
  'bug.triage':                 { superadmin: A, admin: A, manager: S, editor: S, member: N, stakeholder: N, auditor: N },
  'bug.delete':                 { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  // Worklog. There is deliberately no worklog.write.any at any level.
  'worklog.view':               { superadmin: A, admin: A, manager: S, editor: S, member: O, stakeholder: N, auditor: A },
  'worklog.write.own':          { superadmin: O, admin: O, manager: O, editor: O, member: O, stakeholder: N, auditor: N },
  'worklog.backfill':           { superadmin: O, admin: O, manager: O, editor: O, member: O, stakeholder: N, auditor: N },
  'worklog.correct.request':    { superadmin: A, admin: A, manager: S, editor: S, member: N, stakeholder: N, auditor: N },
  // Commenting ON somebody's day, which is NOT writing it. The log stays a
  // first-person statement — there is still no worklog.write.any — and a
  // review is a second, separately attributed statement about it.
  //
  // SCOPED for manager, editor and member, and the scope SOURCE does the real
  // work: a manager's scope comes from app_role_history (the pm/lead roles),
  // an editor's and a member's from assignments. So "a lead or PM of that
  // project, or somebody working on it" falls out of the existing machinery
  // rather than needing a rule of its own.
  //
  // Auditor is 'none' on purpose: they read everything and change nothing, and
  // a review is a change. Stakeholder likewise — a client seat commenting on
  // an employee's day is a conversation that does not belong in this product.
  'worklog.review':             { superadmin: A, admin: A, manager: S, editor: S, member: S, stakeholder: N, auditor: N },
  'coverage.view':              { superadmin: A, admin: A, manager: S, editor: S, member: O, stakeholder: N, auditor: A },
  // Tasks and sprints
  'task.create':                { superadmin: A, admin: A, manager: S, editor: S, member: S, stakeholder: N, auditor: N },
  'task.edit':                  { superadmin: A, admin: A, manager: S, editor: S, member: O, stakeholder: N, auditor: N },
  'task.move':                  { superadmin: A, admin: A, manager: S, editor: S, member: O, stakeholder: N, auditor: N },
  'task.delete':                { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'sprint.manage':              { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  // Deadlines, as THREE questions rather than one, because they are three
  // different acts. Setting a working date is doing the work. Turning one into
  // a promise, and moving a promise other people have planned around, are
  // statements made on the organisation's behalf.
  //
  // `deadline.set` at 'own' resolves ownerId against tasks.assigneeId — the
  // person the work belongs to, not whoever filed it. Stated here rather than
  // left to inference: `can` fails closed on 'own' with no resource, and
  // canMoveTask already passes assigneeId as ownerId, so a caller that picks a
  // different owner source silently produces a permission bug on its first
  // ambiguous row.
  'deadline.set':               { superadmin: A, admin: A, manager: S, editor: S, member: O, stakeholder: N, auditor: N },
  'deadline.commit':            { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'deadline.move.committed':    { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
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
  // Arming, extending and cancelling a planned maintenance window — and, as
  // the same seat, writing THROUGH one. This is the spec's `isAdmin()` in the
  // form this codebase can actually enforce: `role === 'admin'` would read
  // false for a superadmin and lock the highest seat out of the switch that
  // reopens the workspace.
  //
  // Deliberately NOT granted to manager or auditor, both of whom hold
  // 'admin.view'. Seeing the admin area is not the same power as closing the
  // building, and a freeze that a manager could write through would not be a
  // freeze.
  'maintenance.manage':         { superadmin: A, admin: A, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  'danger.dbclear':             { superadmin: A, admin: N, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  // Money: rate cards, per-person rates, and every figure derived from them
  // (project cost, margin, accruals). Superadmin and admin, by the user's
  // decision.
  //
  // ONE capability for rates AND totals, deliberately. Splitting them — rates
  // restricted, totals open — reads as the safer design and is not: a cost
  // total narrowed to a single contributor IS that person's rate, whether it
  // is narrowed by a one-person project or by a date range in which only one
  // person logged. Anything computed from a rate sits behind the same gate as
  // the rate.
  //
  // No scoped arm at any level. A manager running a project does not thereby
  // acquire the right to see what their team is paid, and 'scoped' here would
  // grant precisely that to whoever happens to hold the project.
  'finance.view':               { superadmin: A, admin: A, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  // The rest of the danger zone. Each is separately grantable rather than
  // folded into danger.dbclear, because they differ in what they destroy and
  // therefore in who should hold them.
  //
  // A full backup is the only one that DESTROYS NOTHING — it is the thing you
  // do BEFORE the others — so it is the only one an admin holds too. It still
  // lives here rather than with the ordinary reads because a single file
  // containing every row in the workspace is exactly what an exfiltration
  // looks like, and the audit trail should say who took one.
  'danger.backup.export':       { superadmin: A, admin: A, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  // Emptying the bin is trash.purge applied to everything at once. Same seat
  // as trash.purge (superadmin only) — a bulk version of an irreversible act
  // must never be easier to reach than the single one.
  'danger.trash.empty':         { superadmin: A, admin: N, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  // Wiping recordings destroys the keyframes and audio segments behind every
  // AI meeting note. The notes themselves survive; the evidence for them does
  // not, which is why this is not merely "clearing a cache".
  'danger.recordings.wipe':     { superadmin: A, admin: N, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  // Emptying ONE project's board (sprints, tasks, check-ins) while keeping
  // the project, its team and its meetings. Narrower than dbclear in blast
  // radius but identical in kind, so it stays superadmin-only.
  'danger.app.reset':           { superadmin: A, admin: N, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
} satisfies Record<string, Row>

export type Action = keyof typeof ROLE_GRANTS

/**
 * Sign-off actions: deciding something on behalf of the organisation, rather
 * than doing the work. This is the set an employment stage can withhold.
 */
const APPROVAL_ACTIONS = [
  'request.review', 'absence.approve', 'user.approve', 'user.role.grant',
  'app.grant.stakeholder', 'trash.purge', 'danger.dbclear',
  'user.offboard',
  // The whole danger zone, backup included. Taking a file containing every
  // row in the workspace is a decision made on the organisation's behalf even
  // though it destroys nothing.
  'danger.backup.export', 'danger.trash.empty', 'danger.recordings.wipe',
  'danger.app.reset',
  // A read, like danger.backup.export and here for the same reason: what it
  // returns is what everybody is paid. Somebody still being taught the job, or
  // engaged for one project, holding an admin seat should not thereby see the
  // studio's salaries — and an employment stage is the only lever that can say
  // so without inventing a second seat.
  'finance.view',
  // Committing a deadline, and moving one already committed. Both are promises
  // made on the studio's behalf to somebody planning around them, which is the
  // definition this list uses — not "destructive", which neither is.
  //
  // `deadline.set` is deliberately ABSENT: choosing a working date for your own
  // task is doing the work, not deciding on the organisation's behalf, and
  // capping it would leave a trainee unable to reschedule their own task.
  'deadline.commit', 'deadline.move.committed',
] as const
// NOT trash.restore. Restoring is recovering something somebody deleted by
// mistake, and it is reversible — you can trash it again. A trainee who spots
// an accidental delete should be able to undo it. Purging is the one that
// cannot be taken back, and that is capped.

/** The subset that cannot be undone once done. */
const IRREVERSIBLE_ACTIONS = [
  'trash.purge', 'danger.dbclear', 'user.role.grant', 'user.offboard',
  // Emptying the bin, wiping recordings and resetting a board all end in rows
  // that no restore can bring back. Exporting a backup does not, so it is
  // deliberately absent.
  'danger.trash.empty', 'danger.recordings.wipe', 'danger.app.reset',
] as const

const has = (list: readonly string[], action: Action) => list.includes(action)

/**
 * What an employment stage permits, independent of the seat.
 *
 * A CAP, never a grant: the effective answer is the NARROWER of this and the
 * seat's row, so this can only ever take away. `capFor` returning 'all' means
 * "this stage withholds nothing here", not "this stage allows it".
 *
 * Each entry has a reason, because a cap that nobody can justify is a cap
 * somebody will remove:
 *
 *  - trainee, intern — no sign-off of any kind. Someone still being taught the
 *    work cannot be the person who approves other people's work.
 *  - probation — the irreversible acts only. Probation is about confidence in
 *    judgement, not competence at the job, so ordinary review stays theirs.
 *  - contract — no admitting people to the org. A contractor may run the
 *    project work; deciding who joins the studio is not project work.
 *  - permanent — nothing.
 */
export function capFor(type: EmploymentType, action: Action): GrantLevel {
  switch (type) {
    case 'permanent':
      return 'all'
    case 'trainee':
    case 'intern':
      return has(APPROVAL_ACTIONS, action) ? 'none' : 'all'
    case 'probation':
      return has(IRREVERSIBLE_ACTIONS, action) ? 'none' : 'all'
    case 'contract':
      return action === 'user.create' || action === 'user.approve'
        || action === 'user.role.grant' || action === 'danger.dbclear'
        ? 'none'
        : 'all'
  }
}

/**
 * Whether ANY employment stage withholds this action.
 *
 * Lets a capability check skip loading the employment type entirely for the
 * actions no stage can cap — which is most of them, and all the hot ones
 * (task.edit, worklog.write.own, app.view). Without this, adding the cap
 * would have put a database read in front of every permission question in the
 * app, which is the opposite of why `can` is synchronous.
 */
export function isCappable(action: Action): boolean {
  return EMPLOYMENT_TYPES.some((type) => capFor(type, action) !== 'all')
}

/**
 * Whether this seat holds ANY power an employment stage could withhold.
 *
 * Exists so the UI can say "Trainee: cannot approve anything" only where that
 * sentence is true, WITHOUT writing `role === 'admin' || role === 'manager'`
 * — which is the same silent-drift bug the predicate was introduced to kill,
 * with one more value in it.
 */
export function hasCappablePower(role: UserRole): boolean {
  return (Object.keys(ROLE_GRANTS) as Action[]).some(
    (action) => isCappable(action) && ROLE_GRANTS[action][role] !== 'none',
  )
}

const RANK: Record<GrantLevel, number> = { none: 0, own: 1, scoped: 2, all: 3 }

/** The narrower of the seat's grant and the employment cap. */
export function effectiveGrant(
  role: UserRole,
  type: EmploymentType | undefined,
  action: Action,
): GrantLevel {
  const seat = ROLE_GRANTS[action][role]
  if (!type) return seat
  const cap = capFor(type, action)
  return RANK[cap] < RANK[seat] ? cap : seat
}

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
  const level: GrantLevel = effectiveGrant(actor.role, actor.employmentType, action)
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
