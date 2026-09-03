import { sql } from 'drizzle-orm'
import {
  bigint,
  pgTable, pgEnum, text, uuid, integer, doublePrecision, boolean, date, timestamp,
  numeric, index, uniqueIndex, primaryKey, jsonb,
} from 'drizzle-orm/pg-core'

// The seven seats. Additive over the original admin|member: existing rows keep
// their value and their meaning until 0039 remaps admin -> superadmin, which
// is capability-preserving (today's admin can clear the database, so the
// faithful destination is the seat that still can).
//
// NOT A LADDER. Nothing compares two roles — capability lives in one matrix,
// src/features/auth/capabilities.ts, keyed by (action, role). A `role >= X`
// comparison anywhere is a bug, which is why there is no ordering to compare.
export const userRole = pgEnum('user_role', [
  'superadmin',
  'admin',
  'manager',
  'editor',
  'member',
  'stakeholder',
  'auditor',
])
// Open self-signup + admin approval. New rows default to 'pending' — the
// jwt/session gate (src/lib/auth.ts, src/proxy.ts) lets a pending user hold a
// session (so they can complete onboarding at /pending) but blocks every
// other route until an admin approves or rejects them. 'rejected' is a
// dead end: sign-in is still denied outright (see the signIn callback) —
// the status column is what /pending shows to explain that.
export const userStatus = pgEnum('user_status', ['pending', 'approved', 'rejected'])
export const appStatus = pgEnum('app_status', ['active', 'paused', 'archived'])
// Approval-gated edits. A change request closes by STATUS, never by deletion:
// 'withdrawn' is the requester closing their own, 'rejected' is a reviewer
// declining it. The row IS the audit trail, so there is nothing here a Trash
// bin should hold and no deleted_at to add.
export const changeRequestStatus = pgEnum('change_request_status', ['pending', 'approved', 'rejected', 'withdrawn'])
export const changeRequestOp = pgEnum('change_request_op', ['edit', 'delete', 'restore'])
// Why a person owed no work on a day. 'other_project' and 'no_work_assigned'
// are deliberately in here: both are real answers to "why is there no log",
// and both are the studio's problem rather than the person's, so neither may
// count against them.
// 'casual' is statutory here — Sri Lanka's Shop and Office Employees Act
// grants casual leave separately from annual — so filing it as 'annual' spent
// the wrong entitlement and filing it as 'other' made it invisible in every
// breakdown. Added by drizzle/0067.
//
// LAST IN THIS LIST, not beside 'annual' where it reads better: ALTER TYPE ...
// ADD VALUE appends, so physical enum order ends in 'casual', and this
// declaration is kept in that same order so the two cannot be compared and
// found to disagree. Display order does not come from here anyway — the picker
// reads SELF_DECLARABLE_KINDS (worklog/components/declare-absence-dialog.tsx).
//
// It carries NO BALANCE. Nothing tracks a per-person allowance for 'annual'
// either, so a quota for casual alone would leave annual the odd one out;
// entitlements are their own design.
export const absenceKind = pgEnum('absence_kind', ['annual', 'sick', 'unpaid', 'training', 'other_project', 'no_work_assigned', 'other', 'casual'])
export const absenceStatus = pgEnum('absence_status', ['pending', 'approved', 'rejected', 'withdrawn'])
// What stage of employment somebody is at. NOT a seat — user_role answers what
// they may do, this answers where they are in their career here. Kept separate
// because a trainee can be an editor and an intern can be a member; folding
// the two would turn seven seats into twenty-eight. It CAPS a seat's approval
// powers and never grants — see capFor() in features/auth/capabilities.ts.
export const employmentType = pgEnum('employment_type', ['permanent', 'probation', 'trainee', 'intern', 'contract'])
// Whether a worklog is expected from this person AT ALL, independent of which
// days they work. A supervisory seat that only assigns and monitors produces
// no daily_worklogs rows; without this they read 'missing' every working day
// forever. Zeroing their pattern is not the fix — that claims they are not
// working, and they are.
export const loggingExpectation = pgEnum('logging_expectation', ['daily', 'none'])
// What KIND of work an hour was. `task` is the task-linked case and every
// other value is real work that closes no ticket — which is the whole point:
// a day of meetings, review and support has to be expressible, or the honest
// full day of anyone doing that work computes as zero. See worklog_entries.
export const worklogEntryCategory = pgEnum('worklog_entry_category', ['task', 'meeting', 'review', 'support', 'admin', 'learning', 'other'])
// Where an entry came from. Exists so we can later measure how often an AI
// draft is accepted unedited — the only honest way to tell whether the
// drafting feature helps or merely makes work.
export const worklogEntrySource = pgEnum('worklog_entry_source', ['manual', 'ai_suggested'])
// The two roles app_role_history tracks as-of intervals for. Closed set, like
// every other "kind" column in this file, hence a pg enum rather than free
// text (contrast assignments.role / assignmentHistory.role, which are
// per-project free text and stay `text`).
export const appRoleKind = pgEnum('app_role_kind', ['pm', 'lead'])
export const sprintStatus = pgEnum('sprint_status', ['planned', 'active', 'done'])

// How badly something is broken, as judged by whoever triages it — NOT by the
// reporter, who is asked to describe what happened rather than rate it. Four
// levels, because a fifth is where a severity scale stops being read.
export const bugSeverity = pgEnum('bug_severity', ['low', 'medium', 'high', 'critical'])
// 'triaged' is its own state, separate from 'in_progress', because the
// question a reporter actually asks is "has anyone looked at this yet?" —
// unanswerable if acknowledging a bug and starting work on it are one event.
export const bugStatus = pgEnum('bug_status', [
  'open', 'triaged', 'in_progress', 'resolved', 'closed',
])
// Two values, deliberately not three: a 'soft' middle would be a synonym for
// 'target' that lets somebody avoid naming a counterparty while still looking
// serious. See docs/superpowers/specs/2026-08-20-deadlines-and-bugs-design.md.
export const dueKind = pgEnum('due_kind', ['target', 'committed'])
export const taskStatus = pgEnum('task_status', ['todo', 'in_progress', 'done'])
// 'system' is the workspace talking about itself rather than a person talking
// to a person — today only the maintenance lifecycle writes one. It is a third
// enum value rather than a reuse of 'meeting' because both notification
// surfaces pick their icon off this column, and a maintenance notice wearing a
// calendar icon reads as a meeting invite.
export const notificationType = pgEnum('notification_type', ['mention', 'meeting', 'system'])
export const attendeeResponse = pgEnum('attendee_response', ['pending', 'going', 'maybe', 'declined'])
export const followupKind = pgEnum('followup_kind', ['question', 'action'])
export const followupStatus = pgEnum('followup_status', ['open', 'resolved'])
export const noteSource = pgEnum('note_source', ['typed', 'voice', 'ai'])
export const suggestionStatus = pgEnum('suggestion_status', ['open', 'accepted', 'dismissed'])
export const allocationChange = pgEnum('allocation_change', ['assigned', 'updated', 'removed'])
// Mirrors allocationChange one-for-one for meeting membership. Separate only
// because "assigned to a meeting" reads wrong; the three states, the interval
// algebra and the tombstone rule are the same pattern (see
// meetingAttendeeHistory below).
export const attendanceChange = pgEnum('attendance_change', ['added', 'updated', 'removed'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  title: text('title'),
  // Contact number for the call button on People / person detail. Stored as
  // the user typed it (display form); tel: links use the digits-only form
  // computed by src/lib/phone.ts.
  phone: text('phone'),
  // Second, contact-only address (typically a personal gmail when `email` is
  // the company one). Deliberately NOT unique and NOT domain-gated: it is
  // never an identity. Every sign-in path — Google, password, Notion — looks
  // up `email` and only `email`, so nothing stored here can become a second
  // way into an account.
  personalEmail: text('personal_email'),
  // Their GitHub username, self-set from /profile. Same class as phone and
  // personalEmail: contact/profile metadata, NEVER identity — no sign-in path
  // reads it, so nothing stored here can become a way into an account. It
  // exists so the GitHub App integration (src/features/github) can ask "whose
  // commits are these" without per-user OAuth tokens.
  githubLogin: text('github_login'),
  role: userRole('role').notNull().default('member'),
  /**
   * What this seat may spend on AI per calendar month, in USD.
   *
   * NUMERIC, NOT a float, and read back as a string by the driver for that
   * reason: money compared against a threshold must not carry binary rounding
   * error, and this is the one comparison in the product that decides whether
   * somebody is allowed to work.
   *
   * ZERO MEANS NO AI, never unlimited — see budgetState(), which refuses the
   * division that would otherwise turn a cap of nothing into a cap of
   * everything. Defaults to DEFAULT_AI_BUDGET_USD; an admin raises it per
   * person.
   */
  aiBudgetUsd: numeric('ai_budget_usd', { precision: 10, scale: 2 }).notNull().default('10.00'),
  active: boolean('active').notNull().default(true),
  // Admin-approval gate for self-signup (see src/lib/auth.ts signIn callback).
  // Every row inserted by an admin (createUser) or by a provider that already
  // required an existing row (Notion, password) is backfilled/created as
  // 'approved' — only a brand-new Google self-signup lands as 'pending'.
  status: userStatus('status').notNull().default('pending'),
  passwordHash: text('password_hash'),
  // Set when an admin creates the account with the shared starter password;
  // cleared the moment the user sets their own (see setOwnPassword). While
  // true, the proxy pins the user to /profile so the starter password never
  // survives past first sign-in.
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  // Free-form organization labels (client/team names) an admin pins on a user.
  orgTags: text('org_tags').array().notNull().default([]),
  googleRefreshToken: text('google_refresh_token'),
  /**
   * What we last OBSERVED about this person's Google grant — never a guess.
   *
   * `google_refresh_token` is one nullable column, so it cannot tell "never
   * connected" from "revoked" from "signed in but left the Calendar box
   * unticked on Google's granular consent screen". describeCalendarError
   * already knows how to make that distinction AFTER a failure; this is what
   * lets anything ask BEFORE one.
   *
   * Defaults to 'unknown', never 'ok'. A status column defaulting to the good
   * state asserts something nobody checked, and the first feature built on top
   * would trust it. Existing token holders backfilled to 'unknown' for exactly
   * that reason; rows with no token at all backfilled to 'none', which is a
   * fact rather than an absence of one.
   *
   * TWO RULES that matter more than the column: a 5xx NEVER downgrades anyone
   * (Google being down for ten minutes must not mark the whole workspace
   * broken, a state that would then sit there being wrong), and 'unknown' must
   * never render as "fine".
   *
   * `text` plus a TS union rather than a pgEnum — the repo's standing reason
   * (Postgres forbids using a freshly ADD VALUE'd member in the same
   * transaction) applies, and activity_log.verb set the precedent.
   */
  googleTokenStatus: text('google_token_status')
    .$type<'none' | 'unknown' | 'ok' | 'invalid_grant' | 'insufficient_scope' | 'api_disabled'>()
    .notNull()
    .default('unknown'),
  /** Space-separated scopes Google actually granted, written from
   *  `account.scope` on every Google sign-in. This is what makes an unticked
   *  Calendar checkbox detectable at sign-in rather than at first failure. */
  googleScopes: text('google_scopes'),
  /** When googleTokenStatus was last written from an observation. */
  googleCheckedAt: timestamp('google_checked_at'),
  // Alternate names/initials this person is known by elsewhere in the data
  // (meeting transcripts, follow-up authors, AI notes) — e.g. "W.A.D.N. Perera"
  // stored here as an alias for a user named "Nuwan". matchPersonToAttendee
  // (src/features/meetings/followups.ts) only ever compares against
  // users.name's first whitespace-split token, so a name recorded in any
  // other form silently never matches without an entry here. Admin-set only;
  // nullable/no default because most users need none.
  aliases: text('aliases').array(),
  // What stage of employment this person is at. NOT a seat: user_role answers
  // what they may do. This CAPS their seat's sign-off powers and never grants
  // — a trainee manager cannot approve, a permanent member is unaffected.
  // See capFor() in features/auth/capabilities.ts.
  employmentType: employmentType('employment_type').notNull().default('permanent'),
  // Who mentors them. Required by the action for trainee and intern, optional
  // otherwise — deliberately not a check constraint, which would make CHANGING
  // someone's employment type able to fail, and mentorship is not a
  // data-integrity fact.
  supervisorId: uuid('supervisor_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const apps = pgTable('apps', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  // Ours rather than a client's. Defaults to false, which describes every
  // existing row correctly: a project nobody has marked internal is a client
  // project, and that is what all of them are today. Read by the cost and
  // worth surfaces, which must not bill an internal project to anybody.
  internal: boolean('internal').notNull().default(false),
  description: text('description'),
  status: appStatus('status').notNull().default('active'),
  repoUrl: text('repo_url'),
  techTags: text('tech_tags').array().notNull().default([]),
  leadId: uuid('lead_id').references(() => users.id),
  // Project manager. Unlike leadId, this is required — every app must have
  // one (enforced both by this NOT NULL and by the create/update zod schemas
  // in features/apps/create-input.ts / update-input.ts). Migration 0033
  // added it nullable, backfilled it from lead_id, then locked it NOT NULL —
  // safe because every app already had a lead at that point.
  pmId: uuid('pm_id').notNull().references(() => users.id),
  // Soft delete, the sixth table to carry it — and the first whose children
  // (sprints, tasks, meetings, assignments, comments) all cascade on a HARD
  // delete. That is exactly why deleting an app had to become soft: the only
  // removal available before this was a hard DELETE of the row, which took
  // the whole project history with it and left admin Trash nothing to
  // restore.
  //
  // NOT the same thing as `status = 'archived'`. Archiving retires an app
  // that still exists — it stays readable, keeps its board, and appears
  // deliberately in an "include archived" view. A deleted app is gone from
  // every read: index, detail, search, dashboards, calendars. The two are
  // independent columns because an archived app can still be deleted, and a
  // restored one must come back exactly as archived as it went in.
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  // Every list read is "live apps, by name", so the partial index is the one
  // that matters — a full-table index would carry deleted rows that no such
  // query ever wants.
  index('apps_live_name_idx').on(t.name).where(sql`${t.deletedAt} is null`),
])

// Append-only "as of" index of who has held PM or lead on an app, and when.
// Exactly the assignment_history pattern below, applied to apps.pmId /
// apps.leadId — read that comment first; this one only records where the two
// differ.
//
// apps.pmId / apps.leadId stay THE live state, untouched, for the same
// reason assignments did: every existing read path keeps working with no new
// filter to remember. Without this sibling, updateApp overwrote pmId/leadId
// IN PLACE and every prior holder was lost — only an activity_log row said a
// change had happened (see the write path in features/apps/actions.ts),
// which cannot answer "who was PM on 12 June" from one indexed query.
//
// SHAPE — one row per (appId, role) *interval*, half-open [from, to), with AT
// MOST ONE open row per (appId, role) — narrower than assignment_history's
// (userId, appId) key, because a role here is a single scalar column on
// `apps` (there is one pm and at most one lead at a time), not a set of
// allocations.
//
// NO changeKind/tombstone column, unlike assignment_history and
// meeting_attendee_history. Neither role has a summed quantity a stale value
// could corrupt, and leadId — the only one of the two that can go back to
// "nobody" — is fully described by a CLOSED row with nothing reopened after
// it: appRoleAsOf finds no row covering that instant and correctly reports no
// lead, with no special case required. The "who cleared it" fact still lives
// where it always has, the activity_log row updateApp already writes.
//
// changedBy is the admin (or managing PM) who opened that interval — who put
// this person in the role, not who removed the previous holder (that stays
// on the row that names the removal in activity_log). Backfilled rows (see
// migration 0034) carry note = BACKFILLED_APP_ROLE_NOTE ('backfilled at
// migration', declared in features/apps/role-history.ts) — a fixed sentinel
// rather than a description, so a consumer can tell "we watched this happen"
// from "we assumed this at migration time" with a plain equality check. This
// project has been burned by the alternative once already: migration 0015
// backfilled assignment_history with an inferred effective_from
// indistinguishable from an observed one, and a whole planned feature had to
// drop as-of allocation as untrustworthy as a result.
export const appRoleHistory = pgTable('app_role_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  appId: uuid('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: appRoleKind('role').notNull(),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  changedBy: uuid('changed_by').notNull().references(() => users.id),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Per-app timeline: "who has been PM/lead of this app, and when".
  index('app_role_history_app_from_idx').on(t.appId, t.effectiveFrom),
  // Per-person view: "which apps has this person been PM/lead of, and when".
  index('app_role_history_user_from_idx').on(t.userId, t.effectiveFrom),
  // "As of" lookups filter on the interval bounds alone, same shape as
  // assignment_history_as_of_idx.
  index('app_role_history_as_of_idx').on(t.effectiveFrom, t.effectiveTo),
  // The "AT MOST ONE open row per (appId, role)" invariant above, enforced
  // rather than only documented — same guard, declared the same way, as
  // assignment_history_one_open_idx. A second open interval for the same
  // (app, role) would make an "as of" read ambiguous about who held it.
  uniqueIndex('app_role_history_one_open_idx')
    .on(t.appId, t.role)
    .where(sql`${t.effectiveTo} is null`),
])

