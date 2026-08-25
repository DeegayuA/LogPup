// Pure, unit-testable pieces of the unified note timeline: speaker-label
// resolution, suggestion-to-task payload mapping, segment ordering, app
// routing for AI task suggestions, and the "Around the table" meeting-prep
// assembly. Kept free of DB/network calls on purpose, same as followups.ts —
// the server actions in ai-actions.ts fetch rows and call these functions to
// decide what to do with them.

import {
  checkinGap,
  computeTaskProgress,
  type CheckinGap,
} from '@/features/sprints/checkins'
import { isOverdue, isTerminal, type TaskStatus } from '@/features/sprints/board-view'

export type NoteSource = 'typed' | 'voice' | 'ai'

export type SpeakerMapping = {
  label: string
  userId: string | null
  /** Free-text name typed for a voice that is nobody on the invite. Only
   *  meaningful while userId is null — see resolveSpeakerName. */
  displayName?: string | null
}

/**
 * Resolves a speaker label to a real user id — and ONLY ever from an explicit
 * `meeting_speakers` row. No row means no person: `null`.
 *
 * Resolves ONLY through an explicit, human-confirmed `meeting_speakers`
 * mapping. No mapping means no user: the caller must render the raw label,
 * not a person.
 *
 * This used to fall back to `matchPersonToAttendee(label, attendees)`, so a
 * model-recognized "Kasun Silva" resolved without waiting on a manual
 * assignment. That convenience shipped a real bug: diarization labels are
 * frequently names the model heard *mentioned* rather than the name of
 * whoever was speaking, so notes got attributed to people who were talked
 * ABOUT, not talking. Worse, this same function resolves
 * `suggestedAssigneeLabel`, so one bad guess pre-assigned a real task to the
 * wrong person — a guess laundered into a fact nobody was asked to confirm.
 *
 * `matchPersonToAttendee` is still correct and still used elsewhere; what was
 * wrong was treating its output as confirmed.
 */
export function resolveSpeakerUserId(
  label: string | null | undefined,
  mappings: SpeakerMapping[],
): string | null {
  if (!label) return null
  const mapping = mappings.find((m) => m.label === label)
  return mapping ? mapping.userId : null
}

export type SpeakerNameParts = {
  /** Name of the mapped user, when the label resolved to a real account. */
  userName?: string | null
  /** Free-text name typed for a voice with no account. */
  displayName?: string | null
  /** The as-transcribed label ("Speaker 1"). */
  label?: string | null
}

/**
 * The one name a speaker is shown under: mapped user's name, then a typed-in
 * displayName, then the raw label.
 *
 * The user's name outranks displayName because it is the live one — a
 * mapping made before a rename would otherwise keep showing the old spelling
 * forever, and only one of the two can be kept true without the other. The
 * label comes last because it is the thing every caller is trying to replace;
 * it survives as a fallback so an unassigned voice still reads as "Speaker 1"
 * rather than disappearing. Blank/whitespace values are treated as absent, so
 * a name saved as spaces cannot blank out the label behind it. Null only when
 * nothing at all is known — callers decide what to say then, since the right
 * fallback differs per surface (an author's name, "Voice", "Unknown").
 */
export function resolveSpeakerName(parts: SpeakerNameParts): string | null {
  const firstReal = [parts.userName, parts.displayName, parts.label]
    .map((value) => value?.trim())
    .find((value) => !!value)
  return firstReal ?? null
}

/** A mapping row as the timeline reads it: the row plus the joined user's name. */
export type NamedSpeakerMapping = SpeakerMapping & { userName?: string | null }

/**
 * resolveSpeakerName for a label plus the meeting's mapping rows — what a
 * caller holding a whole timeline (segments + speakers) needs, since a typed
 * name lives on the mapping row and never on the segment itself.
 */
