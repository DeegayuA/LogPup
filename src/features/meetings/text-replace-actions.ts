'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, asc, eq, ne } from 'drizzle-orm'
import { db } from '@/db'
import { liveMeetings, liveNoteSegments } from '@/db/live'
import { meetingAiNotes, meetingNoteSegments, meetingTaskSuggestions } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'
import { canManageMeeting } from '@/features/meetings/ai-actions'
import {
  applyReplacements,
  findOccurrences,
  type Occurrence,
  type SearchTarget,
} from '@/features/meetings/text-replace'

// A correction is worth reviewing, not scrolling: past this many hits the term
// is too common to be a mis-transcribed name, and a dialog of 400 checkboxes is
// something nobody reads before pressing Apply. The count of what was cut is
// reported so the UI can say so rather than quietly showing a prefix.
const MAX_OCCURRENCES = 200
// The same ceiling on the way back in — a selection list longer than what the
// find could ever have produced did not come from the review dialog.
const MAX_SELECTIONS = MAX_OCCURRENCES
const MAX_TERM_CHARS = 120

/**
 * Where a match lives, encoded into `SearchTarget.id` so the apply pass knows
 * which table to write without a second lookup: `segment:<uuid>`,
 * `action:<uuid>`, `summary:<meetingId>`.
 *
 * Prefixed rather than bare uuids because three different tables feed one flat
 * list, and "this uuid is probably a segment" is not something a write should
 * ever guess at.
 */
type TargetTable = 'segment' | 'summary' | 'action'

function encodeTargetId(table: TargetTable, id: string): string {
  return `${table}:${id}`
}

function decodeTargetId(value: string): { table: TargetTable; id: string } | null {
  const separator = value.indexOf(':')
  if (separator === -1) return null
  const table = value.slice(0, separator)
  const id = value.slice(separator + 1)
  if (!id) return null
  if (table !== 'segment' && table !== 'summary' && table !== 'action') return null
  return { table, id }
}

const findInput = z.object({
  meetingId: z.uuid(),
  term: z.string().trim().min(2, 'Search for at least 2 characters').max(MAX_TERM_CHARS),
  // On by default: the whole point is catching the spellings a transcription
  // model produced, which are near-misses, not copies. fuzzyBudget still
  // refuses to fuzz anything under five characters.
  fuzzy: z.boolean().default(true),
  caseSensitive: z.boolean().default(false),
})

const applyInput = z.object({
  meetingId: z.uuid(),
  term: z.string().trim().min(1).max(MAX_TERM_CHARS),
  replacement: z.string().trim().min(1).max(MAX_TERM_CHARS),
  selections: z
    .array(
      z.object({
        targetId: z.string().min(1).max(80),
        start: z.number().int().min(0),
        matched: z.string().min(1).max(MAX_TERM_CHARS * 2),
      }),
    )
    .min(1, 'Nothing was selected')
    .max(MAX_SELECTIONS),
})

export type MeetingReplaceMatches = {
  occurrences: Occurrence[]
  /** How many places the term actually appears — may exceed `occurrences`. */
  total: number
  /** True when MAX_OCCURRENCES cut the list, so the UI can say it did. */
  truncated: boolean
}

export type MeetingReplaceResult = {
  applied: number
  /**
   * Selections that could not be applied — the text at that offset is no
   * longer what was reviewed (someone edited the note, or the segment is
   * gone). Derived from what the caller sent rather than read off the engine,
   * which cannot count a selection whose target has since disappeared.
   */
  skipped: number
}

/**
 * Everything in a meeting a correction could need to reach, as one flat list:
 * the note timeline (typed notes, the AI write-up, and the diarized transcript
 * turns), the AI summary, and the action-item texts.
 *
 * Voice segments are included. Free-form editing of a transcript turn is
 * refused elsewhere (editNoteSegment) because rewriting the record of what was
 * said is not a thing one person should do silently — but that is exactly the
 * case a reviewed, per-occurrence spelling fix is not: every hit is shown in
 * its sentence and ticked by hand, and a name the model misheard the same way
 * eleven times is otherwise permanently wrong in the one place people quote
 * from. Anything applied here lands in the activity trail with the before and
 * after text.
 */