export const assignments = pgTable('assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  appId: uuid('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  allocationPct: integer('allocation_pct').notNull(),
}, (t) => [uniqueIndex('assignments_user_app_idx').on(t.userId, t.appId)])

// Append-only audit of who was allocated to what, and when. `assignments` is
// deliberately left untouched as THE live state — every existing read path
// keeps working with no new filter to remember (the class of bug that once
// silently leaked rows here). This table is written alongside it and is only
// ever read by the history/"as of" surfaces.
//
// SHAPE — one row per (userId, appId) *interval*, half-open [from, to):
//   effectiveTo NULL  = still the state as of now
//   effectiveTo set   = superseded at that instant by the next row, whose
//                       effectiveFrom is the identical timestamp (both are
//                       written from one JS `Date` in a single db.batch, so
//                       the intervals abut exactly and never overlap).
// The invariant is therefore: AT MOST ONE open row per (userId, appId).
//
// REMOVAL SEMANTICS (one of the two options, chosen and applied everywhere):
//   a removal CLOSES the open row and INSERTS a tombstone — changeKind
//   'removed' with allocationPct 0, left open. It is *not* close-only. Two
//   reasons: (1) the timeline needs an event carrying who removed it and
//   when — a close-only write records the instant but not the actor; (2) the
//   "as of" query stays one uniform rule ("the row open at the date wins")
//   with no special case for "no open row", because an unassigned person is
//   represented explicitly as 0%. Callers must therefore drop changeKind
//   'removed' rows from any *breakdown* list — they contribute 0 to totals
//   and must not render as an app chip. See selectRowsAsOf / capacityAsOf in
//   src/features/people/allocation-history.ts, which own that rule.
//
// changedBy is the admin who made the change. Backfilled rows (see migration
// 0015) carry the app's lead, or the oldest admin as a fallback, plus a note
// saying so — they are the only rows whose actor is inferred rather than
// observed.
export const assignmentHistory = pgTable('assignment_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  appId: uuid('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  allocationPct: integer('allocation_pct').notNull(),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  changedBy: uuid('changed_by').notNull().references(() => users.id),
  changeKind: allocationChange('change_kind').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Person timeline (/people/[id]) and the per-person trend.
  index('assignment_history_user_from_idx').on(t.userId, t.effectiveFrom),
  // Per-app history.
  index('assignment_history_app_from_idx').on(t.appId, t.effectiveFrom),
  // "As of" lookups: the whole-team scan filters on the interval bounds, so
  // this covers `effective_from <= $at AND (effective_to IS NULL OR
  // effective_to > $at)` without touching userId/appId first.
  index('assignment_history_as_of_idx').on(t.effectiveFrom, t.effectiveTo),
  // The "AT MOST ONE open row per (userId, appId)" invariant above, enforced
  // rather than only documented. capacityAsOf sums every in-force row, so a
  // second open interval for one pairing silently DOUBLES that person's
  // allocation on every historical page — a wrong number, not an error.
  // Partial (open rows only): closed intervals for the same pairing are the
  // normal case and must stay unconstrained.
  uniqueIndex('assignment_history_one_open_idx')
    .on(t.userId, t.appId)
    .where(sql`${t.effectiveTo} is null`),
])

