'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq, inArray, isNotNull, lt, ne, or } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { meetingAiNotes, meetingAttendees, meetingFollowups, meetings, users } from '@/db/schema'
import { callGemini, GeminiError } from '@/features/gemini/client'
import { ok, err, type ActionResult } from '@/lib/action-result'
import {
  matchPersonToAttendee,
  selectCarriedForward,
  filterValidIds,
  type AttendeeRef,
  type CarriedForwardGroup,
  type FollowupKind,
  type OpenFollowupItem,
} from '@/features/meetings/followups'

const MAX_AUDIO_BYTES = 15 * 1024 * 1024 // inline Gemini requests cap around 20MB
const MAX_LIVE_TRANSCRIPT_CHARS = 100_000

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

export type MeetingIntel = {
  notes: MeetingAiNotesView | null
  prep: CarriedForwardGroup[]
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

/**
 * Meeting intel (transcript, per-person notes, follow-up questions) is
 * readable only by an admin, the meeting's creator, or someone who was
 * actually an attendee. Anything that returns intel — for THIS meeting or for
 * the earlier meeting the prep questions are pulled from — has to pass this.
 */
async function canReadMeetingIntel(
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

async function canManageMeeting(meetingId: string) {
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

/**
 * Open follow-ups (question/action items attributed to a person) whose
 * source meeting is earlier than `meeting` and readable by `caller` — same
 * admin/creator/attendee rule as canReadMeetingIntel, applied here to the
 * SOURCE meeting of each follow-up rather than the meeting being viewed.
 * Without this, a follow-up's text (derived from a transcript) could leak
 * into a meeting the caller has no right to see that source meeting's notes
 * from. Callers still need to narrow this to the target meeting's attendees
 * (see selectCarriedForward) — this only handles time + entitlement.
 */
async function fetchOpenFollowupsBefore(
  meeting: { id: string; startsAt: Date },
  caller: { id: string; isAdmin: boolean },
): Promise<OpenFollowupItem[]> {
  const rows = await db
    .select({
      id: meetingFollowups.id,
      userId: meetingFollowups.userId,
      personName: meetingFollowups.personName,
      text: meetingFollowups.text,
      kind: meetingFollowups.kind,
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
        eq(meetingFollowups.status, 'open'),
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
    raw = await callGemini(userId, [{ text: prompt }], { responseJson: true })
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
  "questions": [{ "person": "...", "questions": ["question this person should answer at the next meeting"] }]
}
Map speakers to attendee names where possible; unknown voices become "Speaker 1", "Speaker 2", … .
Deadlines and action items must be concrete. Give each person 1–3 follow-up questions about their
commitments, blockers, and deadlines from THIS meeting — they follow that person forward and are
shown whenever they attend a future meeting.`

  const base64 = Buffer.from(await audio.arrayBuffer()).toString('base64')
  const mimeType = audio.type || 'audio/webm'

  let raw: string
  try {
    raw = await callGemini(
      session.user.id,
      [{ text: prompt }, { inlineData: { mimeType, data: base64 } }],
      { responseJson: true },
    )
  } catch (error) {
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

  const values = {
    meetingId: id,
    language: typeof parsed.language === 'string' ? parsed.language : 'en',
    transcript,
    summary,
    perPerson,
    deadlines: asArray(parsed.deadlines),
    terms: asArray(parsed.terms),
    questions,
    model: 'gemini-flash-latest',
    createdBy: session.user.id,
    createdAt: new Date(),
  }

  await db
    .insert(meetingAiNotes)
    .values(values)
    .onConflictDoUpdate({ target: meetingAiNotes.meetingId, set: values })

  await deriveAndInsertFollowups(id, attendees, perPerson, questions)

  // "Intelligently think" about carry-forward: check whether any follow-up
  // items owed by this meeting's attendees (from earlier meetings) were
  // addressed here, and resolve them. Best-effort — a failure here must not
  // undo the analysis that already succeeded above.
  try {
    const isAdmin = session.user.role === 'admin'
    const openBefore = await fetchOpenFollowupsBefore(
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

  const openBefore = await fetchOpenFollowupsBefore(
    { id, startsAt: meeting.startsAt },
    { id: session.user.id, isAdmin },
  )
  const prep = selectCarriedForward(openBefore, attendeeIds)

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

const resolveFollowupInput = z.object({ followupId: z.uuid() })

/**
 * Manual resolve for a carried-in follow-up. Allowed for an admin, the
 * source meeting's creator, or the person the item is attributed to —
 * mirrors the read-entitlement rule so resolving something never requires
 * broader access than reading it did.
 */
export async function resolveFollowup(followupId: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const parsed = resolveFollowupInput.safeParse({ followupId })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const [row] = await db
    .select()
    .from(meetingFollowups)
    .where(eq(meetingFollowups.id, parsed.data.followupId))
  if (!row) return err('Not found')

  const [sourceMeeting] = await db
    .select({ createdBy: meetings.createdBy })
    .from(meetings)
    .where(eq(meetings.id, row.sourceMeetingId))
  if (!sourceMeeting) return err('Not found')

  const isAdmin = session.user.role === 'admin'
  const isCreator = sourceMeeting.createdBy === session.user.id
  const isSelf = row.userId === session.user.id
  if (!isAdmin && !isCreator && !isSelf) return err('Not allowed to resolve this item')

  if (row.status !== 'resolved') {
    await db
      .update(meetingFollowups)
      .set({ status: 'resolved', resolvedAt: new Date() })
      .where(eq(meetingFollowups.id, row.id))
    revalidatePath('/meetings')
  }

  return ok(undefined)
}
