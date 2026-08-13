'use server'

import { z } from 'zod'
import { format } from 'date-fns'
import { revalidatePath } from 'next/cache'
import { and, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, ne, notInArray, or, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { alias } from 'drizzle-orm/pg-core'
import { put, get as getBlob } from '@vercel/blob'
import { auth } from '@/lib/auth'
import { allowedDomains, emailAllowed } from '@/lib/allowed-domains'
import { orgForEmail } from '@/lib/org-from-domain'
import { db } from '@/db'
import {
  liveMeetings,
  liveNoteSegments,
  liveScreenshots,
  liveSprints,
  liveTasks,
  liveTasksAs,
} from '@/db/live'
import {
  apps,
  assignmentHistory,
  assignments,
  meetingAiNotes,
  meetingAttendeeHistory,
  meetingAttendees,
  meetingFollowups,
  meetingNoteSegments,
  meetingRecordingSegments,
  meetingScreenshots,
  meetingSpeakers,
  meetingTaskSuggestions,
  meetings,
  // `sprints` is not imported: every sprint READ in this file goes through
  // liveSprints, and nothing here writes a sprint row. `meetings`, `tasks` and
  // meetingNoteSegments/meetingScreenshots stay because their WRITES (soft
  // deletes, inserts, updates) still target the raw tables.
  tasks,
  users,
} from '@/db/schema'
import { buildHistoryEntry } from '@/features/people/allocation-history'
import { buildAttendanceEntry } from '@/features/meetings/attendance-history'
import {
  DEFAULT_GEMINI_MODEL,
  callGemini,
  callGeminiWithAudio,
  callGeminiWithImages,
  GeminiError,
  type GeminiImageInput,
} from '@/features/gemini/client'
import { SYNTHESIS_MODELS } from '@/features/gemini/models'
import {
  estimateMinutesFromAudioBytes,
  summaryDepthInstruction,
} from '@/features/meetings/summary-length'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { revalidateAdmin } from '@/lib/revalidate-admin'
import { updateMeetingNotes } from '@/features/meetings/actions'
import { logActivity } from '@/features/activity/log'
import { createNotifications, extractMentionedUserIds } from '@/features/notifications/notify'
import { createTask } from '@/features/sprints/task-actions'
import {
  buildFollowupRows,
  selectCarriedForward,
  selectUnattributed,
  findMatchingFollowup,
  filterValidIds,
  CARRY_STALE_DAYS,
  type AttendeeRef,
  type CarriedForwardEntry,
  type CarriedForwardGroup,
  type FollowupKind,
  type FollowupMatchCandidate,
  type OpenFollowupItem,
} from '@/features/meetings/followups'
import {
  resolveSpeakerUserId,
  normalizeDueDate,
  planSpeakerAssignment,
  suggestionToTaskPayload,
  orderNoteSegments,
  shouldAutoAssign,
  partitionAutoAssign,
  canUndoAutoAssign,
  buildAutoAssignNotification,
  resolveSuggestedAppId,
  assembleMeetingPrep,
  type NoteSource,
  type SpeakerMapping,
  type AutoAssignCandidate,
  type AutoAssignNotificationPayload,
  type AppOption,
  type AttendeePrep,
} from '@/features/meetings/notes'
import { getCheckinsForSprints } from '@/features/sprints/checkin-queries'
import { toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { concatenateSegments } from '@/features/meetings/recording-segments'
import { formatCapturedAt, MAX_KEYFRAMES_PER_MEETING } from '@/features/meetings/screen-keyframes'
import {
  buildActionList,
  parseSpokenDueDate,
  reconcileActionItems,
  type ActionRow,
} from '@/features/meetings/components/meeting-notes-model'
import { haveNoteSegmentsEverExisted } from '@/features/meetings/legacy-notes'
// Re-exported below (not just imported) — existing callers, including this
// file's own test, import keyframeDeleteLabel/noteSegmentDeleteLabel from
// './ai-actions'. The implementation itself lives in note-labels.ts, a
// dependency-free leaf module shared with src/features/admin/trash-grouping.ts
// so the two neutral labels can never drift into two different strings.
import { keyframeDeleteLabel, noteSegmentDeleteLabel } from '@/features/meetings/note-labels'

export { keyframeDeleteLabel, noteSegmentDeleteLabel }

// Legacy single-shot path (analyzeMeetingAudio, below): the whole recording
// as one inline-base64 upload. Superseded for live recordings by the
// segmented pipeline (transcribeSegment + finalizeMeetingRecording, further
// down) — kept working for anything that still calls it directly. 7MB stays
// under next.config.ts's 8MB server action body limit with headroom for
// multipart overhead; the old 15MB figure predates that limit being lowered
// (see next.config.ts's comment for why 8MB, not the audio size itself,
// changed).
const MAX_AUDIO_BYTES = 7 * 1024 * 1024
// One recording segment (~5 minutes at 32kbps, ~1.2MB nominal — see
// SEGMENT_TARGET_MS in recording-segments.ts) should never come close to
// this; it exists to reject a segment that's wildly oversized (e.g. a
// browser ignoring the requested bitrate) with a clear per-segment error
// instead of a generic 413 from the Next.js body-size limit.
const MAX_SEGMENT_AUDIO_BYTES = 6 * 1024 * 1024
const MAX_LIVE_TRANSCRIPT_CHARS = 100_000
const MAX_RESOLUTION_NOTE_CHARS = 500
// Same ceiling for the two open-item notes (what they said / why it's not
// done): they're the same kind of short, typed-in-the-moment sentence.
const MAX_FOLLOWUP_NOTE_CHARS = 500
const MAX_FOLLOWUP_TEXT_CHARS = 300
const MAX_SEGMENT_LENGTH = 5000 // matches MAX_NOTES_LENGTH in actions.ts
// How many upcoming meetings a hand-added follow-up can be pinned to. A
// picker is a decision aid, not an archive — past this, "their next meeting"
// is the better answer anyway.
const MAX_FOLLOWUP_TARGETS = 25

// A malformed (non-UUID) meetingId would otherwise reach the DB as a raw
// `uuid` column comparison and throw a Postgres "invalid input syntax"
// error instead of a clean ActionResult — validate the shape up front.
const idInput = z.uuid()
const liveTranscriptInput = z.string().max(MAX_LIVE_TRANSCRIPT_CHARS)

export type PerPersonNote = { name: string; points: string[]; actionItems: string[] }
export type DeadlineNote = { item: string; owner: string; due: string }
export type TermNote = { term: string; explanation: string; sinhala: string }
export type QuestionNote = { person: string; questions: string[] }

export type MeetingAiNotesView = {
  language: string
  transcript: string | null
  summary: string | null
  perPerson: PerPersonNote[]
  deadlines: DeadlineNote[]
  terms: TermNote[]
  questions: QuestionNote[]
  model: string
  createdAt: Date
  /** How many auto-eligible action items from THIS analysis pass were held back by MAX_AUTO_TASKS_PER_MEETING. */
  autoAssignCappedCount: number
}

export type FollowupStatus = 'open' | 'resolved'

/**
 * A carried-forward item as the UI needs it: the pure carry-forward entry
 * plus where it stands. `status` is what separates "still owed" from "dealt
 * with"; the three note fields are deliberately distinct records that answer
 * different questions and never overwrite each other:
 *   resolutionNote  what came of it (only meaningful once resolved)
 *   responseNote    what the person actually said about it, still open
 *   deferReason     why it isn't done yet, still open
 * All three are optional — every action here is one click, and the writing
 * is enrichment layered on afterwards.
 */
/** A linked task's live status, for the "show the task instead of a bare resolve button" UI. */
export type LinkedTaskView = {
  id: string
  title: string
  status: 'todo' | 'in_progress' | 'done'
  appSlug: string | null
}

export type CarriedForwardItem = CarriedForwardEntry & {
  status: FollowupStatus
  resolutionNote: string | null
  responseNote: string | null
  deferReason: string | null
  resolvedAt: Date | null
  /** Set when a person added this by hand; null for AI-derived items. */
  createdBy: string | null
  /** Set when it was pinned to one specific meeting instead of carrying. */
  targetMeetingId: string | null
  /** The task that will resolve this item on completion, if one is linked — see linkFollowupToTask. */
  linkedTask: LinkedTaskView | null
}

export type CarriedForwardItemGroup = {
  userId: string
  person: string
  items: CarriedForwardItem[]
  /** How many more open items this person has beyond what `items` shows — see MAX_CARRIED_PER_PERSON. */
  overflowCount: number
}

/** Someone a hand-added follow-up can be attributed to, or an unattributed item can be given to. */
export type FollowupPersonOption = { id: string; name: string }

/** An open follow-up the model heard but couldn't match to a user — surfaced on its own source meeting. */
export type UnattributedFollowupView = {
  id: string
  personName: string
  text: string
  kind: FollowupKind
  createdAt: Date
}

/**
 * A meeting a hand-added follow-up can be pinned to. `attendeeIds` lets the
 * picker only offer meetings the chosen person will actually be at — an item
 * pinned to a meeting they don't attend would never surface.
 */
export type FollowupTargetOption = {
  id: string
  title: string
  startsAt: Date
  attendeeIds: string[]
}

export type MeetingIntel = {
  notes: MeetingAiNotesView | null
  prep: CarriedForwardItemGroup[]
  /** This meeting's attendees — the people a new follow-up can be given to. */
  people: FollowupPersonOption[]
  /** Every approved user, for the "Needs attribution" picker's fallback pool beyond this meeting's attendees. */
  approvedUsers: FollowupPersonOption[]
  /** This meeting's own open follow-ups the model couldn't attribute to a user — see attributeFollowup. */
  unattributed: UnattributedFollowupView[]
  /** Later meetings the caller can see, for the optional "link to" picker. */
  upcomingMeetings: FollowupTargetOption[]
  /** Change-detected screen keyframes captured during recording, oldest first. */
  screenshots: MeetingScreenshotView[]
  /** The per-meeting auto-assign toggle (meetings.autoAssignTasks) — see setMeetingAutoAssignTasks. */
  autoAssignTasks: boolean
  /**
   * Open + auto-accepted task suggestions — the single source of truth for
   * "action items" in the write-up. Identical query to getMeetingNoteTimeline's
   * own suggestions (both call fetchTaskSuggestions), returned here too so the
   * Action items panel and the Record timeline's cards are built from exactly
   * the same rows rather than two independently-fetched copies that could
   * drift apart mid-session.
   */
  suggestions: TaskSuggestionView[]
  /**
   * JSONB action items (from meetingAiNotes.deadlines[] /
   * perPerson[].actionItems[]) that have no matching row in `suggestions` OF
   * ANY STATUS — see reconcileActionItems in meeting-notes-model.ts. The
   * panel used to render deadlines[]/perPerson[] directly as a read-only
   * list; now that it renders `suggestions` instead, anything the suggestion
   * pipeline never saw (an item that only ever existed in the free-text
   * deadlines[] field, or one from an analysis pass that predates task
   * suggestions) would silently vanish without this — surfaced here so the
   * panel can show it in a "Not tracked" group with a one-click "track this".
   */
  untrackedActions: ActionRow[]
  /**
   * The next free recording-segment index for this meeting — one past the
   * highest already stored.
   *
   * The client cannot derive this from its own state. Segment index is half
   * the primary key transcribeSegment upserts on (meetingId, index), and the
   * recorder's local list is emptied of every successfully-transcribed
   * segment once finalize consumes it (and is empty outright after a
   * reload). Restarting a second take at 0 would therefore upsert straight
   * over the first take's transcripts — the meeting would lose the recording
   * it already had, silently, at the moment someone pressed record again.
   */
  nextSegmentIndex: number
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

type SpeakerSegmentOut = { speaker: string | null; text: string }
type ActionItemOut = {
  text: string
  suggestedAssigneeLabel: string | null
  suggestedDueDate: string | null
  /** The model's own 0–1 estimate for this item, or null if it gave none — see shouldAutoAssign. */
  confidence: number | null
  /** App NAME the model routed this item to (from the attendee app lists in
   *  the prompt), or null. Resolved to an id server-side ONLY via
   *  resolveSuggestedAppId — the raw name never reaches a query. */
  suggestedApp: string | null
}

/** Defensive parse of the model's speakerSegments — drops anything without real text. */
function asSpeakerSegments(value: unknown): SpeakerSegmentOut[] {
  return asArray<Record<string, unknown>>(value)
    .map((row) => ({
      speaker: typeof row.speaker === 'string' && row.speaker.trim() ? row.speaker.trim() : null,
      text: typeof row.text === 'string' ? row.text.trim() : '',
    }))
    .filter((row): row is SpeakerSegmentOut => row.text.length > 0)
}

/** Defensive parse of the model's actionItems — drops anything without real text. */
function asActionItems(value: unknown): ActionItemOut[] {
  return asArray<Record<string, unknown>>(value)
    .map((row) => ({
      text: typeof row.text === 'string' ? row.text.trim() : '',
      suggestedAssigneeLabel:
        typeof row.suggestedAssigneeLabel === 'string' && row.suggestedAssigneeLabel.trim()
          ? row.suggestedAssigneeLabel.trim()
          : null,
      suggestedDueDate: normalizeDueDate(
        typeof row.suggestedDueDate === 'string' ? row.suggestedDueDate : null,
      ),
      // The model returns its own 0–1 self-estimate per the prompt below.
      // Anything else (missing, a string, out of range, non-finite) becomes
      // null — shouldAutoAssign treats null the same as "not confident".
      confidence:
        typeof row.confidence === 'number' && Number.isFinite(row.confidence)
          ? row.confidence
          : null,
      // Absent on older analyses and on the live-transcript fallback — null
      // there keeps every pre-routing behaviour byte-for-byte.
      suggestedApp:
        typeof row.suggestedApp === 'string' && row.suggestedApp.trim()
          ? row.suggestedApp.trim()
          : null,
    }))
    .filter((row): row is ActionItemOut => row.text.length > 0)
}

/**
 * "Intelligence auto add notes": inserts the AI's write-up straight into the
 * unified note timeline (one 'ai' segment) and the diarized transcript as
 * 'voice' segments — one per speaker turn — instead of leaving them in a
 * separate panel the user has to go find. Also files the model's actionable
 * proposals as task suggestions — and, for every one that clears
 * shouldAutoAssign (confident, an assignee resolved deterministically, the
 * meeting has an app), an app to file into, an approved assignee, and the
 * meeting's auto-assign toggle still on), creates the real task immediately
 * instead of waiting for a click. Best-effort as a whole: called from inside
 * a try/catch at the call site so a failure here never undoes the analysis
 * that already succeeded.
 *
 * Returns how many otherwise-eligible items were held back by
 * MAX_AUTO_TASKS_PER_MEETING — persisted onto meetingAiNotes so the timeline
 * can say "N more suggestions need review".
 */
async function insertAutoNotesAndSuggestions(
  meeting: { id: string; appId: string | null; title: string; autoAssignTasks: boolean },
  recorder: { id: string; name: string | null },
  summary: string | null,
  speakerSegments: SpeakerSegmentOut[],
  actionItems: ActionItemOut[],
  attendees: AttendeeRef[],
  /** The attendees' app union the prompt offered — see fetchAttendeeAppLists.
   *  [] disables routing outright (every item falls back to meeting.appId). */
  appOptions: AppOption[],
): Promise<{ cappedCount: number }> {
  const meetingId = meeting.id
  const createdBy = recorder.id

  const mappingRows: SpeakerMapping[] = await db
    .select({ label: meetingSpeakers.label, userId: meetingSpeakers.userId })
    .from(meetingSpeakers)
    .where(eq(meetingSpeakers.meetingId, meetingId))

  const segmentRows: (typeof meetingNoteSegments.$inferInsert)[] = []
  if (summary) {
    segmentRows.push({ meetingId, source: 'ai', content: summary, createdBy })
  }
  speakerSegments.forEach((segment, index) => {
    segmentRows.push({
      meetingId,
      source: 'voice',
      speakerLabel: segment.speaker,
      // Only an existing meeting_speakers mapping resolves a label to a
      // person. A brand-new label stays unresolved (speakerId null) and
      // renders as a label until a human says who it was — the model's guess
      // that a label IS an attendee's name is not evidence.
      speakerId: resolveSpeakerUserId(segment.speaker, mappingRows),
      content: segment.text,
      // The model gives no per-chunk timing — a monotonic counter still
      // orders these chunks correctly relative to one another (they share
      // the same createdAt, inserted together), which is all
      // orderNoteSegments needs "startedAtMs" for.
      startedAtMs: index * 1000,
      createdBy,
    })
  })
  if (segmentRows.length > 0) await db.insert(meetingNoteSegments).values(segmentRows)

  if (actionItems.length === 0) return { cappedCount: 0 }

  const resolvedItems = actionItems.map((item) => ({
    item,
    resolvedUserId: resolveSpeakerUserId(item.suggestedAssigneeLabel, mappingRows),
    // App routing: the model returned an app NAME (or null) from the lists
    // the prompt offered; resolveSuggestedAppId is deterministic — exact
    // match, then unambiguous case-insensitive — and gives null rather than
    // guess. Null routes exactly like before routing existed: the meeting's
    // own app, or a card the accepter has to place.
    resolvedAppId: resolveSuggestedAppId(item.suggestedApp, appOptions),
  }))

  // SAFETY: never auto-assign to someone who isn't an approved user. One
  // batched query for every distinct candidate rather than one per item —
  // an unapproved candidate is nulled out BEFORE shouldAutoAssign ever sees
  // it, so the pure decision function stays a plain 3-field question and
  // this DB-backed check stays exactly here, the one place it belongs.
  const candidateIds = [
    ...new Set(resolvedItems.map((r) => r.resolvedUserId).filter((id): id is string => id !== null)),
  ]
  const approvedIds =
    candidateIds.length > 0
      ? new Set(
          (
            await db
              .select({ id: users.id })
              .from(users)
              .where(and(inArray(users.id, candidateIds), eq(users.status, 'approved')))
          ).map((row) => row.id),
        )
      : new Set<string>()

  const candidates: AutoAssignCandidate[] = resolvedItems.map(({ resolvedUserId, resolvedAppId }) => ({
    confidence: null, // placeholder — replaced below once zipped with its item
    resolvedUserId: resolvedUserId && approvedIds.has(resolvedUserId) ? resolvedUserId : null,
    // "Somewhere to file it" now includes a confidently-routed app, so a
    // meeting spanning several projects can auto-assign into the right one —
    // an unrouted item still needs the meeting's own app, exactly as before.
    hasApp: (resolvedAppId ?? meeting.appId) !== null,
  }))
  resolvedItems.forEach(({ item }, index) => {
    candidates[index].confidence = item.confidence
  })

  // The whole auto pass is a no-op — every candidate falls through to a
  // manual card — when the meeting's own toggle is off, without needing a
  // second code path: partitionAutoAssign never marks anything autoAccept
  // for candidates that were never evaluated for it.
  const decisions = meeting.autoAssignTasks
    ? partitionAutoAssign(candidates)
    : candidates.map(() => ({ autoAccept: false, capped: false }))

  let cappedCount = 0
  const pendingNotifications: AutoAssignNotificationPayload[] = []

  for (let index = 0; index < resolvedItems.length; index += 1) {
    const { item, resolvedUserId, resolvedAppId } = resolvedItems[index]
    const decision = decisions[index]
    if (decision.capped) cappedCount += 1

    if (decision.autoAccept) {
      // Guaranteed non-null: shouldAutoAssign requires it, and
      // partitionAutoAssign only marks autoAccept for candidates that
      // passed shouldAutoAssign.
      const assigneeId = candidates[index].resolvedUserId as string
      // Non-null by the same argument — hasApp above is exactly this
      // expression, and shouldAutoAssign requires it.
      const targetAppId = (resolvedAppId ?? meeting.appId) as string
      try {
        const payload = suggestionToTaskPayload(
          { text: item.text, suggestedUserId: assigneeId, suggestedDueDate: item.suggestedDueDate },
          { appId: targetAppId, sprintId: null },
        )
        const created = await createTask(payload)
        if (!created.ok) throw new Error(created.error)

        await db.insert(meetingTaskSuggestions).values({
          meetingId,
          text: item.text,
          suggestedUserId: assigneeId,
          suggestedDueDate: item.suggestedDueDate,
          suggestedAppId: resolvedAppId,
          status: 'accepted',
          createdTaskId: created.data.taskId,
          acceptedBy: null, // null = auto-accepted, see schema.ts's comment on this column
        })

        const notification = buildAutoAssignNotification({
          assigneeId,
          recorderId: recorder.id,
          recorderName: recorder.name,
          taskTitle: payload.title,
          meetingId,
          meetingTitle: meeting.title,
        })
        if (notification) pendingNotifications.push(notification)

        // Close the loop: an open follow-up owed by this same person that
        // reads like the same piece of work gets linked to the task that
        // just addressed it (see findMatchingFollowup). A SEPARATE
        // try/catch from the one around task creation above — the task and
        // suggestion row already exist at this point, so a failure here
        // must not fall through to also filing a manual suggestion card.
        try {
          await linkFollowupToTask(assigneeId, item.text, created.data.taskId)
        } catch (linkError) {
          console.error(
            `[meeting-followups] link on auto-assign failed for meeting ${meetingId}:`,
            linkError,
          )
        }
        continue
      } catch (error) {
        // SAFETY: one failed task creation falls back to a manual card
        // rather than aborting the rest of the analysis — falls through to
        // the manual insert below exactly like an ineligible item would.
        console.error(`[meeting-auto-assign] auto task creation failed for meeting ${meetingId}:`, error)
      }
    }

    await db.insert(meetingTaskSuggestions).values({
      meetingId,
      text: item.text,
      suggestedUserId: resolvedUserId,
      suggestedDueDate: item.suggestedDueDate,
      suggestedAppId: resolvedAppId,
      status: 'open',
    })
  }

  if (pendingNotifications.length > 0) {
    try {
      await createNotifications(pendingNotifications)
    } catch (error) {
      console.error(`[meeting-auto-assign] notify assignees failed for meeting ${meetingId}:`, error)
    }
  }

  return { cappedCount }
}

/**
 * Meeting intel (transcript, per-person notes, follow-up questions) is
 * readable only by an admin, the meeting's creator, or someone who was
 * actually an attendee. Anything that returns intel — for THIS meeting or for
 * the earlier meeting the prep questions are pulled from — has to pass this.
 */
// `meeting` must already have been resolved through liveMeetings by the
// caller (every call site below does) — this function trusts meeting.id is
// live rather than re-checking it, so a trashed meeting has to be turned
// away before it ever reaches here.
export async function canReadMeetingIntel(
  user: { id: string; role?: string | null },
  meeting: { id: string; createdBy: string },
): Promise<boolean> {
  if (user.role === 'admin' || meeting.createdBy === user.id) return true
  const [attendee] = await db
    .select({ userId: meetingAttendees.userId })
    .from(meetingAttendees)
    .where(
      and(eq(meetingAttendees.meetingId, meeting.id), eq(meetingAttendees.userId, user.id)),
    )
  return Boolean(attendee)
}

// Gate function: every write in this file resolves the meeting through here
// first (or through getMeetingIntel/getMeetingNoteTimeline's own liveMeetings
// read for the read-side gates below), so a trashed meeting reads as "not
// found"/"not allowed" instead of remaining mutable through its own gate.
export async function canManageMeeting(meetingId: string) {
  const session = await auth()
  if (!session?.user) return null
  const [meeting] = await db.select().from(liveMeetings).where(eq(liveMeetings.id, meetingId))
  if (!meeting) return null
  const allowed = session.user.role === 'admin' || meeting.createdBy === session.user.id
  return allowed ? { session, meeting } : null
}

// meetingAttendees has no deletedAt of its own — live iff its meeting is
// live (see MEETING_CHILD_TABLES in src/db/live.ts). Every caller below
// passes a meetingId already resolved through liveMeetings (canManageMeeting
// or a direct liveMeetings read), so this can't read a trashed meeting's
// attendees.
async function fetchAttendees(meetingId: string): Promise<AttendeeRef[]> {
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(meetingAttendees)
    .innerJoin(users, eq(meetingAttendees.userId, users.id))
    .where(eq(meetingAttendees.meetingId, meetingId))
  return rows
}

/**
 * The apps each attendee works on — their live `assignments`, plus any app
 * where they still hold a not-done task (someone mid-handover has tasks but
 * no assignment row, and the meeting will still ask them about that app).
 * Two batched queries however many attendees there are.
 *
 * This is the app-routing vocabulary for one analysis pass: the prompt shows
 * the model exactly these names per attendee, and resolveSuggestedAppId
 * resolves the model's answer against the same union — so a suggestion can
 * only ever route to an app that was actually on offer.
 */
async function fetchAttendeeAppLists(attendeeIds: string[]): Promise<Map<string, AppOption[]>> {
  const byUser = new Map<string, AppOption[]>()
  if (attendeeIds.length === 0) return byUser

  const assignmentRows = await db
    .select({ userId: assignments.userId, id: apps.id, name: apps.name })
    .from(assignments)
    .innerJoin(apps, eq(assignments.appId, apps.id))
    .where(inArray(assignments.userId, attendeeIds))

  const taskRows = await db
    .select({ userId: liveTasks.assigneeId, id: apps.id, name: apps.name })
    .from(liveTasks)
    .innerJoin(apps, eq(liveTasks.appId, apps.id))
    .where(and(inArray(liveTasks.assigneeId, attendeeIds), ne(liveTasks.status, 'done')))

  for (const row of [...assignmentRows, ...taskRows]) {
    if (!row.userId) continue
    const list = byUser.get(row.userId) ?? []
    if (!list.some((app) => app.id === row.id)) list.push({ id: row.id, name: row.name })
    if (!byUser.has(row.userId)) byUser.set(row.userId, list)
  }
  for (const list of byUser.values()) list.sort((a, b) => a.name.localeCompare(b.name))
  return byUser
}

/** Deduped union of every attendee's apps — what resolveSuggestedAppId matches against. */
function unionAppOptions(byUser: Map<string, AppOption[]>): AppOption[] {
  const byId = new Map<string, AppOption>()
  for (const list of byUser.values()) {
    for (const app of list) byId.set(app.id, app)
  }
  return [...byId.values()]
}

/**
 * The prompt block that tells the model which apps it may route action items
 * to. Empty string when nobody has any — the JSON spec's suggestedApp field
 * still exists either way, and asActionItems turns its absence into null.
 */
function attendeeAppsPromptBlock(
  attendees: AttendeeRef[],
  appsByUser: Map<string, AppOption[]>,
): string {
  if (unionAppOptions(appsByUser).length === 0) return ''
  const lines = attendees.map((attendee) => {
    const names = (appsByUser.get(attendee.id) ?? []).map((app) => app.name)
    return `- ${attendee.name}: ${names.length > 0 ? names.join(', ') : '(none)'}`
  })
  return `\nApps (projects) each attendee works on — the only valid values for "suggestedApp" below:\n${lines.join('\n')}\n`
}

type FollowupCarryRow = OpenFollowupItem & {
  status: FollowupStatus
  resolutionNote: string | null
  responseNote: string | null
  deferReason: string | null
  resolvedAt: Date | null
  createdBy: string | null
  targetMeetingId: string | null
  resolvedByTaskId: string | null
}

/**
 * Follow-ups (question/action items attributed to a person) whose source
 * meeting is earlier than `meeting` and readable by `caller` — same
 * admin/creator/attendee rule as canReadMeetingIntel, applied here to the
 * SOURCE meeting of each follow-up rather than the meeting being viewed.
 * Without this, a follow-up's text (derived from a transcript) could leak
 * into a meeting the caller has no right to see that source meeting's notes
 * from. Callers still need to narrow this to the target meeting's attendees
 * (see selectCarriedForward) — this only handles time + entitlement.
 *
 * `includeResolvedHere` additionally returns items that were resolved IN
 * this meeting (resolvedInMeetingId), so the panel can keep showing them
 * settled — with whatever note was left — instead of having them blink out
 * of existence the moment they're ticked off. Deliberately narrow: a
 * resolved item shows on the one meeting it was resolved in and nowhere
 * else, which is what keeps it out of every future meeting. Leave it off
 * for anything that treats the result as work still owed (the AI
 * "did this come up" pass).
 *
 * Two ways an item lands on a meeting:
 *   - PINNED (targetMeetingId set, by someone adding it by hand and choosing
 *     a meeting): it shows on that meeting and on no other, whatever its
 *     source meeting was.
 *   - CARRIED (targetMeetingId null — every AI-derived item): the original
 *     rule, i.e. any earlier meeting's still-open item follows its person to
 *     whatever meeting they attend next.
 */
async function fetchCarriedFollowups(
  meeting: { id: string; startsAt: Date },
  caller: { id: string; isAdmin: boolean },
  { includeResolvedHere = false }: { includeResolvedHere?: boolean } = {},
): Promise<FollowupCarryRow[]> {
  const rows = await db
    .select({
      id: meetingFollowups.id,
      userId: meetingFollowups.userId,
      personName: meetingFollowups.personName,
      text: meetingFollowups.text,
      kind: meetingFollowups.kind,
      status: meetingFollowups.status,
      resolutionNote: meetingFollowups.resolutionNote,
      responseNote: meetingFollowups.responseNote,
      deferReason: meetingFollowups.deferReason,
      resolvedAt: meetingFollowups.resolvedAt,
      createdBy: meetingFollowups.createdBy,
      targetMeetingId: meetingFollowups.targetMeetingId,
      resolvedByTaskId: meetingFollowups.resolvedByTaskId,
      sourceMeetingId: meetingFollowups.sourceMeetingId,
      sourceMeetingTitle: liveMeetings.title,
      sourceMeetingStartsAt: liveMeetings.startsAt,
    })
    .from(meetingFollowups)
    // A follow-up's source meeting must be live for its text to surface
    // here at all — a trashed source meeting's follow-ups disappear from
    // every future meeting's prep, the same way an inner join to a hard-
    // deleted meeting always would have.
    .innerJoin(liveMeetings, eq(meetingFollowups.sourceMeetingId, liveMeetings.id))
    .leftJoin(
      meetingAttendees,
      and(eq(meetingAttendees.meetingId, liveMeetings.id), eq(meetingAttendees.userId, caller.id)),
    )
    .where(
      and(
        includeResolvedHere
          ? or(
              eq(meetingFollowups.status, 'open'),
              eq(meetingFollowups.resolvedInMeetingId, meeting.id),
            )
          : eq(meetingFollowups.status, 'open'),
        isNotNull(meetingFollowups.userId),
        or(
          eq(meetingFollowups.targetMeetingId, meeting.id),
          and(
            isNull(meetingFollowups.targetMeetingId),
            ne(meetingFollowups.sourceMeetingId, meeting.id),
            lt(liveMeetings.startsAt, meeting.startsAt),
          ),
        ),
        caller.isAdmin
          ? undefined
          : or(eq(liveMeetings.createdBy, caller.id), isNotNull(meetingAttendees.userId)),
      ),
    )
  return rows
}

/**
 * Later meetings the caller is entitled to see, with their attendee lists —
 * the options for "link this follow-up to a specific meeting" instead of
 * letting it find its person at whatever meeting comes next. Same
 * admin/creator/attendee rule as everything else here, so the picker can
 * never disclose a meeting the caller couldn't otherwise see.
 */
async function fetchFollowupTargets(
  meeting: { id: string; startsAt: Date },
  caller: { id: string; isAdmin: boolean },
): Promise<FollowupTargetOption[]> {
  const callerMeetingIds = db
    .select({ meetingId: meetingAttendees.meetingId })
    .from(meetingAttendees)
    .where(eq(meetingAttendees.userId, caller.id))

  const rows = await db
    .select({
      id: liveMeetings.id,
      title: liveMeetings.title,
      startsAt: liveMeetings.startsAt,
      attendeeId: meetingAttendees.userId,
    })
    .from(liveMeetings)
    .innerJoin(meetingAttendees, eq(meetingAttendees.meetingId, liveMeetings.id))
    .where(
      and(
        gt(liveMeetings.startsAt, meeting.startsAt),
        ne(liveMeetings.id, meeting.id),
        caller.isAdmin
          ? undefined
          : or(eq(liveMeetings.createdBy, caller.id), inArray(liveMeetings.id, callerMeetingIds)),
      ),
    )
    .orderBy(liveMeetings.startsAt)

  const byId = new Map<string, FollowupTargetOption>()
  for (const row of rows) {
    let option = byId.get(row.id)
    if (!option) {
      if (byId.size >= MAX_FOLLOWUP_TARGETS) continue
      option = { id: row.id, title: row.title, startsAt: row.startsAt, attendeeIds: [] }
      byId.set(row.id, option)
    }
    option.attendeeIds.push(row.attendeeId)
  }
  return [...byId.values()]
}

/**
 * This meeting's OWN open follow-ups that the model named someone for but
 * couldn't resolve to a user (nickname, misspelling, a client contact —
 * see matchPersonToAttendee). Scoped to sourceMeetingId = this meeting: the
 * carried-forward query (fetchCarriedFollowups) explicitly excludes a
 * meeting's own follow-ups from its own carry-in, and rightly so — there is
 * no person here for one of these to be carried TO. Surfacing them requires
 * this separate, narrower query instead. No extra entitlement check needed
 * beyond the caller already being cleared to read THIS meeting (checked once
 * in getMeetingIntel) — these rows all belong to it.
 */
async function fetchUnattributedFollowups(meeting: {
  id: string
  title: string
  startsAt: Date
}): Promise<UnattributedFollowupView[]> {
  const rows = await db
    .select({
      id: meetingFollowups.id,
      userId: meetingFollowups.userId,
      personName: meetingFollowups.personName,
      text: meetingFollowups.text,
      kind: meetingFollowups.kind,
      createdAt: meetingFollowups.createdAt,
    })
    .from(meetingFollowups)
    .where(and(eq(meetingFollowups.sourceMeetingId, meeting.id), eq(meetingFollowups.status, 'open')))

  // Routed through the same pure selectUnattributed the tests cover, rather
  // than re-deciding "what counts as unattributed" a second time inline —
  // the `sourceMeetingTitle`/`sourceMeetingStartsAt` fields it wants are
  // filled from `meeting` since every row here already shares that source.
  const unattributedIds = new Set(
    selectUnattributed(
      rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        personName: row.personName,
        text: row.text,
        kind: row.kind,
        sourceMeetingId: meeting.id,
        sourceMeetingTitle: meeting.title,
        sourceMeetingStartsAt: meeting.startsAt,
      })),
    ).map((item) => item.id),
  )

  return rows
    .filter((row) => unattributedIds.has(row.id))
    .map((row) => ({ id: row.id, personName: row.personName, text: row.text, kind: row.kind, createdAt: row.createdAt }))
}

