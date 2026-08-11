'use server'

import { revalidatePath } from 'next/cache'
import { and, desc, eq, isNotNull, lt, ne } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { meetingAiNotes, meetingAttendees, meetings, users } from '@/db/schema'
import { callGemini, GeminiError } from '@/features/gemini/client'
import { ok, err, type ActionResult } from '@/lib/action-result'

const MAX_AUDIO_BYTES = 15 * 1024 * 1024 // inline Gemini requests cap around 20MB

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
  const ctx = await canManageMeeting(meetingId)
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
    .where(eq(meetingAttendees.meetingId, meetingId))
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
    meetingId,
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

  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId))
  if (!meeting) return err('Meeting not found')

  const [notesRow] = await db
    .select()
    .from(meetingAiNotes)
    .where(eq(meetingAiNotes.meetingId, meetingId))

  // Prep questions come from the most recent EARLIER analyzed meeting,
  // scoped to the same app when this meeting has one.
  const [previous] = await db
    .select({
      title: meetings.title,
      startsAt: meetings.startsAt,
      questions: meetingAiNotes.questions,
    })
    .from(meetingAiNotes)
    .innerJoin(meetings, eq(meetingAiNotes.meetingId, meetings.id))
    .where(
      and(
        ne(meetings.id, meetingId),
        lt(meetings.startsAt, meeting.startsAt),
        meeting.appId ? eq(meetings.appId, meeting.appId) : isNotNull(meetings.id),
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
