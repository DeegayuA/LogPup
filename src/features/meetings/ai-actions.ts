'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq, gt, inArray, isNotNull, isNull, lt, ne, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { del, put, get as getBlob } from '@vercel/blob'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import {
  meetingAiNotes,
  meetingAttendees,
  meetingFollowups,
  meetingNoteSegments,
  meetingRecordingSegments,
  meetingScreenshots,
  meetingSpeakers,
  meetingTaskSuggestions,
  meetings,
  users,
} from '@/db/schema'
import {
  DEFAULT_GEMINI_MODEL,
  callGemini,
  callGeminiWithAudio,
  callGeminiWithImages,
  GeminiError,
  type GeminiImageInput,
} from '@/features/gemini/client'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { updateMeetingNotes } from '@/features/meetings/actions'
import { createNotifications, extractMentionedUserIds } from '@/features/notifications/notify'
import { createTask } from '@/features/sprints/task-actions'
import {
  matchPersonToAttendee,
  selectCarriedForward,
  filterValidIds,
  type AttendeeRef,
  type CarriedForwardEntry,
  type CarriedForwardGroup,
  type FollowupKind,
  type OpenFollowupItem,
} from '@/features/meetings/followups'
import {
  resolveSpeakerUserId,
  normalizeDueDate,
  suggestionToTaskPayload,
  orderNoteSegments,
  type NoteSource,
  type SpeakerMapping,
} from '@/features/meetings/notes'
import { concatenateSegments } from '@/features/meetings/recording-segments'
import { formatCapturedAt, MAX_KEYFRAMES_PER_MEETING } from '@/features/meetings/screen-keyframes'

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
}

export type CarriedForwardItemGroup = {
  userId: string
  person: string
  items: CarriedForwardItem[]
}

/** Someone a hand-added follow-up can be attributed to. */
export type FollowupPersonOption = { id: string; name: string }

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
  /** Later meetings the caller can see, for the optional "link to" picker. */
  upcomingMeetings: FollowupTargetOption[]
  /** Change-detected screen keyframes captured during recording, oldest first. */
  screenshots: MeetingScreenshotView[]
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

type SpeakerSegmentOut = { speaker: string | null; text: string }
type ActionItemOut = {
  text: string
  suggestedAssigneeLabel: string | null
  suggestedDueDate: string | null
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
    }))
    .filter((row): row is ActionItemOut => row.text.length > 0)
}

/**
 * "Intelligence auto add notes": inserts the AI's write-up straight into the
 * unified note timeline (one 'ai' segment) and the diarized transcript as
 * 'voice' segments — one per speaker turn — instead of leaving them in a
 * separate panel the user has to go find. Also files the model's actionable
 * proposals as open task suggestion cards. Best-effort: called from inside a
 * try/catch at the call site so a failure here never undoes the analysis
 * that already succeeded.
 */
async function insertAutoNotesAndSuggestions(
  meetingId: string,
  createdBy: string,
  summary: string | null,
  speakerSegments: SpeakerSegmentOut[],
  actionItems: ActionItemOut[],
  attendees: AttendeeRef[],
): Promise<void> {
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
      speakerId: resolveSpeakerUserId(segment.speaker, mappingRows, attendees),
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

  if (actionItems.length > 0) {
    await db.insert(meetingTaskSuggestions).values(
      actionItems.map((item) => ({
        meetingId,
        text: item.text,
        suggestedUserId: resolveSpeakerUserId(item.suggestedAssigneeLabel, mappingRows, attendees),
        suggestedDueDate: item.suggestedDueDate,
        status: 'open' as const,
      })),
    )
  }
}

/**
 * Meeting intel (transcript, per-person notes, follow-up questions) is
 * readable only by an admin, the meeting's creator, or someone who was
 * actually an attendee. Anything that returns intel — for THIS meeting or for
 * the earlier meeting the prep questions are pulled from — has to pass this.
 */
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

