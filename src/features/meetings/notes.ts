// Pure, unit-testable pieces of the unified note timeline: speaker-label
// resolution, suggestion-to-task payload mapping, and segment ordering. Kept
// free of DB/network calls on purpose, same as followups.ts — the server
// actions in ai-actions.ts fetch rows and call these functions to decide
// what to do with them.

export type NoteSource = 'typed' | 'voice' | 'ai'

export type SpeakerMapping = { label: string; userId: string | null }

/**
 * Resolves a speaker label to a real user id — and ONLY ever from an explicit
 * `meeting_speakers` row. No row means no person: `null`.
 *
 * A speaker label is a MODEL GUESS. The analysis prompt asks Gemini to "map
 * speakers to attendee names where possible", so a label is just as likely to
 * be "the name I heard in this passage" as "the person speaking". This
 * function used to fall back to matching the label as a name against the
 * meeting's attendees when no mapping existed, which turned that guess into a
 * rendered fact — a note attributed in production to someone who was talked
 * ABOUT, not talking — and, through the same call in ai-actions.ts,
 * pre-assigned a real task to them.
 *
 * A mapping to `null` ("not a listed attendee") is a real answer and is
 * returned as-is; it is indistinguishable here from "no row yet" only because
 * both correctly mean "do not attribute this to anyone". The difference is
 * kept in `meeting_speakers` (a row exists once a human has looked) and is
 * what the UI reads to tell "unassigned" from "checked, nobody".
 *
 * The label itself is never discarded — callers keep `speakerLabel` and the
 * timeline renders it as a mono chip, visibly a label rather than a name,
 * until someone confirms who it was.
 */
export function resolveSpeakerUserId(
  label: string | null | undefined,
  mappings: SpeakerMapping[],
): string | null {
  if (!label) return null
  const mapping = mappings.find((m) => m.label === label)
  return mapping ? mapping.userId : null
}

export type SpeakerAssignmentPlan = {
  /** The user the label now resolves to; null = "not a listed attendee". */
  userId: string | null
  /** Whether a `meeting_attendees` row (+ its open history row) is needed. */
  addAttendee: boolean
  /** Whether an `assignments` row (+ its history pair) is needed. */
  addAssignment: boolean
}

/**
 * Decides which writes assigning a speaker label to a person implies.
 *
 * Assigning a label is allowed to reach past the meeting: naming someone who
 * wasn't on the invite list means they WERE in the room, so they belong on
 * the attendee list; and if the meeting belongs to an app they carry no
 * assignment for, they were doing that app's work. Both are real membership
 * claims, so both are written — but only when they're actually missing, which
 * is the whole job of this function.
 *
 * Pure so the branching is testable without a database. The server action
 * (assignSpeaker) turns the plan into one db.batch, which is what makes the
 * cascade all-or-nothing: no reachable state has a label mapped to someone
 * who isn't an attendee.
 */
export function planSpeakerAssignment(input: {
  userId: string | null
  /** Current `meeting_attendees` user ids for this meeting. */
  attendeeIds: string[]
  /** The meeting's app, or null when it isn't linked to one. */
  appId: string | null
  /** App ids this user already has an `assignments` row for. */
  assignedAppIds: string[]
}): SpeakerAssignmentPlan {
  // "Not a listed attendee" resolves to nobody, so there is nobody to add
  // anywhere — it is a statement about the label, not about a person.
  if (!input.userId) return { userId: null, addAttendee: false, addAssignment: false }

  return {
    userId: input.userId,
    addAttendee: !input.attendeeIds.includes(input.userId),
    // A meeting with no app has no project to belong to; an assignment row
    // would have nothing to point at.
    addAssignment: input.appId !== null && !input.assignedAppIds.includes(input.appId),
  }
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
