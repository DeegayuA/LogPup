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
export const attendeeResponse = pgEnum('attendee_response', ['pending', 'going', 'maybe', 'declined'])
export const followupKind = pgEnum('followup_kind', ['question', 'action'])
export const followupStatus = pgEnum('followup_status', ['open', 'resolved'])
export const noteSource = pgEnum('note_source', ['typed', 'voice', 'ai'])
export const suggestionStatus = pgEnum('suggestion_status', ['open', 'accepted', 'dismissed'])

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
  // Video-call link (Meet/Zoom/etc.) for one-click join. Optional.
  meetingUrl: text('meeting_url'),
  googleEventId: text('google_event_id'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const meetingAttendees = pgTable('meeting_attendees', {
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // RSVP state — the attendee marks whether they're coming.
  response: attendeeResponse('response').notNull().default('pending'),
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
})

// Maps a raw speaker label ("Speaker 1", "Speaker 2", …) the live transcript
// or the Gemini analysis produced for ONE meeting to a real user — set by an
// authorized user via the speaker-assignment control on the note timeline.
// userId is nullable so "not a listed attendee" can be recorded explicitly
// (distinct from "not yet assigned": a row exists either way once someone
// has looked at the label). Setting/changing a mapping backfills
// meetingNoteSegments.speakerId on every segment carrying that label.
export const meetingSpeakers = pgTable('meeting_speakers', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
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
  status: suggestionStatus('status').notNull().default('open'),
  createdTaskId: uuid('created_task_id').references(() => tasks.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
