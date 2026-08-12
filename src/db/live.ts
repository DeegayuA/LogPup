import { QueryBuilder } from 'drizzle-orm/pg-core'
import { isNull } from 'drizzle-orm'
import {
  meetings, tasks, sprints, meetingNoteSegments, meetingScreenshots,
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

export const liveMeetings = liveMeetingsAs('live_meetings')
export const liveTasks = liveTasksAs('live_tasks')
export const liveSprints = liveSprintsAs('live_sprints')
export const liveNoteSegments = liveNoteSegmentsAs('live_note_segments')
export const liveScreenshots = liveScreenshotsAs('live_screenshots')

export const SOFT_TABLES = [
  { table: meetings, sqlName: 'meetings', live: liveMeetings, liveAs: liveMeetingsAs },
  { table: tasks, sqlName: 'tasks', live: liveTasks, liveAs: liveTasksAs },
  { table: sprints, sqlName: 'sprints', live: liveSprints, liveAs: liveSprintsAs },
  { table: meetingNoteSegments, sqlName: 'meeting_note_segments', live: liveNoteSegments, liveAs: liveNoteSegmentsAs },
  { table: meetingScreenshots, sqlName: 'meeting_screenshots', live: liveScreenshots, liveAs: liveScreenshotsAs },
] as const

export const MEETING_CHILD_TABLES = [
  'meetingAttendees', 'meetingAiNotes', 'meetingFollowups', 'meetingSpeakers',
  'meetingTaskSuggestions', 'meetingRecordingSegments',
] as const