/**
 * The full approved-user roster, for the "Needs attribution" picker's
 * fallback pool once this meeting's own attendees have been offered first —
 * the model may have named a client contact or someone who wasn't in this
 * meeting's attendee list at all.
 */
async function fetchApprovedUsers(): Promise<FollowupPersonOption[]> {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.active, true), eq(users.status, 'approved')))
}

/** Derives person-linked follow-ups from the model's per-person notes and inserts them. */
async function deriveAndInsertFollowups(
  sourceMeetingId: string,
  perPerson: PerPersonNote[],
  questions: QuestionNote[],
): Promise<void> {
  // Attribution comes from confirmed speaker mappings ONLY — never from
  // name-matching the model's output against the attendee list. See
  // buildFollowupRows.
  const mappingRows: SpeakerMapping[] = await db
    .select({ label: meetingSpeakers.label, userId: meetingSpeakers.userId })
    .from(meetingSpeakers)
    .where(eq(meetingSpeakers.meetingId, sourceMeetingId))

  const rows = buildFollowupRows(sourceMeetingId, perPerson, questions, mappingRows)
  if (rows.length > 0) await db.insert(meetingFollowups).values(rows)
}

/**
 * Links an open follow-up owed by `assigneeId` to a task that was just
 * created FOR them, when one clears findMatchingFollowup's bar (same
 * person, high text similarity between the follow-up and what the task is
 * actually about — see followups.ts). Sets `resolvedByTaskId` only — it does
 * NOT resolve the follow-up itself; that happens when the task reaches
 * 'done' (task-actions.ts's follow-up sync), which is the whole point:
 * closing the task is what closes the loop, not accepting the suggestion.
 *
 * Called from both places a real task gets created from a suggestion — the
 * manual accept (acceptTaskSuggestion) and the auto-assign pass
 * (insertAutoNotesAndSuggestions) — each inside its own try/catch, so a
 * lookup/write failure here can never undo a task that already exists.
 */
async function linkFollowupToTask(
  assigneeId: string | null,
  suggestionText: string,
  taskId: string,
): Promise<void> {
  if (!assigneeId) return

  const candidates: FollowupMatchCandidate[] = await db
    .select({ id: meetingFollowups.id, userId: meetingFollowups.userId, text: meetingFollowups.text })
    .from(meetingFollowups)
    .where(and(eq(meetingFollowups.userId, assigneeId), eq(meetingFollowups.status, 'open')))
  if (candidates.length === 0) return

  const matchId = findMatchingFollowup({ assigneeId, text: suggestionText }, candidates)
  if (!matchId) return

  await db.update(meetingFollowups).set({ resolvedByTaskId: taskId }).where(eq(meetingFollowups.id, matchId))
}

/**
 * "Intelligently think" pass: given the open follow-ups carried into this
 * meeting (attributed to its attendees), asks the model — as a separate,
 * narrowly-scoped text prompt — which of them this meeting's discussion
 * addressed, then resolves those. The model gets a fixed list of ids and is
 * required to only pick from it; anything it invents is dropped by
 * filterValidIds before it ever reaches a query.
 */