export async function canManageMeeting(meetingId: string) {
  const session = await auth()
  if (!session?.user) return null
  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId))
  if (!meeting) return null
  const allowed = session.user.role === 'admin' || meeting.createdBy === session.user.id
  return allowed ? { session, meeting } : null
}

async function fetchAttendees(meetingId: string): Promise<AttendeeRef[]> {
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(meetingAttendees)
    .innerJoin(users, eq(meetingAttendees.userId, users.id))
    .where(eq(meetingAttendees.meetingId, meetingId))
  return rows
}

type FollowupCarryRow = OpenFollowupItem & {
  status: FollowupStatus
  resolutionNote: string | null
  responseNote: string | null
  deferReason: string | null
  resolvedAt: Date | null
  createdBy: string | null
  targetMeetingId: string | null
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
      sourceMeetingId: meetingFollowups.sourceMeetingId,
      sourceMeetingTitle: meetings.title,
      sourceMeetingStartsAt: meetings.startsAt,
    })
    .from(meetingFollowups)
    .innerJoin(meetings, eq(meetingFollowups.sourceMeetingId, meetings.id))
    .leftJoin(
      meetingAttendees,
      and(eq(meetingAttendees.meetingId, meetings.id), eq(meetingAttendees.userId, caller.id)),
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
            lt(meetings.startsAt, meeting.startsAt),
          ),
        ),
        caller.isAdmin
          ? undefined
          : or(eq(meetings.createdBy, caller.id), isNotNull(meetingAttendees.userId)),
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
      id: meetings.id,
      title: meetings.title,
      startsAt: meetings.startsAt,
      attendeeId: meetingAttendees.userId,
    })
    .from(meetings)
    .innerJoin(meetingAttendees, eq(meetingAttendees.meetingId, meetings.id))
    .where(
      and(
        gt(meetings.startsAt, meeting.startsAt),
        ne(meetings.id, meeting.id),
        caller.isAdmin
          ? undefined
          : or(eq(meetings.createdBy, caller.id), inArray(meetings.id, callerMeetingIds)),
      ),
    )
    .orderBy(meetings.startsAt)

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