async function fetchTargets(meetingId: string): Promise<SearchTarget[]> {
  const [segments, [aiNotes], suggestions] = await Promise.all([
    db
      .select({
        id: liveNoteSegments.id,
        source: liveNoteSegments.source,
        speakerLabel: liveNoteSegments.speakerLabel,
        content: liveNoteSegments.content,
      })
      .from(liveNoteSegments)
      .where(eq(liveNoteSegments.meetingId, meetingId))
      .orderBy(asc(liveNoteSegments.createdAt), asc(liveNoteSegments.startedAtMs)),
    db
      .select({ summary: meetingAiNotes.summary })
      .from(meetingAiNotes)
      // Unlike the segments above — which have a deletedAt of their own, hence
      // liveNoteSegments — meetingAiNotes and meetingTaskSuggestions carry
      // none: they are live iff the meeting is (see MEETING_CHILD_TABLES in
      // src/db/live.ts). The join names that here rather than leaning on the
      // callers' canManageMeeting gate, because this list doubles as the apply
      // pass's authorization boundary: a trashed meeting's write-up and action
      // items have to be unreachable as WRITE targets, not just as search hits.
      .innerJoin(liveMeetings, eq(liveMeetings.id, meetingAiNotes.meetingId))
      .where(eq(meetingAiNotes.meetingId, meetingId)),
    db
      .select({ id: meetingTaskSuggestions.id, text: meetingTaskSuggestions.text })
      .from(meetingTaskSuggestions)
      // Same meeting-liveness join as the write-up read above.
      .innerJoin(liveMeetings, eq(liveMeetings.id, meetingTaskSuggestions.meetingId))
      .where(
        and(
          eq(meetingTaskSuggestions.meetingId, meetingId),
          // A dismissed card is off the screen for good; rewriting its text
          // corrects nothing anyone will ever read.
          ne(meetingTaskSuggestions.status, 'dismissed'),
        ),
      )
      .orderBy(asc(meetingTaskSuggestions.createdAt)),
  ])

  const targets: SearchTarget[] = segments.map((segment) => ({
    id: encodeTargetId('segment', segment.id),
    kind: segment.source === 'voice' ? 'transcript' : 'segment',
    text: segment.content,
    label:
      segment.source === 'voice'
        ? (segment.speakerLabel ?? undefined)
        : segment.source === 'ai'
          ? 'AI write-up'
          : 'Typed note',
  }))

  if (aiNotes?.summary) {
    targets.push({
      id: encodeTargetId('summary', meetingId),
      kind: 'summary',
      text: aiNotes.summary,
    })
  }

  for (const suggestion of suggestions) {
    targets.push({
      id: encodeTargetId('action', suggestion.id),
      kind: 'action',
      text: suggestion.text,
    })
  }

  return targets
}

/**
 * Every other place `term` appears across this meeting's write-up.
 *
 * Read-only, but gated on canManageMeeting rather than canReadMeetingIntel:
 * the only thing this result is for is feeding the apply below, and an
 * attendee who cannot make the edit has no reason to be handed the
 * transcript sliced up by search term.
 */
export async function findMeetingReplacements(input: {
  meetingId: string
  term: string
  fuzzy?: boolean
  caseSensitive?: boolean
}): Promise<ActionResult<MeetingReplaceMatches>> {
  const parsed = findInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { meetingId, term, fuzzy, caseSensitive } = parsed.data

  const ctx = await canManageMeeting(meetingId)
  if (!ctx) return err('Only admins or the meeting creator can edit this write-up')

  const targets = await fetchTargets(meetingId)
  const occurrences = findOccurrences(targets, term, { fuzzy, caseSensitive })

  return ok({
    occurrences: occurrences.slice(0, MAX_OCCURRENCES),
    total: occurrences.length,
    truncated: occurrences.length > MAX_OCCURRENCES,
  })
}

/**
 * Rewrites exactly the occurrences somebody ticked.
 *
 * The targets are re-read here rather than trusted from the client: that is
 * what makes the engine's staleness check mean anything (it compares each
 * selection against the text as it is RIGHT NOW, so a note edited while the
 * review dialog sat open is skipped instead of overwritten), and it is also
 * the authorization boundary — applyReplacements only ever returns ids that
 * came out of this meeting's own rows, so a forged targetId cannot reach a
 * write for someone else's meeting.
 */
export async function applyMeetingReplacements(input: {
  meetingId: string
  term: string
  replacement: string
  selections: { targetId: string; start: number; matched: string }[]
}): Promise<ActionResult<MeetingReplaceResult>> {
  const parsed = applyInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { meetingId, term, replacement, selections } = parsed.data

  const ctx = await canManageMeeting(meetingId)
  if (!ctx) return err('Only admins or the meeting creator can edit this write-up')
  const { session, meeting } = ctx

  const targets = await fetchTargets(meetingId)
  const { updated, applied } = applyReplacements(targets, selections, replacement)

  for (const row of updated) {
    const ref = decodeTargetId(row.id)
    if (!ref) continue
    if (ref.table === 'segment') {
      await db
        .update(meetingNoteSegments)
        .set({ content: row.text })
        .where(eq(meetingNoteSegments.id, ref.id))
    } else if (ref.table === 'action') {
      await db
        .update(meetingTaskSuggestions)
        .set({ text: row.text })
        .where(eq(meetingTaskSuggestions.id, ref.id))
    } else {
      // Keyed on meetingId, not the encoded id, because meeting_ai_notes holds
      // one row per meeting and that is the column with the unique index.
      await db
        .update(meetingAiNotes)
        .set({ summary: row.text })
        .where(eq(meetingAiNotes.meetingId, meetingId))
    }
  }

  const skipped = selections.length - applied

  if (applied > 0) {
    await logActivity({
      actorId: session.user.id,
      verb: 'updated',
      entityType: 'meeting',
      entityId: meeting.id,
      entityLabel: meeting.title,
      appId: meeting.appId,
      pagePath: '/meetings',
      detail: `replaced “${term}” with “${replacement}” in ${applied} ${applied === 1 ? 'place' : 'places'}`,
      metadata: { term, replacement, applied, skipped },
    })
    revalidatePath('/meetings')
  }

  return ok({ applied, skipped })
}