export const sprints = pgTable('sprints', {
  id: uuid('id').primaryKey().defaultRandom(),
  appId: uuid('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  goal: text('goal'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  status: sprintStatus('status').notNull().default('planned'),
  notionPageId: text('notion_page_id'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by').references(() => users.id),
  // Roadmap row order, independent of date order — a lead can drag-reorder
  // rows without changing a sprint's actual dates. Seeded chronologically by
  // migration 0019 (per app_id, by start_date) so nothing visibly moves the
  // day this column is introduced; `resortSprintsByDate` re-runs that same
  // seed on demand.
  sortOrder: integer('sort_order').notNull().default(0),
})

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  appId: uuid('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
  sprintId: uuid('sprint_id').references(() => sprints.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  status: taskStatus('status').notNull().default('todo'),
  assigneeId: uuid('assignee_id').references(() => users.id),
  priority: integer('priority').notNull().default(0),
  // FRACTIONAL RANK, not a dense index. Widened from `integer` to
  // `double precision` in migration 0020 so a reorder is ONE update of ONE
  // row (the midpoint between its two new neighbours) instead of renumbering
  // every task below it. An integer column cannot express that midpoint once
  // neighbours are adjacent, which is why the old code had to fall back to
  // re-spreading the column — the exact renumber this avoids. The rank math
  // (and the precision-exhaustion guard that DOES trigger a rebalance, after
  // ~50 splits at one spot) lives in src/features/sprints/task-rank.ts.
  //
  // Reads MUST still order by (sort_order, created_at, id): the DB default is
  // 0 and writers outside the board (the ⌘K quick-add) insert at 0, so ties
  // are normal and a bare `ORDER BY sort_order` returns them in whatever order
  // Postgres feels like — a board that reshuffles itself between renders.
  sortOrder: doublePrecision('sort_order').notNull().default(0),
  // Plain calendar day, no time: set from phrases like "today" / "friday" in
  // the ⌘K natural-language quick-add (see src/lib/task-intent.ts).
  //
  // Compared as a YYYY-MM-DD STRING against a business-timezone today, never
  // parsed into a Date — see task-workload.ts, which documents why:
  // `new Date('2026-08-12')` is midnight UTC, still the 11th west of
  // Greenwich. Do not "improve" this into a timestamp; that request is
  // refused on purpose in the deadlines spec.
  dueDate: date('due_date'),
  // WHAT KIND OF DATE THIS IS, because one column meant two incompatible
  // things: a date somebody jotted into quick-add, and a date the studio
  // promised a client. Every reader (dueState, isOverdue, the app overdue
  // counts, the dashboard tiles) reads `due_date` exactly as before; this only
  // says whether breaking it breaks a promise. Defaults to 'target' so no
  // existing row is retroactively turned into a commitment.
  dueKind: dueKind('due_kind').notNull().default('target'),
  // Who it was promised to, in words. Required by the action layer when
  // dueKind is 'committed' — not by a CHECK, because the rule belongs with the
  // capability that enforces it. The promises view shows this as its primary
  // column, so a commitment naming nobody looks empty, because it is.
  dueCommitmentNote: text('due_commitment_note'),
  // Written ONCE, on the first null -> non-null transition, and never again:
  // not on a move, a clear, a restore, or a reassignment. Those are precisely
  // the operations that destroy every other answer to "what did we originally
  // say", which is why this is a column rather than a derivation.
  originalDueDate: date('original_due_date'),
  // A RECOMPUTABLE CACHE over activity_log, never the record — when the two
  // disagree, activity_log wins. Increments only on non-null -> DIFFERENT
  // non-null, so first-set and clear both leave it alone.
  dueChangedCount: integer('due_changed_count').notNull().default(0),
  // WHEN it was finished, as opposed to `status` saying THAT it is.
  //
  // NULL on every row that predates this column, and that is the honest value:
  // nothing recorded when those tasks were completed, and backfilling from
  // `updated_at` would invent a completion time indistinguishable from a real
  // one ever after. For anything older, activity_log's 'completed' verb
  // remains the answer — and stays the authority where the two disagree, the
  // same precedence rule due_changed_count already documents.
  //
  // Set on entry to 'done' and CLEARED on reopen, by transitionTaskStatus and
  // nothing else. A status write that bypasses it leaves this column lying.
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by').references(() => users.id),
}, (t) => [
  // Covers the board's only read: filter (app_id, sprint_id), order by rank.
  // `tasks` had no index at all, so every board render was a full scan + sort.
  index('tasks_app_sprint_sort_idx').on(t.appId, t.sprintId, t.sortOrder).where(sql`${t.deletedAt} is null`),
  // "What is on this person's plate, soonest first" — the read behind every
  // deadline surface in the product, and it had nothing. Partial on the two
  // conditions every one of those reads already carries.
  index('tasks_assignee_due_idx')
    .on(t.assigneeId, t.dueDate)
    .where(sql`${t.deletedAt} is null and ${t.status} <> 'done'`),
])

// One task, several people.
//
// ADDITIVE OVER tasks.assignee_id, which is UNCHANGED and still means "the
// accountable person" — the single name board-view, task-workload, app-health
// and the dashboard tiles read, none of which change. This table is the FULL
// set and ALWAYS CONTAINS that person: migration 0064 backfills every existing
// assignee_id into it, so "everyone on it" is a join here and "whose is it" is
// still the column read it always was.
//
// Dropping assignee_id instead would mean rewriting every one of those readers
// in the same commit as a schema change, on a database where migrations are
// applied by hand. That is the version of this change that breaks production.
//
// Composite primary key, same shape and the same reasons as meetingAttendees:
// the key IS the invariant (a person is on a task at most once, so a
// double-submit from the picker is a no-op rather than a duplicate) and it is
// the access path for the dominant read, "who is on this task".
// task_assignees_user_idx serves the reverse direction, "what is this person
// on" — the workload and my-work read, which runs per page load per person —
// and gives the user_id foreign key an index to check against.
//
// NO deletedAt, deliberately — meetingAttendees and meetingApps answered the
// identical question the same way. Taking somebody off a task loses no
// content and the row's absence IS the fact; who removed whom and when is
// already activity_log's job. Liveness is the task's: these rows carry no
// state of their own, so a soft-deleted task keeps its people and restoring it
// brings them back untouched.
export const taskAssignees = pgTable('task_assignees', {
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  // Ordering the chips by when somebody joined the task beats ordering by
  // name: it keeps the person who was there first in the first slot.
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  // Nullable: the rows the 0064 backfill created had no actor, and inventing
  // one would attribute an assignment to somebody who never made it.
  addedBy: uuid('added_by').references(() => users.id),
}, (t) => [
  primaryKey({ columns: [t.taskId, t.userId] }),
  index('task_assignees_user_idx').on(t.userId),
])

/**
 * A recurring meeting's RULE, and the standing template its occurrences are
 * stamped from.
 *
 * Occurrences are REAL `meetings` rows, materialised ahead of time and linked
 * back here by `meetings.series_id`. They are not computed at read time, and
 * that is the load-bearing decision of this whole feature: fourteen tables
 * reference `meetings.id` — notes, recordings, keyframes, tasks, attendance —
 * and there is nowhere to attach a recording to a row that does not exist.
 * Materialising means moving one occurrence is `updateMeeting` and cancelling
 * one is the soft delete that already exists, rather than an exception model
 * invented for the purpose.
 *
 * The rule itself lives in `features/meetings/recurrence.ts`, which is pure
 * and tested; this table is only its storage.
 */
export const meetingSeries = pgTable('meeting_series', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Title every new occurrence is created with. Renaming ONE occurrence does
   *  not come back here — that edit is about that meeting, not the rule. */
  title: text('title').notNull(),
  appId: uuid('app_id').references(() => apps.id, { onDelete: 'set null' }),
  agenda: text('agenda'),
  meetingUrl: text('meeting_url'),
  freq: text('freq').$type<'daily' | 'weekly' | 'monthly'>().notNull(),
  /** Every N days/weeks/months. */
  interval: integer('interval').notNull().default(1),
  /** Weekly only. 0 = Sunday. Empty means "the anchor's own weekday". */
  byWeekday: integer('by_weekday').array().notNull().default([]),
  monthlyMode: text('monthly_mode').$type<'day-of-month' | 'nth-weekday'>(),
  /**
   * The zone the wall clock below is expressed in.
   *
   * Stored as minutes-past-local-midnight PLUS a zone, never as an instant. A
   * 09:00 standup kept as a UTC instant drifts an hour the moment anyone
   * crosses a DST boundary. Colombo has no DST, which is exactly why that bug
   * would ship silently and surface only when someone travels.
   */
  timeZone: text('time_zone').notNull().default('Asia/Colombo'),
  startMinutes: integer('start_minutes').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  /** First candidate day, local. Also fixes the phase of every interval, and
   *  for monthly rules it is what decides WHICH day of the month is meant. */
  anchorDate: date('anchor_date').notNull(),
  /** Inclusive last day, local. Null is open-ended — the horizon top-up keeps
   *  it filled rather than the series ever running dry. */
  untilDate: date('until_date'),
  calendarOrganiserId: uuid('calendar_organiser_id').notNull().references(() => users.id),
  googleCalendarId: text('google_calendar_id').notNull().default('primary'),
  autoAssignTasks: boolean('auto_assign_tasks').notNull().default(true),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  // Soft delete: reads go through src/db/live.ts; enforcement is src/db/live.test.ts.
  // Trashing a series does NOT trash the meetings it created — see
  // meetings.seriesId, which is `set null` for the same reason.
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by').references(() => users.id),
})

/**
 * The STANDING invite list — who is on the series, as opposed to who is on
 * one occurrence of it.
 *
 * Not derivable from "whoever was on the last occurrence". That reading makes
 * a one-off guest permanent and makes removing someone from a single week
 * silently remove them from every week after it. Editing an occurrence's
 * attendees stays local to that meeting; editing the series edits this.
 */
export const meetingSeriesAttendees = pgTable('meeting_series_attendees', {
  seriesId: uuid('series_id').notNull().references(() => meetingSeries.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  optional: boolean('optional').notNull().default(false),
}, (t) => [primaryKey({ columns: [t.seriesId, t.userId] })])

export const meetings = pgTable('meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  // DEPRECATED as the answer to "which projects is this meeting on" — that is
  // `meeting_apps` now (many-to-many, every project equal, no primary). NOT
  // DEAD, DO NOT DROP: change-request routing (change_requests.app_id) needs
  // one stable, primary-ish project id for a meeting without resolving a set,
  // and this column is it. It is still maintained by every meeting write:
  // setMeetingApps/createMeeting/updateMeeting keep it inside the meeting's
  // project set — unchanged while it is still a member, otherwise the first of
  // the new set (or null when the set is empty). Read it ONLY where one id is
  // genuinely required; anything that shows a project to a person, or gates
  // permission, must read the set.
  appId: uuid('app_id').references(() => apps.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at').notNull(),
  agenda: text('agenda'),
  notes: text('notes'),
  // Who may SEE this meeting outside its own attendee list. 'workspace' is
  // every signed-in teammate (the pre-0062 behaviour, and the default);
  // 'attendees' hides it from every list, calendar, search index and AI
  // grounding pack for anyone not on it — a quick note is 'attendees' from
  // birth. Enforced at the read layer through meetingVisibleTo
  // (src/features/meetings/visibility.ts); visibility.test.ts enumerates the
  // readers the way live.test.ts enumerates raw reads, so a new query cannot
  // skip the check silently.
  visibility: text('visibility', { enum: ['workspace', 'attendees'] })
    .notNull()
    .default('workspace'),
  // "We'll pick this up on Thursday at 3." Recorded from a meeting that has
  // just ENDED, so the deadlines coming out of it have something to hang off:
  // a task agreed here is, by default, due by the next one.
  //
  // NOT A MEETING ID, and it references nothing on purpose — the meeting it
  // describes usually does not exist yet. There is already a separate notion
  // of "your next meeting" (moveFollowupsToNextMeeting in
  // features/meetings/followup-move-actions.ts) which resolves, per person,
  // the earliest meeting they are actually on. That answers "where will I next
  // see this person"; this answers "when did this room agree to reconvene".
  // The two are allowed to disagree and neither is derived from the other.
  //
  // Timezone-aware, unlike starts_at/ends_at above. Those are bare timestamps
  // predating the Asia/Colombo convention this app now runs on (lk-holidays.ts,
  // working-days.ts — all day maths is business-timezone, never UTC slicing).
  // A new column has no legacy to match, so it stores an unambiguous instant.
  // Do not "make it consistent" by dropping the timezone.
  nextMeetingAt: timestamp('next_meeting_at', { withTimezone: true }),
  // Video-call link (Meet/Zoom/etc.) for one-click join. Optional.
  meetingUrl: text('meeting_url'),
  googleEventId: text('google_event_id'),
  /**
   * WHOSE calendar this meeting lives on — deliberately NOT `created_by`.
   *
   * Every calendar write resolves a refresh token, and all three call sites
   * resolved it from `created_by`. That made each of them a single point of
   * failure on one person's PERSONAL Google account: deactivate them and every
   * future meeting they created becomes unpatchable and uncancellable at once,
   * because the offboarding gate counts assignments, roles and tasks — not
   * meetings.
   *
   * Reassigning `created_by` instead would have been cheaper and wrong: that
   * is the authorship fact activity_log was written against and the meeting
   * detail renders. Migration 0034_app_role_history exists in this repo
   * precisely because overwriting a historical holder in place destroys the
   * answer to "who held this on 12 June". The same mistake one table over is
   * not cheaper.
   *
   * Backfilled to `created_by`, which is what makes the column safe to ship
   * ahead of the handover action that will move it: on the day it landed the
   * two were equal and behaviour was byte-for-byte unchanged.
   */
  calendarOrganiserId: uuid('calendar_organiser_id')
    .notNull()
    .references(() => users.id),
  /** Which Google calendar to write to. 'primary' is the organiser's own; a
   *  shared studio calendar is the cheap eighty percent of removing the
   *  personal-account SPOF. No picker yet — a second organiser patching an
   *  event they did not create gets a 403 that is NOT the insufficient-scope
   *  403, and mislabelling it is how a fixable permission problem becomes
   *  "Google is broken". */
  googleCalendarId: text('google_calendar_id').notNull().default('primary'),
  /** Sticky result of the last calendar write. The yellow banner on save is a
   *  good sentence but it is not a record: today a dead token produces the same
   *  toast on every save until everyone clicks past it, and six weeks later
   *  nobody knows which meetings guests can actually see. */
  calendarSyncState: text('calendar_sync_state').$type<'ok' | 'failed' | 'stale'>(),
  calendarSyncedAt: timestamp('calendar_synced_at'),
  /** A classification KEY from classifyCalendarError, never a rendered
   *  sentence — LogPup's surfaces are bilingual, and a sentence written at
   *  failure time is a permanent decision about a reader whose language is not
   *  known until read time. */
  calendarError: text('calendar_error').$type<
    'invalid_grant' | 'api_disabled' | 'insufficient_scope' | 'bad_credentials' | 'not_found' | 'unavailable' | 'refused'
  >(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  // Per-meeting override for the auto-assign pipeline (see notes.ts
  // shouldAutoAssign / MAX_AUTO_TASKS_PER_MEETING and the auto-accept pass
  // in ai-actions.ts persistMeetingAnalysis). Default ON, so full-auto is
  // the out-of-the-box behaviour; only the meeting's creator or an admin can
  // flip it (setMeetingAutoAssignTasks). Lives on `meetings` rather than
  // `meetingAiNotes` because it is meeting-level configuration a person can
  // set before any analysis has ever run — `meetingAiNotes` only gets a row
  // once the first analysis completes.
  autoAssignTasks: boolean('auto_assign_tasks').notNull().default(true),
  // Soft delete: reads go through src/db/live.ts; enforcement is src/db/live.test.ts.
  // skip = deletedAt IS NOT NULL. Children of a trashed meeting are live-iff-meeting-live
  // (derived, no columns).
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by').references(() => users.id),
  // RECURRENCE COLUMNS (series_id, occurrence_key) ARE HELD BACK until
  // drizzle/0056_recurring_meetings.sql has been applied. Drizzle selects every
  // declared column, so declaring them against a database that lacks them
  // breaks EVERY meetings read for every session sharing this tree. Restore
  // from the scratchpad patch the moment `npm run db:migrate` has run.
}, (t) => [
  index('meetings_starts_live_idx').on(t.startsAt).where(sql`${t.deletedAt} is null`),
])

export const meetingAttendees = pgTable('meeting_attendees', {
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // RSVP state — the attendee marks whether they're coming.
  response: attendeeResponse('response').notNull().default('pending'),
  // required = row optional:false (default); optional = row optional:true;
  // skip = no row at all (see the attendee recommender design spec). A real,
  // visible invite property — plumbed through to the .ics ROLE parameter
  // (features/meetings/ics.ts) and the Google Calendar attendee payload
  // (features/calendar/google-calendar.ts), not just stored and ignored.
  optional: boolean('optional').notNull().default(false),
}, (t) => [primaryKey({ columns: [t.meetingId, t.userId] })])

// meetingId/userId/surface union: which of the four attendee-recommender
// surfaces (scheduling, pre-meeting, retrospective, inferred series) most
// recently computed this row. A plain text column with a TS union, not a
// pgEnum — see the file-level comment on activityLog.verb/entityType: a new
// surface is a new string at a call site, not a migration, and Postgres
// forbids using a freshly ADD VALUE'd enum member in the same transaction
// that added it, which matters on a database where migrations are already
// applied by hand.
export type MeetingAttendeeRecommendationSurface = 'schedule' | 'pre' | 'retro' | 'series'
// Same reasoning as `surface` above — the tier vocabulary is scorer-owned,
// not a fixed set the database should gate.
export type MeetingAttendeeRecommendationTier = 'required' | 'optional' | 'skip'

// One row per (meetingId, userId) — see the uniqueIndex below — upserted by
// the scoring engine (attendee-score.ts, not part of this migration) as it
// reruns across surfaces; `surface` records which run last wrote the row.
// neon-http has no transactions (db.batch only), so this table is always
// written via ON CONFLICT DO UPDATE, never a read-then-write pair.
//   score / scoreDet   points_total / points_det from the absolute 100-point
//                      ledger (see the design spec's Section 2) — scoreDet
//                      is what the required-tier threshold is evaluated
//                      against, score includes the AI's A1 signal.
//   reasons            the full, organizer/admin-only reason ledger backing
//                      `score`; the redaction projector (recommendation-view.ts,
//                      not part of this migration) derives what a non-privileged
//                      viewer sees from this rather than storing two copies.
//   aiOverride/aiOverrideRejected  the Gemini validator's proposed one-tier-
//                      upward move, and — separately — a proposal that failed
//                      validation or the override bounds, kept for audit.
//   status             reuses suggestionStatus (open|accepted|dismissed) —
//                      identical accepted-by-a-human/dismissed-stays-dismissed
//                      shape as meetingTaskSuggestions, not a boolean, for the
//                      same reason documented on that table.
export const meetingAttendeeRecommendations = pgTable('meeting_attendee_recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  surface: text('surface').notNull().$type<MeetingAttendeeRecommendationSurface>(),
  score: integer('score').notNull(),
  scoreDet: integer('score_det').notNull(),
  tier: text('tier').notNull().$type<MeetingAttendeeRecommendationTier>(),
  hardEvidenceCount: integer('hard_evidence_count').notNull(),
  reasons: jsonb('reasons'),
  aiOverride: jsonb('ai_override'),
  aiOverrideRejected: jsonb('ai_override_rejected'),
  status: suggestionStatus('status').notNull().default('open'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('meeting_attendee_recs_meeting_user_idx').on(t.meetingId, t.userId),
  index('meeting_attendee_recs_meeting_surface_idx').on(t.meetingId, t.surface),
])

// Decisions about meeting-load suggestions. The engine's only table.
//
// OPEN SUGGESTIONS ARE NOT STORED, and that is the whole design. Every
// suggestion is an assertion about live work ("these four items need the same
// five people"). The moment one is written down it starts rotting: the
// follow-up is answered, the task is ticked, the deadline moves, and the row
// on screen keeps insisting otherwise. So suggestions are computed live on
// every render and only DECISIONS persist — the same doctrine planner.ts
// states for asks ("a stale ask-list is worse than none").
//
//   kind        which rule produced the suggestion — 'cover_together' today,
//               R1-R5 later. TEXT, not a pgEnum, per the activityLog
//               precedent: each further rule would otherwise cost a migration,
//               and ALTER TYPE ... ADD VALUE cannot be used in the transaction
//               that added it (see 0037, 0053).
//   targetKey   the suggestion's stable identity. R6 builds it in
//               coverage.ts's coverageTargetKey; the shape is documented
//               there, and it is stable across runs precisely so a dismissal
//               sticks.
//   status      REUSES suggestionStatus rather than minting an enum. Rows only
//               ever hold 'accepted' or 'dismissed' — 'open' is what it means
//               for no row to exist, and storing it would create a second,
//               contradictable answer to "is this still open". No default, for
//               the same reason: every write states which it is.
//   evidence    a snapshot of the numbers that were on screen when somebody
//               decided. IDS ONLY, never names — a dismissed group must not
//               become a place somebody's name is kept after they are gone.
//   decidedBy   set null rather than cascade: removing an account should not
//               silently un-dismiss everything that account ever dismissed.
//
// The unique index on (kind, targetKey) IS the never-re-show guarantee — the
// renderer filters live suggestions against the decided keys, and the index is
// what stops two clicks racing into two rows that half-suppress it. Admin
// Reopen deletes the row, and is the only path back.
export const meetingLoadDecisions = pgTable('meeting_load_decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind').notNull(),
  targetKey: text('target_key').notNull(),
  status: suggestionStatus('status').notNull(),
  evidence: jsonb('evidence').notNull(),
  decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('meeting_load_decisions_kind_target_idx').on(t.kind, t.targetKey),
])

// Append-only audit of who was on a meeting, and when. Exactly the
// assignment_history pattern above, applied to meeting membership — read that
// comment first; this one only records where the two differ.
//
// meetingAttendees stays THE live state, untouched, for the same reason
// assignments did: every existing read path keeps working with no new filter
// to remember. Without this sibling, removing someone from a meeting erased
// the fact that they were ever on it.
//
// SHAPE — one row per (meetingId, userId) *interval*, half-open [from, to),
// with AT MOST ONE open row per pair. A change closes the open row and opens
// the next from the SAME JS `Date` in one db.batch, so the intervals abut
// exactly and never overlap.
//
// REMOVAL SEMANTICS — identical: close the open row AND insert a 'removed'
// tombstone, left open. Not close-only, because a close records the instant
// but not the actor, and the "as of" query stays one uniform rule ("the row
// open at the date wins") with no special case for "no open row". Readers
// must drop 'removed' rows from any roster — see attendanceAsOf in
// src/features/meetings/attendance-history.ts, which owns that rule.
//
// DIFFERENCES from assignment_history, both forced by the payload:
//   - `response` (the RSVP) takes the place of role+allocationPct. It is
//     CARRIED onto the tombstone rather than zeroed — attendance has no
//     summed quantity, so "was going when removed" is the useful record and
//     there is nothing whose total a stale value could corrupt.
//   - An 'updated' row is an RSVP change (respondToMeeting), which is the
//     only payload edit this table has.
//
// Removal is a statement about the future only: note segments keep their
// speakerId and accepted tasks keep their assignee, because those record what
// was actually said and agreed.
//
// changedBy is whoever made the change. Backfilled rows (migration 0018)
// carry the meeting's creator at the meeting's createdAt — near-observed,
// since the attendee list is written in the same batch as the meeting itself,
// but still noted as backfill because a later hand-added attendee is
// indistinguishable from an original one in the live table.
export const meetingAttendeeHistory = pgTable('meeting_attendee_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  response: attendeeResponse('response').notNull(),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  changedBy: uuid('changed_by').notNull().references(() => users.id),
  changeKind: attendanceChange('change_kind').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // "Which meetings was this person on?" — the person-side timeline.
  index('meeting_attendee_history_user_from_idx').on(t.userId, t.effectiveFrom),
  // "Who was on this meeting?" — the per-meeting roster.
  index('meeting_attendee_history_meeting_from_idx').on(t.meetingId, t.effectiveFrom),
  // "As of" lookups filter on the interval bounds alone, same as
  // assignment_history_as_of_idx.
  index('meeting_attendee_history_as_of_idx').on(t.effectiveFrom, t.effectiveTo),
  // The "AT MOST ONE open row per (meetingId, userId)" invariant above,
  // enforced rather than only documented — the same guard, declared the same
  // way, as assignment_history_one_open_idx. attendanceAsOf returns every
  // in-force row, so a second open interval for one pairing would list the
  // person twice with two different RSVPs: a wrong answer, not an error.
  // Partial (open rows only): closed intervals for the same pairing are the
  // normal case and must stay unconstrained.
  uniqueIndex('meeting_attendee_history_one_open_idx')
    .on(t.meetingId, t.userId)
    .where(sql`${t.effectiveTo} is null`),
])