/** Derives person-linked follow-ups from the model's per-person notes and inserts them. */
async function deriveAndInsertFollowups(
  sourceMeetingId: string,
  attendees: AttendeeRef[],
  perPerson: PerPersonNote[],
  questions: QuestionNote[],
): Promise<void> {
  const rows: {
    sourceMeetingId: string
    userId: string | null
    personName: string
    text: string
    kind: FollowupKind
  }[] = []

  for (const person of perPerson) {
    if (!person.name) continue
    const userId = matchPersonToAttendee(person.name, attendees)
    for (const action of person.actionItems ?? []) {
      if (!action) continue
      rows.push({ sourceMeetingId, userId, personName: person.name, text: action, kind: 'action' })
    }
  }

  for (const entry of questions) {
    if (!entry.person) continue
    const userId = matchPersonToAttendee(entry.person, attendees)
    for (const question of entry.questions ?? []) {
      if (!question) continue
      rows.push({
        sourceMeetingId,
        userId,
        personName: entry.person,
        text: question,
        kind: 'question',
      })
    }
  }

  if (rows.length > 0) await db.insert(meetingFollowups).values(rows)
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

  const prompt = `You are LogPup's meeting analyst for a software team.
Audio of the meeting "${meeting.title}"${meeting.agenda ? ` (agenda: ${meeting.agenda})` : ''} is attached.
Known attendees: ${attendeeNames.length > 0 ? attendeeNames.join(', ') : 'unknown'}.
This is a Sri Lankan team meeting. Speakers routinely CODE-SWITCH between Sinhala and English —
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
  "summary": "professional meeting minutes in English (if mainly Sinhala, append a Sinhala section) with three clear parts: Decisions made, Discussion highlights, and Next steps — written for someone who was not in the room, not a raw dump of everything said",
  "perPerson": [{ "name": "...", "points": ["key things this person said or decided"], "actionItems": ["..."] }],
  "deadlines": [{ "item": "...", "owner": "...", "due": "date or phrase as spoken" }],
  "terms": [{ "term": "software/technical term used", "explanation": "plain-English explanation", "sinhala": "short සිංහල explanation" }],
  "questions": [{ "person": "...", "questions": ["question this person should answer at the next meeting"] }],
  "speakerSegments": [{ "speaker": "attendee name if identifiable, else \"Speaker 1\"/\"Speaker 2\"/… used consistently for the same voice, or null", "text": "what this speaker said in this turn, verbatim in whichever language(s) they actually used — never translated or normalized to one language" }],
  "actionItems": [{ "text": "concrete, assignable next step", "suggestedAssigneeLabel": "attendee name or speaker label this belongs to, or null", "suggestedDueDate": "YYYY-MM-DD or null — never a phrase", "confidence": 0.0 }]
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
or null, and confidence is your own 0–1 estimate of how sure you are about the assignee/due date.`

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

  return persistMeetingAnalysis(id, meeting, session.user, attendees, raw, modelUsed)
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
  meeting: { title: string; startsAt: Date },
  author: { id: string; role?: string | null },
  attendees: AttendeeRef[],
  raw: string,
  modelUsed: string,
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
  }

  await db
    .insert(meetingAiNotes)
    .values(values)
    .onConflictDoUpdate({ target: meetingAiNotes.meetingId, set: values })

  await deriveAndInsertFollowups(id, attendees, perPerson, questions)

  // "Intelligence auto add notes": drop the summary and diarized transcript
  // straight into the unified note timeline, and file the model's
  // actionable proposals as suggestion cards. Best-effort, same reasoning
  // as the carry-forward pass below — a failure here must not undo the
  // analysis that already succeeded.
  try {
    await insertAutoNotesAndSuggestions(id, createdBy, summary, speakerSegments, actionItems, attendees)
  } catch (error) {
    console.error('[meeting-notes] auto note/suggestion insert failed:', error)
  }

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
): Promise<ActionResult> {
  try {
    return await finalizeMeetingRecordingInner(meetingId, liveTranscriptHint)
  } catch (error) {
    return recordingFailure('Writing up the minutes', error)
  }
}

