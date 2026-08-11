'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq, inArray, isNotNull, lt, ne, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import {
  meetingAiNotes,
  meetingAttendees,
  meetingFollowups,
  meetingNoteSegments,
  meetingSpeakers,
  meetingTaskSuggestions,
  meetings,
  users,
} from '@/db/schema'
import { DEFAULT_GEMINI_MODEL, callGemini, GeminiError } from '@/features/gemini/client'
import { ok, err, type ActionResult } from '@/lib/action-result'
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

const MAX_AUDIO_BYTES = 15 * 1024 * 1024 // inline Gemini requests cap around 20MB
const MAX_LIVE_TRANSCRIPT_CHARS = 100_000
const MAX_RESOLUTION_NOTE_CHARS = 500
const MAX_SEGMENT_LENGTH = 5000 // matches MAX_NOTES_LENGTH in actions.ts

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
 * with", and `resolutionNote` carries the answer someone typed when they
 * resolved it — the record of WHAT changed, not just that something did.
 */
export type CarriedForwardItem = CarriedForwardEntry & {
  status: FollowupStatus
  resolutionNote: string | null
  resolvedAt: Date | null
}

export type CarriedForwardItemGroup = {
  userId: string
  person: string
  items: CarriedForwardItem[]
}

export type MeetingIntel = {
  notes: MeetingAiNotesView | null
  prep: CarriedForwardItemGroup[]
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
  resolvedAt: Date | null
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
 */
async function fetchFollowupsBefore(
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
      resolvedAt: meetingFollowups.resolvedAt,
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
        ne(meetingFollowups.sourceMeetingId, meeting.id),
        lt(meetings.startsAt, meeting.startsAt),
        caller.isAdmin
          ? undefined
          : or(eq(meetings.createdBy, caller.id), isNotNull(meetingAttendees.userId)),
      ),
    )
  return rows
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
    return err('Recording is over 15MB — record shorter segments (about 20 minutes max)')
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
The meeting may be in English, Sinhala (සිංහල), or mixed — transcribe faithfully in the original language and script.
${
  liveTranscript
    ? `\nA live, noisy speech-to-text capture made during the meeting is included below as a HINT ONLY.
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
  "language": "en" | "si" | "mixed",
  "transcript": "full transcript with speaker labels where identifiable",
  "summary": "professional meeting minutes in English (if mainly Sinhala, append a Sinhala section) with three clear parts: Decisions made, Discussion highlights, and Next steps — written for someone who was not in the room, not a raw dump of everything said",
  "perPerson": [{ "name": "...", "points": ["key things this person said or decided"], "actionItems": ["..."] }],
  "deadlines": [{ "item": "...", "owner": "...", "due": "date or phrase as spoken" }],
  "terms": [{ "term": "software/technical term used", "explanation": "plain-English explanation", "sinhala": "short සිංහල explanation" }],
  "questions": [{ "person": "...", "questions": ["question this person should answer at the next meeting"] }],
  "speakerSegments": [{ "speaker": "attendee name if identifiable, else \"Speaker 1\"/\"Speaker 2\"/… used consistently for the same voice, or null", "text": "what this speaker said in this turn" }],
  "actionItems": [{ "text": "concrete, assignable next step", "suggestedAssigneeLabel": "attendee name or speaker label this belongs to, or null", "suggestedDueDate": "YYYY-MM-DD or null — never a phrase", "confidence": 0.0 }]
}
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

  const base64 = Buffer.from(await audio.arrayBuffer()).toString('base64')
  const mimeType = audio.type || 'audio/webm'

  let raw: string
  let modelUsed: string = DEFAULT_GEMINI_MODEL
  try {
    ;({ text: raw, model: modelUsed } = await callGemini(
      session.user.id,
      [{ text: prompt }, { inlineData: { mimeType, data: base64 } }],
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
    language: typeof parsed.language === 'string' ? parsed.language : 'en',
    transcript,
    summary,
    perPerson,
    deadlines: asArray(parsed.deadlines),
    terms: asArray(parsed.terms),
    questions,
    model: modelUsed,
    createdBy: session.user.id,
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
    await insertAutoNotesAndSuggestions(id, session.user.id, summary, speakerSegments, actionItems, attendees)
  } catch (error) {
    console.error('[meeting-notes] auto note/suggestion insert failed:', error)
  }

  // "Intelligently think" about carry-forward: check whether any follow-up
  // items owed by this meeting's attendees (from earlier meetings) were
  // addressed here, and resolve them. Best-effort — a failure here must not
  // undo the analysis that already succeeded above.
  try {
    const isAdmin = session.user.role === 'admin'
    const openBefore = await fetchFollowupsBefore(
      { id, startsAt: meeting.startsAt },
      { id: session.user.id, isAdmin },
    )
    const carriedIn = selectCarriedForward(
      openBefore,
      attendees.map((a) => a.id),
    )
    await resolveAddressedFollowups(session.user.id, { id, title: meeting.title }, carriedIn, transcript, summary)
  } catch (error) {
    console.error('[meeting-followups] carry-forward resolution failed:', error)
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
  const attendeeIdRows = await db
    .select({ userId: meetingAttendees.userId })
    .from(meetingAttendees)
    .where(eq(meetingAttendees.meetingId, id))
  const attendeeIds = attendeeIdRows.map((row) => row.userId)

  // Items resolved in THIS meeting come back too (includeResolvedHere) so a
  // resolve is visible as a settled row with its outcome note rather than a
  // disappearance — and can be undone. They stay pinned to this one meeting,
  // so nothing resolved is ever carried into a future one.
  const carried = await fetchFollowupsBefore(
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
            resolvedAt: row?.resolvedAt ?? null,
          }
        })
        // Still-owed work first; the settled ones are a record, not a to-do.
        // Array#sort is stable, so each half keeps its original order.
        .sort((a, b) => Number(a.status === 'resolved') - Number(b.status === 'resolved')),
    }),
  )

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
 * Manual resolve for a carried-in follow-up, with the outcome attached:
 * `note` is what the answer/change actually was, which is the whole point of
 * closing an item rather than just silencing it.
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
  // Re-resolving an already-resolved item is only meaningful when it adds
  // the note that was missing; otherwise leave the original timestamp and
  // meeting alone.
  if (alreadyResolved && !resolutionNote) return ok(undefined)

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