// Per-user Gemini API keys. Multiple keys per user; requests roll across
// active keys (least-recently-used first) so free-tier rate limits spread out.
// The key itself is AES-256-GCM encrypted at rest (see src/lib/crypto.ts);
// last4 is kept for display only.
export const geminiKeys = pgTable('gemini_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  encryptedKey: text('encrypted_key').notNull(),
  last4: text('last4').notNull(),
  active: boolean('active').notNull().default(true),
  // Org sharing: the owner explicitly opted this key into the org pool
  // (consent dialog in the keys card). Selection order is always the
  // caller's own keys first, then shared keys — see orderKeysForRotation.
  shared: boolean('shared').notNull().default(false),
  // 'free' | 'paid' — declared by the owner (Google exposes no way to
  // detect it). Display-only: free keys show "$0 charged", paid keys show
  // an indicative estimated charge.
  tier: text('tier').notNull().default('free'),
  failCount: integer('fail_count').notNull().default(0),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// One row per top-level Gemini call (not per internal retry): who spent
// quota, on whose key, for which feature, and the token counts Gemini
// reported. Usage accounting only — no prompt or response text is ever
// stored here. key_owner_id and key_last4 are denormalized snapshots so
// shared-key attribution survives key deletion (key_id goes NULL).
// RETENTION: none. Nothing prunes this table today — rows accumulate for as
// long as the user exists (and are removed only with them, by the cascade).
// Stated plainly because the previous note here promised a 12-month prune
// that was never built. If one is added it is a hard delete: this table is
// exempt from the soft-delete rule, there being nothing to restore.
export const aiUsageEvents = pgTable('ai_usage_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  keyId: uuid('key_id').references(() => geminiKeys.id, { onDelete: 'set null' }),
  keyOwnerId: uuid('key_owner_id').references(() => users.id, { onDelete: 'set null' }),
  keyLast4: text('key_last4'),
  feature: text('feature').notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  // 'ok' or the GeminiErrorCode that ended the call (e.g. 'AUTH_FAILED').
  status: text('status').notNull().default('ok'),
  // Wall-clock milliseconds the call took, measured in client.ts around the
  // whole key/model/retry loop — what the CALLER waited, not one HTTP round
  // trip. Nullable: rows from before 0056, and writers that cannot measure
  // (live sessions never resolve client-side). It exists so the meter can say
  // "usually ~40s" from observed history instead of inventing an ETA.
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('ai_usage_user_created_idx').on(t.userId, t.createdAt),
  index('ai_usage_key_owner_created_idx').on(t.keyOwnerId, t.createdAt),
  index('ai_usage_feature_created_idx').on(t.feature, t.createdAt),
])

// Per-user AI feature toggles. ABSENT ROW = ENABLED — the product default
// is fully AI-enabled; a row exists only once the user has touched the
// switch. Feature ids are the display-feature ids from
// src/features/gemini/ai-features.ts, not per-call slugs.
export const userAiPrefs = pgTable('user_ai_prefs', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  feature: text('feature').notNull(),
  enabled: boolean('enabled').notNull(),
  // Chosen model for this feature; NULL means "use the feature's default
  // chain" (same absent-means-default convention as `enabled`).
  model: text('model'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  primaryKey({ name: 'user_ai_prefs_pk', columns: [t.userId, t.feature] }),
])

// AI analysis of a recorded meeting (transcript + structured notes), one row
// per meeting. jsonb shapes:
//   perPerson:  [{ name, points: string[], actionItems: string[] }]
//   deadlines:  [{ item, owner, due }]            (due = free-text date phrase)
//   terms:      [{ term, explanation, sinhala }]  (software terms glossary)
//   questions:  [{ person, questions: string[] }] (prep for the next meeting)
export const meetingAiNotes = pgTable('meeting_ai_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().unique()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  language: text('language').notNull().default('en'),
  transcript: text('transcript'),
  summary: text('summary'),
  perPerson: jsonb('per_person'),
  deadlines: jsonb('deadlines'),
  terms: jsonb('terms'),
  questions: jsonb('questions'),
  model: text('model').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  // How many of THIS analysis pass's action items qualified for auto-assign
  // (see notes.ts shouldAutoAssign) but were left as manual suggestion cards
  // anyway because the meeting had already hit MAX_AUTO_TASKS_PER_MEETING.
  // Recomputed on every analysis run (upserted alongside everything else
  // above) — what the "N more suggestions need review" note on the note
  // timeline reads. 0 means either nothing was capped or auto-assign never
  // ran (e.g. the meeting has no linked app).
  autoAssignCappedCount: integer('auto_assign_capped_count').notNull().default(0),
})

