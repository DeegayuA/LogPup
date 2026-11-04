import { QueryBuilder } from 'drizzle-orm/pg-core'
import { isNull } from 'drizzle-orm'
import {
  apps, bugReports, meetings, tasks, sprints, meetingNoteSegments, meetingScreenshots,
  worklogEntries, meetingSeries, meetingRecordingSegments, meetingRecordings, attachments,
  taskComments,
  docs,
  messages,
} from './schema'

// Connection-free: QueryBuilder builds SQL without a client, so importing
// this module never touches the lazy db Proxy (build-time safety).
const qb = new QueryBuilder()

// Written out per table rather than through a generic helper: drizzle's
// `.from()` signature is a conditional type that a generic parameter cannot
// satisfy, and — more importantly — an explicit builder per table gives each
// subquery its own column types, so consumers get liveMeetings.startsAt
// rather than a union they have to narrow.

// A fixed subquery object cannot appear twice in one statement, so each
// `*As(name)` mints a fresh aliased subquery for self-joins and queries that
// reference the same table twice.
export const liveAppsAs = (name: string) =>
  qb.select().from(apps).where(isNull(apps.deletedAt)).as(name)
export const liveBugReportsAs = (name: string) =>
  qb.select().from(bugReports).where(isNull(bugReports.deletedAt)).as(name)
export const liveMeetingsAs = (name: string) =>
  qb.select().from(meetings).where(isNull(meetings.deletedAt)).as(name)
export const liveTasksAs = (name: string) =>
  qb.select().from(tasks).where(isNull(tasks.deletedAt)).as(name)
export const liveSprintsAs = (name: string) =>
  qb.select().from(sprints).where(isNull(sprints.deletedAt)).as(name)
export const liveNoteSegmentsAs = (name: string) =>
  qb.select().from(meetingNoteSegments).where(isNull(meetingNoteSegments.deletedAt)).as(name)
export const liveScreenshotsAs = (name: string) =>
  qb.select().from(meetingScreenshots).where(isNull(meetingScreenshots.deletedAt)).as(name)
export const liveWorklogEntriesAs = (name: string) =>
  qb.select().from(worklogEntries).where(isNull(worklogEntries.deletedAt)).as(name)
export const liveMeetingSeriesAs = (name: string) =>
  qb.select().from(meetingSeries).where(isNull(meetingSeries.deletedAt)).as(name)
export const liveRecordingSegmentsAs = (name: string) =>
  qb.select().from(meetingRecordingSegments).where(isNull(meetingRecordingSegments.deletedAt)).as(name)
export const liveRecordingsAs = (name: string) =>
  qb.select().from(meetingRecordings).where(isNull(meetingRecordings.deletedAt)).as(name)
export const liveAttachmentsAs = (name: string) =>
  qb.select().from(attachments).where(isNull(attachments.deletedAt)).as(name)
export const liveTaskCommentsAs = (name: string) =>
  qb.select().from(taskComments).where(isNull(taskComments.deletedAt)).as(name)

export const liveApps = liveAppsAs('live_apps')
export const liveBugReports = liveBugReportsAs('live_bug_reports')
export const liveMeetings = liveMeetingsAs('live_meetings')
export const liveTasks = liveTasksAs('live_tasks')
export const liveSprints = liveSprintsAs('live_sprints')
export const liveNoteSegments = liveNoteSegmentsAs('live_note_segments')
export const liveScreenshots = liveScreenshotsAs('live_screenshots')
export const liveWorklogEntries = liveWorklogEntriesAs('live_worklog_entries')
export const liveMeetingSeries = liveMeetingSeriesAs('live_meeting_series')
export const liveRecordingSegments = liveRecordingSegmentsAs('live_recording_segments')
export const liveRecordings = liveRecordingsAs('live_meeting_recordings')
export const liveAttachments = liveAttachmentsAs('live_attachments')
export const liveTaskComments = liveTaskCommentsAs('live_task_comments')
export const liveDocsAs = (name: string) =>
  qb.select().from(docs).where(isNull(docs.deletedAt)).as(name)
export const liveDocs = liveDocsAs('live_docs')
export const liveMessagesAs = (name: string) =>
  qb.select().from(messages).where(isNull(messages.deletedAt)).as(name)
export const liveMessages = liveMessagesAs('live_messages')

/**
 * Every column of `apps`, taken from the LIVE subquery.
 *
 * Exists because `getTableColumns(apps)` is the obvious way to write "select
 * all of an app's columns" and is wrong the moment the statement reads from
 * `liveApps`: the spread names the RAW table, the FROM names the subquery, and
 * drizzle throws at runtime with
 *
 *   Your "id" field references a column "apps"."id", but the table "apps" is
 *   not part of the query! Did you forget to join it?
 *
 * — which is a runtime error on a page, not a type error at build. One
 * definition here means a converted call site cannot half-convert.
 */
