import { sql } from 'drizzle-orm'
import {
  bigint,
  pgTable, pgEnum, text, uuid, integer, doublePrecision, boolean, date, timestamp,
  index, uniqueIndex, primaryKey, jsonb,
} from 'drizzle-orm/pg-core'

export const userRole = pgEnum('user_role', ['admin', 'member'])
// Open self-signup + admin approval. New rows default to 'pending' — the
// jwt/session gate (src/lib/auth.ts, src/proxy.ts) lets a pending user hold a
// session (so they can complete onboarding at /pending) but blocks every
// other route until an admin approves or rejects them. 'rejected' is a
// dead end: sign-in is still denied outright (see the signIn callback) —
// the status column is what /pending shows to explain that.
export const userStatus = pgEnum('user_status', ['pending', 'approved', 'rejected'])
export const appStatus = pgEnum('app_status', ['active', 'paused', 'archived'])
// The two roles app_role_history tracks as-of intervals for. Closed set, like
// every other "kind" column in this file, hence a pg enum rather than free
// text (contrast assignments.role / assignmentHistory.role, which are
// per-project free text and stay `text`).
export const appRoleKind = pgEnum('app_role_kind', ['pm', 'lead'])
export const sprintStatus = pgEnum('sprint_status', ['planned', 'active', 'done'])
export const taskStatus = pgEnum('task_status', ['todo', 'in_progress', 'done'])
export const notificationType = pgEnum('notification_type', ['mention', 'meeting'])
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
  role: userRole('role').notNull().default('member'),
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
  // Alternate names/initials this person is known by elsewhere in the data
  // (meeting transcripts, follow-up authors, AI notes) — e.g. "W.A.D.N. Perera"
  // stored here as an alias for a user named "Nuwan". matchPersonToAttendee
  // (src/features/meetings/followups.ts) only ever compares against
  // users.name's first whitespace-split token, so a name recorded in any
  // other form silently never matches without an entry here. Admin-set only;
  // nullable/no default because most users need none.
  aliases: text('aliases').array(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const apps = pgTable('apps', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
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
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

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
  dueDate: date('due_date'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by').references(() => users.id),
}, (t) => [
  // Covers the board's only read: filter (app_id, sprint_id), order by rank.
  // `tasks` had no index at all, so every board render was a full scan + sort.
  index('tasks_app_sprint_sort_idx').on(t.appId, t.sprintId, t.sortOrder).where(sql`${t.deletedAt} is null`),
])

export const meetings = pgTable('meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  appId: uuid('app_id').references(() => apps.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at').notNull(),
  agenda: text('agenda'),
  notes: text('notes'),
  // Video-call link (Meet/Zoom/etc.) for one-click join. Optional.
  meetingUrl: text('meeting_url'),
  googleEventId: text('google_event_id'),
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
// Rows older than 12 months are pruned (privacy-prune pattern; exempt
// from the soft-delete rule — there is nothing to restore).
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
  type: notificationType('type').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  link: text('link'),
  meetingId: uuid('meeting_id').references(() => meetings.id, { onDelete: 'cascade' }),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

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
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('meeting_recording_segments_meeting_index_idx').on(t.meetingId, t.index)])

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