// Person-linked follow-ups derived from a meeting's AI analysis: an open
// question or action item attributed to a specific person. These carry
// forward to whatever future meeting that person attends next (see
// getMeetingIntel's prep computation) instead of only surfacing in "the
// previous meeting" the way the old questions-only prep did.
//   userId          resolved from personName against the SOURCE meeting's
//                    attendees (see matchPersonToAttendee); null when the
//                    name didn't match exactly one attendee — personName is
//                    always kept regardless so the raw text isn't lost.
//   resolvedInMeetingId / resolvedAt  set either by an admin/creator/the
//                    person themself manually resolving it, or by the AI
//                    "did this come up" pass run after analyzing a later
//                    meeting (analyzeMeetingAudio). resolvedInMeetingId is
//                    the meeting the item was resolved *in* — the analyzed
//                    meeting for the AI pass, the meeting whose Intelligence
//                    panel the person clicked Resolve on for a manual one.
//                    It is what keeps a resolved item visible (settled, with
//                    its note) on that one meeting instead of silently
//                    vanishing everywhere; null only when the resolve had no
//                    meeting context. Reopening clears all three fields so
//                    the item carries forward again.
//   resolutionNote   what actually came of it — the answer/outcome typed on
//                    resolve. Optional: a resolve with no note is still a
//                    resolve, so null means "done, nothing written down".
//   responseNote     what the person SAID about it while it is still open —
//                    deliberately separate from resolutionNote, which only
//                    exists on a closed item. Recording a response never
//                    changes `status`, so the item keeps carrying forward:
//                    "she said the client hasn't replied yet" is an update,
//                    not an answer. Null until someone writes one down.
//   deferReason      why it is NOT resolved yet — the reason typed when
//                    someone hits "Not yet" (or later). Also open-only, and
//                    also optional: deferring is one click, the reason is
//                    enrichment layered on afterwards.
//   createdBy        who added the item by hand. Null for the AI-derived
//                    rows (deriveAndInsertFollowups), which is what makes
//                    this column the "was a human asking for this?" flag,
//                    not just provenance trivia.
//   targetMeetingId  pins the item to ONE specific meeting instead of
//                    letting it surface at whatever meeting its person
//                    attends next. Null (the default, and every AI-derived
//                    row) keeps the carry-forward behaviour; set, the item
//                    shows on that meeting and nowhere else.
export const meetingFollowups = pgTable('meeting_followups', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceMeetingId: uuid('source_meeting_id').notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  personName: text('person_name').notNull(),
  text: text('text').notNull(),
  kind: followupKind('kind').notNull(),
  status: followupStatus('status').notNull().default('open'),
  resolvedInMeetingId: uuid('resolved_in_meeting_id')
    .references(() => meetings.id, { onDelete: 'set null' }),
  resolvedAt: timestamp('resolved_at'),
  resolutionNote: text('resolution_note'),
  responseNote: text('response_note'),
  deferReason: text('defer_reason'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  targetMeetingId: uuid('target_meeting_id')
    .references(() => meetings.id, { onDelete: 'set null' }),
  // Set when this item was matched (see followups.ts findMatchingFollowup —
  // same userId, high text similarity) to a task created from a suggestion
  // that addresses it. Closes the loop the carry-forward system otherwise
  // never closes on its own: once set, moving that task to 'done' resolves
  // this row automatically (and moving it back out reopens it) — see
  // task-actions.ts's follow-up sync, wired into updateTask/moveTaskOnBoard.
  // onDelete set null (not cascade): deleting the task should not delete the
  // record that a follow-up existed, only un-link it back to plain manual
  // resolution.
  resolvedByTaskId: uuid('resolved_by_task_id')
    .references(() => tasks.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// In-app notifications. One row per recipient. `actorId` is who triggered it,
// `link` is the in-app path to open, `meetingId` ties mention/meeting alerts to
// their source so deleting the meeting cleans them up.
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  // The LEGACY discriminator, and deliberately still an enum. `kind` below
  // supersedes it — the design's whole complaint was that a new kind of
  // notification needed a migration, and a free-text `kind` fixes that without
  // converting a live column on a database several sessions share.
  type: notificationType('type').notNull(),
  // Fallbacks, not the record. A row written before title_key existed renders
  // from these; a row written after renders from title_key + params, so a
  // person's name is resolved at READ time and a renamed user is not left
  // frozen in somebody's inbox under their old name.
  title: text('title').notNull(),
  body: text('body'),
  link: text('link'),
  meetingId: uuid('meeting_id').references(() => meetings.id, { onDelete: 'cascade' }),
  read: boolean('read').notNull().default(false),
  // What kind of thing happened, as a string. 'legacy' for every row written
  // before this column existed, then backfilled from `type` by migration 0057.
  kind: text('kind').notNull().default('legacy'),
  // The i18n key and its parameter bag. params carries IDS, NOT NAMES —
  // actorId, appId, taskId — because freezing actorName into jsonb at write
  // time is how an inbox ends up asserting something that stopped being true.
  titleKey: text('title_key'),
  params: jsonb('params').$type<Record<string, unknown>>(),
  // NO FOREIGN KEY on either, matching activity_log's posture and for its
  // reason: a notification about a task must survive that task being trashed.
  // The click-through resolves at read time and degrades to "no longer
  // available" rather than the row vanishing from somebody's inbox.
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  dedupeKey: text('dedupe_key'),
  // Which of the two dedupe rules applies. true is an escalation ladder — one
  // row per (person, key), ever. false collapses only while unread, so the
  // count resets once they have seen it.
  dedupePermanent: boolean('dedupe_permanent').notNull().default(false),
  collapseCount: integer('collapse_count').notNull().default(1),
  // NOT `deletedAt`, on purpose. This table is not part of the five-table
  // soft-delete contract and must not be pulled into it by naming: dismissing
  // a notification is somebody clearing their own inbox, not an admin trashing
  // a record, and no Trash bin should ever list one.
  dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
  digestState: text('digest_state').notNull().default('none'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  // The bell, which polls every 20 seconds and until now had no index at all.
  index('notifications_bell_idx')
    .on(t.userId, t.read, t.createdAt.desc())
    .where(sql`${t.dismissedAt} is null`),
  index('notifications_inbox_idx').on(t.userId, t.createdAt.desc()),
  // Cascade on trash: "everything pointing at this entity".
  index('notifications_entity_idx').on(t.entityType, t.entityId),
  uniqueIndex('notifications_dedupe_permanent_idx')
    .on(t.userId, t.dedupeKey)
    .where(sql`${t.dedupePermanent}`),
  uniqueIndex('notifications_dedupe_collapse_idx')
    .on(t.userId, t.dedupeKey)
    .where(sql`not ${t.dedupePermanent} and ${t.read} = false and ${t.dismissedAt} is null`),
])

/**
 * Who was named, where, and whether it reached them.
 *
 * APPEND-ONLY, AND DELIBERATELY WITHOUT `deletedAt`. src/db/live.test.ts
 * reflects over this schema and fails the build for any table carrying that
 * column without a SOFT_TABLES registration — this table belongs in neither.
 * It is an index of things that were said, not trashable user content: a
 * mention is evidence, and evidence that can be deleted by the person it
 * incriminates is not evidence. The column's ABSENCE is the decision.
 */
export const mentions = pgTable('mentions', {
  id: uuid('id').primaryKey().defaultRandom(),
  // MENTION_SOURCES in features/notifications/entity-kinds.ts, which also owns
  // the total mapping from a source to the entity it is about. Three tables
  // inventing three vocabularies is how a per-entity join silently returns
  // nothing — and "nothing" here reads as "nobody has mentioned you".
  sourceType: text('source_type').notNull(),
  // NO `.references()`, matching activity_log.entityId's posture and for its
  // reason: a mention must outlive a trashed or purged source. "You told me in
  // that comment" stays true after the comment is gone. Visibility is enforced
  // at READ time by joining the live view for the source's type.
  sourceId: uuid('source_id').notNull(),
  // Denormalised so an orphaned row still reads as a sentence rather than as a
  // link to nothing.
  sourceLabel: text('source_label').notNull(),
  mentionedUserId: uuid('mentioned_user_id').notNull().references(() => users.id),
  actorId: uuid('actor_id').notNull().references(() => users.id),
  // Nullable: a worklog mention belongs to no project, and forcing one would
  // file it under a project it has nothing to do with.
  appId: uuid('app_id'),
  /** Whether a bell row was actually created. False is the interesting case. */
  notified: boolean('notified').notNull().default(false),
  /**
   * `no_access` | `inactive` | `self` | `assignment_supersedes`, or null when it
   * was delivered.
   *
   * THE ROW IS WRITTEN EITHER WAY. A mention that could not be delivered is
   * recorded and reported back to the author, never silently dropped —
   * otherwise half the org spends six months believing they told somebody.
   */
  suppressedReason: text('suppressed_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // THE ANTI-SPAM MECHANISM, and the reason this table exists at all. It sits
  // at the storage layer precisely so the several call sites that extract
  // mentions cannot each get it wrong: re-running extraction over an edited
  // body inserts nothing, so a mention notifies EXACTLY ONCE, EVER.
  //
  // A DIFFERENT GUARANTEE from notifications' collapsing dedupe index, and both
  // are needed. That one resets once the reader catches up, by design; under it
  // alone, editing a body after they read the mention would notify them again.
  // Under this one alone, three genuinely different mentions would be three
  // bell rows. Deleting either is the obvious future "simplification" and is
  // wrong both times.
  uniqueIndex('mentions_source_user_idx').on(t.sourceType, t.sourceId, t.mentionedUserId),
  index('mentions_of_me_idx').on(t.mentionedUserId, t.createdAt.desc()),
])

// Discussion thread on an app's overview. @mentions in the body notify the
// mentioned users via the notifications table (see app comment actions).
export const appComments = pgTable('app_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  appId: uuid('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// One unified, chronological note timeline per meeting — replaces the old
// split between the human-typed `meetings.notes` blob and the AI's
// `meetingAiNotes.summary` block. Every entry ("segment") carries a SOURCE
// so the UI can badge it (typed/voice/ai) and, where known, a speaker.
//   source        'typed' (a person wrote it), 'voice' (transcribed speech,
//                 one chunk per speaker turn from the Gemini analysis),
//                 or 'ai' (the model's own summary/insight — auto-inserted
//                 when analysis completes, see analyzeMeetingAudio).
//   speakerId     resolved user, either directly (a 'typed'/'ai' segment's
//                 author) or via a meetingSpeakers label mapping backfilled
//                 onto 'voice' segments once someone assigns that speaker.
//   speakerLabel  the raw as-transcribed label ("Speaker 1", or an attendee
//                 name the model recognized) for 'voice' segments before —
//                 or absent — a mapping. Null for 'typed'/'ai'.
//   startedAtMs   offset into the recording, used to order 'voice' segments
//                 that land in the same analysis pass (their real wall-clock
//                 createdAt is identical, down to the second, since they're
//                 inserted together) — see orderNoteSegments in notes.ts.
//                 Null for 'typed'/'ai', and for 'voice' segments the model
//                 couldn't place (ordering then falls back to input order).
// meetings.notes is left in place as a read-only legacy field — a meeting
// with no segments yet renders it as a synthetic first entry, and it is
// migrated into a real 'typed' segment the first time notes are edited
// (see addTypedNoteSegment) rather than dropped.
export const meetingNoteSegments = pgTable('meeting_note_segments', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  source: noteSource('source').notNull(),
  speakerId: uuid('speaker_id').references(() => users.id, { onDelete: 'set null' }),
  speakerLabel: text('speaker_label'),
  content: text('content').notNull(),
  startedAtMs: integer('started_at_ms'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by').references(() => users.id),
}, (t) => [
  // The table had no index at all until the attendee recommender's E5 voice-
  // participation signal started scanning it per candidate per series.
  index('meeting_note_segments_meeting_idx').on(t.meetingId),
])

// Maps a raw speaker label ("Speaker 1", "Speaker 2", …) the live transcript
// or the Gemini analysis produced for ONE meeting to a real user — set by an
// authorized user via the speaker-assignment control on the note timeline.
// userId is nullable so "not a listed attendee" can be recorded explicitly
// (distinct from "not yet assigned": a row exists either way once someone
// has looked at the label). Setting/changing a mapping backfills
// meetingNoteSegments.speakerId on every segment carrying that label.
// displayName carries a typed-in name for a voice that is nobody on the
// invite — a client, a candidate, someone's colleague. Without it, "not a
// listed attendee" recorded only that the voice was nobody we know and threw
// away who it actually was, leaving the transcript saying "Speaker 1"
// forever. It is meaningful only while userId is null: a mapped user's name
// is the users table's to change, and a stale copy here would outlive a
// rename.
export const meetingSpeakers = pgTable('meeting_speakers', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('meeting_speakers_meeting_label_idx').on(t.meetingId, t.label)])

// Actionable items the AI proposes after analyzing a meeting — rendered as
// one-click "Add task" suggestion cards on the note timeline. `status`
// tracks the card's fate: 'open' (still showing), 'accepted' (a real task
// was created — see createdTaskId), or 'dismissed' (rejected, persisted so
// it never re-shows). segmentId is nullable: a suggestion isn't always
// anchored to one exact voice/ai segment (e.g. it may synthesize across
// several), so it's best-effort provenance, not a requirement.
export const meetingTaskSuggestions = pgTable('meeting_task_suggestions', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  segmentId: uuid('segment_id').references(() => meetingNoteSegments.id, { onDelete: 'set null' }),
  text: text('text').notNull(),
  suggestedUserId: uuid('suggested_user_id').references(() => users.id, { onDelete: 'set null' }),
  suggestedDueDate: date('suggested_due_date'),
  // Which app the AI routed this item into — resolved server-side from the
  // model's suggestedApp NAME (the prompt shows it each attendee's app list)
  // via resolveSuggestedAppId in notes.ts: exact match, then unambiguous
  // case-insensitive, never a guess. NULL means "no confident app", and
  // every reader falls back to the meeting's own appId — exactly the
  // behaviour this column predates. ON DELETE set null so deleting an app
  // degrades its suggestions to that fallback instead of orphaning them.
  suggestedAppId: uuid('suggested_app_id').references(() => apps.id, { onDelete: 'set null' }),
  status: suggestionStatus('status').notNull().default('open'),
  createdTaskId: uuid('created_task_id').references(() => tasks.id, { onDelete: 'set null' }),
  // Who ACCEPTED this suggestion — set only while status is 'accepted'.
  // NULL there means the auto-assign pass accepted it (see notes.ts
  // shouldAutoAssign / ai-actions.ts persistMeetingAnalysis); a real user id
  // means a person clicked "Add task" (or edited-then-accepted) themselves
  // (acceptTaskSuggestion). Meaningless while status is 'open'/'dismissed' —
  // stays null there, same as `createdTaskId`.
  //
  // CHOICE — nullable column vs. adding an 'auto_accepted' value to
  // suggestionStatus: a new enum value would mean every reader that
  // branches on status (getMeetingNoteTimeline's WHERE, the UI's
  // open/accepted/dismissed switch) has to learn a fourth case, and Postgres
  // enum additions can't run inside the same transaction as anything that
  // uses the new value — riskier on a database where migrations are already
  // applied by hand (see the file-level note on drizzle bookkeeping). A
  // plain nullable uuid needs no enum surgery, keeps 'accepted' meaning
  // exactly what it always has ("a real task exists"), and answers a
  // strictly narrower question ("who accepted it") that only the timeline's
  // badge/undo affordance ever needs to ask.
  acceptedBy: uuid('accepted_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Raw per-segment transcripts from a SEGMENTED recording (see
// transcribeSegment/finalizeMeetingRecording in meetings/ai-actions.ts and
// SEGMENT_TARGET_MS in meetings/recording-segments.ts) — the long-meeting
// answer to the old "one Blob for the whole meeting, one server action at
// the end" design, which broke down around 17 minutes (server action body
// limit) and again around 20 minutes (Gemini's inline payload ceiling).
// Distinct from meetingNoteSegments on purpose: this is transcription
// bookkeeping (one row per ~5-minute audio segment, keyed by its position in
// the recording), not display content — nothing here renders directly in
// the note timeline. Once the meeting is stopped, finalizeMeetingRecording
// reads every row for the meeting ordered by `index` (concatenateSegments in
// recording-segments.ts — reports rather than silently skips a missing
// index, e.g. a segment whose upload failed and was never retried), runs ONE
// text-only synthesis pass over the concatenated transcript, and inserts the
// result into meetingAiNotes/meetingNoteSegments/meetingFollowups exactly as
// the legacy single-shot analyzeMeetingAudio always has.
// `index` is 0-based, unique per meeting (a retried segment upserts its own
// row rather than duplicating).
export const meetingRecordingSegments = pgTable('meeting_recording_segments', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  index: integer('index').notNull(),
  transcript: text('transcript').notNull(),
  model: text('model').notNull(),
  // Which TAKE this segment belongs to. NULL is not missing data — it reads
  // "recorded before takes were tracked", and migration 0060 deliberately
  // backfilled nothing: inferring take boundaries from timestamps would have
  // produced rows indistinguishable from observed ones, the exact mistake
  // migration 0015 made with assignment_history.
  //
  // SET NULL rather than cascade, so deleting a take never destroys the
  // transcript row itself. The soft delete below is what hides it, and a hard
  // cascade would make restore impossible and the admin trash a lie.
  recordingId: uuid('recording_id').references(() => meetingRecordings.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  // Soft delete, per the repo rule, registered in SOFT_TABLES (src/db/live.ts)
  // in the SAME change that adds the column — before any reader exists.
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by').references(() => users.id),
}, (t) => [
  uniqueIndex('meeting_recording_segments_meeting_index_idx').on(t.meetingId, t.index),
  index('meeting_recording_segments_recording_live_idx')
    .on(t.recordingId, t.index)
    .where(sql`${t.deletedAt} is null`),
])

// One TAKE: a single press of record and the stop that followed it.
//
// A meeting is commonly ten or fifteen of these. Until migration 0060 they
// existed only as a continuous run of segment indexes — the numbering that
// stops a second take upserting over the first one's transcripts
// (ai-actions.ts) — which meant nothing recorded WHICH segments belonged to
// which take. A studio could not be shown its own takes, could not count them,
// and could not remove one without hand-picking an index range.
//
// take_index KEEPS ITS SLOT WHEN DELETED. The unique index covers deleted rows
// too, so a restore can never collide with a take recorded after it, and
// "take 7" means the same thing to anybody who wrote the number down.
export const meetingRecordings = pgTable('meeting_recordings', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  // 1-based and per meeting — what the card calls itself ("Take 3").
  takeIndex: integer('take_index').notNull(),
  // Optional, renameable: "client demo", "after the break". A take nobody
  // named is still a take, so this stays nullable rather than defaulting to a
  // string that pretends somebody chose it.
  label: text('label'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  // NULL while still recording. That is also how a take interrupted by a
  // closed tab is told apart from one somebody stopped.
  endedAt: timestamp('ended_at', { withTimezone: true }),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by').references(() => users.id),
}, (t) => [
  uniqueIndex('meeting_recordings_meeting_take_idx').on(t.meetingId, t.takeIndex),
  index('meeting_recordings_meeting_live_idx')
    .on(t.meetingId)
    .where(sql`${t.deletedAt} is null`),
])

// Change-detected screen keyframes captured during a "screen + mic" recording
// (see screen-keyframes.ts). Full-video recording was rejected on cost (720p
// runs ~450-900 MB/hour vs the ~14 MB/hour the segmented audio path costs) —
// this is the cheap alternative: sample the shared screen periodically, keep
// a frame only when it perceptually changed (a new slide, a diagram, a code
// diff), and hand the kept frames to Gemini alongside the transcript so it
// can read on-screen content the audio alone can't capture. Bounded per
// meeting by MAX_KEYFRAMES_PER_MEETING (screen-keyframes.ts), enforced both
// client- and server-side (uploadMeetingKeyframe in ai-actions.ts).
// `blobUrl` is the raw Vercel Blob URL returned at upload time (record-
// keeping only — it's a PRIVATE blob, not directly fetchable by a browser);
// `blobPathname` is what actually gets used to fetch (via the
// /api/meeting-keyframes proxy, same private-blob pattern as avatars) and to
// delete (deleteMeeting's best-effort Blob cleanup, and the per-keyframe
// delete action) — kept as its own column rather than parsed out of the URL
// so a delete never depends on URL shape staying stable.
// `capturedAtMs` is the offset from the start of the recording, not a wall-
// clock timestamp — what the filmstip and the Gemini prompt label frames
// with ("screen at 12:34").
export const meetingScreenshots = pgTable('meeting_screenshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  blobUrl: text('blob_url').notNull(),
  blobPathname: text('blob_pathname').notNull(),
  capturedAtMs: integer('captured_at_ms').notNull(),
  width: integer('width'),
  height: integer('height'),
  byteSize: integer('byte_size'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by').references(() => users.id),
}, (t) => [index('meeting_screenshots_meeting_captured_idx').on(t.meetingId, t.capturedAtMs)])

// Append-only trail of every mutation in the product: who did what, to which
// thing, from which page, when — the "complete backtrack". Written by
// logActivity (src/features/activity/log.ts) from inside every mutating
// server action; read by the dashboard's Recent-activity feed and /activity.
//
// DELIBERATE DENORMALIZATION, twice over:
//  - entityId has NO foreign key. Most entities cascade-delete (a deleted app
//    takes its tasks, sprints and meetings with it); an FK — even ON DELETE
//    SET NULL — would either erase or orphan exactly the history a deletion
//    is most worth remembering. entityLabel carries the name as it read at
//    write time so the row stays legible forever.
//  - appId/appName the same, for grouping a feed by product after the
//    product is gone.
// actorId DOES reference users: accounts are deactivated, never deleted, so
// the join is safe, and it's how "who" stays a real person with an avatar.
//
// verb and entityType are text, not pgEnums, on purpose: a new verb is a new
// string at a call site, not a migration — and with npm run db:migrate broken
// (see docs/superpowers/specs/2026-08-12-dashboard-activity-design.md) every
// avoided migration matters.
export const activityLog = pgTable('activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').notNull().references(() => users.id),
  // created | updated | deleted | moved | completed | reopened | assigned |
  // unassigned | rsvp | resolved | approved | rejected | commented | …
  verb: text('verb').notNull(),
  // app | task | sprint | meeting | user | assignment | comment | followup
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  entityLabel: text('entity_label').notNull(),
  appId: uuid('app_id'),
  appName: text('app_name'),
  // The page the change belongs to (e.g. /apps/logpup, /meetings/<id>) — for
  // "which page" in the feed and as the row's click-through target.
  pagePath: text('page_path'),
  // Human fragment completing "actor verb entity …": "moved to In progress".
  detail: text('detail'),
  // Machine-readable before/after for fields the change touched.
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // The firehose: dashboard feed + /activity, newest first.
  index('activity_log_created_idx').on(t.createdAt),
  // Per-entity timeline ("backtrack this task").
  index('activity_log_entity_idx').on(t.entityType, t.entityId, t.createdAt),
  // Per-person filter on /activity.
  index('activity_log_actor_idx').on(t.actorId, t.createdAt),
])

// One self-reported progress number per (sprint, person): "I'm at N%",
// optionally with a sentence of context. The row is CURRENT STATE, upserted
// in place (see upsertSprintCheckin in sprints/checkin-actions.ts) — an
// append-only history was rejected because every reader (the standup/meeting
// prep surface) only ever wants each person's latest answer, and the "who
// changed what, when" trail already lives in activity_log. `updated_at` is
// therefore the staleness signal: a check-in from four days ago is itself
// information at standup.
//
// Deliberately stores ONLY the human's number. The computed side — what this
// person's task board says (computeTaskProgress in sprints/checkins.ts) — is
// derived at read time, never persisted next to it, so the gap between the
// two (checkinGap, the signal this feature exists to surface) can't quietly
// compare a fresh report against a stale snapshot of the board.
//
// userId intentionally has no ON DELETE clause: accounts are deactivated,
// never deleted (same reasoning as activity_log.actor_id), so the join to a
// name/avatar is always safe. A deleted sprint takes its check-ins with it —
// they mean nothing without the sprint they report on.
export const sprintCheckins = pgTable('sprint_checkins', {
  id: uuid('id').primaryKey().defaultRandom(),
  sprintId: uuid('sprint_id').notNull().references(() => sprints.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  // 0..100, validated at the action boundary. Integer on purpose: nobody
  // reports "37.5% done" at standup, and whole points keep the gap math and
  // the UI's tabular-nums rendering exact.
  percent: integer('percent').notNull(),
  note: text('note'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  // THE invariant: one current answer per person per sprint. Also what the
  // upsert's ON CONFLICT targets, and the access path for every read
  // (getSprintCheckins / getCheckinsForSprints filter on sprint_id, the
  // index's leading column).
  uniqueIndex('sprint_checkins_sprint_user_idx').on(t.sprintId, t.userId),
])

// One row per person per DAY — what they did, and how much of what they set
// out to do they got through. Deliberately NOT sprintCheckins: that table is
// uniquely indexed (sprint_id, user_id), so it holds one overwritten row per
// person per SPRINT answering "how far through this sprint am I". It carries
// no day-by-day history and is unreachable for anyone not on a sprint.
//
// Not soft-deletable and there is no delete action: a day is corrected by
// editing it. That is what keeps this table out of SOFT_TABLES in
// src/db/live.ts and out of live.test.ts's enforcement scan.
export const dailyWorklogs = pgTable('daily_worklogs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // A calendar day in Asia/Colombo, not an instant — see resolveWorkDay in
  // src/features/worklog/worklog-day.ts. A UTC-derived day would file an
  // evening entry under the wrong date for half the working week.
  day: date('day').notNull(),
  // 0..100, validated at the action boundary. Means "of what I planned
  // today", self-scored: it has to stay meaningful on a day of meetings,
  // review and debugging that closed no ticket.
  percent: integer('percent').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  // THE invariant: one answer per person per day. Also the upsert's
  // ON CONFLICT target and the access path for the personal history read.
  uniqueIndex('daily_worklogs_user_day_idx').on(t.userId, t.day),
  // The team view reads a day range across everybody.
  index('daily_worklogs_day_idx').on(t.day),
])

// WHERE the hours actually went — many entries per person per day, alongside
// the one self-scored `percent` above rather than replacing it.
//
// THE TWO NUMBERS ARE NOT THE SAME QUESTION, and this table exists partly to
// keep them apart. `daily_worklogs.percent` is a JUDGEMENT — "of what I set
// out to do, how much did I get done". The figure derived from these rows
// (minutes logged over minutes scheduled) is COVERAGE — "how much of my
// scheduled day is accounted for". A good day can be 100% on one and 60% on
// the other, so the derived one is called "Accounted" and is never labelled,
// exported, or tiled as a percent. Two numbers under two names is healthy;
// two numbers under one name is how this repo already ended up with
// FOLLOWUP_STALE_DAYS exported twice with different values.
//
// A TIME ENTRY DOES NOT REQUIRE A TASK. A tech lead whose Tuesday was four
// meetings, two reviews and a production incident closed no ticket and moved
// no card. If only task-linked time counted, their honest full day would
// compute as zero — the app calling somebody lazy for doing their job.
// `category` carries the non-task cases and every one counts toward the day.
//
// Hangs off (user_id, day), NOT off a daily_worklogs.id: logging time never
// requires the header row to exist first, which is what makes backfilling a
// day you never self-scored possible at all.
//
// SELF-ONLY WRITES, inherited from daily_worklogs. There is deliberately no
// `worklog.write.any` for any of the seven seats (capabilities.test.ts
// asserts the key does not exist), because the record is a FIRST-PERSON
// STATEMENT about somebody's own day. This table does not introduce one.
export const worklogEntries = pgTable('worklog_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Asia/Colombo calendar day via resolveWorkDay (features/worklog/worklog-day.ts),
  // never a UTC slice — the same contract as daily_worklogs.day.
  day: date('day').notNull(),
  // MINUTES, NOT HOURS. 90 beats 1.5 for a person typing it, and integers
  // cannot drift the way floats do once a month of half-hours is summed.
  // Division by 60 happens at the display edge, never in storage.
  minutes: integer('minutes').notNull(),
  // Which project this time belongs to. NOT derivable from taskId: that is
  // set only on category='task' rows, so without this a meeting, a review or
  // an incident on a project could not be attributed at all — per-project
  // cost undercounted silently and effort mix read ~100% 'task'. Non-task
  // time being first class is the whole reason categories exist.
  //
  // NULLABLE: some time belongs to no project (admin, learning). Forcing a
  // choice would make people pick a wrong one, which is worse than null.
  //
  // Stored on EVERY row including task rows, derived from the task's app at
  // write time. It survives the task being deleted (taskId does not), and
  // where the two later disagree THIS value wins for historical figures: a
  // task moved between projects must not retroactively move hours somebody
  // logged against the old one.
  appId: uuid('app_id').references(() => apps.id, { onDelete: 'set null' }),
  // Set ONLY when the time went to a tracked task. SET NULL rather than
  // cascade: deleting a task must not delete the record that somebody spent
  // three hours on it — the hours were still worked.
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  category: worklogEntryCategory('category').notNull(),
  // The cost/worth design derives earned value from exactly this flag. It
  // lands with the table rather than in a later migration, because adding it
  // afterwards means an ALTER on a table that by then holds every hour
  // anybody logged, with no defensible value to backfill.
  billable: boolean('billable').notNull().default(false),
  // One line: what it was.
  note: text('note'),
  source: worklogEntrySource('source').notNull().default('manual'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // Soft delete, per the repo rule — registered in SOFT_TABLES (src/db/live.ts)
  // in the SAME change that creates the table, before any reader exists.
  //
  // No `deletedBy` column, unlike bug_reports/apps: writes here are self-only,
  // so the deleter is always `userId` and a second column would be a copy of
  // it that could one day disagree.
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  // The day editor's only read: one person, one day (or a month's range).
  // Partial on live rows because every read filters soft-deleted ones out.
  index('worklog_entries_user_day_live_idx')
    .on(t.userId, t.day)
    .where(sql`${t.deletedAt} is null`),
  // "How many hours went into this task" — what the effort and cost reports
  // are built on.
  index('worklog_entries_task_live_idx').on(t.taskId).where(sql`${t.deletedAt} is null`),
  // Every per-project figure — cost, effort mix, portfolio rollup — reads by
  // app and date range. Task-scoped hours alone would miss meetings, reviews
  // and incidents, which is why this exists alongside the task index.
  index('worklog_entries_app_day_live_idx')
    .on(t.appId, t.day)
    .where(sql`${t.deletedAt} is null`),
])

// One registered passkey (WebAuthn credential) per row. `id` IS the
// credential id Base64URL — the authenticator's own identifier, globally
// unique by construction, so a synthetic uuid would just be a second name
// for it. publicKey is Base64URL too: bytea round-trips through the
// neon-http driver as hex strings, and encoding once at the boundary beats
// remembering which reads decode.
//
// Deliberately NOT soft-deletable: removing a passkey is a security action
// ("this device is gone") and must be absolute — a restorable credential in
// an admin Trash would be a key that can come back from the dead. The
// delete is exempted by name in live.test.ts.
export const webauthnCredentials = pgTable('webauthn_credentials', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  publicKey: text('public_key').notNull(),
  // Signature counter — anti-cloning. bigint: the spec allows 2^32-1, which
  // overflows a Postgres integer by exactly one.
  counter: bigint('counter', { mode: 'number' }).notNull().default(0),
  // CSV of the authenticator's transports ('internal,hybrid') — fed back to
  // the browser so it picks the right UI (Touch ID vs QR-to-phone).
  transports: text('transports'),
  // What the user calls this device ("MacBook Touch ID"); free text.
  label: text('label'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
}, (t) => [index('webauthn_credentials_user_idx').on(t.userId)])

// The one-time bridge between a verified WebAuthn assertion and a NextAuth
// session: completePasskeyLogin verifies the signature, writes a row here,
// and hands the RAW token to the client, which trades it through the
// 'passkey' Credentials provider within TTL. Only the sha256 of the token is
// stored — a database read can never mint a session. Consumption is an
// UPDATE of usedAt, not a delete, so replay shows up as "already used"
// rather than "never existed", and the row itself is the audit record.
export const webauthnLoginTokens = pgTable('webauthn_login_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
})

// ---------------------------------------------------------------------------
// RBAC, approvals and non-daily logging (migrations 0037-0039)
// ---------------------------------------------------------------------------

/** One weekday's share of a working day. 1 = full, 0.5 = half, 0 = not owed. */
export type SchedulePattern = {
  mon: number; tue: number; wed: number; thu: number
  fri: number; sat: number; sun: number
}

// Every proposal, in both directions, in one table.
//
// An editor may not delete and may not edit outside their window; instead of
// refusing outright, those paths open a row here and a reviewer signs it. The
// middle state between "permitted" and "refused" is the whole point.
//
// payload is { before, after }. `before` is the pre-image captured when the
// request was filed, and it is what makes stale-approval detection possible at
// all: none of the target tables carries an updated_at to compare against, so
// the applier diffs field by field against this and refuses loudly rather than
// clobbering a newer value.
//
// CLOSES BY STATUS — see the enum comment above. No deleted_at, deliberately.
export const changeRequests = pgTable('change_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  requesterId: uuid('requester_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  entityLabel: text('entity_label').notNull(),
  operation: changeRequestOp('operation').notNull(),
  payload: jsonb('payload').$type<{ before: Record<string, unknown>; after: Record<string, unknown> }>().notNull(),
  reason: text('reason').notNull(),
  status: changeRequestStatus('status').notNull().default('pending'),
  appId: uuid('app_id').references(() => apps.id, { onDelete: 'cascade' }),
  reviewerId: uuid('reviewer_id').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewNote: text('review_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // The approvals inbox: pending, oldest first.
  index('change_requests_status_created_idx').on(t.status, t.createdAt),
  // "What has been proposed against this row" — the per-entity trail.
  index('change_requests_entity_idx').on(t.entityType, t.entityId),
  index('change_requests_requester_idx').on(t.requesterId, t.createdAt),
])

// What a person is expected to log, effective-dated.
//
// A row exists ONLY for someone who deviates from the studio default (Mon-Fri
// full, Saturday half, Sunday none), which keeps living in exactly one place,
// src/lib/working-days.ts. No row means the default, so this table stays
// near-empty for a normal team and the default never forks.
//
// CLOSES BY effective_to, the same half-open [from, to) as appRoleHistory:
// moving someone to part-time in June must not rewrite what was expected of
// them in May, which is exactly what an in-place update would do.
export const workSchedules = pgTable('work_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  pattern: jsonb('pattern').$type<SchedulePattern>().notNull(),
  // Which days they work is `pattern`; whether a log is owed at all is this.
  // Two questions, deliberately two columns — a part-time tech lead needs both
  // answers and they are not the same answer.
  logging: loggingExpectation('logging').notNull().default('daily'),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  changedBy: uuid('changed_by').notNull().references(() => users.id),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('work_schedules_user_from_idx').on(t.userId, t.effectiveFrom),
  // THE INVARIANT, same guard as app_role_history_one_open_idx: at most one
  // open schedule per person. Two open rows would make "what was expected of
  // them on 12 June" ambiguous, which is the one question coverage answers.
  uniqueIndex('work_schedules_one_open_idx')
    .on(t.userId)
    .where(sql`${t.effectiveTo} is null`),
])

// Why a person owed no work on a range of days.
//
// Both bounds are INCLUSIVE — deliberately unlike the half-open intervals
// above. These are dates a person states in words ("I am out Monday to
// Wednesday"), not machine intervals, and an exclusive end is the classic
// off-by-one in exactly that translation.
//
// Retroactive with no limit: filing leave for a past date is valid, and
// approval flips those days to exempt immediately even if a report already
// counted them missing. Coverage is truth-as-currently-known, never a frozen
// snapshot.
//
// CLOSES BY STATUS. Overlap between approved rows is prevented in
// absence-actions.ts rather than by an EXCLUDE constraint, which would need
// btree_gist — unverified on this Neon instance, and a failed extension
// install mid-migration is worse than an application check with a test.
export const absences = pgTable('absences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  kind: absenceKind('kind').notNull(),
  reason: text('reason'),
  status: absenceStatus('status').notNull().default('pending'),
  reviewerId: uuid('reviewer_id').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewNote: text('review_note'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('absences_user_start_idx').on(t.userId, t.startDate),
  index('absences_status_start_idx').on(t.status, t.startDate),
])

// Company shutdown days, composed on top of the gazetted map through the same
// isHoliday callback working-days.ts already takes. A company holiday used to
// require a deploy; now it does not.
//
// REVOKED BY DELETE. A cancelled company holiday did not happen, and a
// tombstone would make every coverage read filter for it forever. Named in
// live.test.ts's DELETE_ALLOWED_FUNCTIONS with that rationale.
export const orgHolidays = pgTable('org_holidays', {
  id: uuid('id').primaryKey().defaultRandom(),
  day: date('day').notNull().unique(),
  name: text('name').notNull(),
  note: text('note'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // REVOKED, NOT DELETED — and revocation does not reach backwards.
  //
  // isHoliday is read at COMPUTE time, so removing the row would not merely
  // lose a note: it would make that day recompute as owed, retroactively, for
  // everybody. People correctly excused in August would acquire a missing day
  // in November with nothing on screen to explain it — the exact silent
  // rewrite of history this feature exists to prevent.
  //
  // So the row survives, and `revokedFrom` is the day the cancellation takes
  // effect. A day BEFORE it stays a holiday forever: you can call off a
  // shutdown that has not happened yet, but you cannot un-hold one people
  // already took.
  revokedFrom: date('revoked_from'),
  revokedBy: uuid('revoked_by').references(() => users.id),
})

// The stakeholder seat's reach: explicit, per-app, read-only.
//
// Deliberately not assignments — a client is not allocated to the project,
// they are permitted to look at it, and conflating the two would put them in
// capacity maths they have no business being in.
//
// REVOKED BY DELETE, for the same reason webauthn_credentials is exempted
// from the soft-delete rule: this is an access key. A restorable grant is a
// key that can come back from the dead, so revocation must be absolute.
export const appGrants = pgTable('app_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  appId: uuid('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
  grantedBy: uuid('granted_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('app_grants_user_app_unique').on(t.userId, t.appId),
  index('app_grants_user_idx').on(t.userId),
])

// One meeting, several projects. Many-to-many, EVERY PROJECT EQUAL: no
// isPrimary, no sortOrder, no createdAt/addedBy. Display order is
// `ORDER BY apps.name` at every read site, so the list is meaningful to a
// reader and cannot repaint when a project is added; who linked what and when
// is already in activity_log, which is where that question belongs.
//
// Same two-column shape and composite primary key as meetingAttendees, and for
// the same reasons: the key IS the invariant (a project appears on a meeting at
// most once, so a double-submit from the picker is a no-op rather than a
// duplicate) and it is the access path for the dominant read, "which projects
// is this meeting on". meeting_apps_app_idx serves the reverse direction and
// gives the app_id cascade an index to use.
//
// NO deletedAt, deliberately — meetingAttendees answered the identical question
// the same way. There is nothing here to retract: unlinking a project loses no
// content, and the row's absence IS the fact. Liveness is the meeting's:
// registered in MEETING_CHILD_TABLES (src/db/live.ts), live iff its meeting is,
// so trashing a meeting leaves these rows alone and restoreMeeting brings the
// meeting back with its projects still attached. Every read must reach it
// through liveMeetings.
//
// "No project" is COUNT(*) = 0 — a company all-hands belongs to nobody, so
// there is no "at least one" constraint and there cannot be one.
export const meetingApps = pgTable('meeting_apps', {
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  appId: uuid('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.meetingId, t.appId] }),
  index('meeting_apps_app_idx').on(t.appId),
])

// Bugs, as reported by whoever hit one.
//
// A SEPARATE TABLE, NOT A TASK WITH A FLAG. The two look alike for about a
// day and then diverge on every field that matters: a task is planned work
// with an assignee, an estimate and a place in a sprint, while a bug arrives
// unplanned from someone who may not work on the project at all, and its
// useful fields — what happened, where, how bad — have no task equivalent.
// Folding them together would also put every unplanned report into the sprint
// counts the board uses to say whether the plan is on track.
//
// The link runs the other way instead: `linkedTaskId` records the task
// somebody created to FIX this, so a triaged bug can point at the work
// without pretending to be it.
export const bugReports = pgTable('bug_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  // NOT NULL, and cascade: a bug is always about a project. Cascade is safe
  // here because a soft-deleted app keeps its rows — only a purge removes
  // them, and a purge is meant to take the project's records with it.
  appId: uuid('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  // What happened, in the reporter's words. Free text on purpose: a required
  // "steps to reproduce / expected / actual" triple is what stops people
  // filing bugs at all.
  description: text('description').notNull(),
  severity: bugSeverity('severity').notNull().default('medium'),
  status: bugStatus('status').notNull().default('open'),
  // The page the reporter was on when they hit it, captured automatically.
  // The single most useful field in a bug report, and the one nobody types.
  pagePath: text('page_path'),
  reportedBy: uuid('reported_by').notNull().references(() => users.id),
  assignedTo: uuid('assigned_to').references(() => users.id),
  // The task somebody opened to fix this, if any. SET NULL rather than
  // cascade: deleting the fix must not delete the report of the problem.
  linkedTaskId: uuid('linked_task_id').references(() => tasks.id, { onDelete: 'set null' }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // The app's own bug list, which is every read on the Bugs tab.
  index('bug_reports_app_live_idx')
    .on(t.appId, t.status, t.createdAt)
    .where(sql`${t.deletedAt} is null`),
  // "What have I reported?" and the workspace-wide triage queue.
  index('bug_reports_reporter_idx').on(t.reportedBy).where(sql`${t.deletedAt} is null`),
  index('bug_reports_status_idx').on(t.status, t.createdAt).where(sql`${t.deletedAt} is null`),
])

// Removing a person from the workspace — a TOMBSTONE TABLE, deliberately not
// a `deleted_at` column on `users`.
//
// WHY NOT THE USUAL SOFT-DELETE SHAPE. Every other soft-deleted table here
// carries deletedAt and is read through a `live*` subquery (src/db/live.ts),
// and src/db/live.test.ts enforces that: a table with deletedAt MUST be
// registered, and every read then filters deleted rows out. That rule is
// right for apps, tasks and meetings — and wrong for people. `users` is
// joined by roughly a hundred reads whose whole job is ATTRIBUTION: who wrote
// this comment, who logged this day, who was in this meeting, who deleted
// this row. Filtering a removed person out of those joins would not hide
// them, it would blank the record of what they did — every past comment
// suddenly by nobody. A person leaving does not un-write their work.
//
// So removal is recorded BESIDE the user instead. Directories, member
// pickers, assignment targets and sign-in ask this table and exclude anyone
// with an open row; attribution joins never consult it and keep resolving the
// name. Same shape as app_role_history and assignment_history: an interval,
// closed by restoring rather than deleted.
//
// NOT deactivation. A deactivated account still signs in and is told it is
// deactivated (users.active). A removed one cannot sign in at all, and stops
// appearing anywhere work is handed out.
export const userDeletions = pgTable('user_deletions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  removedAt: timestamp('removed_at', { withTimezone: true }).notNull().defaultNow(),
  // Nullable and ON DELETE no action: losing the remover's own account must
  // not rewrite the record of who removed whom.
  removedBy: uuid('removed_by').references(() => users.id),
  /** Why they were removed — left, contract ended, duplicate account. */
  reason: text('reason'),
  restoredAt: timestamp('restored_at', { withTimezone: true }),
  restoredBy: uuid('restored_by').references(() => users.id),
}, (t) => [
  // AT MOST ONE open removal per person. Without it, removing an
  // already-removed account opens a second interval and the restore that
  // follows closes only one of them — leaving somebody removed with no row
  // left saying why, and the directory still hiding them.
  uniqueIndex('user_deletions_one_open_idx')
    .on(t.userId)
    .where(sql`${t.restoredAt} is null`),
  index('user_deletions_removed_at_idx').on(t.removedAt),
])

// ---------------------------------------------------------------------------
// Money: what an hour costs and what a project is worth (migration 0048)
// ---------------------------------------------------------------------------
//
// THE SUBSTRATE ONLY. These three tables and the pure maths in
// src/features/finance/cost.ts are the whole of this change: no action reads
// or writes any of them yet, and in particular NOTHING READS person_rates.
// That is deliberate — see the comment on that table.
//
// EVERY AMOUNT IS numeric, NEVER doublePrecision. This file already uses
// doublePrecision for allocation fractions, where a rounding error is a
// cosmetic one. Money summed as a float drifts, and a cost report that
// disagrees with itself by a cent between two screens is a report nobody
// trusts again. Drizzle hands `numeric` back as a STRING for exactly this
// reason; the finance module parses it at its boundary and treats an
// unparseable value as "no rate", never as zero.

// What an hour of a given job role costs. The BASE rate — the normal case,
// and the only one most people ever have.
//
// `role` is `users.title`, the job-role text already carried on a person
// ("Senior Engineer"), matched by value rather than by a foreign key: titles
// are free text an admin types, and a rate card must keep pricing hours that
// were logged under a title nobody holds today.
//
// AS-OF INTERVALS, NEVER A MUTABLE NUMBER — half-open [effective_from,
// effective_to), the same shape as app_role_history and work_schedules, and
// resolved by the same rule (a row whose effective_to equals the day does NOT
// cover it, so two adjacent rows cannot both claim the boundary).
//
// This is the entire reason the table has a shape at all rather than being an
// `hourly` column on some settings row. A rate that is simply EDITED silently
// re-prices every hour ever worked: last quarter's finished project changes
// cost, months after it closed, because somebody got a raise this week. The
// number on a cost report has to be computed against the rate in force on the
// day the work happened, and only an interval can answer that.
//
// DATE, not timestamp, unlike the two history tables above. A rate change is
// something a person states as a calendar day ("from 1 July he bills at X"),
// and worklog_entries.day is a date too — pricing a day against an interval
// keyed to an instant would mean picking an hour for the boundary, which is
// the Colombo/UTC off-by-one this repo has already been bitten by.
export const rateCards = pgTable('rate_cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  role: text('role').notNull(),
  hourly: numeric('hourly', { precision: 12, scale: 2 }).notNull(),
  // One workspace currency. Mixing them is a later problem, and the finance
  // module refuses to sum across two rather than pretending it can.
  currency: text('currency').notNull(),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  setBy: uuid('set_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // The only read: "every rate this role has ever had", walked to find the one
  // covering a day.
  index('rate_cards_role_from_idx').on(t.role, t.effectiveFrom),
  // AT MOST ONE open interval per role, the same guard as
  // app_role_history_one_open_idx and work_schedules_one_open_idx. Two open
  // rows would make "what did this role cost on 12 June" ambiguous, and an
  // ambiguous cost is worse than no cost.
  uniqueIndex('rate_cards_one_open_idx')
    .on(t.role)
    .where(sql`${t.effectiveTo} is null`),
])

// The optional per-person override, for someone whose rate genuinely differs
// from their role's. Same shape, same half-open interval, same resolution
// rule; an override beats the role rate for the days it covers, and its
// ABSENCE means the role rate, which is the normal case and must stay so.
//
// THIS IS SALARY DATA AND IS TREATED AS SUCH. The design (docs/superpowers/
// specs/2026-08-20-project-cost-and-worth-design.md) is explicit:
//
//   - It is gated by ITS OWN capability, which DOES NOT EXIST YET. The
//     capability matrix belongs to another session and nobody currently holds
//     it. The table can land without that decision; anything that EXPOSES a
//     rate cannot, so no query, action or loader in this repo reads this
//     table, on purpose. Whoever adds the first reader must add the gate in
//     the same change — not after it.
//   - Never rendered in any per-person view: not the person page, not the
//     directory, not a tooltip.
//   - NO COST-PER-PERSON CHART, EVER. A bar chart of cost by person is a
//     salary chart with extra steps. Cost aggregates to project, team, role
//     or time, never to an individual.
export const personRates = pgTable('person_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  hourly: numeric('hourly', { precision: 12, scale: 2 }).notNull(),
  currency: text('currency').notNull(),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  setBy: uuid('set_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('person_rates_user_from_idx').on(t.userId, t.effectiveFrom),
  // Same invariant as rate_cards_one_open_idx, per person.
  uniqueIndex('person_rates_one_open_idx')
    .on(t.userId)
    .where(sql`${t.effectiveTo} is null`),
])

// What a project is worth. One row per app.
//
// TWO KINDS OF MONEY, TWO COLUMNS, AND THEY ARE NEVER ADDED TOGETHER. A
// fixed-price build (contract_value) and a monthly retainer
// (subscription_monthly) answer different questions — "what is this build
// worth" versus "what does this earn while it runs" — and a single "worth"
// figure quietly merging them is the two-numbers-under-one-name disease
// docs/kpi-inventory.md already catalogues thirteen instances of. The finance
// module returns them separately and makes the caller label each.
//
// BOTH ARE NULLABLE, and null means "not stated", never zero. An internal
// tool has no contract value; that is not the same fact as a contract worth
// nothing, and margin against it must report "cannot say" rather than a
// number.
//
// SUBSCRIPTION IS A DATE RANGE, NOT A LEDGER. subscriptionAccrued() walks
// [subscription_from, subscription_to) at READ time. There are deliberately no
// per-month rows: a missed cron would silently under-report revenue, and the
// under-report looks exactly like a quiet month. The range is the source of
// truth and it cannot fall behind.
export const projectValue = pgTable('project_value', {
  id: uuid('id').primaryKey().defaultRandom(),
  appId: uuid('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
  contractValue: numeric('contract_value', { precision: 14, scale: 2 }),
  subscriptionMonthly: numeric('subscription_monthly', { precision: 14, scale: 2 }),
  subscriptionFrom: date('subscription_from'),
  // HALF-OPEN, like every other interval in this file: the subscription runs
  // up to but not including this day, so an end and the next start can share a
  // date without billing it twice.
  subscriptionTo: date('subscription_to'),
  currency: text('currency').notNull(),
  setBy: uuid('set_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // ONE row per app, enforced rather than assumed. Two rows would make "what
  // is this project worth" ambiguous in the one place the question is asked.
  uniqueIndex('project_value_app_idx').on(t.appId),
])

// PLANNED MAINTENANCE — the one row in this file that can hold every person
// out of the app.
//
// A SINGLETON, enforced by the primary key rather than by convention: `id` is
// text with a CHECK that pins it to 'current', so a second window is a
// constraint violation instead of an ambiguity about which one is in force.
//
// EPOCH MILLISECONDS, NOT timestamps. The admin picks the window in a
// datetime-local input and every surface counts down to it in the browser, so
// the number the client needs is a millisecond. Storing timestamptz would mean
// a conversion on the way out, in the one place where being five and a half
// hours wrong locks the workspace at the wrong time. See
// src/features/maintenance/window.ts, which owns every reading of these.
//
// mode AND kind ARE text, NOT pgEnum, on purpose. The parser in window.ts
// treats an unrecognised value as "no maintenance", which is the fail-open
// behaviour the whole feature rests on. A database enum would instead make an
// unknown value an INSERT error at arm time and a value this build cannot read
// at parse time — trading a safe read for a hard write failure, in the feature
// whose one rule is that a malformed row must never lock anybody out.
//
// NO deletedAt. This is app configuration, not somebody's work, so it is
// outside the soft-delete contract (adding the column would also fail check 5
// in src/db/live.test.ts unless the table joined SOFT_TABLES, which it must
// not). An ended window is inert and the next arming overwrites it.
export const maintenanceWindow = pgTable('maintenance_window', {
  id: text('id').primaryKey().default('current'),
  enabled: boolean('enabled').notNull().default(false),
  startAtMs: bigint('start_at_ms', { mode: 'number' }).notNull(),
  endAtMs: bigint('end_at_ms', { mode: 'number' }).notNull(),
  message: text('message').notNull().default(''),
  mode: text('mode').notNull(),
  kind: text('kind').notNull(),
  // Nullable: a window armed by an account since removed still has to render
  // its own message rather than failing to load.
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdByName: text('created_by_name').notNull().default('an admin'),
  // THESE HOLD A startAtMs, NOT THE MOMENT OF THE ANNOUNCEMENT — which is why
  // "notified for which window" is answerable at all. Comparing them against
  // the current startAtMs is what makes a re-armed window announce again
  // instead of staying silent because a previous window was already announced.
  startNotifiedAtMs: bigint('start_notified_at_ms', { mode: 'number' }),
  endNotifiedAtMs: bigint('end_notified_at_ms', { mode: 'number' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