async function finalizeMeetingRecordingInner(
  meetingId: string,
  liveTranscriptHint?: string,
): Promise<ActionResult> {
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

  if (segmentRows.length === 0) return err('No transcribed audio yet — record something first')

  const { text: combinedTranscript, missingIndices } = concatenateSegments(segmentRows)
  if (missingIndices.length > 0) {
    console.warn(
      `[meeting-recording] finalize for meeting ${id} is missing segment(s) ${missingIndices.join(', ')} — proceeding with the gap reported to the model`,
    )
  }

  const hintParsed = liveTranscriptInput.safeParse(
    typeof liveTranscriptHint === 'string' && liveTranscriptHint.trim().length > 0 ? liveTranscriptHint : '',
  )
  const hint = hintParsed.success ? hintParsed.data || null : null

  const attendees = await fetchAttendees(id)
  const attendeeNames = attendees.map((a) => a.name)

  // Change-detected screen keyframes captured alongside the audio (see
  // screen-keyframes.ts) — fetched here and handed to Gemini as labelled
  // image parts so the final synthesis pass can read on-screen content
  // (slides, diagrams, shared code, dashboards) the audio alone never
  // captures. Ordered by capturedAtMs so "in captured-at order" holds
  // without callGeminiWithImages having to re-sort. Best-effort per image —
  // one bad Blob fetch drops just that frame, never the whole analysis.
  const screenshotRows = await db
    .select({
      blobPathname: meetingScreenshots.blobPathname,
      capturedAtMs: meetingScreenshots.capturedAtMs,
    })
    .from(meetingScreenshots)
    .where(eq(meetingScreenshots.meetingId, id))
    .orderBy(meetingScreenshots.capturedAtMs)

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
This is a Sri Lankan team that routinely code-switches between Sinhala and English mid-sentence — the
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
  "summary": "professional meeting minutes in English (if mainly Sinhala, append a Sinhala section) with three clear parts: Decisions made, Discussion highlights, and Next steps — written for someone who was not in the room, not a raw dump of everything said",
  "perPerson": [{ "name": "...", "points": ["key things this person said or decided"], "actionItems": ["..."] }],
  "deadlines": [{ "item": "...", "owner": "...", "due": "date or phrase as spoken" }],
  "terms": [{ "term": "software/technical term used", "explanation": "plain-English explanation", "sinhala": "short සිංහල explanation" }],
  "questions": [{ "person": "...", "questions": ["question this person should answer at the next meeting"] }],
  "speakerSegments": [{ "speaker": "attendee name if identifiable, else \"Speaker 1\"/\"Speaker 2\"/… used CONSISTENTLY for the same voice across the WHOLE meeting, or null", "text": "what this speaker said in this turn, verbatim in whichever language(s) they actually used" }],
  "actionItems": [{ "text": "concrete, assignable next step", "suggestedAssigneeLabel": "attendee name or speaker label this belongs to, or null", "suggestedDueDate": "YYYY-MM-DD or null — never a phrase", "confidence": 0.0 }]
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
suggestedDueDate must be a real ISO date or null.`

  let raw: string
  let modelUsed: string = DEFAULT_GEMINI_MODEL
  try {
    ;({ text: raw, model: modelUsed } =
      images.length > 0
        ? await callGeminiWithImages(session.user.id, [{ text: prompt }], images, { responseJson: true })
        : await callGemini(session.user.id, [{ text: prompt }], { responseJson: true }))
  } catch (error) {
    if (error instanceof GeminiError) return err(error.message)
    return err('Gemini request failed — try again')
  }

  return persistMeetingAnalysis(id, meeting, session.user, attendees, raw, modelUsed)
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

  const existing = await db
    .select({ id: meetingScreenshots.id })
    .from(meetingScreenshots)
    .where(eq(meetingScreenshots.meetingId, id))
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
 * gate as capturing it in the first place. The DB row goes first; the Blob
 * delete is best-effort (same never-block posture as deleteMeeting's Google
 * Calendar cleanup) since a stray object left in Blob storage is cleanup
 * debt, not something that should block the person's actual request.
 */
export async function deleteMeetingKeyframe(screenshotId: string): Promise<ActionResult> {
  const parsed = idInput.safeParse(screenshotId)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const [row] = await db
    .select()
    .from(meetingScreenshots)
    .where(eq(meetingScreenshots.id, parsed.data))
  if (!row) return err('Not found')

  const ctx = await canManageMeeting(row.meetingId)
  if (!ctx) return err('Not allowed')

  await db.delete(meetingScreenshots).where(eq(meetingScreenshots.id, row.id))
  try {
    await del(row.blobPathname)
  } catch {
    // Ignore — the DB row (and so the filmstrip entry) is already gone.
  }

  revalidatePath('/meetings')
  return ok(undefined)
}

export async function getMeetingIntel(meetingId: string): Promise<ActionResult<MeetingIntel>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const idParsed = idInput.safeParse(meetingId)
  if (!idParsed.success) return err(idParsed.error.issues[0].message)
  const id = idParsed.data

  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id))
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
  const prep: CarriedForwardItemGroup[] = selectCarriedForward(carried, attendeeIds).map(
    (group) => ({
      userId: group.userId,
      person: group.person,
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
          }
        })
        // Still-owed work first; the settled ones are a record, not a to-do.
        // Array#sort is stable, so each half keeps its original order.
        .sort((a, b) => Number(a.status === 'resolved') - Number(b.status === 'resolved')),
    }),
  )

  const screenshotRows = await db
    .select({
      id: meetingScreenshots.id,
      blobPathname: meetingScreenshots.blobPathname,
      capturedAtMs: meetingScreenshots.capturedAtMs,
      width: meetingScreenshots.width,
      height: meetingScreenshots.height,
      byteSize: meetingScreenshots.byteSize,
    })
    .from(meetingScreenshots)
    .where(eq(meetingScreenshots.meetingId, id))
    .orderBy(meetingScreenshots.capturedAtMs)

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
        }
      : null,
    prep,
    people: attendees.map((attendee) => ({ id: attendee.id, name: attendee.name })),
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
  })
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
    .select({ createdBy: meetings.createdBy })
    .from(meetings)
    .where(eq(meetings.id, row.sourceMeetingId))
  if (!sourceMeeting) return err('Not found')

  const isAdmin = session.user.role === 'admin'
  const isCreator = sourceMeeting.createdBy === session.user.id
  const isSelf = row.userId === session.user.id
  if (!isAdmin && !isCreator && !isSelf) return err(`Not allowed to ${verb} this item`)

  return ok({ user: session.user, row })
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
  const { user, row } = authorized.data

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
      .from(meetings)
      .where(eq(meetings.id, parsed.data.meetingId))
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
  const { row } = authorized.data

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
    revalidatePath('/meetings')
  }

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
  const { row } = authorized.data

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

  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, parsed.data.meetingId))
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
      .from(meetings)
      .where(eq(meetings.id, parsed.data.targetMeetingId))
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

  await db.insert(meetingFollowups).values({
    sourceMeetingId: meeting.id,
    userId: person.id,
    personName: person.name,
    text: parsed.data.text,
    kind: parsed.data.kind,
    status: 'open',
    createdBy: session.user.id,
    targetMeetingId,
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
    .from(meetings)
    .where(eq(meetings.id, parsed.data.meetingId))
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

export type SpeakerRow = { label: string; userId: string | null; userName: string | null }

export type TaskSuggestionView = {
  id: string
  segmentId: string | null
  text: string
  suggestedUserId: string | null
  suggestedUserName: string | null
  suggestedDueDate: string | null
  status: 'open' | 'accepted' | 'dismissed'
  createdTaskId: string | null
}

export type NoteTimelineData = {
  segments: NoteSegmentView[]
  speakers: SpeakerRow[]
  suggestions: TaskSuggestionView[]
  attendees: AttendeeRef[]
  appId: string | null
}

const speakerUsers = alias(users, 'note_speaker_users')
const authorUsers = alias(users, 'note_author_users')
const suggestedUsers = alias(users, 'note_suggested_users')

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

  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id))
  if (!meeting) return err('Meeting not found')
  if (!(await canReadMeetingIntel(session.user, meeting))) return err('Not available')

  const attendees = await fetchAttendees(id)

  const segmentRows = await db
    .select({
      id: meetingNoteSegments.id,
      source: meetingNoteSegments.source,
      speakerId: meetingNoteSegments.speakerId,
      speakerName: speakerUsers.name,
      speakerLabel: meetingNoteSegments.speakerLabel,
      content: meetingNoteSegments.content,
      startedAtMs: meetingNoteSegments.startedAtMs,
      createdByName: authorUsers.name,
      createdAt: meetingNoteSegments.createdAt,
    })
    .from(meetingNoteSegments)
    .leftJoin(speakerUsers, eq(meetingNoteSegments.speakerId, speakerUsers.id))
    .innerJoin(authorUsers, eq(meetingNoteSegments.createdBy, authorUsers.id))
    .where(eq(meetingNoteSegments.meetingId, id))

  // No segments yet — the legacy `meetings.notes` blob (pre-dating this
  // feature) still renders as a read-only first entry rather than vanishing;
  // it becomes a real segment the first time someone edits notes here (see
  // addTypedNoteSegment).
  const segments: NoteSegmentView[] =
    segmentRows.length === 0 && meeting.notes
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

  const speakerMapRows = await db
    .select({ label: meetingSpeakers.label, userId: meetingSpeakers.userId, userName: users.name })
    .from(meetingSpeakers)
    .leftJoin(users, eq(meetingSpeakers.userId, users.id))
    .where(eq(meetingSpeakers.meetingId, id))

  const suggestionRows = await db
    .select({
      id: meetingTaskSuggestions.id,
      segmentId: meetingTaskSuggestions.segmentId,
      text: meetingTaskSuggestions.text,
      suggestedUserId: meetingTaskSuggestions.suggestedUserId,
      suggestedUserName: suggestedUsers.name,
      suggestedDueDate: meetingTaskSuggestions.suggestedDueDate,
      status: meetingTaskSuggestions.status,
      createdTaskId: meetingTaskSuggestions.createdTaskId,
    })
    .from(meetingTaskSuggestions)
    .leftJoin(suggestedUsers, eq(meetingTaskSuggestions.suggestedUserId, suggestedUsers.id))
    .where(and(eq(meetingTaskSuggestions.meetingId, id), eq(meetingTaskSuggestions.status, 'open')))

  return ok({
    segments,
    speakers: speakerMapRows,
    suggestions: suggestionRows,
    attendees,
    appId: meeting.appId,
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

  const [existing] = await db
    .select({ id: meetingNoteSegments.id })
    .from(meetingNoteSegments)
    .where(eq(meetingNoteSegments.meetingId, meeting.id))
    .limit(1)
  if (!existing && meeting.notes) {
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
    .from(meetingNoteSegments)
    .where(eq(meetingNoteSegments.id, parsed.data.segmentId))
  if (!segment) return err('Not found')
  if (segment.source === 'voice') return err('The recorded transcript can’t be edited')

  const ctx = await canManageMeeting(segment.meetingId)
  if (!ctx) return err('Not allowed')

  await db
    .update(meetingNoteSegments)
    .set({ content: parsed.data.content })
    .where(eq(meetingNoteSegments.id, segment.id))

  revalidatePath('/meetings')
  return ok(undefined)
}

/** Deletes a typed or AI segment. Voice (transcript) segments are read-only. */
export async function deleteNoteSegment(segmentId: string): Promise<ActionResult> {
  const parsed = idInput.safeParse(segmentId)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const [segment] = await db.select().from(meetingNoteSegments).where(eq(meetingNoteSegments.id, parsed.data))
  if (!segment) return err('Not found')
  if (segment.source === 'voice') return err('The recorded transcript can’t be deleted')

  const ctx = await canManageMeeting(segment.meetingId)
  if (!ctx) return err('Not allowed')

  await db.delete(meetingNoteSegments).where(eq(meetingNoteSegments.id, segment.id))

  revalidatePath('/meetings')
  return ok(undefined)
}

const setSpeakerMappingInput = z.object({
  meetingId: z.uuid(),
  label: z.string().trim().min(1).max(60),
  userId: z.uuid().nullable(),
})

/**
 * Maps a speaker label to a real user (or explicitly to "not a listed
 * attendee", i.e. null) and backfills speakerId on every note segment
 * already carrying that label — so assigning "Speaker 1" once relabels
 * everything they said, past and future, not just from here on.
 */
export async function setSpeakerMapping(
  meetingId: string,
  label: string,
  userId: string | null,
): Promise<ActionResult> {
  const parsed = setSpeakerMappingInput.safeParse({ meetingId, label, userId })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const ctx = await canManageMeeting(parsed.data.meetingId)
  if (!ctx) return err('Not allowed')

  await db
    .insert(meetingSpeakers)
    .values({ meetingId: parsed.data.meetingId, label: parsed.data.label, userId: parsed.data.userId })
    .onConflictDoUpdate({
      target: [meetingSpeakers.meetingId, meetingSpeakers.label],
      set: { userId: parsed.data.userId },
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
  const { meeting } = ctx
  if (!meeting.appId) return err('Link this meeting to an app before creating tasks from it')

  const payload = suggestionToTaskPayload(
    {
      text: suggestion.text,
      suggestedUserId: suggestion.suggestedUserId,
      suggestedDueDate: suggestion.suggestedDueDate,
    },
    { appId: meeting.appId, sprintId: null },
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
    .set({ status: 'accepted', createdTaskId: result.data.taskId })
    .where(eq(meetingTaskSuggestions.id, suggestion.id))

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
    revalidatePath('/meetings')
  }

  return ok(undefined)
}