export const liveAppColumns = {
  id: liveApps.id,
  name: liveApps.name,
  slug: liveApps.slug,
  // Carried here rather than left to callers: AppPortfolioEntry is inferred
  // from this set, so a column absent from it is a column no live read can see.
  internal: liveApps.internal,
  description: liveApps.description,
  // The nicknames a project answers to. Here for the reason the comment above
  // gives: AppPortfolioEntry is inferred from this set, so leaving it out would
  // make the column unreadable by every live read and unrenderable by the form
  // that edits it.
  aliases: liveApps.aliases,
  // Same reason: the card and the detail header print it as "#12".
  number: liveApps.number,
  // Same reason again, and a sharper one: the edit form ALWAYS sends the key
  // (that is how one is cleared), so a form seeded without it would erase it.
  key: liveApps.key,
  status: liveApps.status,
  repoUrl: liveApps.repoUrl,
  techTags: liveApps.techTags,
  leadId: liveApps.leadId,
  pmId: liveApps.pmId,
  deletedAt: liveApps.deletedAt,
  deletedBy: liveApps.deletedBy,
  createdAt: liveApps.createdAt,
}

export const SOFT_TABLES = [
  // apps is the widest of the six: a deleted app must vanish from the index,
  // the detail page, ⌘K, every dashboard zone, the meetings calendar and the
  // capacity maths — which is precisely why it is registered here rather than
  // left to each caller to remember an isNull() of its own.
  { table: apps, sqlName: 'apps', live: liveApps, liveAs: liveAppsAs },
  // Registered in the SAME change that creates the table, before its first
  // reader exists — the rule meetingApps established. Adding a soft table to
  // the guard after its readers are written means the guard was blind for
  // exactly as long as it mattered.
  { table: bugReports, sqlName: 'bug_reports', live: liveBugReports, liveAs: liveBugReportsAs },
  { table: meetings, sqlName: 'meetings', live: liveMeetings, liveAs: liveMeetingsAs },
  { table: tasks, sqlName: 'tasks', live: liveTasks, liveAs: liveTasksAs },
  { table: sprints, sqlName: 'sprints', live: liveSprints, liveAs: liveSprintsAs },
  { table: meetingNoteSegments, sqlName: 'meeting_note_segments', live: liveNoteSegments, liveAs: liveNoteSegmentsAs },
  { table: meetingScreenshots, sqlName: 'meeting_screenshots', live: liveScreenshots, liveAs: liveScreenshotsAs },
  // Registered in the SAME change that creates the table, before its first
  // reader exists — the rule meetingApps and bugReports established. A
  // worklog entry is a first-person statement about somebody's own day, so a
  // deleted one reappearing in a total is the app contradicting them about
  // their own hours.
  { table: worklogEntries, sqlName: 'worklog_entries', live: liveWorklogEntries, liveAs: liveWorklogEntriesAs },
  // Registered in the SAME change that adds the column, before its first
  // reader exists — the rule every entry above states. A deleted take's
  // transcript reappearing in a synthesis is the meeting quoting a recording
  // somebody removed on purpose, which is the one thing the delete exists to
  // prevent.
  { table: meetingRecordingSegments, sqlName: 'meeting_recording_segments', live: liveRecordingSegments, liveAs: liveRecordingSegmentsAs },
  { table: meetingRecordings, sqlName: 'meeting_recordings', live: liveRecordings, liveAs: liveRecordingsAs },
  // The table landed in 4d94451 carrying deleted_at but never reached this
  // list, so the guard went red the moment it was declared — which is the
  // guard doing precisely its job. Registered here BEFORE the series UI has a
  // reader, per the rule the entries above state: adding a soft table after
  // its readers exist means the guard was blind for exactly as long as it
  // mattered. A cancelled series must not keep materialising occurrences.
  { table: meetingSeries, sqlName: 'meeting_series', live: liveMeetingSeries, liveAs: liveMeetingSeriesAs },
  // Registered in the SAME change that declares the table (0077), before its
  // first reader exists — the rule every entry above states. A removed file
  // reappearing on a task is the app showing something somebody took down.
  { table: attachments, sqlName: 'attachments', live: liveAttachments, liveAs: liveAttachmentsAs },
  // Same rule, same change (0078): a deleted comment must not reappear in the
  // thread or in a mention digest.
  { table: taskComments, sqlName: 'task_comments', live: liveTaskComments, liveAs: liveTaskCommentsAs },
  // Module C (0082), registered before its first reader: a deleted page must
  // not reappear in the hub, in search or behind a link.
  { table: docs, sqlName: 'docs', live: liveDocs, liveAs: liveDocsAs },
  // Module D (0083), registered before its first reader. Note a chat view
  // may still read raw messages to show "This message was deleted" in place —
  // that reader must say so (live.test.ts allowlist), not skip the guard.
  { table: messages, sqlName: 'messages', live: liveMessages, liveAs: liveMessagesAs },
] as const

// Registered BEFORE anything reads them. Both tables arrived with later
// merges, neither carries a deletedAt of its own, and both are live iff their
// meeting is — so a read that forgets to join liveMeetings would hand back a
// trashed meeting's rows. Adding them to the guard now is free, because
// nothing reads either one yet; adding them after the first reader exists
// means the guard stays blind for exactly as long as it matters.
//
// meetingApps is registered here in the SAME change that creates it, before
// any reader exists — it has no deletedAt of its own and is live iff its
// meeting is, so a read that forgets liveMeetings would hand back a trashed
// meeting's projects (and, through ⌘K, resurface the meeting itself while
// admin Trash still lists it deleted).
export const MEETING_CHILD_TABLES = [
  'meetingAttendees', 'meetingAiNotes', 'meetingFollowups', 'meetingSpeakers',
  'meetingTaskSuggestions', 'meetingRecordingSegments',
  'meetingAttendeeHistory', 'meetingAttendeeRecommendations',
  'meetingApps',
] as const
