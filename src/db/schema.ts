import {
  pgTable, pgEnum, text, uuid, integer, boolean, date, timestamp,
  uniqueIndex, primaryKey, jsonb,
} from 'drizzle-orm/pg-core'

export const userRole = pgEnum('user_role', ['admin', 'member'])
export const appStatus = pgEnum('app_status', ['active', 'paused', 'archived'])
export const sprintStatus = pgEnum('sprint_status', ['planned', 'active', 'done'])
export const taskStatus = pgEnum('task_status', ['todo', 'in_progress', 'done'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  title: text('title'),
  role: userRole('role').notNull().default('member'),
  active: boolean('active').notNull().default(true),
  passwordHash: text('password_hash'),
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
