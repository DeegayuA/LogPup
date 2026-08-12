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

// --- Auto-assign: deciding which AI-proposed action items become real
// tasks with no click, vs. staying today's manual "Add task" suggestion
// card. Pure decision logic lives here; the DB/network execution (creating
// the task, inserting the suggestion row, notifying the assignee) lives in
// ai-actions.ts's persistMeetingAnalysis / insertAutoNotesAndSuggestions.

/**
 * Minimum model self-reported confidence (0–1) an action item must clear
 * before it is auto-assigned instead of left for a person to review. Set
 * deliberately high: an auto-created, auto-notified task is a stronger claim
 * on someone's day than a suggestion card they can vet before it exists, so
 * "confident and correct" has to mean more here than it would for a card
 * nobody is forced to act on.
 */
export const AUTO_ASSIGN_CONFIDENCE = 0.8

/**
 * Hard ceiling on how many tasks ONE meeting's analysis can auto-create.
 * Bounds a single over-eager analysis pass (e.g. one that returns dozens of
 * "confident" action items) — the first this many, in order, auto-assign;
 * anything past it falls back to a manual card, with the timeline showing
 * how many were held back (see meetingAiNotes.autoAssignCappedCount).
 */
export const MAX_AUTO_TASKS_PER_MEETING = 10

export type AutoAssignCandidate = {
  /** The model's own 0–1 estimate for this item, or null if it gave none. */
  confidence: number | null
  /**
   * The assignee, already resolved DETERMINISTICALLY — via an explicit
   * speaker-label mapping or an unambiguous attendee-name match (the same
   * resolveSpeakerUserId/matchPersonToAttendee a manual suggestion uses) —
   * or null if nothing resolved unambiguously. Callers are also responsible
   * for nulling this out when the resolved user fails a safety check (e.g.
   * not an approved user) BEFORE calling shouldAutoAssign — this function
   * only ever asks "was someone resolved", not "should this person receive
   * this task."
   */
  resolvedUserId: string | null
  /** Whether the meeting is linked to an app — createTask requires one. */
  hasApp: boolean
}

/**
 * Whether one action item should be auto-created as a real task rather than
 * left as a manual suggestion card. ALL of the following must hold:
 *   - confidence is a real, finite number >= AUTO_ASSIGN_CONFIDENCE. Missing
 *     confidence (null — an older model shape, or the model omitted it)
 *     never auto-assigns: silence is not confidence.
 *   - resolvedUserId is set: someone was resolved unambiguously.
 *   - hasApp: the meeting has somewhere to file the task.
 * Anything else falls back to today's manual card. Pure and total — never
 * throws, does no I/O, and is the single place this decision is made (so the
 * unit tests below are the actual spec, not a description of it).
 */
export function shouldAutoAssign(candidate: AutoAssignCandidate): boolean {
  const { confidence, resolvedUserId, hasApp } = candidate
  if (confidence === null || !Number.isFinite(confidence)) return false
  if (confidence < AUTO_ASSIGN_CONFIDENCE) return false
  if (!resolvedUserId) return false
  if (!hasApp) return false
  return true
}

export type AutoAssignDecision = {
  /** True: create the real task now. */
  autoAccept: boolean
  /** True: this item WOULD auto-assign, but the meeting already hit MAX_AUTO_TASKS_PER_MEETING. */
  capped: boolean
}

/**
 * Applies MAX_AUTO_TASKS_PER_MEETING to a whole meeting's candidates, in
 * order, deciding which ones actually get to auto-create a task. The first
 * `cap` candidates that pass shouldAutoAssign are marked `autoAccept`;
 * anything past the cap that WOULD otherwise qualify is marked `capped`
 * (not merely ineligible) — this is what the "N more suggestions need
 * review" note counts, distinct from every other manual card whose text
 * never made it past shouldAutoAssign at all.
 *
 * Pure: takes no createTask, does no DB work, decides nothing about WHETHER
 * a create later succeeds. ai-actions.ts calls this once per analysis, then
 * only attempts createTask for the indices marked `autoAccept` — so a
 * failed task creation (caught there, falls back to a manual card) can never
 * desync this count from what was actually decided.
 */
export function partitionAutoAssign(
  candidates: AutoAssignCandidate[],
  cap: number = MAX_AUTO_TASKS_PER_MEETING,
): AutoAssignDecision[] {
  let autoCount = 0
  return candidates.map((candidate) => {
    if (!shouldAutoAssign(candidate)) return { autoAccept: false, capped: false }
    if (autoCount < cap) {
      autoCount += 1
      return { autoAccept: true, capped: false }
    }
    return { autoAccept: false, capped: true }
  })
}

export type AutoAssignedTaskFields = {
  status: 'todo' | 'in_progress' | 'done'
  title: string
  assigneeId: string | null
  dueDate: string | null
}

/**
 * Whether an auto-accepted suggestion's created task is still eligible for
 * Undo. Tasks carry no updatedAt/version column, so "unmodified" is judged
 * by comparing the task's CURRENT fields against what the auto pass set at
 * creation (reconstructible from the suggestion row itself — see
 * suggestionToTaskPayload — since the auto path never applies overrides).
 * Eligible only when ALL hold:
 *   - still 'todo' (moving it means someone started or finished the work)
 *   - title, assignee, and due date are all still exactly what was set
 * Any drift means a person has already acted on this task, and Undo
 * silently deleting their change out from under them would be worse than
 * leaving the card as "Auto-assigned" with no Undo offered.
 */
export function canUndoAutoAssign(
  current: AutoAssignedTaskFields,
  original: AutoAssignedTaskFields,
): boolean {
  return (
    current.status === 'todo' &&
    current.title === original.title &&
    current.assigneeId === original.assigneeId &&
    current.dueDate === original.dueDate
  )
}

export type AutoAssignNotificationInput = {
  assigneeId: string
  recorderId: string
  /** Display name of whoever recorded/ran the analysis; falls back to "Someone". */
  recorderName: string | null
  taskTitle: string
  meetingId: string
  meetingTitle: string
}

export type AutoAssignNotificationPayload = {
  userId: string
  actorId: string
  type: 'mention'
  title: string
  body: string
  link: string
  meetingId: string
}

/**
 * Builds the notification an auto-assigned task fires for its assignee —
 * same shape (and same `type: 'mention'`) as the existing @mention
 * notifications (see notify.ts createNotifications), so it reads
 * identically in the notification list rather than inventing a new visual
 * language for one more case. Returns null when the assignee IS the
 * recorder: telling someone "you assigned yourself a task" is not news, and
 * the whole point of notifying is that finding out is what makes full-auto
 * trustworthy — there is nothing to find out about your own action.
 */
export function buildAutoAssignNotification(
  input: AutoAssignNotificationInput,
): AutoAssignNotificationPayload | null {
  if (input.assigneeId === input.recorderId) return null
  return {
    userId: input.assigneeId,
    actorId: input.recorderId,
    type: 'mention',
    title: `${input.recorderName ?? 'Someone'} assigned you a task`,
    body: `“${input.taskTitle}” — from “${input.meetingTitle}”`,
    link: '/meetings',
    meetingId: input.meetingId,
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