export function resolveSpeakerNameForLabel(
  label: string | null | undefined,
  mappings: NamedSpeakerMapping[],
): string | null {
  const mapping = label ? mappings.find((m) => m.label === label) : undefined
  return resolveSpeakerName({
    userName: mapping?.userName,
    displayName: mapping?.displayName,
    label,
  })
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

// --- App routing: which app an AI-proposed action item should be filed
// into. The model is shown each attendee's app list (names) and asked to
// return "suggestedApp" as an app NAME or null; this resolver is the only
// thing that turns that name back into an id. Same posture as
// matchPersonToAttendee/resolveSpeakerUserId: deterministic, and it gives up
// (null) rather than guess — a task filed into the wrong app is worse than a
// suggestion card that falls back to the meeting's own app.

export type AppOption = { id: string; name: string }

/**
 * Resolves a model-suggested app NAME to an app id. Exact (trimmed) match
 * first, then a case-insensitive match — but only when either is unambiguous.
 *
 * Ambiguity is judged over DISTINCT ids, not raw rows: the caller's list is a
 * union across attendees, so the same app legitimately appears once per
 * person who works on it, and that repetition must not read as "two apps
 * claimed this name". Two DIFFERENT apps sharing a name (even by case) is
 * real ambiguity and resolves to null. Unknown names resolve to null too —
 * the model inventing an app must never route a task anywhere.
 */
export function resolveSuggestedAppId(
  name: string | null | undefined,
  apps: AppOption[],
): string | null {
  if (!name) return null
  const needle = name.trim()
  if (!needle) return null

  const distinctIds = (matches: AppOption[]) => [...new Set(matches.map((app) => app.id))]

  const exact = distinctIds(apps.filter((app) => app.name.trim() === needle))
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) return null

  const lower = needle.toLowerCase()
  const loose = distinctIds(apps.filter((app) => app.name.trim().toLowerCase() === lower))
  return loose.length === 1 ? loose[0] : null
}

// --- "Around the table" meeting prep: one row per attendee — their apps,
// what the current sprint's board says about each, and their latest sprint
// check-in against what the board computes. Pure assembly over rows the
// server action (getMeetingPrep in ai-actions.ts) fetches; every branchy
// decision (which sprint is "current", which check-in is "latest", what
// counts as overdue) lives here where the tests can pin it down.

export type PrepAttendee = { id: string; name: string }

/** One (user, app) pairing from the live `assignments` table. */
export type PrepAssignmentRow = {
  userId: string
  appId: string
  appName: string
  appSlug: string
}

/** A sprint running now (active, or planned with today inside its range). */
export type PrepSprintRow = {
  sprintId: string
  sprintName: string
  appId: string
  appName: string
  appSlug: string
  /** Plain yyyy-mm-dd, compared lexicographically — never parsed to a Date. */
  startDate: string
}

/** One task inside a running sprint — the inputs the counts need, nothing more. */
export type PrepTaskRow = {
  sprintId: string | null
  assigneeId: string | null
  status: TaskStatus
  dueDate: string | null
}

export type PrepCheckinRow = {
  sprintId: string
  userId: string
  percent: number
  note: string | null
  updatedAt: Date
}

export type AttendeeAppPrep = {
  appId: string
  appName: string
  appSlug: string
  /** Null when the app has no sprint running right now. */
  sprintId: string | null
  sprintName: string | null
  /** This attendee's not-done tasks in the current sprint. */
  openCount: number
  /** Of openCount, strictly past due (isOverdue — due today is not overdue). */
  overdueCount: number
}

export type AttendeeCheckinPrep = {
  sprintId: string
  sprintName: string
  appName: string
  percent: number
  note: string | null
  updatedAt: Date
  /** What the same sprint's board computes for them — null = no tasks there. */
  computedPercent: number | null
  gap: CheckinGap
}

/** Where an inline check-in made from this row should land. */
export type CheckinTarget = {
  sprintId: string
  sprintName: string
  appName: string
  /** Board-computed percent for this (sprint, user) — lets the client show
   *  and re-derive the gap optimistically without a second fetch. */
  computedPercent: number | null
}

export type AttendeePrep = {
  userId: string
  name: string
  /** Sorted by app name; empty when nothing links this person to any app. */
  apps: AttendeeAppPrep[]
  /** Their most recent check-in across their apps' running sprints. */
  checkin: AttendeeCheckinPrep | null
  /** Null when none of their apps has a running sprint to report against. */
  checkinTarget: CheckinTarget | null
}

/**
 * Builds the per-attendee prep rows. Decisions made here, on purpose:
 *
 * - An attendee's apps are the union of their live `assignments` rows and
 *   any app where a running sprint holds a task assigned to them — someone
 *   mid-handover (tasks but no assignment row) still shows up under the app
 *   the meeting will actually ask them about.
 * - "The current sprint" of an app with several running at once is the one
 *   that started most recently: that is the one a standup talks about, and
 *   summing counts across overlapping sprints would double-count a person's
 *   plate. Lexicographic max on yyyy-mm-dd; ties keep the first seen so the
 *   answer is stable across calls.
 * - "Latest check-in" is by updatedAt across their apps' current sprints
 *   only — a check-in on some unrelated sprint is not this meeting's signal.
 * - The check-in target is the sprint their latest check-in is already on
 *   (updating beats scattering), else the current sprint of their first app
 *   alphabetically — deterministic, not clever.
 */
