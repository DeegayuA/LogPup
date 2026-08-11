import {
  pgTable, pgEnum, text, uuid, integer, boolean, date, timestamp,
  uniqueIndex, primaryKey, jsonb,
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
export const sprintStatus = pgEnum('sprint_status', ['planned', 'active', 'done'])
export const taskStatus = pgEnum('task_status', ['todo', 'in_progress', 'done'])
export const notificationType = pgEnum('notification_type', ['mention', 'meeting'])
export const followupKind = pgEnum('followup_kind', ['question', 'action'])
export const followupStatus = pgEnum('followup_status', ['open', 'resolved'])

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
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const assignments = pgTable('assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  appId: uuid('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  allocationPct: integer('allocation_pct').notNull(),
}, (t) => [uniqueIndex('assignments_user_app_idx').on(t.userId, t.appId)])

export const sprints = pgTable('sprints', {
  id: uuid('id').primaryKey().defaultRandom(),
  appId: uuid('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  goal: text('goal'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  status: sprintStatus('status').notNull().default('planned'),
  notionPageId: text('notion_page_id'),
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
  sortOrder: integer('sort_order').notNull().default(0),
  // Plain calendar day, no time: set from phrases like "today" / "friday" in
  // the ⌘K natural-language quick-add (see src/lib/task-intent.ts).
  dueDate: date('due_date'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const meetings = pgTable('meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  appId: uuid('app_id').references(() => apps.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at').notNull(),
  agenda: text('agenda'),
  notes: text('notes'),
  googleEventId: text('google_event_id'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const meetingAttendees = pgTable('meeting_attendees', {
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.meetingId, t.userId] })])

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
  failCount: integer('fail_count').notNull().default(0),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

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
//                    meeting (analyzeMeetingAudio) — resolvedInMeetingId
//                    distinguishes the two (null on a manual resolve).
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
