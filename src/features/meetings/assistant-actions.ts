'use server'

import { z } from 'zod'
import { format } from 'date-fns'
import { and, asc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { liveMeetings, liveNoteSegments } from '@/db/live'
import {
  meetingAiNotes,
  meetingFollowups,
  meetingSpeakers,
  meetingTaskSuggestions,
  users,
} from '@/db/schema'
import { resolveSpeakerNameForLabel } from '@/features/meetings/notes'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { GeminiError, callGemini } from '@/features/gemini/client'
import { ASSISTANT_MODELS } from '@/features/gemini/models'
import { canReadMeetingIntel } from '@/features/meetings/ai-actions'

/**
 * "Ask this meeting a question" — a short, grounded Q&A over one meeting's
 * own record (summary, transcript, notes, action items, open follow-ups).
 *
 * Deliberately NOT a general chatbot: the context is assembled server-side
 * from exactly the rows the caller is already entitled to read, and the
 * prompt forbids answering from anything else. That keeps a question like
 * "what did I promise?" answerable without turning meeting transcripts into
 * a retrieval corpus that ignores per-meeting permissions.
 *
 * The answer is short by construction because it is meant to be SPOKEN back
 * (see useSpeech on the client) as well as read — a page of text is a bad
 * answer when it arrives as audio.
 */

const askInput = z.object({
  meetingId: z.uuid(),
  question: z.string().trim().min(3).max(500),
})

/** How much transcript to include. Roughly 15k tokens — a big but bounded slice. */
const MAX_TRANSCRIPT_CHARS = 60_000
const MAX_SEGMENTS = 200

export type MeetingAnswer = {
  answer: string
  model: string
}

export async function askMeeting(
  meetingId: string,
  question: string,
): Promise<ActionResult<MeetingAnswer>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const parsed = askInput.safeParse({ meetingId, question })
  if (!parsed.success) {
    return err(
      parsed.error.issues[0].code === 'too_big'
        ? 'That question is too long — ask something shorter'
        : 'Ask a question first',
    )
  }
  const { meetingId: id, question: asked } = parsed.data

  const [meeting] = await db.select().from(liveMeetings).where(eq(liveMeetings.id, id))
  if (!meeting) return err('Meeting not found')
  // Same gate as every other read of transcript-derived content: admin, the
  // meeting's creator, or someone who was actually there.
  if (!(await canReadMeetingIntel(session.user, meeting))) return err('Not available')

  // Four independent context reads, batched — never serialize what can run
  // together (suggest-actions.ts's rule). On the Neon HTTP driver each await
  // is a full round trip, and this action sits between a spoken question and
  // its spoken answer, where every serial hop is audible dead air.
  //
  // Every child read below joins liveMeetings itself: meetingAiNotes,
  // meetingTaskSuggestions, meetingFollowups and meetingSpeakers carry no
  // deletedAt of their own (MEETING_CHILD_TABLES in src/db/live.ts), so a
  // trashed meeting's children have to stop being readable along with it.
  // The lookup above already turns a trashed meeting away; the joins keep
  // that true if this batch is ever reordered or moved ahead of that gate.
  const [[notes], segments, actionItems, openFollowups, speakerMappings] = await Promise.all([
    // Columns named instead of a bare select(): the liveMeetings join would
    // otherwise nest the row under a table key, and only these two are ever
    // read — the rest of meeting_ai_notes is jsonb this action never touches.
    db
      .select({ transcript: meetingAiNotes.transcript, summary: meetingAiNotes.summary })
      .from(meetingAiNotes)
      .innerJoin(liveMeetings, eq(meetingAiNotes.meetingId, liveMeetings.id))
      .where(eq(meetingAiNotes.meetingId, id)),
    db
      .select({
        source: liveNoteSegments.source,
        speakerLabel: liveNoteSegments.speakerLabel,
        speakerName: users.name,
        content: liveNoteSegments.content,
      })
      .from(liveNoteSegments)
      .leftJoin(users, eq(liveNoteSegments.speakerId, users.id))
      .where(eq(liveNoteSegments.meetingId, id))
      .orderBy(asc(liveNoteSegments.startedAtMs), asc(liveNoteSegments.createdAt))
      .limit(MAX_SEGMENTS),
    db
      .select({
        text: meetingTaskSuggestions.text,
        assignee: users.name,
        due: meetingTaskSuggestions.suggestedDueDate,
        status: meetingTaskSuggestions.status,
      })
      .from(meetingTaskSuggestions)
      .innerJoin(liveMeetings, eq(meetingTaskSuggestions.meetingId, liveMeetings.id))
      .leftJoin(users, eq(meetingTaskSuggestions.suggestedUserId, users.id))
      .where(eq(meetingTaskSuggestions.meetingId, id)),
    db
      .select({ person: meetingFollowups.personName, text: meetingFollowups.text })
      .from(meetingFollowups)
      .innerJoin(liveMeetings, eq(meetingFollowups.sourceMeetingId, liveMeetings.id))
      .where(and(eq(meetingFollowups.sourceMeetingId, id), eq(meetingFollowups.status, 'open'))),
    // Speaker mappings, so a voice named by hand reaches the assistant too. A
    // typed name has no users row, so the join above leaves speakerName null
    // and the assistant would answer "Speaker 2 said…" about somebody the
    // transcript, the timeline and the PDF all call by name.
    db
      .select({
        label: meetingSpeakers.label,
        userId: meetingSpeakers.userId,
        userName: users.name,
        displayName: meetingSpeakers.displayName,
      })
      .from(meetingSpeakers)
      .innerJoin(liveMeetings, eq(meetingSpeakers.meetingId, liveMeetings.id))
      .leftJoin(users, eq(meetingSpeakers.userId, users.id))
      .where(eq(meetingSpeakers.meetingId, id)),
  ])

  const transcript = (notes?.transcript ?? '').slice(0, MAX_TRANSCRIPT_CHARS)
  const spoken = segments
    .filter((row) => row.source === 'voice')
    .map(
      (row) =>
        `${resolveSpeakerNameForLabel(row.speakerLabel, speakerMappings) ?? row.speakerName ?? 'Unknown'}: ${row.content}`,
    )
    .join('\n')
    .slice(0, MAX_TRANSCRIPT_CHARS)
  const typed = segments
    .filter((row) => row.source !== 'voice')
    .map((row) => row.content)
    .join('\n')
    .slice(0, 10_000)

  // Nothing to ground an answer in — say so rather than let the model
  // improvise a meeting that never got recorded.
  if (!transcript && !spoken && !typed && !notes?.summary) {
    return err('This meeting has no notes or transcript yet — record or analyze it first')
  }

  const prompt = `You are LogPup's meeting assistant, answering ONE question about a single meeting for
${session.user.name ?? 'a team member'}.

Meeting: "${meeting.title}" on ${format(meeting.startsAt, 'EEEE, d MMMM yyyy')}${meeting.agenda ? `\nAgenda: ${meeting.agenda}` : ''}

${notes?.summary ? `SUMMARY:\n${notes.summary}\n` : ''}
${spoken ? `WHAT WAS SAID (speaker: text):\n${spoken}\n` : ''}
${!spoken && transcript ? `TRANSCRIPT:\n${transcript}\n` : ''}
${typed ? `TYPED NOTES:\n${typed}\n` : ''}
${
  actionItems.length > 0
    ? `ACTION ITEMS:\n${actionItems
        .map(
          (item) =>
            `- ${item.text} (owner: ${item.assignee ?? 'unassigned'}, due: ${item.due ?? 'none'}, ${item.status})`,
        )
        .join('\n')}\n`
    : ''
}
${
  openFollowups.length > 0
    ? `OPEN FOLLOW-UPS:\n${openFollowups.map((row) => `- ${row.person}: ${row.text}`).join('\n')}\n`
    : ''
}
QUESTION: ${asked}

Rules:
- Answer ONLY from the meeting material above. If it does not contain the answer, say so plainly
  ("That wasn't discussed in this meeting") — never guess, never fill gaps from general knowledge.
- Your answer will be READ ALOUD as well as displayed. Keep it under 90 words, in plain sentences.
  No markdown, no bullet characters, no headings.
- This is a Sri Lankan team that code-switches between Sinhala and English. Answer in the language
  the QUESTION was asked in. Keep technical/product terms (sprint, deploy, PR, app names) in English
  either way, and write Sinhala in Sinhala script (සිංහල).
- Name people as they are named above. Never invent a name, a date, or a commitment.`

  try {
    const { text, model } = await callGemini(session.user.id, [{ text: prompt }], {
      models: ASSISTANT_MODELS,
    })
    const answer = text.trim()
    if (!answer) return err('No answer came back — try asking again')
    return ok({ answer, model })
  } catch (error) {
    if (error instanceof GeminiError) return err(error.message)
    return err('Could not answer that — try again')
  }
}
