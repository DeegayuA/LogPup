'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, desc, eq, isNotNull, isNull, lt, ne, or } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { meetingAiNotes, meetingAttendees, meetings, users } from '@/db/schema'
import { callGemini, GeminiError } from '@/features/gemini/client'
import { ok, err, type ActionResult } from '@/lib/action-result'

const MAX_AUDIO_BYTES = 15 * 1024 * 1024 // inline Gemini requests cap around 20MB

// A malformed (non-UUID) meetingId would otherwise reach the DB as a raw
// `uuid` column comparison and throw a Postgres "invalid input syntax"
// error instead of a clean ActionResult — validate the shape up front.
const idInput = z.uuid()

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
  prep: { fromTitle: string; fromDate: Date; questions: QuestionNote[] } | null
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

  const attendeeRows = await db
    .select({ name: users.name })
    .from(meetingAttendees)
    .innerJoin(users, eq(meetingAttendees.userId, users.id))
    .where(eq(meetingAttendees.meetingId, id))
  const attendeeNames = attendeeRows.map((row) => row.name)

  const prompt = `You are LogPup's meeting analyst for a software team.
Audio of the meeting "${meeting.title}"${meeting.agenda ? ` (agenda: ${meeting.agenda})` : ''} is attached.
Known attendees: ${attendeeNames.length > 0 ? attendeeNames.join(', ') : 'unknown'}.
The meeting may be in English, Sinhala (සිංහල), or mixed — transcribe faithfully in the original language and script.

Return STRICT JSON only, matching exactly:
{
  "language": "en" | "si" | "mixed",
  "transcript": "full transcript with speaker labels where identifiable",
  "summary": "concise English summary; if the meeting was mainly Sinhala, append a Sinhala summary",
  "perPerson": [{ "name": "...", "points": ["key things this person said or decided"], "actionItems": ["..."] }],
  "deadlines": [{ "item": "...", "owner": "...", "due": "date or phrase as spoken" }],
  "terms": [{ "term": "software/technical term used", "explanation": "plain-English explanation", "sinhala": "short සිංහල explanation" }],
  "questions": [{ "person": "...", "questions": ["question this person should answer at the next meeting"] }]
}
Map speakers to attendee names where possible; unknown voices become "Speaker 1", "Speaker 2", … .
Deadlines and action items must be concrete. Give each person 1–3 follow-up questions about their
commitments, blockers, and deadlines from THIS meeting — they are shown at the next meeting.`

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

  const values = {
    meetingId: id,
    language: typeof parsed.language === 'string' ? parsed.language : 'en',
    transcript: typeof parsed.transcript === 'string' ? parsed.transcript : null,
    summary: typeof parsed.summary === 'string' ? parsed.summary : null,
    perPerson: asArray(parsed.perPerson),
    deadlines: asArray(parsed.deadlines),
    terms: asArray(parsed.terms),
    questions: asArray(parsed.questions),
    model: 'gemini-flash-latest',
    createdBy: session.user.id,
    createdAt: new Date(),
  }

  await db
    .insert(meetingAiNotes)
    .values(values)
    .onConflictDoUpdate({ target: meetingAiNotes.meetingId, set: values })

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

  // Prep questions come from the most recent EARLIER analyzed meeting,
  // scoped to the same app when this meeting has one.
  //
  // The entitlement check above only covers THIS meeting's row. The prep
  // source is a *different* meeting, and its questions are per-person
  // follow-ups derived verbatim from that meeting's transcript — so the same
  // attendee/creator/admin rule has to be applied to it as well. Without
  // this, any member could create a throwaway meeting on someone else's
  // appId (createMeeting takes a client-supplied appId with no app-membership
  // check), pass the guard above as its creator, and read a confidential
  // meeting's questions. Expressed as a SQL filter rather than a
  // post-hoc check so `limit 1` lands on the most recent *readable* meeting
  // instead of dropping prep entirely when the newest one is off-limits.
  const isAdmin = session.user.role === 'admin'
  const [previous] = await db
    .select({
      title: meetings.title,
      startsAt: meetings.startsAt,
      questions: meetingAiNotes.questions,
    })
    .from(meetingAiNotes)
    .innerJoin(meetings, eq(meetingAiNotes.meetingId, meetings.id))
    .leftJoin(
      meetingAttendees,
      and(
        eq(meetingAttendees.meetingId, meetings.id),
        eq(meetingAttendees.userId, session.user.id),
      ),
    )
    .where(
      and(
        ne(meetings.id, id),
        lt(meetings.startsAt, meeting.startsAt),
        // App-less meetings only pull prep from other app-less meetings —
        // never from an unrelated project's analyzed notes.
        meeting.appId ? eq(meetings.appId, meeting.appId) : isNull(meetings.appId),
        isAdmin
          ? undefined
          : or(
              eq(meetings.createdBy, session.user.id),
              isNotNull(meetingAttendees.userId),
            ),
      ),
    )
    .orderBy(desc(meetings.startsAt))
    .limit(1)

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
    prep: previous
      ? {
          fromTitle: previous.title,
          fromDate: previous.startsAt,
          questions: asArray<QuestionNote>(previous.questions),
        }
      : null,
  })
}