async function resolveAddressedFollowups(
  userId: string,
  meeting: { id: string; title: string },
  carriedIn: CarriedForwardGroup[],
  transcript: string | null,
  summary: string | null,
): Promise<void> {
  const items = carriedIn.flatMap((group) =>
    group.items.map((item) => ({ id: item.id, person: group.person, text: item.text })),
  )
  if (items.length === 0) return
  if (!transcript && !summary) return

  const prompt = `You are reviewing the meeting "${meeting.title}" to check which previously open
follow-up items — questions or action items owed by specific people from earlier meetings — were
addressed in THIS meeting's discussion (answered, completed, or otherwise resolved).

${summary ? `Meeting summary:\n${summary}\n` : ''}
${transcript ? `Meeting transcript (may be long, use as needed):\n${transcript.slice(0, 50_000)}\n` : ''}

Open follow-up items (each has a stable id — use it exactly as given):
${items.map((item) => `- id="${item.id}" person="${item.person}": ${item.text}`).join('\n')}

Return STRICT JSON only, matching exactly:
{ "resolvedIds": ["..."] }
Only include ids copied verbatim from the list above — never invent one. If none were addressed,
return { "resolvedIds": [] }.`

  let raw: string
  try {
    ;({ text: raw } = await callGemini(userId, [{ text: prompt }], { responseJson: true }))
  } catch (error) {
    console.error('[meeting-followups] resolution check failed:', error)
    return
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?\n?|```$/g, '').trim())
  } catch {
    return
  }

  const candidateIds = asArray<string>(
    parsed && typeof parsed === 'object' && 'resolvedIds' in parsed
      ? (parsed as { resolvedIds: unknown }).resolvedIds
      : undefined,
  ).filter((v): v is string => typeof v === 'string')

  const validIds = filterValidIds(
    candidateIds,
    items.map((item) => item.id),
  )
  if (validIds.length === 0) return

  await db
    .update(meetingFollowups)
    .set({ status: 'resolved', resolvedInMeetingId: meeting.id, resolvedAt: new Date() })
    .where(inArray(meetingFollowups.id, validIds))
}

export async function analyzeMeetingAudio(
  meetingId: string,
  formData: FormData,
): Promise<ActionResult> {
  const idParsed = idInput.safeParse(meetingId)
  if (!idParsed.success) return err(idParsed.error.issues[0].message)
  const id = idParsed.data

  const ctx = await canManageMeeting(id)
  if (!ctx) return err('Only admins or the meeting creator can record analysis')
  const { session, meeting } = ctx

  const audio = formData.get('audio')
  if (!(audio instanceof File) || audio.size === 0) return err('No audio received')
  // Depth target for the summary, from what was actually recorded (32 kbps
  // WebM ≈ 240 kB/min). The live transcript is too lossy to size by — the
  // browser recognizer drops most Sinhala — so recording length is the signal.
  const summaryDepth = summaryDepthInstruction({
    minutes: estimateMinutesFromAudioBytes(audio.size),
  })
  if (audio.size > MAX_AUDIO_BYTES) {
    return err('Recording is over 7MB — use the segmented recording flow for longer meetings')
  }

  const liveTranscriptRaw = formData.get('liveTranscript')
  const liveTranscriptParsed = liveTranscriptInput.safeParse(
    typeof liveTranscriptRaw === 'string' && liveTranscriptRaw.trim().length > 0
      ? liveTranscriptRaw
      : '',
  )
  if (!liveTranscriptParsed.success) return err('Live transcript is too long')
  const liveTranscript = liveTranscriptParsed.data || null

  const attendees = await fetchAttendees(id)
  const attendeeNames = attendees.map((a) => a.name)
  // One meeting covers every project its people work on — the model gets each
  // attendee's app list so it can route action items ("suggestedApp"), and
  // resolveSuggestedAppId later resolves against exactly this same union.
  const appsByUser = await fetchAttendeeAppLists(attendees.map((a) => a.id))
  const appOptions = unionAppOptions(appsByUser)

  const prompt = `You are LogPup's meeting analyst for a software team.
Audio of the meeting "${meeting.title}"${meeting.agenda ? ` (agenda: ${meeting.agenda})` : ''} is attached.
Known attendees: ${attendeeNames.length > 0 ? attendeeNames.join(', ') : 'unknown'}.
${attendeeAppsPromptBlock(attendees, appsByUser)}This is a Sri Lankan team meeting. Speakers routinely CODE-SWITCH between Sinhala and English —
often mid-sentence, sometimes mid-phrase — and that is completely normal for this team, not an
error to correct. Transcribe each phrase in whichever language it was ACTUALLY spoken in: Sinhala
words in Sinhala script (සිංහල), English words in Latin script, on the same line, exactly as a
bilingual person would write it down. Do NOT force-translate the whole thing into one language, and
do NOT paraphrase Sinhala into English (or vice versa) just to make the transcript read as a single
language — that would misrepresent what was actually said. Technical/product terms that Sinhala
speakers commonly say untranslated (e.g. "sprint", "deploy", "bug", "PR", "server", app or feature
names) must stay in English/Latin script even inside an otherwise-Sinhala sentence — never
transliterate or translate them.
${
  liveTranscript
    ? `\nA live, noisy speech-to-text capture made during the meeting is included below as a HINT ONLY —
it may already interleave Sinhala and English phrases the way the audio does.
Treat the AUDIO as authoritative for content, meaning, and language; use this noisy text only to help
spell attendee names, product/technical terms, and numbers correctly. Never quote it verbatim over what
the audio actually says.

Live transcript hint:
"""
${liveTranscript}
"""
`
    : ''
}
Return STRICT JSON only, matching exactly:
{
  "language": "en" | "si" | "bilingual",
  "transcript": "full transcript with speaker labels where identifiable — each phrase kept in the language it was actually spoken in, per the code-switching rules above",
  "summary": "professional meeting minutes in English (if mainly Sinhala, append a Sinhala section) with three clear parts: Decisions made, Discussion highlights, and Next steps — written for someone who was not in the room, not a raw dump of everything said. ${summaryDepth}",
  "perPerson": [{ "name": "...", "points": ["key things this person said or decided"], "actionItems": ["..."] }],
  "deadlines": [{ "item": "...", "owner": "...", "due": "date or phrase as spoken" }],
  "terms": [{ "term": "software/technical term used", "explanation": "plain-English explanation", "sinhala": "short සිංහල explanation" }],
  "questions": [{ "person": "...", "questions": ["question this person should answer at the next meeting"] }],
  "speakerSegments": [{ "speaker": "attendee name if identifiable, else \"Speaker 1\"/\"Speaker 2\"/… used consistently for the same voice, or null", "text": "what this speaker said in this turn, verbatim in whichever language(s) they actually used — never translated or normalized to one language" }],
  "actionItems": [{ "text": "concrete, assignable next step", "suggestedAssigneeLabel": "attendee name or speaker label this belongs to, or null", "suggestedDueDate": "YYYY-MM-DD or null — never a phrase", "confidence": 0.0, "suggestedApp": "app name copied EXACTLY from the attendee app lists above, or null" }]
}
Use "bilingual" for "language" whenever the meeting code-switches between Sinhala and English —
the common case for this team — and "en"/"si" only when it is genuinely all one language throughout.
Map speakers to attendee names where possible; unknown voices become "Speaker 1", "Speaker 2", … .
Deadlines and action items must be concrete. Give each person 1–3 follow-up questions about their
commitments, blockers, and deadlines from THIS meeting — they follow that person forward and are
shown whenever they attend a future meeting.
speakerSegments must cover the whole meeting, in chronological order, one entry per speaker turn,
using the same label for the same voice throughout. If you genuinely cannot tell speakers apart,
return exactly ONE entry with "speaker": null and "text" set to the full transcript — never invent
distinct labels you are not confident about. actionItems are the concrete next steps raised in the
discussion (overlap with perPerson's actionItems is fine); suggestedDueDate must be a real ISO date
or null, and confidence is your own 0–1 estimate of how sure you are about the assignee/due date.
For "suggestedApp", pick the ONE app (project) the task belongs to, copied exactly from the attendee
app lists above — never invent an app name; use null when no listed app clearly fits or when no app
lists were given.`

  const audioBytes = Buffer.from(await audio.arrayBuffer())
  const mimeType = audio.type || 'audio/webm'

  let raw: string
  let modelUsed: string = DEFAULT_GEMINI_MODEL
  try {
    ;({ text: raw, model: modelUsed } = await callGeminiWithAudio(
      session.user.id,
      [{ text: prompt }],
      audioBytes,
      mimeType,
      { responseJson: true },
    ))
  } catch (error) {
    // GeminiError.message is already an actionable, key-free string (see
    // callGemini): distinguishes "everything's busy, your recording is
    // safe, retry shortly" from "your key was rejected" from a generic
    // failure. The recording itself is never touched here — the client
    // (meeting-intel.tsx) keeps the blob and live transcript in memory and
    // re-offers Analyze on any failure, so nothing recorded is lost.
    if (error instanceof GeminiError) return err(error.message)
    return err('Gemini request failed — try again')
  }

  return persistMeetingAnalysis(id, meeting, session.user, attendees, raw, modelUsed, appOptions)
}

/**
 * Shared tail of both analysis paths — the legacy single-shot
 * analyzeMeetingAudio above (whole recording, one audio call) and
 * finalizeMeetingRecording below (segmented recording, one text-only call
 * over the concatenated segment transcripts). Everything past "we have raw
 * JSON text back from Gemini" is identical either way: parse it, store the
 * structured notes, auto-insert the note-timeline segments and task
 * suggestions, derive this meeting's own follow-ups, and check whether any
 * carried-in follow-up was addressed here. Kept as one function so the two
 * entry points can never drift on what "analyzed" means.
 */
async function persistMeetingAnalysis(
  id: string,
  meeting: { title: string; startsAt: Date; appId: string | null; autoAssignTasks: boolean },
  author: { id: string; name?: string | null; role?: string | null },
  attendees: AttendeeRef[],
  raw: string,
  modelUsed: string,
  /** The attendees' app union the caller's prompt offered the model (see
   *  fetchAttendeeAppLists) — what resolveSuggestedAppId resolves against.
   *  [] disables app routing outright; the live-transcript fallback passes
   *  exactly that, since its raw JSON never carries actionItems anyway. */
  appOptions: AppOption[],
): Promise<ActionResult> {
  const createdBy = author.id
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?\n?|```$/g, '').trim())
  } catch {
    return err('Gemini returned malformed notes — try again')
  }

  const perPerson = asArray<PerPersonNote>(parsed.perPerson)
  const questions = asArray<QuestionNote>(parsed.questions)
  const transcript = typeof parsed.transcript === 'string' ? parsed.transcript : null
  const summary = typeof parsed.summary === 'string' ? parsed.summary : null
  const speakerSegments = asSpeakerSegments(parsed.speakerSegments)
  const actionItems = asActionItems(parsed.actionItems)

  // "Intelligence auto add notes": drop the summary and diarized transcript
  // straight into the unified note timeline, and file the model's
  // actionable proposals as suggestions — auto-creating the real task for
  // every one that clears shouldAutoAssign. Best-effort, same reasoning as
  // the carry-forward pass below — a failure here must not undo the
  // analysis that already succeeded, and NOT stop the ai_notes row below
  // from being written (it just reports 0 capped rather than the real
  // count). Run BEFORE the ai_notes upsert so autoAssignCappedCount can be
  // written in the same insert instead of a second round-trip.
  let cappedCount = 0
  try {
    ;({ cappedCount } = await insertAutoNotesAndSuggestions(
      { id, appId: meeting.appId, title: meeting.title, autoAssignTasks: meeting.autoAssignTasks },
      { id: createdBy, name: author.name ?? null },
      summary,
      speakerSegments,
      actionItems,
      attendees,
      appOptions,
    ))
  } catch (error) {
    console.error('[meeting-notes] auto note/suggestion insert failed:', error)
  }

  const values = {
    meetingId: id,
    // Free-text, not a DB enum — the model returns "en" | "si" | "bilingual"
    // per the prompt above (bilingual = code-switching detected, the
    // expected case for this team). Older rows may still say "mixed" from
    // before this field's semantics were made explicit for code-switching;
    // nothing in the codebase branches on the exact string, so both values
    // coexist safely and neither needs a backfill.
    language: typeof parsed.language === 'string' ? parsed.language : 'en',
    transcript,
    summary,
    perPerson,
    deadlines: asArray(parsed.deadlines),
    terms: asArray(parsed.terms),
    questions,
    model: modelUsed,
    createdBy,
    createdAt: new Date(),
    autoAssignCappedCount: cappedCount,
  }

  await db
    .insert(meetingAiNotes)
    .values(values)
    .onConflictDoUpdate({ target: meetingAiNotes.meetingId, set: values })

  await deriveAndInsertFollowups(id, perPerson, questions)


  // "Intelligently think" about carry-forward: check whether any follow-up
  // items owed by this meeting's attendees (from earlier meetings) were
  // addressed here, and resolve them. Best-effort — a failure here must not
  // undo the analysis that already succeeded above.
  try {
    const isAdmin = author.role === 'admin'
    const openBefore = await fetchCarriedFollowups(
      { id, startsAt: meeting.startsAt },
      { id: createdBy, isAdmin },
    )
    const carriedIn = selectCarriedForward(
      openBefore,
      attendees.map((a) => a.id),
      new Date(),
    )
    await resolveAddressedFollowups(createdBy, { id, title: meeting.title }, carriedIn, transcript, summary)
  } catch (error) {
    console.error('[meeting-followups] carry-forward resolution failed:', error)
  }

  revalidatePath('/meetings')
  return ok(undefined)
}

// --- Segmented recording: incremental per-segment transcription + one
// text-only final synthesis pass. See recording-segments.ts (SEGMENT_TARGET_MS,
// shouldCutSegment, concatenateSegments) and meetingRecordingSegments in
// schema.ts for the rest of the design.

const transcribeSegmentInput = z.object({
  meetingId: z.uuid(),
  index: z.number().int().min(0),
})

export type TranscribeSegmentResult = { index: number; transcript: string }

/**
 * Anything THROWN inside a server action rejects the client's promise, and a
 * rejection carries no message across the boundary in production — the caller
 * can only render "something went wrong", and the real cause never reaches a
 * human. That is exactly how an unapplied `meeting_recording_segments`
 * migration presented itself: a Postgres `relation ... does not exist` on
 * every insert, shown as a bare "Upload failed — try again" that no amount of
 * retrying could ever clear.
 *
 * Every recording action funnels its UNEXPECTED failures through here
 * instead: the full error is logged server-side with the meeting it belongs
 * to, and the caller gets a specific ActionResult it can act on — crucially
 * distinguishing "retry will work" (transient) from "retrying forever is
 * pointless, a person has to fix the deployment" (schema/config).
 */
function recordingFailure(context: string, error: unknown): ActionResult<never> {
  console.error(`[meeting-recording] ${context}:`, error)
  const message = error instanceof Error ? error.message : String(error)

  // A missing relation/column means a migration in drizzle/ was never applied
  // to this database. Not transient, not the user's fault, and not fixable by
  // pressing retry — say what actually has to happen, and say the audio is
  // still safe so nobody stops the meeting over it.
  if (/relation ".+" does not exist|column ".+" does not exist/i.test(message)) {
    return err(
      'LogPup’s database is missing a table this feature needs — a pending migration has not been applied. Your audio is still here; ask an admin to run the migrations, then retry.',
    )
  }
  // Connection-level faults are genuinely transient — worth retrying.
  if (
    /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|connection|terminated unexpectedly|fetch failed/i.test(
      message,
    )
  ) {
    return err('Could not reach the database just now — your audio is kept, retry in a moment.')
  }
  return err(`${context} failed on the server (${message.slice(0, 160)}) — your audio is kept, retry.`)
}

/**
 * Transcribes ONE ~5-minute recording segment and stores it. Called from the
 * client in the background while a meeting is still being recorded — each
 * call is independent (its own Gemini request, its own retry via
 * callGemini/callGeminiWithAudio's built-in backoff, see retry.ts), so one
 * segment failing never touches any other segment or aborts the recording.
 * The client keeps that segment's audio in memory and re-offers this action
 * on failure — the same "nothing recorded is lost" guarantee
 * analyzeMeetingAudio always made, just scoped to one segment (a couple MB)
 * instead of the whole meeting.
 *
 * onConflictDoUpdate makes a retry (same meetingId+index) an upsert rather
 * than a duplicate row — safe to call again for a segment that already
 * succeeded (e.g. the client didn't see the first response) without
 * doubling it in the eventual concatenated transcript.
 */
export async function transcribeSegment(
  meetingId: string,
  index: number,
  formData: FormData,
): Promise<ActionResult<TranscribeSegmentResult>> {
  try {
    return await transcribeSegmentInner(meetingId, index, formData)
  } catch (error) {
    return recordingFailure(`Transcribing segment ${index + 1}`, error)
  }
}

async function transcribeSegmentInner(
  meetingId: string,
  index: number,
  formData: FormData,
): Promise<ActionResult<TranscribeSegmentResult>> {
  const parsed = transcribeSegmentInput.safeParse({ meetingId, index })
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const id = parsed.data.meetingId

  const ctx = await canManageMeeting(id)
  if (!ctx) return err('Only admins or the meeting creator can record analysis')
  const { session, meeting } = ctx

  const audio = formData.get('audio')
  if (!(audio instanceof File) || audio.size === 0) {
    return err(`No audio received for segment ${parsed.data.index + 1}`)
  }
  if (audio.size > MAX_SEGMENT_AUDIO_BYTES) {
    return err(`Segment ${parsed.data.index + 1} came out unexpectedly large — try recording again`)
  }

  const hintRaw = formData.get('liveTranscriptHint')
  const hintParsed = liveTranscriptInput.safeParse(
    typeof hintRaw === 'string' && hintRaw.trim().length > 0 ? hintRaw : '',
  )
  const liveTranscriptHint = hintParsed.success ? hintParsed.data || null : null

  const attendees = await fetchAttendees(id)
  const attendeeNames = attendees.map((a) => a.name)

  const prompt = `You are LogPup's meeting transcriber for a software team. This is ONE ~5-minute
segment (segment ${parsed.data.index + 1}) of a longer recording of the meeting "${meeting.title}"
${meeting.agenda ? `(agenda: ${meeting.agenda})` : ''} — audio for just this stretch is attached.
Transcribe only what is actually in THIS audio; you were not given earlier or later segments, so
never guess at content you can't hear.
Known attendees: ${attendeeNames.length > 0 ? attendeeNames.join(', ') : 'unknown'}.
This is a Sri Lankan team meeting. Speakers routinely CODE-SWITCH between Sinhala and English — often
mid-sentence — and that is normal, not an error to correct. Transcribe each phrase in whichever
language it was ACTUALLY spoken in: Sinhala words in Sinhala script (සිංහල), English words in Latin
script, on the same line, exactly as a bilingual person would write it down. Do NOT force-translate
into one language. Technical/product terms Sinhala speakers commonly say untranslated (e.g. "sprint",
"deploy", "bug", "PR", "server", app or feature names) must stay in English/Latin script even inside
an otherwise-Sinhala sentence.
${
  liveTranscriptHint
    ? `\nA live, noisy speech-to-text capture made during the meeting is included below as a HINT ONLY
— use it only to help spell attendee names, product/technical terms, and numbers correctly; the audio
is authoritative for content and language.\n\nLive transcript hint (whole meeting so far):\n"""\n${liveTranscriptHint}\n"""\n`
    : ''
}
Return STRICT JSON only, matching exactly:
{ "transcript": "full transcript of just this segment, with speaker labels where identifiable — each
phrase kept in the language it was actually spoken in, per the code-switching rules above" }
Label speakers as attendee names where recognizable, else "Speaker 1"/"Speaker 2"/… consistently
WITHIN this segment. These labels are local to this segment only — you have no way to know if
"Speaker 1" here is the same person as "Speaker 1" in another segment, so don't worry about matching
across segments; a later pass reconciles identity across the whole meeting.`

  const audioBytes = Buffer.from(await audio.arrayBuffer())
  const mimeType = audio.type || 'audio/webm'

  let raw: string
  let modelUsed: string = DEFAULT_GEMINI_MODEL
  try {
    ;({ text: raw, model: modelUsed } = await callGeminiWithAudio(
      session.user.id,
      [{ text: prompt }],
      audioBytes,
      mimeType,
      { responseJson: true },
    ))
  } catch (error) {
    if (error instanceof GeminiError) return err(error.message)
    return err('Gemini request failed — try again')
  }

  let parsedJson: Record<string, unknown>
  try {
    parsedJson = JSON.parse(raw.replace(/^```(?:json)?\n?|```$/g, '').trim())
  } catch {
    return err('Gemini returned a malformed transcript for this segment — try again')
  }
  const transcript = typeof parsedJson.transcript === 'string' ? parsedJson.transcript.trim() : ''
  if (!transcript) return err('Gemini returned an empty transcript for this segment — try again')

  await db
    .insert(meetingRecordingSegments)
    .values({ meetingId: id, index: parsed.data.index, transcript, model: modelUsed, createdBy: session.user.id })
    .onConflictDoUpdate({
      target: [meetingRecordingSegments.meetingId, meetingRecordingSegments.index],
      set: { transcript, model: modelUsed, createdBy: session.user.id },
    })

  return ok({ index: parsed.data.index, transcript })
}

const finalizeRecordingInput = z.object({ meetingId: z.uuid() })

/**
 * Which of the two outcomes finalize produced, so the client can say so
 * honestly: 'full' is the normal Gemini write-up; 'live-transcript' means no
 * segment was ever transcribed (typically: no Gemini key) and the meeting's
 * notes are the browser's live transcript — real, but limited, and upgraded
 * in place the next time analysis runs with a working key.
 */
export type FinalizeRecordingResult = { mode: 'full' | 'live-transcript' }

/**
 * Runs once, when the user stops recording: a single TEXT-ONLY Gemini pass
 * over every segment transcribed so far (concatenateSegments — ordered by
 * index, any gap reported inline rather than silently skipped), producing
 * the same structured minutes/per-person notes/deadlines/terms/questions/
 * speakerSegments/actionItems shape analyzeMeetingAudio always has, then
 * handing off to the same persistMeetingAnalysis tail. Text-only means no
 * practical size ceiling and far cheaper than re-sending hours of audio —
 * the whole point of segmenting in the first place.
 *
 * Proceeds even if some segments are missing (still uploading, or failed and
 * not yet retried) — "never abort the meeting" — the gap is reported to the
 * model (so it doesn't fabricate content for it) and surfaces in
 * `missingIndices` isn't currently threaded further than a console note,
 * matching how analyzeMeetingAudio has never blocked on partial data either.
 * Safe to call again later (e.g. after retrying a failed segment) — it just
 * re-reads whatever segments exist now and re-runs synthesis.
 */
export async function finalizeMeetingRecording(
  meetingId: string,
  liveTranscriptHint?: string,
): Promise<ActionResult<FinalizeRecordingResult>> {
  try {
    return await finalizeMeetingRecordingInner(meetingId, liveTranscriptHint)
  } catch (error) {
    return recordingFailure('Writing up the minutes', error)
  }
}