export function assembleMeetingPrep(input: {
  attendees: PrepAttendee[]
  assignments: PrepAssignmentRow[]
  sprints: PrepSprintRow[]
  tasks: PrepTaskRow[]
  checkins: PrepCheckinRow[]
  /** Plain yyyy-mm-dd in the team's calendar — see isOverdue. */
  todayIso: string
}): AttendeePrep[] {
  const currentSprintByApp = new Map<string, PrepSprintRow>()
  for (const sprint of input.sprints) {
    const existing = currentSprintByApp.get(sprint.appId)
    if (!existing || sprint.startDate > existing.startDate) {
      currentSprintByApp.set(sprint.appId, sprint)
    }
  }

  const sprintById = new Map(input.sprints.map((sprint) => [sprint.sprintId, sprint]))

  const tasksBySprint = new Map<string, PrepTaskRow[]>()
  for (const task of input.tasks) {
    if (!task.sprintId) continue
    const group = tasksBySprint.get(task.sprintId)
    if (group) group.push(task)
    else tasksBySprint.set(task.sprintId, [task])
  }

  const checkinsByUser = new Map<string, PrepCheckinRow[]>()
  for (const row of input.checkins) {
    const group = checkinsByUser.get(row.userId)
    if (group) group.push(row)
    else checkinsByUser.set(row.userId, [row])
  }

  return input.attendees.map((attendee) => {
    // Union of assignment apps and task-discovered apps, deduped by id.
    const appsById = new Map<string, { appId: string; appName: string; appSlug: string }>()
    for (const row of input.assignments) {
      if (row.userId !== attendee.id) continue
      appsById.set(row.appId, { appId: row.appId, appName: row.appName, appSlug: row.appSlug })
    }
    for (const task of input.tasks) {
      if (task.assigneeId !== attendee.id || !task.sprintId) continue
      const sprint = sprintById.get(task.sprintId)
      if (!sprint || appsById.has(sprint.appId)) continue
      appsById.set(sprint.appId, {
        appId: sprint.appId,
        appName: sprint.appName,
        appSlug: sprint.appSlug,
      })
    }

    const apps: AttendeeAppPrep[] = [...appsById.values()]
      .sort((a, b) => a.appName.localeCompare(b.appName))
      .map((app) => {
        const sprint = currentSprintByApp.get(app.appId) ?? null
        const sprintTasks = sprint ? (tasksBySprint.get(sprint.sprintId) ?? []) : []
        const mine = sprintTasks.filter((task) => task.assigneeId === attendee.id)
        const open = mine.filter((task) => !isTerminal(task.status))
        return {
          ...app,
          sprintId: sprint?.sprintId ?? null,
          sprintName: sprint?.sprintName ?? null,
          openCount: open.length,
          overdueCount: open.filter((task) => isOverdue(task, input.todayIso)).length,
        }
      })

    // Latest check-in — restricted to this person's apps' CURRENT sprints so
    // a stale report on last month's sprint can't masquerade as fresh signal.
    const currentSprintIds = new Set(
      apps.map((app) => app.sprintId).filter((id): id is string => id !== null),
    )
    let latest: PrepCheckinRow | null = null
    for (const row of checkinsByUser.get(attendee.id) ?? []) {
      if (!currentSprintIds.has(row.sprintId)) continue
      if (!latest || row.updatedAt.getTime() > latest.updatedAt.getTime()) latest = row
    }

    const computedFor = (sprintId: string) =>
      computeTaskProgress(tasksBySprint.get(sprintId) ?? [], attendee.id).percent

    let checkin: AttendeeCheckinPrep | null = null
    if (latest) {
      const sprint = sprintById.get(latest.sprintId)
      const computedPercent = computedFor(latest.sprintId)
      checkin = {
        sprintId: latest.sprintId,
        sprintName: sprint?.sprintName ?? '',
        appName: sprint?.appName ?? '',
        percent: latest.percent,
        note: latest.note,
        updatedAt: latest.updatedAt,
        computedPercent,
        gap: checkinGap(latest.percent, { percent: computedPercent }),
      }
    }

    let checkinTarget: CheckinTarget | null = null
    if (checkin) {
      checkinTarget = {
        sprintId: checkin.sprintId,
        sprintName: checkin.sprintName,
        appName: checkin.appName,
        computedPercent: checkin.computedPercent,
      }
    } else {
      const firstWithSprint = apps.find((app) => app.sprintId !== null)
      if (firstWithSprint) {
        checkinTarget = {
          sprintId: firstWithSprint.sprintId as string,
          sprintName: firstWithSprint.sprintName ?? '',
          appName: firstWithSprint.appName,
          computedPercent: computedFor(firstWithSprint.sprintId as string),
        }
      }
    }

    return { userId: attendee.id, name: attendee.name, apps, checkin, checkinTarget }
  })
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
