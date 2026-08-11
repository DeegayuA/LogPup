// Pure, unit-testable pieces of the unified note timeline: speaker-label
// resolution, suggestion-to-task payload mapping, and segment ordering. Kept
// free of DB/network calls on purpose, same as followups.ts — the server
// actions in ai-actions.ts fetch rows and call these functions to decide
// what to do with them.

import { matchPersonToAttendee, type AttendeeRef } from '@/features/meetings/followups'

export type NoteSource = 'typed' | 'voice' | 'ai'

export type SpeakerMapping = { label: string; userId: string | null }

/**
 * Resolves a speaker label ("Speaker 1", or an attendee name the model
 * recognized) to a real user id.
 *
 * An explicit mapping (set via the speaker-assignment control) always wins —
 * including one that maps a label to `null` ("not a listed attendee"),
 * which must NOT fall through to name-matching once a human has looked at
 * it. Only when no mapping exists yet does this fall back to matching the
 * label as a name against the meeting's attendees (matchPersonToAttendee),
 * which is what lets a model-recognized "Kasun Silva" resolve automatically
 * without waiting on a manual assignment.
 */
export function resolveSpeakerUserId(
  label: string | null | undefined,
  mappings: SpeakerMapping[],
  attendees: AttendeeRef[],
): string | null {
  if (!label) return null
  const mapping = mappings.find((m) => m.label === label)
  if (mapping) return mapping.userId
  return matchPersonToAttendee(label, attendees)
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Validates a due-date string is a real, well-formed `YYYY-MM-DD` date,
 * returning null for anything else (missing, malformed, or a free-text
 * phrase the model returned despite being asked for ISO). Never throws.
 */
export function normalizeDueDate(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!ISO_DATE_RE.test(trimmed)) return null
  const parsed = new Date(`${trimmed}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return trimmed
}

export type TaskSuggestionSource = {
  text: string
  suggestedUserId: string | null
  suggestedDueDate: string | null
}

export type MeetingTaskContext = {
  appId: string
  sprintId: string | null
}

export type TaskSuggestionOverrides = {
  title?: string
  assigneeId?: string | null
  dueDate?: string | null
  priority?: number
}

export type TaskCreatePayload = {
  appId: string
  sprintId: string | null
  title: string
  assigneeId: string | null
  dueDate: string | null
  priority: number
  status: 'todo'
}

/**
 * Maps an accepted (or edited-then-accepted) suggestion to the payload
 * `createTask` expects. `overrides` come from the "Edit" form — any field a
 * caller explicitly sets (including explicitly clearing it to null) wins
 * over the AI's original suggestion; an omitted (`undefined`) field falls
 * back to the suggestion as proposed.
 */
export function suggestionToTaskPayload(
  suggestion: TaskSuggestionSource,
  context: MeetingTaskContext,
  overrides: TaskSuggestionOverrides = {},
): TaskCreatePayload {
  const title = (overrides.title ?? suggestion.text).trim()
  const assigneeId = overrides.assigneeId !== undefined ? overrides.assigneeId : suggestion.suggestedUserId
  const dueDate =
    overrides.dueDate !== undefined ? overrides.dueDate : normalizeDueDate(suggestion.suggestedDueDate)
  const priority = overrides.priority ?? 0

  return {
    appId: context.appId,
    sprintId: context.sprintId,
    title,
    assigneeId,
    dueDate,
    priority,
    status: 'todo',
  }
}

export type OrderableSegment = {
  id: string
  source: NoteSource
  startedAtMs: number | null
  createdAt: Date
}

/**
 * Orders note segments chronologically for the timeline.
 *
 * Primary key is `createdAt` — real wall-clock time, always present, and
 * what actually separates "typed during the meeting" from "the AI's
 * write-up afterwards". A batch of 'voice' segments inserted together from
 * one analysis pass shares (near-)identical `createdAt`, so `startedAtMs`
 * (their position in the recording) breaks the tie between them. Segments
 * with no `startedAtMs` — including every 'typed'/'ai' segment, and any
 * 'voice' segment the model couldn't place — keep their input order
 * relative to one another (a stable sort, not "first" or "last").
 */
export function orderNoteSegments<T extends OrderableSegment>(segments: T[]): T[] {
  return segments
    .map((segment, index) => ({ segment, index }))
    .sort((a, b) => {
      const byTime = a.segment.createdAt.getTime() - b.segment.createdAt.getTime()
      if (byTime !== 0) return byTime

      const aOffset = a.segment.startedAtMs
      const bOffset = b.segment.startedAtMs
      if (aOffset !== null && bOffset !== null) return aOffset - bOffset
      if (aOffset !== null) return -1
      if (bOffset !== null) return 1

      return a.index - b.index
    })
    .map((entry) => entry.segment)
}