async function finalizeMeetingRecordingInner(
  meetingId: string,
  liveTranscriptHint?: string,
): Promise<ActionResult<FinalizeRecordingResult>> {
  const parsed = finalizeRecordingInput.safeParse({ meetingId })
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const id = parsed.data.meetingId

  const ctx = await canManageMeeting(id)
  if (!ctx) return err('Only admins or the meeting creator can record analysis')
  const { session, meeting } = ctx

  const segmentRows = await db
    .select({ index: meetingRecordingSegments.index, transcript: meetingRecordingSegments.transcript })
    .from(meetingRecordingSegments)
    .where(eq(meetingRecordingSegments.meetingId, id))

  const hintParsed = liveTranscriptInput.safeParse(
    typeof liveTranscriptHint === 'string' && liveTranscriptHint.trim().length > 0 ? liveTranscriptHint : '',
  )
  const hint = hintParsed.success ? hintParsed.data || null : null

  const attendees = await fetchAttendees(id)

  // No-Gemini path. Zero transcribed segments means every per-segment Gemini
  // call failed or never ran — no key saved, quota exhausted for the day,
  // whatever. The browser's live transcript (user-correctable in the UI
  // while recording) still exists, and limited notes beat no notes: persist
  // it as the meeting transcript, clearly labelled, through the SAME
  // persistMeetingAnalysis tail as a real analysis. Because that tail
  // upserts on meetingId, running "Analyze again" later — once a key exists
  // and the parked segments have been retried — replaces this fallback with
  // the full AI write-up. Nothing about the failure is hidden: the model
  // column says 'live-transcript', and the client tells the user which of
  // the two outcomes they got.
  if (segmentRows.length === 0) {
    if (!hint) return err('No transcribed audio yet — record something first')
    const fallback = JSON.stringify({ transcript: hint, language: 'bilingual' })
    const persisted = await persistMeetingAnalysis(
      id,
      meeting,
      session.user,
      attendees,
      fallback,
      'live-transcript',
      // No Gemini pass ran, so there are no actionItems to route — [] keeps
      // this fallback byte-for-byte what it was before app routing existed
      // (and skips the two attendee-app queries it would never use).
      [],
    )
    if (!persisted.ok) return persisted
    return ok({ mode: 'live-transcript' as const })
  }

  const { text: combinedTranscript, missingIndices } = concatenateSegments(segmentRows)
  if (missingIndices.length > 0) {
    console.warn(
      `[meeting-recording] finalize for meeting ${id} is missing segment(s) ${missingIndices.join(', ')} — proceeding with the gap reported to the model`,
    )
  }

  const attendeeNames = attendees.map((a) => a.name)
  // Same app-routing vocabulary as analyzeMeetingAudio: the prompt below
  // shows the model these lists, and resolveSuggestedAppId resolves its
  // "suggestedApp" answers against the identical union.
  const appsByUser = await fetchAttendeeAppLists(attendees.map((a) => a.id))
  const appOptions = unionAppOptions(appsByUser)

  // Change-detected screen keyframes captured alongside the audio (see
  // screen-keyframes.ts) — fetched here and handed to Gemini as labelled
  // image parts so the final synthesis pass can read on-screen content
  // (slides, diagrams, shared code, dashboards) the audio alone never
  // captures. Ordered by capturedAtMs so "in captured-at order" holds
  // without callGeminiWithImages having to re-sort. Best-effort per image —
  // one bad Blob fetch drops just that frame, never the whole analysis.
  const screenshotRows = await db
    .select({
      blobPathname: liveScreenshots.blobPathname,
      capturedAtMs: liveScreenshots.capturedAtMs,
    })
    .from(liveScreenshots)
    .where(eq(liveScreenshots.meetingId, id))
    .orderBy(liveScreenshots.capturedAtMs)

  const images: GeminiImageInput[] = []
  for (const row of screenshotRows) {
    try {
      const result = await getBlob(row.blobPathname, { access: 'private' })
      if (!result || result.statusCode !== 200) continue
      const bytes = Buffer.from(await new Response(result.stream).arrayBuffer())
      images.push({
        bytes,
        mimeType: result.blob.contentType || 'image/jpeg',
        label: `Screen capture at ${formatCapturedAt(row.capturedAtMs)} into the recording:`,
      })
    } catch (error) {
      console.error(`[meeting-recording] failed to load screen keyframe for meeting ${id}:`, error)
    }
  }

  // Depth target for the summary — here the assembled transcript itself is
  // the best signal for how much was actually said.
  const summaryDepth = summaryDepthInstruction({ transcriptChars: combinedTranscript.length })

  const prompt = `You are LogPup's meeting analyst for a software team. Below is the FULL transcript of
the meeting "${meeting.title}"${meeting.agenda ? ` (agenda: ${meeting.agenda})` : ''}, assembled from
several ~5-minute segments that were each transcribed independently (audio was never sent to you
directly here — only this assembled text). Segment boundaries are marked "--- segment N ---"; a
boundary marked "(missing — not transcribed, audio lost)" means that stretch of the meeting genuinely
has no transcript — treat it as a real gap in the record, never invent what might have been said
during it. IMPORTANT: speaker labels like "Speaker 1" were assigned independently per segment and do
NOT necessarily refer to the same person across a segment boundary — use content, names actually
mentioned, and context to attribute speech consistently in YOUR OWN speakerSegments output below,
rather than trusting the per-segment labels to already match up.
Known attendees: ${attendeeNames.length > 0 ? attendeeNames.join(', ') : 'unknown'}.
${attendeeAppsPromptBlock(attendees, appsByUser)}This is a Sri Lankan team that routinely code-switches between Sinhala and English mid-sentence — the
transcript already reflects that (Sinhala in සිංහල script, English in Latin script, technical terms
like "sprint"/"deploy"/"PR" left in English) — keep it that way in your own output, never
force-translate or paraphrase into a single language.
${
  hint
    ? `\nA live, noisy speech-to-text capture made during the meeting is included below as a HINT ONLY —
use it only to help spell attendee names, product/technical terms, and numbers correctly; the
transcript above is authoritative for content and language.\n\nLive transcript hint:\n"""\n${hint}\n"""\n`
    : ''
}
${
  images.length > 0
    ? `\n${images.length} screen capture(s) from this meeting are attached below this prompt, each preceded
by its own label giving its timestamp offset into the recording, in chronological order (earliest first).
Use them for ON-SCREEN CONTEXT — slides, diagrams, shared code, dashboards — that the transcript alone
doesn't capture. When something shown on screen materially informs a decision, deadline, or action item,
reference what was actually shown and when (e.g. "per the architecture diagram at 12:34" or "the PR shown
at 5:02"). Don't narrate every screenshot — only mention one when it actually matters to the minutes.\n`
    : ''
}
Transcript:
"""
${combinedTranscript.slice(0, 200_000)}
"""

Return STRICT JSON only, matching exactly:
{
  "language": "en" | "si" | "bilingual",
  "transcript": "the full transcript above, lightly cleaned up (you may smooth segment-boundary
    artifacts) but never re-translated or condensed — this is the record of what was said",
  "summary": "professional meeting minutes in English (if mainly Sinhala, append a Sinhala section) with three clear parts: Decisions made, Discussion highlights, and Next steps — written for someone who was not in the room, not a raw dump of everything said. ${summaryDepth}",
  "perPerson": [{ "name": "...", "points": ["key things this person said or decided"], "actionItems": ["..."] }],
  "deadlines": [{ "item": "...", "owner": "...", "due": "date or phrase as spoken" }],
  "terms": [{ "term": "software/technical term used", "explanation": "plain-English explanation", "sinhala": "short සිංහල explanation" }],
  "questions": [{ "person": "...", "questions": ["question this person should answer at the next meeting"] }],
  "speakerSegments": [{ "speaker": "attendee name if identifiable, else \"Speaker 1\"/\"Speaker 2\"/… used CONSISTENTLY for the same voice across the WHOLE meeting, or null", "text": "what this speaker said in this turn, verbatim in whichever language(s) they actually used" }],
  "actionItems": [{ "text": "concrete, assignable next step", "suggestedAssigneeLabel": "attendee name or speaker label this belongs to, or null", "suggestedDueDate": "YYYY-MM-DD or null — never a phrase", "confidence": 0.0, "suggestedApp": "app name copied EXACTLY from the attendee app lists above, or null" }]
}
Use "bilingual" for "language" whenever the meeting code-switches between Sinhala and English — the
common case for this team — and "en"/"si" only when it is genuinely all one language throughout.
Map speakers to attendee names where possible; unknown voices become "Speaker 1", "Speaker 2", … —
assigned by YOU, consistently, across the whole meeting (not copied from the per-segment labels in
the transcript above). Deadlines and action items must be concrete. Give each person 1–3 follow-up
questions about their commitments, blockers, and deadlines from THIS meeting.
speakerSegments must cover the whole meeting, in chronological order, one entry per speaker turn. If
you genuinely cannot tell speakers apart, return exactly ONE entry with "speaker": null and "text" set
to the full transcript — never invent distinct labels you are not confident about. actionItems are the
concrete next steps raised in the discussion (overlap with perPerson's actionItems is fine);
suggestedDueDate must be a real ISO date or null, and confidence is your own 0–1 estimate of how sure
you are about the assignee/due date. For "suggestedApp", pick the ONE app (project) the task belongs
to, copied exactly from the attendee app lists above — never invent an app name; use null when no
listed app clearly fits or when no app lists were given.`

  let raw: string
  let modelUsed: string = DEFAULT_GEMINI_MODEL
  try {
    // The one pass whose output a person actually reads, and the only one
    // that has to hold a whole meeting at once — reconciling speaker labels
    // across every segment and reading the captured screens. It runs once
    // per meeting, so a Pro-first chain costs a rounding error of the
    // request budget the per-segment calls already spend.
    ;({ text: raw, model: modelUsed } =
      images.length > 0
        ? await callGeminiWithImages(session.user.id, [{ text: prompt }], images, {
            models: SYNTHESIS_MODELS,
            responseJson: true,
          })
        : await callGemini(session.user.id, [{ text: prompt }], {
            models: SYNTHESIS_MODELS,
            responseJson: true,
          }))
  } catch (error) {
    // Deliberately NOT falling back to transcript-only notes here (unlike
    // the zero-segments branch above): the segment transcripts are already
    // durable in meeting_recording_segments, the client keeps its "Retry
    // analysis" affordance on error, and a retry once Gemini recovers yields
    // the full write-up. A fallback here would report success, dismiss that
    // affordance, and quietly leave the meeting with worse notes than a
    // retry would have produced.
    if (error instanceof GeminiError) return err(error.message)
    return err('Gemini request failed — try again')
  }

  const persisted = await persistMeetingAnalysis(
    id,
    meeting,
    session.user,
    attendees,
    raw,
    modelUsed,
    appOptions,
  )
  if (!persisted.ok) return persisted
  return ok({ mode: 'full' as const })
}

// --- Screen keyframes: change-detected screenshots captured alongside a
// "screen + mic" recording (see screen-keyframes.ts for the capture-side
// logic — sampling cadence, perceptual-hash keep/skip decision, and the
// downscale/JPEG-quality constants the client encodes with before calling
// this). Stored in Blob storage (private access — internal meeting screens,
// never world-readable) with metadata in meetingScreenshots; served back to
// the browser through /api/meeting-keyframes, the same private-blob proxy
// pattern avatars use, never as a raw Blob URL.

const KEYFRAME_PROXY_PREFIX = '/api/meeting-keyframes/'

/** Same single-encoded-segment trick avatar-actions.ts uses — the pathname
 *  (which itself contains '/') is one URL-encoded path segment, decoded and
 *  reconstructed by the proxy route rather than split across multiple. */
function keyframeProxyUrl(pathname: string): string {
  return KEYFRAME_PROXY_PREFIX + encodeURIComponent(pathname)
}

// Hard reject ceiling for one uploaded keyframe. A downscaled (max 1280px
// long edge), JPEG-quality-0.7 screen capture normally lands well under this
// — it exists to catch a client that sent something unexpected (e.g. the
// downscale step was skipped) with a clear per-frame error instead of a
// generic body-size failure.
const MAX_KEYFRAME_BYTES = 1 * 1024 * 1024
const ALLOWED_KEYFRAME_TYPES = ['image/jpeg']

export type MeetingScreenshotView = {
  id: string
  url: string
  capturedAtMs: number
  width: number | null
  height: number | null
  byteSize: number | null
}

const uploadKeyframeInput = z.object({
  meetingId: z.uuid(),
  capturedAtMs: z.number().int().min(0),
  width: z.number().int().min(1).max(20_000),
  height: z.number().int().min(1).max(20_000),
})

/**
 * Uploads one change-detected screen keyframe. Same entitlement as the rest
 * of the recording pipeline (canManageMeeting — only an admin or the
 * meeting's creator can record) rather than the looser read rule, since this
 * writes new content tied to the recording, same posture as
 * transcribeSegment.
 *
 * MAX_KEYFRAMES_PER_MEETING is enforced here too, not just by the client's
 * own counter (use-screen-keyframes.ts) — a client-side cap alone is not a
 * real limit, it's just a UI nicety a modified client could ignore.
 */
export async function uploadMeetingKeyframe(
  meetingId: string,
  file: File,
  capturedAtMs: number,
  width: number,
  height: number,
): Promise<ActionResult<MeetingScreenshotView>> {
  const parsed = uploadKeyframeInput.safeParse({ meetingId, capturedAtMs, width, height })
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const id = parsed.data.meetingId

  if (!(file instanceof File) || file.size === 0) return err('No image received')
  if (file.size > MAX_KEYFRAME_BYTES) return err('Screen capture came out larger than expected — skipped')
  if (!ALLOWED_KEYFRAME_TYPES.includes(file.type)) return err('Unsupported image type')

  const ctx = await canManageMeeting(id)
  if (!ctx) return err('Only admins or the meeting creator can capture screen keyframes')
  const { session, meeting } = ctx

  // LIVE frames only: a trashed keyframe still has a row (soft-deleted, not
  // gone) and must not count against the cap for new captures.
  const existing = await db
    .select({ id: liveScreenshots.id })
    .from(liveScreenshots)
    .where(eq(liveScreenshots.meetingId, id))
  if (existing.length >= MAX_KEYFRAMES_PER_MEETING) {
    return err(`Reached the ${MAX_KEYFRAMES_PER_MEETING}-screenshot cap for this meeting`)
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return err('Image storage is not configured — set BLOB_READ_WRITE_TOKEN to enable screen capture')
  }

  let blob: Awaited<ReturnType<typeof put>>
  try {
    blob = await put(`meeting-keyframes/${id}/${crypto.randomUUID()}.jpg`, file, {
      access: 'private',
      contentType: file.type,
    })
  } catch {
    return err('Upload failed — try again')
  }

  const [row] = await db
    .insert(meetingScreenshots)
    .values({
      meetingId: id,
      blobUrl: blob.url,
      blobPathname: blob.pathname,
      capturedAtMs: parsed.data.capturedAtMs,
      width: parsed.data.width,
      height: parsed.data.height,
      byteSize: file.size,
      createdBy: session.user.id,
    })
    .returning({ id: meetingScreenshots.id })

  revalidatePath('/meetings')
  return ok({
    id: row.id,
    url: keyframeProxyUrl(blob.pathname),
    capturedAtMs: parsed.data.capturedAtMs,
    width: parsed.data.width,
    height: parsed.data.height,
    byteSize: file.size,
  })
}

/**
 * Deletes one keyframe someone doesn't want kept — same canManageMeeting
 * gate as capturing it in the first place. Soft delete: the row is marked,
 * not removed, so it stays available to an admin from Trash. The Blob object
 * itself is intentionally left alone — it's retained until an admin
 * permanently purges the trash, not swept here.
 */
export async function deleteMeetingKeyframe(screenshotId: string): Promise<ActionResult> {
  const parsed = idInput.safeParse(screenshotId)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const [row] = await db
    .select()
    .from(liveScreenshots)
    .where(eq(liveScreenshots.id, parsed.data))
  if (!row) return err('Not found')

  const ctx = await canManageMeeting(row.meetingId)
  if (!ctx) return err('Not allowed')

  const marked = await db
    .update(meetingScreenshots)
    .set({ deletedAt: new Date(), deletedBy: ctx.session.user.id })
    .where(and(eq(meetingScreenshots.id, row.id), isNull(meetingScreenshots.deletedAt)))
    .returning({ id: meetingScreenshots.id })
  if (marked.length === 0) return err('Not found')

  await logActivity({
    actorId: ctx.session.user.id,
    verb: 'deleted',
    entityType: 'meeting',
    entityId: row.meetingId,
    entityLabel: keyframeDeleteLabel(ctx.meeting.title),
    pagePath: '/meetings',
    detail: 'a screen keyframe',
  })

  revalidatePath('/meetings')
  // The frame is now a row in the admin Trash card — see revalidateAdmin.
  revalidateAdmin()
  return ok(undefined)
}

export async function getMeetingIntel(meetingId: string): Promise<ActionResult<MeetingIntel>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const idParsed = idInput.safeParse(meetingId)
  if (!idParsed.success) return err(idParsed.error.issues[0].message)
  const id = idParsed.data

  const [meeting] = await db.select().from(liveMeetings).where(eq(liveMeetings.id, id))
  if (!meeting) return err('Meeting not found')

  // Meeting intel can contain a full transcript — restrict reads to people
  // who were actually in the room (attendees), the meeting's creator, or an
  // admin. A plain "any signed-in user" check would leak transcripts across
  // the whole org.
  if (!(await canReadMeetingIntel(session.user, meeting))) return err('Not available')

  const [notesRow] = await db
    .select()
    .from(meetingAiNotes)
    .where(eq(meetingAiNotes.meetingId, id))

  // Prep is now person-linked follow-up carry-forward rather than "the
  // previous meeting's questions": every OPEN follow-up attributed to one of
  // THIS meeting's attendees, drawn from any earlier meeting they were owed
  // it from — not just the immediately preceding one, and not scoped to a
  // single app, since a person carries their open items with them.
  //
  // The entitlement check above only covers THIS meeting's row. Each
  // follow-up's source meeting is a *different* meeting, and its text is
  // derived verbatim from that meeting's transcript — so the same
  // attendee/creator/admin rule has to be applied to every source meeting
  // too (fetchOpenFollowupsBefore). Without this, any member could create a
  // throwaway meeting that happens to share an attendee with someone else's
  // confidential meeting and read that meeting's follow-up text here.
  const isAdmin = session.user.role === 'admin'
  const attendees = await fetchAttendees(id)
  const attendeeIds = attendees.map((row) => row.id)

  // Items resolved in THIS meeting come back too (includeResolvedHere) so a
  // resolve is visible as a settled row with its outcome note rather than a
  // disappearance — and can be undone. They stay pinned to this one meeting,
  // so nothing resolved is ever carried into a future one.
  const carried = await fetchCarriedFollowups(
    { id, startsAt: meeting.startsAt },
    { id: session.user.id, isAdmin },
    { includeResolvedHere: true },
  )
  const detailById = new Map(carried.map((row) => [row.id, row]))

  // One clock read, shared by every item's age/staleness below — matches
  // meeting-notes-model.ts's own "one `now` per render" reasoning, just on
  // the server side of the same computation.
  const now = new Date()

  // Reconcile the JSONB action list against every suggestion row THIS
  // meeting has ever had (any status — open, auto-accepted, person-accepted,
  // or dismissed), not just the visible open+auto-accepted subset
  // fetchTaskSuggestions returns below. A JSONB item whose suggestion was
  // dismissed or turned into a task already has an answer from the
  // suggestion system and must NOT be re-offered as "untracked"; only a
  // JSONB item with NO suggestion at all (never inserted — e.g. it only ever
  // existed in the free-text deadlines[] field) is a real gap to backfill.
  const actionRows: ActionRow[] = notesRow
    ? buildActionList(
        { perPerson: asArray<PerPersonNote>(notesRow.perPerson), deadlines: asArray<DeadlineNote>(notesRow.deadlines) },
        now,
      )
    : []
  const untrackedActions =
    actionRows.length > 0
      ? reconcileActionItems(
          actionRows,
          await db
            .select({ id: meetingTaskSuggestions.id, text: meetingTaskSuggestions.text })
            .from(meetingTaskSuggestions)
            .where(eq(meetingTaskSuggestions.meetingId, id)),
        ).untracked
      : []

  // Batched lookup of every task a carried item is linked to (see
  // linkFollowupToTask) — one query for the whole set, not one per row, same
  // pattern as revalidateApps in sprints/task-actions.ts.
  const linkedTaskIds = [
    ...new Set(
      carried
        .map((row) => row.resolvedByTaskId)
        .filter((taskId): taskId is string => taskId !== null),
    ),
  ]
  const linkedTaskById = new Map<string, LinkedTaskView>()
  if (linkedTaskIds.length > 0) {
    const taskRows = await db
      .select({
        id: liveTasks.id,
        title: liveTasks.title,
        status: liveTasks.status,
        appSlug: apps.slug,
      })
      .from(liveTasks)
      .leftJoin(apps, eq(liveTasks.appId, apps.id))
      .where(inArray(liveTasks.id, linkedTaskIds))
    for (const row of taskRows) {
      linkedTaskById.set(row.id, { id: row.id, title: row.title, status: row.status, appSlug: row.appSlug })
    }
  }

  const prep: CarriedForwardItemGroup[] = selectCarriedForward(carried, attendeeIds, now).map(
    (group) => ({
      userId: group.userId,
      person: group.person,
      overflowCount: group.overflowCount,
      items: group.items
        .map((item) => {
          const row = detailById.get(item.id)
          return {
            ...item,
            status: row?.status ?? 'open',
            resolutionNote: row?.resolutionNote ?? null,
            responseNote: row?.responseNote ?? null,
            deferReason: row?.deferReason ?? null,
            resolvedAt: row?.resolvedAt ?? null,
            createdBy: row?.createdBy ?? null,
            targetMeetingId: row?.targetMeetingId ?? null,
            linkedTask: row?.resolvedByTaskId ? (linkedTaskById.get(row.resolvedByTaskId) ?? null) : null,
          }
        })
        // Still-owed work first; the settled ones are a record, not a to-do.
        // Array#sort is stable, so each half keeps its original order.
        .sort((a, b) => Number(a.status === 'resolved') - Number(b.status === 'resolved')),
    }),
  )

  const screenshotRows = await db
    .select({
      id: liveScreenshots.id,
      blobPathname: liveScreenshots.blobPathname,
      capturedAtMs: liveScreenshots.capturedAtMs,
      width: liveScreenshots.width,
      height: liveScreenshots.height,
      byteSize: liveScreenshots.byteSize,
    })
    .from(liveScreenshots)
    .where(eq(liveScreenshots.meetingId, id))
    .orderBy(liveScreenshots.capturedAtMs)

  return ok({
    notes: notesRow
      ? {
          language: notesRow.language,
          transcript: notesRow.transcript,
          summary: notesRow.summary,
          perPerson: asArray<PerPersonNote>(notesRow.perPerson),
          deadlines: asArray<DeadlineNote>(notesRow.deadlines),
          terms: asArray<TermNote>(notesRow.terms),
          questions: asArray<QuestionNote>(notesRow.questions),
          model: notesRow.model,
          createdAt: notesRow.createdAt,
          autoAssignCappedCount: notesRow.autoAssignCappedCount,
        }
      : null,
    prep,
    people: attendees.map((attendee) => ({ id: attendee.id, name: attendee.name })),
    approvedUsers: await fetchApprovedUsers(),
    unattributed: await fetchUnattributedFollowups({ id, title: meeting.title, startsAt: meeting.startsAt }),
    upcomingMeetings: await fetchFollowupTargets(
      { id, startsAt: meeting.startsAt },
      { id: session.user.id, isAdmin },
    ),
    screenshots: screenshotRows.map((row) => ({
      id: row.id,
      url: keyframeProxyUrl(row.blobPathname),
      capturedAtMs: row.capturedAtMs,
      width: row.width,
      height: row.height,
      byteSize: row.byteSize,
    })),
    autoAssignTasks: meeting.autoAssignTasks,
    suggestions: await fetchTaskSuggestions(id),
    untrackedActions,
    nextSegmentIndex: await fetchNextSegmentIndex(id),
  })
}

/**
 * One past the highest recording-segment index stored for this meeting, or 0
 * when nothing has been recorded yet. See MeetingIntel.nextSegmentIndex for
 * why the client cannot work this out for itself.
 */
async function fetchNextSegmentIndex(meetingId: string): Promise<number> {
  const [row] = await db
    .select({ maxIndex: sql<number | null>`max(${meetingRecordingSegments.index})` })
    .from(meetingRecordingSegments)
    .where(eq(meetingRecordingSegments.meetingId, meetingId))
  return row?.maxIndex === null || row?.maxIndex === undefined ? 0 : Number(row.maxIndex) + 1
}

/**
 * "Around the table" prep — one row per attendee: the apps they work on,
 * per-app open/overdue counts for the current sprint, and their latest
 * sprint check-in measured against what their board computes (checkinGap).
 * A SIBLING of getMeetingIntel rather than a field on it, so this
 * board-derived payload can load and refresh independently of the (heavier)
 * transcript-bearing intel — an inline check-in only needs THIS refetched.
 *
 * Same read gate as getMeetingIntel: these rows lay out named people's
 * workloads across every project, which is exactly the kind of cross-project
 * view that must not leak past the people who were actually in the room.
 *
 * Every fetch below is batched — one query per table however many attendees
 * there are (getCheckinsForSprints is the documented ONE-query grouped read)
 * — and every branchy decision (which sprint is "current", which check-in is
 * "latest", what counts as overdue) lives in the pure, tested
 * assembleMeetingPrep, not here.
 */
export async function getMeetingPrep(meetingId: string): Promise<ActionResult<AttendeePrep[]>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const idParsed = idInput.safeParse(meetingId)
  if (!idParsed.success) return err(idParsed.error.issues[0].message)
  const id = idParsed.data

  const [meeting] = await db.select().from(liveMeetings).where(eq(liveMeetings.id, id))
  if (!meeting) return err('Meeting not found')
  if (!(await canReadMeetingIntel(session.user, meeting))) return err('Not available')

  const attendees = await fetchAttendees(id)
  if (attendees.length === 0) return ok([])
  const attendeeIds = attendees.map((row) => row.id)

  const assignmentRows = await db
    .select({
      userId: assignments.userId,
      appId: assignments.appId,
      appName: apps.name,
      appSlug: apps.slug,
    })
    .from(assignments)
    .innerJoin(apps, eq(assignments.appId, apps.id))
    .where(inArray(assignments.userId, attendeeIds))

  // Same "running now" predicate as getActiveSprints (sprints/queries.ts):
  // status 'active', plus 'planned' rows whose date range already contains
  // today — covering sprints nobody remembered to flip. Fetched for ALL apps,
  // not just assigned ones, so assembleMeetingPrep can also discover an app
  // someone mid-handover only holds tasks in.
  const todayIso = toIsoDateInTimeZone(new Date())
  const sprintRows = await db
    .select({
      sprintId: liveSprints.id,
      sprintName: liveSprints.name,
      appId: liveSprints.appId,
      appName: apps.name,
      appSlug: apps.slug,
      startDate: liveSprints.startDate,
    })
    .from(liveSprints)
    .innerJoin(apps, eq(liveSprints.appId, apps.id))
    .where(
      or(
        eq(liveSprints.status, 'active'),
        and(
          eq(liveSprints.status, 'planned'),
          lte(liveSprints.startDate, todayIso),
          gte(liveSprints.endDate, todayIso),
        ),
      ),
    )
  const sprintIds = sprintRows.map((row) => row.sprintId)

  // Only the attendees' own tasks: unassigned tasks belong to nobody's
  // counts, and other people's never land in these rows (computeTaskProgress
  // filters per person anyway — this just keeps the fetch narrow).
  const taskRows =
    sprintIds.length > 0
      ? await db
          .select({
            sprintId: liveTasks.sprintId,
            assigneeId: liveTasks.assigneeId,
            status: liveTasks.status,
            dueDate: liveTasks.dueDate,
          })
          .from(liveTasks)
          .where(
            and(
              inArray(liveTasks.sprintId, sprintIds),
              inArray(liveTasks.assigneeId, attendeeIds),
            ),
          )
      : []

  const checkinsBySprint = await getCheckinsForSprints(sprintIds)
  const checkinRows = [...checkinsBySprint.values()].flat()

  return ok(
    assembleMeetingPrep({
      attendees,
      assignments: assignmentRows,
      sprints: sprintRows,
      tasks: taskRows,
      checkins: checkinRows,
      todayIso,
    }),
  )
}

const setAutoAssignInput = z.object({ meetingId: z.uuid(), enabled: z.boolean() })

/**
 * Flips the per-meeting "Auto-assign tasks" toggle (layer (a) of full-auto's
 * manual override — see notes.ts shouldAutoAssign for what it gates). Same
 * canManageMeeting gate as recording itself: only the meeting's creator or
 * an admin decides whether THIS meeting's future analyses run full-auto or
 * leave everything as manual suggestion cards. Takes effect on the NEXT
 * analysis — it does not retroactively touch suggestions already accepted.
 */
export async function setMeetingAutoAssignTasks(
  meetingId: string,
  enabled: boolean,
): Promise<ActionResult> {
  const parsed = setAutoAssignInput.safeParse({ meetingId, enabled })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const ctx = await canManageMeeting(parsed.data.meetingId)
  if (!ctx) return err('Not allowed')

  await db
    .update(meetings)
    .set({ autoAssignTasks: parsed.data.enabled })
    .where(eq(meetings.id, parsed.data.meetingId))

  revalidatePath('/meetings')
  return ok(undefined)
}

const resolveFollowupInput = z.object({
  followupId: z.uuid(),
  // What actually came of the item. Optional on purpose — "done" with no
  // explanation is still a legitimate answer, and forcing prose here would
  // just get it skipped.
  note: z.string().trim().max(MAX_RESOLUTION_NOTE_CHARS).optional(),
  // Which meeting the person was looking at when they resolved it. Recorded
  // so the settled row stays visible on that meeting (see
  // fetchFollowupsBefore) instead of vanishing everywhere at once.
  meetingId: z.uuid().optional(),
})

const reopenFollowupInput = z.object({ followupId: z.uuid() })

type FollowupWriteContext = {
  user: { id: string; role?: string | null }
  row: typeof meetingFollowups.$inferSelect
  /**
   * The source meeting, carried out of the authorization read that had to
   * happen anyway. Exists so the activity trail can name what changed WITHOUT
   * quoting the follow-up: `row.text` is transcript-derived and gated behind
   * canReadMeetingIntel, while activity_log is read by every member.
   */
  sourceMeeting: { title: string; appId: string | null }
}

/**
 * Shared gate for the manual follow-up writes (resolve / reopen). Allowed
 * for an admin, the source meeting's creator, or the person the item is
 * attributed to — mirrors the read-entitlement rule so changing something
 * never requires broader access than reading it did, and so undoing a
 * resolve needs exactly as much standing as making it did.
 */
async function authorizeFollowupWrite(
  followupId: string,
  verb: string,
): Promise<ActionResult<FollowupWriteContext>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const [row] = await db.select().from(meetingFollowups).where(eq(meetingFollowups.id, followupId))
  if (!row) return err('Not found')

  const [sourceMeeting] = await db
    .select({
      createdBy: liveMeetings.createdBy,
      title: liveMeetings.title,
      appId: liveMeetings.appId,
    })
    .from(liveMeetings)
    .where(eq(liveMeetings.id, row.sourceMeetingId))
  if (!sourceMeeting) return err('Not found')

  const isAdmin = session.user.role === 'admin'
  const isCreator = sourceMeeting.createdBy === session.user.id
  const isSelf = row.userId === session.user.id
  if (!isAdmin && !isCreator && !isSelf) return err(`Not allowed to ${verb} this item`)

  return ok({ user: session.user, row, sourceMeeting })
}

/**
 * Manual resolve for a carried-in follow-up. Closing it is ONE click and
 * never waits on prose: `note` (what the answer/change actually was) is
 * optional and can be added — or edited, or cleared — afterwards by calling
 * this again on an already-resolved item, which is how the UI's "Add
 * outcome" affordance works without ever gating the resolve itself.
 */
export async function resolveFollowup(
  followupId: string,
  note?: string,
  meetingId?: string,
): Promise<ActionResult> {
  const parsed = resolveFollowupInput.safeParse({ followupId, note, meetingId })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const authorized = await authorizeFollowupWrite(parsed.data.followupId, 'resolve')
  if (!authorized.ok) return authorized
  const { user, row, sourceMeeting } = authorized.data

  // An all-whitespace note is no note — store null so "resolved with no
  // explanation" has one representation, not two.
  const resolutionNote = parsed.data.note ? parsed.data.note : null

  // The meeting context is only trusted after the same read check the panel
  // itself passes — otherwise a resolve could pin an item onto a meeting the
  // caller can't see.
  let resolvedInMeetingId: string | null = null
  if (parsed.data.meetingId) {
    const [contextMeeting] = await db
      .select()
      .from(liveMeetings)
      .where(eq(liveMeetings.id, parsed.data.meetingId))
    if (!contextMeeting) return err('Not found')
    if (!(await canReadMeetingIntel(user, contextMeeting))) return err('Not available')
    resolvedInMeetingId = contextMeeting.id
  }

  const alreadyResolved = row.status === 'resolved'
  // Re-resolving an already-resolved item only ever edits its outcome note —
  // the original timestamp and meeting stay put. When there's no note to
  // write and none to clear, there is genuinely nothing to do.
  if (alreadyResolved && !resolutionNote && !row.resolutionNote) return ok(undefined)

  await db
    .update(meetingFollowups)
    .set({
      status: 'resolved',
      resolvedAt: alreadyResolved ? row.resolvedAt : new Date(),
      resolvedInMeetingId: alreadyResolved ? row.resolvedInMeetingId : resolvedInMeetingId,
      resolutionNote,
    })
    .where(eq(meetingFollowups.id, row.id))

  await logActivity({
    actorId: user.id,
    verb: 'resolved',
    entityType: 'followup',
    entityId: row.id,
    // NEVER row.text, and never the resolution note. Both are derived from
    // the meeting transcript and readable only behind canReadMeetingIntel;
    // activity_log has no such gate. The meeting title is already team-wide
    // (every member sees it on /meetings), so it names the event safely —
    // anyone entitled to the content follows the link to read it.
    entityLabel: sourceMeeting.title,
    appId: sourceMeeting.appId,
    pagePath: '/meetings',
    detail: 'a follow-up',
    metadata: { status: { from: row.status, to: 'resolved' } },
  })

  revalidatePath('/meetings')

  return ok(undefined)
}

/**
 * Undo of the above — "actually, not yet". Clears every trace of the
 * resolve (timestamp, meeting, note) so the item is indistinguishable from
 * one that was never closed, which is exactly what makes it carry forward
 * to the next meeting its person attends again.
 */
export async function reopenFollowup(followupId: string): Promise<ActionResult> {
  const parsed = reopenFollowupInput.safeParse({ followupId })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const authorized = await authorizeFollowupWrite(parsed.data.followupId, 'reopen')
  if (!authorized.ok) return authorized
  const { user, row, sourceMeeting } = authorized.data

  if (row.status !== 'open') {
    await db
      .update(meetingFollowups)
      .set({
        status: 'open',
        resolvedAt: null,
        resolvedInMeetingId: null,
        resolutionNote: null,
      })
      .where(eq(meetingFollowups.id, row.id))

    await logActivity({
      actorId: user.id,
      verb: 'reopened',
      entityType: 'followup',
      entityId: row.id,
      // Meeting title, not row.text — see the resolve site above.
      entityLabel: sourceMeeting.title,
      appId: sourceMeeting.appId,
      pagePath: '/meetings',
      detail: 'a follow-up',
      metadata: { status: { from: row.status, to: 'open' } },
    })

    revalidatePath('/meetings')
  }

  return ok(undefined)
}

const closeAsStaleInput = z.object({ followupId: z.uuid() })

/**
 * One-click close for an item that has been carried past CARRY_STALE_DAYS
 * with nothing said about it either way — distinct from a normal Resolve
 * (which claims the item was actually addressed): this claims only that it
 * is being stopped from carrying forward forever, and says so honestly in
 * the outcome note rather than pretending it was answered. Same authorizer
 * as resolve/reopen — no separate permission tier for this being "just" a
 * cleanup action.
 */
export async function closeFollowupAsStale(followupId: string): Promise<ActionResult> {
  const parsed = closeAsStaleInput.safeParse({ followupId })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const authorized = await authorizeFollowupWrite(parsed.data.followupId, 'close as stale')
  if (!authorized.ok) return authorized
  const { user, row, sourceMeeting } = authorized.data
  if (row.status === 'resolved') return ok(undefined)

  const ageDays = Math.max(
    0,
    Math.floor((Date.now() - row.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
  )
  const resolutionNote = `Closed as stale — carried ${ageDays} days with no update`

  await db
    .update(meetingFollowups)
    .set({ status: 'resolved', resolvedAt: new Date(), resolutionNote })
    .where(eq(meetingFollowups.id, row.id))

  await logActivity({
    actorId: user.id,
    verb: 'resolved',
    entityType: 'followup',
    entityId: row.id,
    // Meeting title, not row.text — see resolveFollowup.
    entityLabel: sourceMeeting.title,
    appId: sourceMeeting.appId,
    pagePath: '/meetings',
    detail: 'a follow-up, closed as stale',
    metadata: { status: { from: row.status, to: 'resolved' }, reason: 'stale' },
  })

  revalidatePath('/meetings')
  return ok(undefined)
}

const attributeFollowupInput = z.object({ followupId: z.uuid(), userId: z.uuid() })

/**
 * Gives an unattributed follow-up (see fetchUnattributedFollowups — the
 * model named someone it couldn't unambiguously resolve to a user) a real
 * owner. After this, it's an ordinary AI-derived follow-up: normal
 * carry-forward, resolve, and task-linking all apply from here on.
 *
 * Entitlement is canManageMeeting on the item's SOURCE meeting (admin or
 * that meeting's creator) — same tier as recording/managing that meeting,
 * not the broader read-entitlement every attendee gets, since this is a
 * write that changes who the item is about.
 */
export async function attributeFollowup(followupId: string, userId: string): Promise<ActionResult> {
  const parsed = attributeFollowupInput.safeParse({ followupId, userId })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const [row] = await db.select().from(meetingFollowups).where(eq(meetingFollowups.id, parsed.data.followupId))
  if (!row) return err('Not found')
  if (row.userId !== null) return err('Already attributed to someone')

  const ctx = await canManageMeeting(row.sourceMeetingId)
  if (!ctx) return err('Not allowed')

  const [person] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, parsed.data.userId))
  if (!person) return err('Person not found')

  await db
    .update(meetingFollowups)
    .set({ userId: person.id, personName: person.name })
    .where(eq(meetingFollowups.id, row.id))

  await logActivity({
    actorId: ctx.session.user.id,
    verb: 'updated',
    entityType: 'followup',
    entityId: row.id,
    // Meeting title, not row.text — see resolveFollowup.
    entityLabel: ctx.meeting.title,
    appId: ctx.meeting.appId,
    pagePath: '/meetings',
    detail: `a follow-up, attributed to ${person.name}`,
  })

  revalidatePath('/meetings')
  return ok(undefined)
}

const followupNoteInput = z.object({
  followupId: z.uuid(),
  // Blank is meaningful: it clears whatever was written before. Nothing here
  // is ever required, so there has to be a way back to nothing.
  note: z.string().trim().max(MAX_FOLLOWUP_NOTE_CHARS),
})

/**
 * Shared writer for the two notes an item can carry while it is still OPEN —
 * what the person said, and why it isn't done yet. Neither touches `status`:
 * that's the whole point. An item with a response is still owed, and still
 * carries forward, until someone actually resolves it.
 */
async function writeOpenFollowupNote(
  followupId: string,
  note: string,
  column: 'responseNote' | 'deferReason',
  verb: string,
): Promise<ActionResult> {
  const parsed = followupNoteInput.safeParse({ followupId, note })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const authorized = await authorizeFollowupWrite(parsed.data.followupId, verb)
  if (!authorized.ok) return authorized
  const { row, sourceMeeting } = authorized.data

  const value = parsed.data.note ? parsed.data.note : null
  await db
    .update(meetingFollowups)
    .set(column === 'responseNote' ? { responseNote: value } : { deferReason: value })
    .where(eq(meetingFollowups.id, row.id))

  revalidatePath('/meetings')
  return ok(undefined)
}

/**
 * Records what the person actually said about an open item — an update, not
 * an answer. The item stays open and keeps carrying forward; passing a blank
 * note clears it.
 */
export async function noteFollowup(followupId: string, note: string): Promise<ActionResult> {
  return writeOpenFollowupNote(followupId, note, 'responseNote', 'record a response on')
}

/**
 * Records WHY an item isn't resolved yet — the reason behind "not yet".
 * Stored separately from both the response and the outcome so the three
 * never collapse into one ambiguous blob. Blank clears it.
 */
export async function deferFollowupReason(
  followupId: string,
  reason: string,
): Promise<ActionResult> {
  return writeOpenFollowupNote(followupId, reason, 'deferReason', 'add a reason to')
}

const addFollowupInput = z.object({
  meetingId: z.uuid(),
  personUserId: z.uuid(),
  text: z.string().trim().min(1).max(MAX_FOLLOWUP_TEXT_CHARS),
  kind: z.enum(['question', 'action']),
  // Optional pin. Omitted, the item behaves like every AI-derived one: it
  // finds its person at whatever meeting they attend next.
  targetMeetingId: z.uuid().nullish(),
})

/**
 * Adds a follow-up by hand — the same kind of open question/action item the
 * analysis derives, except a person decided it should exist. It is sourced
 * at the meeting it was added from, which is exactly why it does NOT appear
 * there: an open item shows up at the NEXT meeting its person attends (or at
 * `targetMeetingId`, if one was picked).
 *
 * Same read gate as the panel it's added from, plus: the person has to be
 * someone this caller could legitimately name (an attendee of this meeting,
 * or an active user), and a chosen target meeting has to be one the caller
 * can see AND one that person is actually attending — otherwise the item
 * would be filed somewhere it can never surface.
 */
export async function addFollowup(input: {
  meetingId: string
  personUserId: string
  text: string
  kind: FollowupKind
  targetMeetingId?: string | null
}): Promise<ActionResult> {
  const parsed = addFollowupInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const [meeting] = await db.select().from(liveMeetings).where(eq(liveMeetings.id, parsed.data.meetingId))
  if (!meeting) return err('Meeting not found')
  if (!(await canReadMeetingIntel(session.user, meeting))) return err('Not available')

  const [person] = await db
    .select({ id: users.id, name: users.name, active: users.active })
    .from(users)
    .where(eq(users.id, parsed.data.personUserId))
  if (!person) return err('Pick who this is for')

  if (!person.active) {
    const [attendee] = await db
      .select({ userId: meetingAttendees.userId })
      .from(meetingAttendees)
      .where(
        and(
          eq(meetingAttendees.meetingId, meeting.id),
          eq(meetingAttendees.userId, person.id),
        ),
      )
    if (!attendee) return err('That person is no longer active')
  }

  let targetMeetingId: string | null = null
  if (parsed.data.targetMeetingId) {
    const [target] = await db
      .select()
      .from(liveMeetings)
      .where(eq(liveMeetings.id, parsed.data.targetMeetingId))
    if (!target) return err('That meeting no longer exists')
    if (!(await canReadMeetingIntel(session.user, target))) return err('Not available')
    const [going] = await db
      .select({ userId: meetingAttendees.userId })
      .from(meetingAttendees)
      .where(
        and(eq(meetingAttendees.meetingId, target.id), eq(meetingAttendees.userId, person.id)),
      )
    if (!going) {
      return err(`${person.name} isn’t on that meeting — pick another, or leave it to their next one`)
    }
    targetMeetingId = target.id
  }

  const [createdFollowup] = await db
    .insert(meetingFollowups)
    .values({
      sourceMeetingId: meeting.id,
      userId: person.id,
      personName: person.name,
      text: parsed.data.text,
      kind: parsed.data.kind,
      status: 'open',
      createdBy: session.user.id,
      targetMeetingId,
    })
    .returning({ id: meetingFollowups.id })

  await logActivity({
    actorId: session.user.id,
    verb: 'created',
    entityType: 'followup',
    entityId: createdFollowup.id,
    // Meeting title, not the follow-up text — see resolveFollowup. Typed by
    // hand rather than transcribed, but it lives on the same intel-gated
    // panel and is read back by the same people, so it gets the same rule.
    entityLabel: meeting.title,
    appId: meeting.appId,
    pagePath: '/meetings',
    detail: `a follow-up for ${person.name}`,
  })

  revalidatePath('/meetings')
  return ok(undefined)
}

const copyResponseInput = z.object({ followupId: z.uuid(), meetingId: z.uuid() })

/**
 * Puts a recorded response into the meeting's own notes, attributed —
 * "Shanika Ayasmanthi: the client hasn't replied yet". Always an explicit
 * action, never automatic: what someone said in passing is not
 * automatically part of the record, and the panel only offers this once a
 * response has actually been written down.
 *
 * Appends via the existing updateMeetingNotes so its rules apply unchanged
 * (only an admin or the meeting's creator can write notes, the length cap
 * holds, @mentions still notify, the same paths revalidate).
 */
export async function copyFollowupResponseToNotes(
  followupId: string,
  meetingId: string,
): Promise<ActionResult> {
  const parsed = copyResponseInput.safeParse({ followupId, meetingId })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const authorized = await authorizeFollowupWrite(parsed.data.followupId, 'copy')
  if (!authorized.ok) return authorized
  const { user, row } = authorized.data

  const response = row.responseNote?.trim()
  if (!response) return err('Write down what they said first')

  const [contextMeeting] = await db
    .select()
    .from(liveMeetings)
    .where(eq(liveMeetings.id, parsed.data.meetingId))
  if (!contextMeeting) return err('Meeting not found')
  if (!(await canReadMeetingIntel(user, contextMeeting))) return err('Not available')

  const line = `${row.personName}: ${response}`
  const existing = contextMeeting.notes ?? ''
  if (existing.includes(line)) return err('That’s already in this meeting’s notes')

  const nextNotes = existing.trim() ? `${existing.trimEnd()}\n${line}` : line
  return updateMeetingNotes(contextMeeting.id, nextNotes)
}

// --- Unified note timeline: segments, speaker assignment, task suggestions ---

export type NoteSegmentView = {
  id: string
  source: NoteSource
  speakerId: string | null
  speakerName: string | null
  speakerLabel: string | null
  content: string
  startedAtMs: number | null
  createdByName: string | null
  createdAt: Date
  /** A synthetic entry read from the legacy `meetings.notes` field — not a
   *  real row yet. Editing it (addTypedNoteSegment) migrates it into one. */
  isLegacy?: boolean
}

export type SpeakerRow = {
  label: string
  userId: string | null
  userName: string | null
  /** Typed-in name for a voice with no account; null whenever userId is set.
   *  Render via resolveSpeakerName (notes.ts) — the segment rows cannot carry
   *  this, since a name with no account has no users row to join. */
  displayName: string | null
}

export type TaskSuggestionView = {
  id: string
  segmentId: string | null
  text: string
  suggestedUserId: string | null
  suggestedUserName: string | null
  suggestedDueDate: string | null
  /**
   * The app the AI confidently routed this item into (suggestedAppId in
   * schema.ts), with its display name for the card. Null means no confident
   * app — accepting falls back to the meeting's own app, exactly the
   * pre-routing behaviour.
   */
  suggestedAppId: string | null
  suggestedAppName: string | null
  status: 'open' | 'accepted' | 'dismissed'
  createdTaskId: string | null
  /**
   * Who ACCEPTED this suggestion — only meaningful while status is
   * 'accepted'. Null there means the auto-assign pass accepted it; a real
   * user id means a person clicked "Add task" themselves. See schema.ts's
   * comment on meetingTaskSuggestions.acceptedBy for why this is a nullable
   * column rather than a fourth status value.
   */
  acceptedBy: string | null
  /** Live snapshot of the created task — null unless createdTaskId is set. */
  taskStatus: 'todo' | 'in_progress' | 'done' | null
  taskTitle: string | null
  /** The task's app slug, for linking straight to its board. */
  appSlug: string | null
}

/** Someone in the org who is NOT on this meeting — the picker's second tier. */
export type OrgPersonOption = { id: string; name: string; email: string }

/**
 * Everything the speaker-assignment control needs. Bundled as its own type so
 * the control can be mounted somewhere that has no note timeline (see
 * getSpeakerAssignmentData) as well as inside one.
 */
export type SpeakerAssignmentData = {
  /** Distinct speaker labels the transcript produced for this meeting. */
  labels: string[]
  speakers: SpeakerRow[]
  attendees: AttendeeRef[]
  orgPeople: OrgPersonOption[]
  /** Whether the caller may create a brand-new person (admins only). */
  canAddPeople: boolean
}

/**
 * A follow-up the AI derived but could not attribute to a real person — its
 * `personName` is the model's raw guess, kept verbatim and rendered as a
 * LABEL. Until someone says who it belongs to it carries forward to nobody,
 * which is the point: an item owed by "whoever the model thought" is worse
 * than one visibly waiting to be assigned.
 */
export type UnassignedFollowupView = {
  id: string
  personName: string
  text: string
  kind: FollowupKind
}

export type NoteTimelineData = {
  segments: NoteSegmentView[]
  speakers: SpeakerRow[]
  suggestions: TaskSuggestionView[]
  attendees: AttendeeRef[]
  /**
   * Every approved user, for the "Who's who" speaker picker's second group:
   * the person behind "Speaker 2" is often someone who joined without being
   * on the attendee list, so the picker cannot stop at `attendees`.
   */
  approvedUsers: AttendeeRef[]
  appId: string | null
  /** Active org members who aren't on this meeting — picker tier 2. */
  orgPeople: OrgPersonOption[]
  /** Whether the caller may create a brand-new person — picker tier 3. */
  canAddPeople: boolean
  /** AI-derived follow-ups from THIS meeting with nobody attributed yet. */
  unassignedFollowups: UnassignedFollowupView[]
}

/**
 * Active, approved org members who are NOT already on this meeting — the
 * "anyone else in the org" tier of the speaker picker.
 *
 * Filtered to active+approved because those are the people who can actually
 * hold work: a rejected or deactivated account showing up as a speaker option
 * would let an attribution create membership for someone who can't sign in.
 */
async function fetchOrgPeople(meetingId: string): Promise<OrgPersonOption[]> {
  const attendeeIds = db
    .select({ userId: meetingAttendees.userId })
    .from(meetingAttendees)
    .where(eq(meetingAttendees.meetingId, meetingId))

  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(
      and(
        eq(users.active, true),
        eq(users.status, 'approved'),
        notInArray(users.id, attendeeIds),
      ),
    )
    .orderBy(users.name)
}

/** The distinct speaker labels a meeting's voice segments carry. */
async function fetchSpeakerLabels(meetingId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ label: liveNoteSegments.speakerLabel })
    .from(liveNoteSegments)
    .where(
      and(
        eq(liveNoteSegments.meetingId, meetingId),
        eq(liveNoteSegments.source, 'voice'),
        isNotNull(liveNoteSegments.speakerLabel),
      ),
    )
  return rows.map((row) => row.label as string).sort((a, b) => a.localeCompare(b))
}

const speakerUsers = alias(users, 'note_speaker_users')
const authorUsers = alias(users, 'note_author_users')
const suggestedUsers = alias(users, 'note_suggested_users')
// A fixed subquery object can't appear twice in one statement, and `tasks`
// is one of the soft-deleted tables — liveTasksAs mints a fresh aliased
// liveTasks subquery instead of aliasing the raw table, so a suggestion
// whose created task was later trashed doesn't still show it as live here.
const suggestionTasks = liveTasksAs('note_suggestion_tasks')
const suggestionApps = alias(apps, 'note_suggestion_apps')
// The app a suggestion was ROUTED to (suggestedAppId) — distinct from
// suggestionApps above, which is the created task's actual app.
const suggestionTargetApps = alias(apps, 'note_suggestion_target_apps')

/**
 * Open task suggestions for a meeting, as the UI needs them: open cards AND
 * auto-accepted ones (status 'accepted' with acceptedBy null) — the latter
 * is what lets an auto-assigned card keep showing with its "Auto-assigned"
 * badge and Undo, instead of only ever-manual acceptances staying visible.
 * A suggestion a PERSON accepted (acceptedBy set) has done its job and drops
 * off, same as before.
 *
 * Factored out of getMeetingNoteTimeline (below) so getMeetingIntel can call
 * the exact same query — the write-up's Action items panel and the Record
 * timeline's cards must be built from one list, never two independently
 * fetched copies that could show different state for the same row.
 */
async function fetchTaskSuggestions(meetingId: string): Promise<TaskSuggestionView[]> {
  return db
    .select({
      id: meetingTaskSuggestions.id,
      segmentId: meetingTaskSuggestions.segmentId,
      text: meetingTaskSuggestions.text,
      suggestedUserId: meetingTaskSuggestions.suggestedUserId,
      suggestedUserName: suggestedUsers.name,
      suggestedDueDate: meetingTaskSuggestions.suggestedDueDate,
      suggestedAppId: meetingTaskSuggestions.suggestedAppId,
      suggestedAppName: suggestionTargetApps.name,
      status: meetingTaskSuggestions.status,
      createdTaskId: meetingTaskSuggestions.createdTaskId,
      acceptedBy: meetingTaskSuggestions.acceptedBy,
      taskStatus: suggestionTasks.status,
      taskTitle: suggestionTasks.title,
      appSlug: suggestionApps.slug,
    })
    .from(meetingTaskSuggestions)
    .leftJoin(suggestedUsers, eq(meetingTaskSuggestions.suggestedUserId, suggestedUsers.id))
    .leftJoin(suggestionTasks, eq(meetingTaskSuggestions.createdTaskId, suggestionTasks.id))
    .leftJoin(suggestionApps, eq(suggestionTasks.appId, suggestionApps.id))
    .leftJoin(
      suggestionTargetApps,
      eq(meetingTaskSuggestions.suggestedAppId, suggestionTargetApps.id),
    )
    .where(
      and(
        eq(meetingTaskSuggestions.meetingId, meetingId),
        or(
          eq(meetingTaskSuggestions.status, 'open'),
          and(eq(meetingTaskSuggestions.status, 'accepted'), isNull(meetingTaskSuggestions.acceptedBy)),
        ),
      ),
    )
}

/**
 * The unified note timeline for a meeting: typed/voice/ai segments in
 * chronological order, the speaker-label→user mappings set so far, and open
 * task suggestions. Same read gate as getMeetingIntel (admin, creator, or
 * attendee) — this can carry the same transcript-derived content.
 */
export async function getMeetingNoteTimeline(meetingId: string): Promise<ActionResult<NoteTimelineData>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const idParsed = idInput.safeParse(meetingId)
  if (!idParsed.success) return err(idParsed.error.issues[0].message)
  const id = idParsed.data

  const [meeting] = await db.select().from(liveMeetings).where(eq(liveMeetings.id, id))
  if (!meeting) return err('Meeting not found')
  if (!(await canReadMeetingIntel(session.user, meeting))) return err('Not available')

  // Five independent reads, batched: all key on the already-validated id (or
  // nothing at all), and on the Neon HTTP driver each serial await is a full
  // round trip. This action runs on every meeting panel open — it was five
  // sequential hops before the timeline could render.
  const [attendees, segmentRows, speakerMapRows, suggestionRows, approvedUsers] =
    await Promise.all([
      fetchAttendees(id),
      db
        .select({
          id: liveNoteSegments.id,
          source: liveNoteSegments.source,
          speakerId: liveNoteSegments.speakerId,
          speakerName: speakerUsers.name,
          speakerLabel: liveNoteSegments.speakerLabel,
          content: liveNoteSegments.content,
          startedAtMs: liveNoteSegments.startedAtMs,
          createdByName: authorUsers.name,
          createdAt: liveNoteSegments.createdAt,
        })
        .from(liveNoteSegments)
        .leftJoin(speakerUsers, eq(liveNoteSegments.speakerId, speakerUsers.id))
        .innerJoin(authorUsers, eq(liveNoteSegments.createdBy, authorUsers.id))
        .where(eq(liveNoteSegments.meetingId, id)),
      db
        .select({
          label: meetingSpeakers.label,
          userId: meetingSpeakers.userId,
          userName: users.name,
          displayName: meetingSpeakers.displayName,
        })
        .from(meetingSpeakers)
        .leftJoin(users, eq(meetingSpeakers.userId, users.id))
        .where(eq(meetingSpeakers.meetingId, id)),
      fetchTaskSuggestions(id),
      fetchApprovedUsers(),
    ])

  // No LIVE segments — but the legacy `meetings.notes` blob (pre-dating this
  // feature) only renders as a read-only first entry when NO segment has
  // EVER existed for this meeting (see legacy-notes.ts): trashing the last
  // segment must not resurrect it. The raw-table probe is only reached when
  // segmentRows is already empty, so this stays a single extra query on the
  // rare path rather than one on every load.
  const segments: NoteSegmentView[] =
    segmentRows.length === 0 && meeting.notes && !(await haveNoteSegmentsEverExisted(id))
      ? [
          {
            id: 'legacy',
            source: 'typed',
            speakerId: null,
            speakerName: null,
            speakerLabel: null,
            content: meeting.notes,
            startedAtMs: null,
            createdByName: null,
            createdAt: meeting.createdAt,
            isLegacy: true,
          },
        ]
      : orderNoteSegments(segmentRows)

  return ok({
    segments,
    speakers: speakerMapRows,
    suggestions: suggestionRows,
    attendees,
    approvedUsers,
    appId: meeting.appId,
    orgPeople: await fetchOrgPeople(id),
    canAddPeople: session.user.role === 'admin',
    unassignedFollowups: await db
      .select({
        id: meetingFollowups.id,
        personName: meetingFollowups.personName,
        text: meetingFollowups.text,
        kind: meetingFollowups.kind,
      })
      .from(meetingFollowups)
      .where(
        and(
          eq(meetingFollowups.sourceMeetingId, id),
          isNull(meetingFollowups.userId),
          eq(meetingFollowups.status, 'open'),
        ),
      ),
  })
}

const assignFollowupInput = z.object({ followupId: z.uuid(), userId: z.uuid() })

/**
 * Attributes an unresolved follow-up to a real person — the human confirmation
 * that replaces the name-match this used to do automatically.
 *
 * Same gate as every other follow-up write (authorizeFollowupWrite): an admin,
 * the source meeting's creator, or the person it is already attributed to.
 * Since these rows have no attribution yet, in practice that is admin or
 * organizer — the people who were in a position to know who was talking.
 *
 * Only ever fills in a MISSING attribution. Re-pointing an item that already
 * names someone is a different, louder operation than finishing an incomplete
 * one, and quietly allowing it here would let a mis-click rewrite work someone
 * has already responded to.
 */
export async function assignFollowupPerson(
  followupId: string,
  userId: string,
): Promise<ActionResult> {
  const parsed = assignFollowupInput.safeParse({ followupId, userId })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const authorized = await authorizeFollowupWrite(parsed.data.followupId, 'assign')
  if (!authorized.ok) return authorized
  const { row } = authorized.data
  if (row.userId) return err('That follow-up is already assigned')

  const [person] = await db
    .select({ id: users.id, active: users.active })
    .from(users)
    .where(eq(users.id, parsed.data.userId))
  if (!person) return err('That person no longer exists')
  if (!person.active) return err('That person is no longer active')

  await db
    .update(meetingFollowups)
    .set({ userId: person.id })
    .where(eq(meetingFollowups.id, row.id))

  revalidatePath('/meetings')
  return ok(undefined)
}

/**
 * The speaker-assignment control's data on its own, for hosts that render it
 * without a note timeline (the meeting Intelligence panel's "By person"
 * section). The timeline already carries all of this in its own payload — it
 * passes it down rather than calling this and paying for a second round trip.
 *
 * Same read gate as the timeline: this exposes the org directory and the
 * meeting's speaker labels.
 */
export async function getSpeakerAssignmentData(
  meetingId: string,
): Promise<ActionResult<SpeakerAssignmentData>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const idParsed = idInput.safeParse(meetingId)
  if (!idParsed.success) return err(idParsed.error.issues[0].message)
  const id = idParsed.data

  const [meeting] = await db.select().from(liveMeetings).where(eq(liveMeetings.id, id))
  if (!meeting) return err('Meeting not found')
  if (!(await canReadMeetingIntel(session.user, meeting))) return err('Not available')

  // Four independent reads, batched. All key on the already-validated id, and
  // on the Neon HTTP driver each serial await is a full round trip — this was
  // four sequential hops before the panel could paint.
  const [speakers, labels, attendees, orgPeople] = await Promise.all([
    db
      .select({
        label: meetingSpeakers.label,
        userId: meetingSpeakers.userId,
        userName: users.name,
        // Required by SpeakerRow: a voice belonging to nobody on the invite is
        // named through this column rather than users.name. It arrived in
        // migration 0026, and this query came from a branch that forked before
        // it — so without this the panel could never show a typed-in name.
        displayName: meetingSpeakers.displayName,
      })
      .from(meetingSpeakers)
      .leftJoin(users, eq(meetingSpeakers.userId, users.id))
      .where(eq(meetingSpeakers.meetingId, id)),
    fetchSpeakerLabels(id),
    fetchAttendees(id),
    fetchOrgPeople(id),
  ])

  return ok({
    labels,
    speakers,
    attendees,
    orgPeople,
    canAddPeople: session.user.role === 'admin',
  })
}

const addTypedNoteInput = z.object({
  meetingId: z.uuid(),
  content: z.string().trim().min(1).max(MAX_SEGMENT_LENGTH),
})

/**
 * Adds one typed note segment, authored by the caller. The FIRST time notes
 * are edited on a meeting that predates this feature, the legacy
 * `meetings.notes` text is migrated into a real segment first (attributed to
 * the meeting's creator, at the meeting's own createdAt — best-effort
 * provenance for content nobody recorded an author/time for) so it keeps its
 * place in the timeline instead of being silently superseded.
 */
export async function addTypedNoteSegment(meetingId: string, content: string): Promise<ActionResult> {
  const parsed = addTypedNoteInput.safeParse({ meetingId, content })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const ctx = await canManageMeeting(parsed.data.meetingId)
  if (!ctx) return err('Not allowed')
  const { session, meeting } = ctx

  // Same raw-table "ever existed" probe as getMeetingNoteTimeline (see
  // legacy-notes.ts) — if a segment existed and was since trashed, the
  // legacy blob must not be migrated in again as a duplicate.
  const everExisted = await haveNoteSegmentsEverExisted(meeting.id)
  if (!everExisted && meeting.notes) {
    await db.insert(meetingNoteSegments).values({
      meetingId: meeting.id,
      source: 'typed',
      content: meeting.notes,
      createdBy: meeting.createdBy,
      createdAt: meeting.createdAt,
    })
  }

  await db.insert(meetingNoteSegments).values({
    meetingId: meeting.id,
    source: 'typed',
    content: parsed.data.content,
    createdBy: session.user.id,
  })

  await logActivity({
    actorId: session.user.id,
    verb: 'updated',
    entityType: 'meeting',
    entityId: meeting.id,
    entityLabel: meeting.title,
    appId: meeting.appId,
    pagePath: '/meetings',
    detail: 'meeting notes',
  })

  // Notify anyone @mentioned in the new segment (except the author) — same
  // convention as the legacy updateMeetingNotes. Best-effort.
  try {
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users)
    const mentionedIds = extractMentionedUserIds(parsed.data.content, allUsers).filter(
      (uid) => uid !== session.user.id,
    )
    await createNotifications(
      mentionedIds.map((userId) => ({
        userId,
        actorId: session.user.id,
        type: 'mention' as const,
        title: `${session.user.name ?? 'Someone'} mentioned you`,
        body: `In “${meeting.title}”`,
        link: '/meetings',
        meetingId: meeting.id,
      })),
    )
  } catch (error) {
    console.error('[notifications] mention notify failed:', error)
  }

  revalidatePath('/meetings')
  return ok(undefined)
}

const editSegmentInput = z.object({
  segmentId: z.uuid(),
  content: z.string().trim().min(1).max(MAX_SEGMENT_LENGTH),
})

/** Edits a typed or AI segment in place. Voice (transcript) segments are read-only. */
export async function editNoteSegment(segmentId: string, content: string): Promise<ActionResult> {
  const parsed = editSegmentInput.safeParse({ segmentId, content })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const [segment] = await db
    .select()
    .from(liveNoteSegments)
    .where(eq(liveNoteSegments.id, parsed.data.segmentId))
  if (!segment) return err('Not found')
  if (segment.source === 'voice') return err('The recorded transcript can’t be edited')

  const ctx = await canManageMeeting(segment.meetingId)
  if (!ctx) return err('Not allowed')
  const { session, meeting } = ctx

  await db
    .update(meetingNoteSegments)
    .set({ content: parsed.data.content })
    .where(eq(meetingNoteSegments.id, segment.id))

  await logActivity({
    actorId: session.user.id,
    verb: 'updated',
    entityType: 'meeting',
    entityId: meeting.id,
    entityLabel: meeting.title,
    appId: meeting.appId,
    pagePath: '/meetings',
    detail: 'meeting notes',
  })

  revalidatePath('/meetings')
  return ok(undefined)
}

/** Deletes a typed or AI segment. Voice (transcript) segments are read-only. */
export async function deleteNoteSegment(segmentId: string): Promise<ActionResult> {
  const parsed = idInput.safeParse(segmentId)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const [segment] = await db.select().from(liveNoteSegments).where(eq(liveNoteSegments.id, parsed.data))
  if (!segment) return err('Not found')
  if (segment.source === 'voice') return err('The recorded transcript can’t be deleted')

  const ctx = await canManageMeeting(segment.meetingId)
  if (!ctx) return err('Not allowed')

  const marked = await db
    .update(meetingNoteSegments)
    .set({ deletedAt: new Date(), deletedBy: ctx.session.user.id })
    .where(and(eq(meetingNoteSegments.id, segment.id), isNull(meetingNoteSegments.deletedAt)))
    .returning({ id: meetingNoteSegments.id })
  if (marked.length === 0) return err('Not found')

  await logActivity({
    actorId: ctx.session.user.id,
    verb: 'deleted',
    entityType: 'meeting',
    entityId: segment.meetingId,
    entityLabel: noteSegmentDeleteLabel(ctx.meeting.title),
    pagePath: '/meetings',
    detail: 'deleted a note',
  })

  revalidatePath('/meetings')
  // The segment is now a row in the admin Trash card — see revalidateAdmin.
  revalidateAdmin()
  return ok(undefined)
}

/**
 * Throws away a meeting's whole write-up so it can be produced again.
 *
 * Clears three tables, all keyed on the meeting: the AI summary
 * (meetingAiNotes), every note segment, and the follow-up questions. None of
 * them cascade from one another — each references meetings.id directly — so all
 * three deletes have to be spelled out.
 *
 * DELIBERATELY KEPT: the recording segments (the transcript), the speaker
 * mappings, and the screen keyframes. Those are the evidence; the write-up is an
 * interpretation of it. Keeping them means re-running the analysis costs another
 * Gemini call rather than another meeting, and someone who cleared the notes by
 * mistake has not destroyed the only record of what was said.
 *
 * PERMANENT FOR THE DERIVED ROWS, and the exemption is the point: the write-up
 * and the follow-ups it produced are rebuildable from the transcript that
 * survives, not a record of something that happened. A trash bin for
 * regenerable output is a second thing to reason about for a recovery nobody
 * needs.
 *
 * TYPED NOTE SEGMENTS ARE THE EXCEPTION, and they are SOFT-deleted here. The
 * caveat this comment used to carry — "this also removes typed note segments,
 * and those are NOT regenerable" — was a caveat precisely because the
 * behaviour was wrong. meeting_note_segments is a soft-deleted table now, so a
 * person's typed words go to the admin Trash and come back, while the
 * generated rows around them still go for good.
 */
export async function clearMeetingAiNotes(meetingId: string): Promise<ActionResult> {
  const parsed = idInput.safeParse(meetingId)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const ctx = await canManageMeeting(parsed.data)
  if (!ctx) return err('Not allowed')

  await db.delete(meetingAiNotes).where(eq(meetingAiNotes.meetingId, parsed.data))
  // Marked, not removed. Already-trashed rows are skipped so this cannot
  // overwrite the deletedBy of whoever trashed a single segment earlier —
  // the trail should keep naming them, not this caller.
  await db
    .update(meetingNoteSegments)
    .set({ deletedAt: new Date(), deletedBy: ctx.session.user.id })
    .where(
      and(eq(meetingNoteSegments.meetingId, parsed.data), isNull(meetingNoteSegments.deletedAt)),
    )
  // sourceMeetingId, not a plain meetingId: a follow-up is authored by one
  // meeting and may be resolved in a later one. This clears the ones THIS
  // meeting produced, which is the right scope — but it takes their resolution
  // notes and answers with them, and those were written by people, not
  // generated. The confirmation copy has to say so.
  await db.delete(meetingFollowups).where(eq(meetingFollowups.sourceMeetingId, parsed.data))

  await logActivity({
    actorId: ctx.session.user.id,
    verb: 'updated',
    entityType: 'meeting',
    entityId: parsed.data,
    entityLabel: ctx.meeting.title,
    pagePath: '/meetings',
    detail: 'cleared the meeting notes',
  })

  revalidatePath('/meetings')
  return ok(undefined)
}

const assignSpeakerInput = z
  .object({
    meetingId: z.uuid(),
    label: z.string().trim().min(1).max(60),
    // Tier 1 (attendee) and tier 2 (anyone else in the org) both arrive as a
    // user id; null is the explicit "not a listed attendee" answer.
    userId: z.uuid().nullable().optional(),
    // Tier 3 — admins only, checked in the action, not here.
    newPerson: z
      .object({
        name: z.string().trim().min(2).max(80),
        email: z.email().max(160),
      })
      .optional(),
    // The role and allocation to open a NEW app assignment with, for the case
    // where attributing this label also puts someone on the meeting's app for
    // the first time. Absent on the first call — the action answers
    // 'needs-assignment' and the admin is asked, rather than a number being
    // invented for them (see assignSpeaker). Same bounds as the admin
    // allocation dialog (people/actions.ts assignInput) because it lands in
    // exactly the same table and the same capacity totals.
    assignment: z
      .object({
        role: z.string().trim().min(2).max(40),
        allocationPct: z.number().int().min(5).max(100),
      })
      .optional(),
  })
  .refine((data) => (data.userId === undefined) !== (data.newPerson === undefined), {
    message: 'Pick someone, or add a new person — not both',
  })

/**
 * The two statements an `assignment_history` change appends: close the
 * interval currently open for this (userId, appId), then open one describing
 * the resulting state. Both take the SAME `at`, so the intervals abut exactly.
 *
 * A local copy of features/people/actions.ts' `historyStatements` because a
 * `'use server'` module can only export async functions — the shared helper
 * cannot be imported across the boundary. The RULE lives in one place either
 * way: both call `buildHistoryEntry`, which is what decides the row's shape.
 */
function assignmentHistoryStatements(input: {
  userId: string
  appId: string
  role: string
  allocationPct: number
  changeKind: 'assigned' | 'updated' | 'removed'
  changedBy: string
  at: Date
  note?: string | null
}) {
  return [
    db
      .update(assignmentHistory)
      .set({ effectiveTo: input.at })
      .where(
        and(
          eq(assignmentHistory.userId, input.userId),
          eq(assignmentHistory.appId, input.appId),
          isNull(assignmentHistory.effectiveTo),
        ),
      ),
    db.insert(assignmentHistory).values(buildHistoryEntry(input)),
  ] as const
}

/**
 * The membership equivalent of the pair above, for `meeting_attendee_history`.
 * Same rule, same single `at`, same reason it must be one batch. A local copy
 * of rsvp-actions.ts' helper for the same `'use server'` export restriction —
 * the shape itself is decided in one place, by buildAttendanceEntry.
 */
function attendanceHistoryStatements(input: {
  meetingId: string
  userId: string
  response: 'pending' | 'going' | 'maybe' | 'declined'
  changeKind: 'added' | 'updated' | 'removed'
  changedBy: string
  at: Date
  note?: string | null
}) {
  return [
    db
      .update(meetingAttendeeHistory)
      .set({ effectiveTo: input.at })
      .where(
        and(
          eq(meetingAttendeeHistory.meetingId, input.meetingId),
          eq(meetingAttendeeHistory.userId, input.userId),
          isNull(meetingAttendeeHistory.effectiveTo),
        ),
      ),
    db.insert(meetingAttendeeHistory).values(buildAttendanceEntry(input)),
  ] as const
}

/**
 * What assignSpeaker answers.
 *
 * 'needs-assignment' is NOT an error and NOT a partial write — nothing at all
 * was written. Attributing this label would also open the person's first
 * assignment on the meeting's app, and there is no honest default for what
 * that assignment claims: an invented percentage is indistinguishable from a
 * decided one once it is in `assignments`, and every capacity total that
 * includes it silently inherits the guess. So the action stops and asks, and
 * the caller retries with `assignment` filled in.
 */
export type AssignSpeakerResult =
  | {
      status: 'assigned'
      userId: string | null
      /** Set when this write put the person over 100% across all their apps. */
      warning?: string
      /**
       * An app assignment was missing but the caller isn't an admin, so the
       * label mapping and meeting attendance were written and the assignment
       * was left alone. Allocations are admin-only everywhere else
       * (people/actions.ts assignUser), and this is not the place to make an
       * exception — least of all by inventing the number.
       */
      assignmentDeferred?: { appName: string }
    }
  | {
      status: 'needs-assignment'
      personName: string
      appName: string
      /** Their current total across all apps, so the admin is deciding with
       *  the capacity picture in front of them rather than blind. */
      currentPct: number
    }

/**
 * Maps a speaker label to a person — and follows that claim everywhere it
 * leads, in ONE server action.
 *
 * Saying "this voice is Kasun" on a meeting Kasun isn't listed for is a
 * statement that he WAS in the room; if the meeting belongs to an app he
 * carries no assignment for, it's a statement that he was doing that app's
 * work. Both are real membership facts, so both get written. The alternative
 * — mapping the label and leaving the rest to be noticed later — is how a
 * speaker ends up attributed on a meeting they're not on, which is a fresh
 * version of the bug this whole change exists to fix.
 *
 * Everything goes in one db.batch. neon-http has no interactive transactions,
 * but a batch IS one transaction, so no half-applied state is reachable:
 * there is no moment where the label is mapped to a non-attendee, or an
 * attendee exists with no membership history.
 *
 * Also backfills speakerId on every segment already carrying that label, so
 * assigning "Speaker 1" once relabels everything they said, past and future.
 */
export async function assignSpeaker(input: {
  meetingId: string
  label: string
  userId?: string | null
  newPerson?: { name: string; email: string }
  assignment?: { role: string; allocationPct: number }
}): Promise<ActionResult<AssignSpeakerResult>> {
  const parsed = assignSpeakerInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const ctx = await canManageMeeting(parsed.data.meetingId)
  if (!ctx) return err('Not allowed')
  const { session, meeting } = ctx
  const isAdmin = session.user.role === 'admin'

  // Statements are collected in FK-safe order: a new user row must precede
  // anything that references it.
  const statements: BatchItem<'pg'>[] = []
  let targetUserId: string | null = null
  // Only needed to name the person in the "what should this assignment say?"
  // prompt, so it is whatever the caller already made us look up.
  let targetUserName = ''

  if (parsed.data.newPerson) {
    if (!isAdmin) return err('Only an admin can add someone new')

    const email = parsed.data.newPerson.email.trim().toLowerCase()
    // Sign-in is domain-gated (every provider funnels through emailAllowed),
    // so an account outside the allowlist would be a locked door — the same
    // refusal admin createUser makes.
    if (!emailAllowed(email)) {
      const domain = email.slice(email.lastIndexOf('@') + 1)
      return err(
        `${domain} isn’t an allowed sign-in domain — this person could never log in. Allowed: ${allowedDomains().join(', ') || '(none configured)'}`,
      )
    }

    const [clash] = await db.select({ id: users.id }).from(users).where(eq(users.email, email))
    // Deliberately not "adopt the existing account": two people can share a
    // name, and silently attributing a transcript to whoever already holds
    // this email is exactly the kind of confident guess being removed here.
    if (clash) return err('Someone already uses that email — pick them from the list instead')

    const derivedOrg = orgForEmail(email)
    targetUserId = crypto.randomUUID()
    statements.push(
      db.insert(users).values({
        id: targetUserId,
        email,
        name: parsed.data.newPerson.name,
        role: 'member',
        active: true,
        orgTags: derivedOrg ? [derivedOrg] : [],
        // An admin adding them IS the vetting step; 'pending' exists for open
        // Google self-signup only (src/lib/auth.ts). No starter password is
        // minted — they sign in with Google when they first need to, and this
        // row exists now so attribution has something true to point at.
        status: 'approved',
      }),
    )
    targetUserName = parsed.data.newPerson.name
  } else if (parsed.data.userId) {
    const [person] = await db
      .select({ id: users.id, name: users.name, active: users.active })
      .from(users)
      .where(eq(users.id, parsed.data.userId))
    if (!person) return err('That person no longer exists')

    if (!person.active) {
      // A deactivated account is still a legitimate answer for a PAST
      // meeting they attended — just not a way to create new membership.
      const [attendee] = await db
        .select({ userId: meetingAttendees.userId })
        .from(meetingAttendees)
        .where(
          and(
            eq(meetingAttendees.meetingId, meeting.id),
            eq(meetingAttendees.userId, person.id),
          ),
        )
      if (!attendee) return err('That person is no longer active')
    }
    targetUserId = person.id
    targetUserName = person.name
  }

  // What the assignment already looks like, so the plan only adds what's
  // genuinely missing.
  const [attendeeRows, assignmentRows] = await Promise.all([
    db
      .select({ userId: meetingAttendees.userId })
      .from(meetingAttendees)
      .where(eq(meetingAttendees.meetingId, meeting.id)),
    targetUserId
      ? db
          // allocationPct comes along so the over-allocation total can be
          // computed without a second round trip — both to show the admin
          // what they're adding to, and to warn afterwards.
          .select({ appId: assignments.appId, allocationPct: assignments.allocationPct })
          .from(assignments)
          .where(eq(assignments.userId, targetUserId))
      : Promise.resolve([] as { appId: string; allocationPct: number }[]),
  ])

  const plan = planSpeakerAssignment({
    userId: targetUserId,
    attendeeIds: attendeeRows.map((row) => row.userId),
    appId: meeting.appId,
    assignedAppIds: assignmentRows.map((row) => row.appId),
  })

  // The new assignment needs a role and an allocation, and nobody has said
  // what they are. STOP — before any statement runs — and ask. Returning here
  // writes nothing at all, so a cancelled prompt leaves the meeting exactly as
  // it was rather than half-attributed.
  //
  // Non-admins are the one case that proceeds without one: creating an
  // assignment is admin-only everywhere else (people/actions.ts assignUser),
  // so there is nothing to prompt them for. They still get the two claims they
  // ARE allowed to make — the label mapping and the attendance row — and the
  // caller is told the assignment is outstanding.
  const needsAssignment = plan.addAssignment && meeting.appId !== null && !parsed.data.assignment
  const [appRow] = needsAssignment
    ? await db.select({ name: apps.name }).from(apps).where(eq(apps.id, meeting.appId!))
    : [undefined]

  if (needsAssignment && isAdmin) {
    return ok({
      status: 'needs-assignment',
      personName: targetUserName,
      appName: appRow?.name ?? 'this app',
      currentPct: assignmentRows.reduce((total, row) => total + row.allocationPct, 0),
    })
  }

  const writeAssignment = plan.addAssignment && Boolean(parsed.data.assignment)

  // ONE instant for every interval boundary this batch writes, so the closing
  // and opening rows abut exactly instead of leaving a gap or an overlap.
  const at = new Date()

  statements.push(
    db
      .insert(meetingSpeakers)
      .values({ meetingId: meeting.id, label: parsed.data.label, userId: plan.userId })
      .onConflictDoUpdate({
        target: [meetingSpeakers.meetingId, meetingSpeakers.label],
        set: { userId: plan.userId },
      }),
    db
      .update(meetingNoteSegments)
      .set({ speakerId: plan.userId })
      .where(
        and(
          eq(meetingNoteSegments.meetingId, meeting.id),
          eq(meetingNoteSegments.speakerLabel, parsed.data.label),
        ),
      ),
  )

  if (plan.userId && plan.addAttendee) {
    statements.push(
      db
        .insert(meetingAttendees)
        .values({ meetingId: meeting.id, userId: plan.userId, response: 'pending' }),
      // CLOSE FIRST. Someone absent from meeting_attendees may still have an
      // OPEN history row — the tombstone left by an earlier removal. Inserting
      // without closing it would leave two open intervals for the same
      // (meetingId, userId), which the one-open partial unique index rejects
      // and which would make "as of" ambiguous. Re-adding after a removal has
      // to close the tombstone, exactly as re-assigning closes an allocation's.
      ...attendanceHistoryStatements({
        meetingId: meeting.id,
        userId: plan.userId,
        // They were in the room but never RSVP'd — 'pending' is the honest
        // value, not a retroactive "going" nobody clicked.
        response: 'pending',
        changeKind: 'added',
        changedBy: session.user.id,
        at,
        note: 'Added automatically when a meeting speaker was attributed to this person.',
      }),
    )
  }

  if (plan.userId && writeAssignment && meeting.appId && parsed.data.assignment) {
    const { role, allocationPct } = parsed.data.assignment
    statements.push(
      db.insert(assignments).values({
        userId: plan.userId,
        appId: meeting.appId,
        role,
        allocationPct,
      }),
      ...assignmentHistoryStatements({
        userId: plan.userId,
        appId: meeting.appId,
        role,
        allocationPct,
        changeKind: 'assigned',
        changedBy: session.user.id,
        at,
        // No "placeholder" caveat any more: an admin typed this role and this
        // percentage when they attributed the speaker, so the history entry
        // records a decision rather than a guess to be corrected later.
        note: `Set when this person was attributed as a speaker in “${meeting.title}”.`,
      }),
    )
  }

  try {
    // The batch is one transaction: the mapping, the attendee row, the
    // assignment and every history row commit together or not at all.
    await db.batch(statements as [BatchItem<'pg'>, ...BatchItem<'pg'>[]])
  } catch (error) {
    console.error('[meeting-speakers] assignSpeaker batch failed:', error)
    return err('Could not save that — try again')
  }

  revalidatePath('/meetings')
  if (writeAssignment) {
    revalidatePath('/people')
    revalidatePath('/')
  }

  // Same over-allocation check the admin allocation dialog makes — an
  // assignment opened from here counts towards capacity identically, so it
  // should be just as loud about pushing someone past 100%.
  const totalPct = writeAssignment
    ? assignmentRows.reduce((total, row) => total + row.allocationPct, 0) +
      (parsed.data.assignment?.allocationPct ?? 0)
    : 0

  return ok({
    status: 'assigned',
    userId: plan.userId,
    ...(totalPct > 100 ? { warning: `Now at ${totalPct}% allocation` } : {}),
    ...(needsAssignment && !isAdmin
      ? { assignmentDeferred: { appName: appRow?.name ?? 'this app' } }
      : {}),
  })
}

const setSpeakerMappingInput = z.object({
  meetingId: z.uuid(),
  label: z.string().trim().min(1).max(60),
  userId: z.uuid().nullable(),
  displayName: z.string().trim().min(1).max(80).nullable().optional(),
})

/**
 * Maps a speaker label to a real user, or to a typed-in name for someone with
 * no account, or explicitly to nobody — and backfills speakerId on every note
 * segment already carrying that label, so assigning "Speaker 1" once relabels
 * everything they said, past and future, not just from here on.
 *
 * `displayName` is stored ONLY when userId is null. A mapped user's name
 * belongs to the users table; keeping a second copy here would survive a
 * rename and quietly contradict it. Passing a user therefore CLEARS any name
 * typed earlier rather than leaving a losing value behind the winner — see
 * resolveSpeakerName for the precedence this mirrors. Omitting displayName on
 * an existing row clears it too: the argument is the whole intended state of
 * the mapping, not a patch.
 */
export async function setSpeakerMapping(
  meetingId: string,
  label: string,
  userId: string | null,
  displayName?: string | null,
): Promise<ActionResult> {
  const parsed = setSpeakerMappingInput.safeParse({ meetingId, label, userId, displayName })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const ctx = await canManageMeeting(parsed.data.meetingId)
  if (!ctx) return err('Not allowed')

  const storedName = parsed.data.userId ? null : (parsed.data.displayName ?? null)

  await db
    .insert(meetingSpeakers)
    .values({
      meetingId: parsed.data.meetingId,
      label: parsed.data.label,
      userId: parsed.data.userId,
      displayName: storedName,
    })
    .onConflictDoUpdate({
      target: [meetingSpeakers.meetingId, meetingSpeakers.label],
      set: { userId: parsed.data.userId, displayName: storedName },
    })

  await db
    .update(meetingNoteSegments)
    .set({ speakerId: parsed.data.userId })
    .where(
      and(
        eq(meetingNoteSegments.meetingId, parsed.data.meetingId),
        eq(meetingNoteSegments.speakerLabel, parsed.data.label),
      ),
    )

  revalidatePath('/meetings')
  return ok(undefined)
}

const trackActionItemInput = z.object({
  meetingId: z.uuid(),
  text: z.string().trim().min(1).max(500),
  owner: z.string().trim().max(200).nullable().optional(),
  due: z.string().trim().max(200).nullable().optional(),
})

/**
 * Promotes a JSONB-only action item (one reconcileActionItems found in
 * getMeetingIntel's `untrackedActions` — a row from deadlines[]/
 * perPerson[].actionItems[] with no matching meeting_task_suggestions row of
 * any status) into a real, identity-bearing suggestion row, on demand from
 * the write-up's "Not tracked" group.
 *
 * This is the backfill half of making meeting_task_suggestions the single
 * source of truth for action items: rather than the panel silently dropping
 * whatever the suggestion pipeline never saw (an item that only ever existed
 * in the free-text deadlines[] field, or one from an analysis pass that
 * predates task suggestions entirely), a person can turn it into the same
 * editable row with one click. Lands as a plain 'open' suggestion — same
 * shape insertAutoNotesAndSuggestions creates for a manual card, minus a
 * segmentId (this was never tied to one transcript line) — so it is
 * immediately editable (assignee, due date, title) and acceptable/dismissible
 * exactly like every other suggestion.
 *
 * `owner`/`due` are the free text the model wrote (a first name, a spoken
 * date phrase). The date is resolved by parseSpokenDueDate, which leaves a
 * phrase like "next Friday" unset rather than inventing a day. The owner is
 * NOT resolved: a first name matched against the attendee list is a guess,
 * and this column is reserved for attributions a human confirmed. It lands
 * unassigned, with the name still readable in the item's own text.
 */
export async function trackActionItem(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = trackActionItemInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  // `owner` stays in the input schema — callers send it and the write-up's
  // own text carries the name — but it is no longer read here; see below.
  const { meetingId, text, due } = parsed.data

  const ctx = await canManageMeeting(meetingId)
  if (!ctx) return err('Only admins or the meeting creator can track action items')

  // Deliberately UNASSIGNED. This used to run the write-up's free-text owner
  // through matchPersonToAttendee and store the result as suggestedUserId —
  // a first-name guess recorded as fact. Migration 0029's second repair pass
  // exists to null exactly these rows (open suggestions with no meeting_speakers
  // row vouching for the attribution), so leaving the guess in would have this
  // action re-creating the data the same merge shipped a migration to delete.
  // The owner's name is already in `text`; a human picks the assignee, and the
  // confirmed-speaker path (resolveSpeakerUserId) is the only thing allowed to
  // fill this column without one.
  const resolvedDue = due ? parseSpokenDueDate(due) : null
  const suggestedDueDate = resolvedDue ? format(resolvedDue, 'yyyy-MM-dd') : null

  const [row] = await db
    .insert(meetingTaskSuggestions)
    .values({ meetingId, text, suggestedUserId: null, suggestedDueDate, status: 'open' })
    .returning({ id: meetingTaskSuggestions.id })

  revalidatePath('/meetings')
  return ok({ id: row.id })
}

const updateSuggestionInput = z
  .object({
    text: z.string().trim().min(1).max(140),
    suggestedUserId: z.uuid().nullable(),
    suggestedDueDate: z.iso.date().nullable(),
  })
  .partial()

/**
 * Edits an OPEN suggestion in place — reassign, reschedule, or retitle it
 * before it becomes a task. This is the "state (a)" half of editing an
 * action item on the note timeline; the "state (b)" half (a suggestion that
 * already became a task) goes through updateTask in task-actions.ts instead
 * — see resolveActionItemEditTarget in note-timeline-model.ts for the
 * routing decision. Refuses once status has moved past 'open', the same
 * "already handled" guard acceptTaskSuggestion and dismissTaskSuggestion
 * already enforce — a suggestion that became a task is no longer this row's
 * source of truth for any of these fields.
 *
 * Partial: only the keys the caller actually sent are written. This
 * codebase has been bitten twice by a `.set()` built from a
 * fully-populated object silently overwriting fields nobody meant to
 * touch — z.object(...).partial() plus building `set` from
 * Object.keys(parsed.data) (not from the input's own keys, and not a fixed
 * field list) is what keeps an omitted field from ever reaching the UPDATE,
 * same shape as taskUpdateInput in task-actions.ts.
 */
export async function updateTaskSuggestion(suggestionId: string, input: unknown): Promise<ActionResult> {
  const idParsed = idInput.safeParse(suggestionId)
  if (!idParsed.success) return err(idParsed.error.issues[0].message)

  const [suggestion] = await db
    .select()
    .from(meetingTaskSuggestions)
    .where(eq(meetingTaskSuggestions.id, idParsed.data))
  if (!suggestion) return err('Not found')
  if (suggestion.status !== 'open') return err('This suggestion was already handled')

  const ctx = await canManageMeeting(suggestion.meetingId)
  if (!ctx) return err('Not allowed')

  const parsed = updateSuggestionInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const set: Record<string, unknown> = {}
  for (const key of Object.keys(parsed.data) as (keyof typeof parsed.data)[]) {
    set[key] = parsed.data[key]
  }
  if (Object.keys(set).length === 0) return err('Nothing to update')

  await db.update(meetingTaskSuggestions).set(set).where(eq(meetingTaskSuggestions.id, suggestion.id))

  await logActivity({
    actorId: ctx.session.user.id,
    verb: 'updated',
    entityType: 'suggestion',
    entityId: suggestion.id,
    // Meeting title, not suggestion.text — see acceptTaskSuggestion.
    entityLabel: ctx.meeting.title,
    appId: ctx.meeting.appId,
    pagePath: '/meetings',
    detail: 'a task suggestion',
  })

  revalidatePath('/meetings')
  return ok(undefined)
}

const acceptSuggestionInput = z.object({
  suggestionId: z.uuid(),
  title: z.string().trim().min(1).max(140).optional(),
  assigneeId: z.uuid().nullable().optional(),
  dueDate: z.iso.date().nullable().optional(),
  priority: z.number().int().min(0).max(3).optional(),
})

/**
 * Accepts a task suggestion — one click, or with edits from the small form
 * first. Goes through the real createTask action so its own authz and
 * FK-violation handling apply; this only resolves the payload and records
 * which task the suggestion turned into.
 */
export async function acceptTaskSuggestion(
  suggestionId: string,
  overrides?: { title?: string; assigneeId?: string | null; dueDate?: string | null; priority?: number },
): Promise<ActionResult<{ taskId: string }>> {
  const parsed = acceptSuggestionInput.safeParse({ suggestionId, ...overrides })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const [suggestion] = await db
    .select()
    .from(meetingTaskSuggestions)
    .where(eq(meetingTaskSuggestions.id, parsed.data.suggestionId))
  if (!suggestion) return err('Not found')
  if (suggestion.status !== 'open') return err('This suggestion was already handled')

  const ctx = await canManageMeeting(suggestion.meetingId)
  if (!ctx) return err('Not allowed')
  const { session, meeting } = ctx
  // The app the AI confidently routed this item to wins (suggestedAppId, see
  // schema.ts); a suggestion with no routed app files into the meeting's own
  // app — exactly the pre-routing behaviour, including this error when the
  // meeting has none either.
  const targetAppId = suggestion.suggestedAppId ?? meeting.appId
  if (!targetAppId) return err('Link this meeting to an app before creating tasks from it')

  const payload = suggestionToTaskPayload(
    {
      text: suggestion.text,
      suggestedUserId: suggestion.suggestedUserId,
      suggestedDueDate: suggestion.suggestedDueDate,
    },
    { appId: targetAppId, sprintId: null },
    {
      title: parsed.data.title,
      assigneeId: parsed.data.assigneeId,
      dueDate: parsed.data.dueDate,
      priority: parsed.data.priority,
    },
  )

  const result = await createTask(payload)
  if (!result.ok) return err(result.error)

  await db
    .update(meetingTaskSuggestions)
    // acceptedBy: a real user id — this is a PERSON accepting, never the
    // auto-assign pass (that writes acceptedBy: null itself, in
    // insertAutoNotesAndSuggestions). Distinguishes a manual accept from an
    // auto one on an otherwise-identical 'accepted' row.
    .set({ status: 'accepted', createdTaskId: result.data.taskId, acceptedBy: session.user.id })
    .where(eq(meetingTaskSuggestions.id, suggestion.id))

  // Close the loop: an open follow-up owed by this task's assignee that
  // reads like the same piece of work gets linked to it (see
  // linkFollowupToTask / findMatchingFollowup) — best-effort, wrapped
  // separately from task creation above so a lookup/write failure here can
  // never undo a task that was already accepted.
  try {
    await linkFollowupToTask(payload.assigneeId, suggestion.text, result.data.taskId)
  } catch (error) {
    console.error(`[meeting-followups] link on suggestion accept failed for suggestion ${suggestion.id}:`, error)
  }

  // createTask above already wrote the "created task" trail row — this one
  // records the DISTINCT event (the suggestion being accepted), not a second
  // copy of the same creation.
  await logActivity({
    actorId: session.user.id,
    verb: 'accepted',
    entityType: 'suggestion',
    entityId: suggestion.id,
    // NOT suggestion.text — the model derived it from the transcript, so it
    // carries the same intel gating the trail does not have. The created
    // task's title is safe by contrast: tasks are team-wide on the boards.
    entityLabel: meeting.title,
    appId: meeting.appId,
    pagePath: '/meetings',
    detail: `a task suggestion as “${payload.title}”`,
    metadata: { taskId: result.data.taskId, meetingId: meeting.id },
  })

  revalidatePath('/meetings')
  return ok({ taskId: result.data.taskId })
}

/** Rejects a suggestion. Persisted so it never re-shows on this meeting. */
export async function dismissTaskSuggestion(suggestionId: string): Promise<ActionResult> {
  const parsed = idInput.safeParse(suggestionId)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const [suggestion] = await db
    .select()
    .from(meetingTaskSuggestions)
    .where(eq(meetingTaskSuggestions.id, parsed.data))
  if (!suggestion) return err('Not found')

  const ctx = await canManageMeeting(suggestion.meetingId)
  if (!ctx) return err('Not allowed')

  if (suggestion.status === 'open') {
    await db
      .update(meetingTaskSuggestions)
      .set({ status: 'dismissed' })
      .where(eq(meetingTaskSuggestions.id, suggestion.id))

    await logActivity({
      actorId: ctx.session.user.id,
      verb: 'rejected',
      entityType: 'suggestion',
      entityId: suggestion.id,
      // Meeting title, not suggestion.text — see acceptTaskSuggestion.
      entityLabel: ctx.meeting.title,
      appId: ctx.meeting.appId,
      pagePath: '/meetings',
      detail: 'a task suggestion',
    })

    revalidatePath('/meetings')
  }

  return ok(undefined)
}

/**
 * Undo for an auto-accepted suggestion — layer (b) of full-auto's manual
 * override. Deletes the task the auto-assign pass created and reverts the
 * suggestion to 'open' (a plain manual card again), so a wrong auto-assign
 * costs one click to take back.
 *
 * Deliberately NOT the same authz as deleteTask (admins only) — the
 * recorder who ran the analysis may not be an admin, and they are exactly
 * who should be able to take back what full-auto just did on their own
 * meeting. Scoped instead to canManageMeeting (creator or admin), same tier
 * as accepting the suggestion in the first place would have needed.
 *
 * CONSTRAINT, enforced here rather than only documented: only while the
 * task is still 'todo' and unmodified from what the auto pass created (see
 * notes.ts canUndoAutoAssign) — reconstructed from the suggestion row
 * itself via suggestionToTaskPayload, since the auto path never applies
 * overrides. Once a person has retitled it, reassigned it, rescheduled it,
 * or moved it off 'todo', Undo refuses rather than deleting their change out
 * from under them — the suggestion stays 'accepted' and the card shows the
 * task as-is instead.
 */
export async function undoAutoAcceptedSuggestion(suggestionId: string): Promise<ActionResult> {
  const parsed = idInput.safeParse(suggestionId)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const [suggestion] = await db
    .select()
    .from(meetingTaskSuggestions)
    .where(eq(meetingTaskSuggestions.id, parsed.data))
  if (!suggestion) return err('Not found')
  if (suggestion.status !== 'accepted' || suggestion.acceptedBy !== null) {
    return err('Only an auto-assigned suggestion can be undone this way')
  }
  if (!suggestion.createdTaskId) return err('No task to undo')

  const ctx = await canManageMeeting(suggestion.meetingId)
  if (!ctx) return err('Not allowed')
  const { meeting } = ctx

  const [task] = await db.select().from(liveTasks).where(eq(liveTasks.id, suggestion.createdTaskId))
  if (!task) return err('That task no longer exists')

  // Reconstruct against the task's OWN appId — the app the auto pass really
  // filed into. Re-deriving it as `suggestion.suggestedAppId ?? meeting.appId`
  // would wrongly refuse the undo for an unrouted suggestion whose meeting was
  // unlinked from its app after the auto pass ran (both null). The appId is
  // not part of canUndoAutoAssign's comparison anyway; it only satisfies the
  // payload shape.
  const original = suggestionToTaskPayload(
    {
      text: suggestion.text,
      suggestedUserId: suggestion.suggestedUserId,
      suggestedDueDate: suggestion.suggestedDueDate,
    },
    { appId: task.appId, sprintId: null },
  )
  const eligible = canUndoAutoAssign(
    { status: task.status, title: task.title, assigneeId: task.assigneeId, dueDate: task.dueDate },
    {
      status: 'todo',
      title: original.title,
      assigneeId: original.assigneeId,
      dueDate: original.dueDate,
    },
  )
  if (!eligible) {
    return err('This task has already been changed since it was auto-assigned — edit it directly instead')
  }

  // Soft delete: `tasks` is one of the soft-deleted tables (see
  // src/db/live.ts) — the auto-created task is marked, not removed, so an
  // undone auto-assign still leaves an admin-visible trace in Trash rather
  // than vanishing outright.
  const marked = await db
    .update(tasks)
    .set({ deletedAt: new Date(), deletedBy: ctx.session.user.id })
    .where(and(eq(tasks.id, task.id), isNull(tasks.deletedAt)))
    .returning({ id: tasks.id })
  if (marked.length === 0) return err('That task no longer exists')

  await db
    .update(meetingTaskSuggestions)
    .set({ status: 'open', createdTaskId: null, acceptedBy: null })
    .where(eq(meetingTaskSuggestions.id, suggestion.id))

  await logActivity({
    actorId: ctx.session.user.id,
    verb: 'reopened',
    entityType: 'suggestion',
    entityId: suggestion.id,
    // Meeting title, not suggestion.text — see acceptTaskSuggestion.
    entityLabel: meeting.title,
    appId: meeting.appId,
    pagePath: '/meetings',
    detail: `a task suggestion, undoing auto-created “${task.title}”`,
    metadata: { taskId: task.id },
  })

  // Same board-revalidation as deleteTask (task-actions.ts) — the task just
  // vanished from wherever it was filed, not only from this meeting's panel.
  // task.appId, not meeting.appId: a routed task lived on a different board
  // than the meeting's own app.
  const [app] = await db.select({ slug: apps.slug }).from(apps).where(eq(apps.id, task.appId))
  if (app) revalidatePath('/apps/' + app.slug)
  revalidatePath('/meetings')
  return ok(undefined)
}
