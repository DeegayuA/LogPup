'use server'

import { z } from 'zod'
import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { activityLog } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { GeminiError, callGemini } from '@/features/gemini/client'
import { resolveChain } from '@/features/gemini/model-choice'
import { aiFeatureDisabledMessage, getAiPrefs } from '@/features/gemini/prefs'
import { buildWorklogDraftPrompt, type DraftActivity } from './draft-prompt'
import { WORK_DAY_PATTERN } from './worklog-day'

/** Enough to characterise a day; beyond this it is just tokens. */
const MAX_ACTIVITY_ROWS = 60

/**
 * What the model is allowed to hand back when asked for a percent too.
 * Parsed, never trusted — same rule as suggestSprint. `percent` gets a
 * `.catch(null)`: a malformed percent costs the suggestion chip, never the
 * note that came with it.
 */
const draftSchema = z.object({
  note: z.string().min(1).max(4000),
  percent: z.number().min(0).max(100).nullable().catch(null),
})

/** Snap to the slider's own steps — nobody means the difference between 62% and 65%. */
function snapPercent(value: number | null): number | null {
  if (value === null) return null
  return Math.min(100, Math.max(0, Math.round(value / 5) * 5))
}

export type WorklogDraft = {
  note: string
  activityCount: number
  /**
   * A LABELED SUGGESTION for the day's self-score, or null when the day's
   * activity gives the model nothing to judge from. The form renders it as a
   * chip the person applies with one click — it never lands in the slider by
   * itself, because the score is theirs, not the model's.
   */
  suggestedPercent: number | null
}

/**
 * Drafts the note from what LogPup already saw this person do, so filling in
 * a work log is editing a paragraph rather than writing one from a blank box.
 *
 * Reads ONLY the caller's own activity — `eq(activityLog.actorId, session.user.id)`
 * is what makes this safe to expose to every member, and it must stay. There
 * is deliberately no `targetUserId`: nobody drafts anybody else's day.
 *
 * Also proposes a percent (see WorklogDraft.suggestedPercent). The return
 * shape only GREW — callers that read `note`/`activityCount` alone keep
 * working unchanged.
 */
export async function draftWorklogNote(day: string): Promise<ActionResult<WorklogDraft>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const disabled = await aiFeatureDisabledMessage(session.user.id, 'worklog-draft')
  if (disabled) return err(disabled)

  if (!WORK_DAY_PATTERN.test(day)) return err('That is not a day')

  // activity_log stores instants; the day is Asia/Colombo (+05:30), so the
  // window is expressed at that offset rather than at the server's zone.
  const start = new Date(`${day}T00:00:00+05:30`)
  const end = new Date(`${day}T23:59:59.999+05:30`)

  const activity: DraftActivity[] = await db
    .select({
      verb: activityLog.verb,
      entityType: activityLog.entityType,
      entityLabel: activityLog.entityLabel,
      appName: activityLog.appName,
    })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.actorId, session.user.id),
        gte(activityLog.createdAt, start),
        lte(activityLog.createdAt, end),
      ),
    )
    .orderBy(asc(activityLog.createdAt))
    .limit(MAX_ACTIVITY_ROWS)

  const prompt = buildWorklogDraftPrompt({
    name: session.user.name ?? 'this engineer',
    day,
    activity,
    suggestPercent: true,
  })

  try {
    const prefs = await getAiPrefs(session.user.id)
    const { text } = await callGemini(session.user.id, [{ text: prompt }], {
      models: resolveChain('worklog-draft', prefs['worklog-draft'].model),
      responseJson: true,
      feature: 'worklog.draft',
    })

    // The JSON path, with the plain text as fallback: a model that ignored
    // the shape but still wrote a note costs the percent suggestion, never
    // the draft — note drafting predates the percent and must not get less
    // reliable for having gained it.
    let note = ''
    let suggestedPercent: number | null = null
    try {
      const parsed = draftSchema.safeParse(JSON.parse(text))
      if (parsed.success) {
        note = parsed.data.note.trim()
        suggestedPercent = snapPercent(parsed.data.percent)
      }
    } catch {
      // Not JSON at all — fall through to the raw text below.
    }
    if (!note) {
      const raw = text.trim()
      // A JSON-shaped blob that failed the schema is not a sentence anyone
      // should be handed as their own words.
      if (!raw || raw.startsWith('{')) return err('No draft came back — try again')
      note = raw
    }

    // A percent judged from nothing is a number pretending to be a reading —
    // the exact silent-50 defect this suggestion exists to replace.
    if (activity.length === 0) suggestedPercent = null

    // activityCount travels back so the UI can say the day looked empty,
    // rather than letting a "describe it yourself" draft read as the model
    // having failed. It also captions the suggestion chip ("based on 12
    // activities"), so the person knows what the number was judged from.
    return ok({ note, activityCount: activity.length, suggestedPercent })
  } catch (error) {
    if (error instanceof GeminiError) return err(error.message)
    return err('Could not draft that right now — write it yourself or try again')
  }
}
