'use server'

import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { activityLog } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { GeminiError, callGemini } from '@/features/gemini/client'
import { buildWorklogDraftPrompt, type DraftActivity } from './draft-prompt'
import { WORK_DAY_PATTERN } from './worklog-day'

/** Enough to characterise a day; beyond this it is just tokens. */
const MAX_ACTIVITY_ROWS = 60

/**
 * Drafts the note from what LogPup already saw this person do, so filling in
 * a work log is editing a paragraph rather than writing one from a blank box.
 *
 * Reads ONLY the caller's own activity — `eq(activityLog.actorId, session.user.id)`
 * is what makes this safe to expose to every member, and it must stay. There
 * is deliberately no `targetUserId`: nobody drafts anybody else's day.
 */
export async function draftWorklogNote(
  day: string,
): Promise<ActionResult<{ note: string; activityCount: number }>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')
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
  })

  try {
    const { text } = await callGemini(session.user.id, [{ text: prompt }], {
      feature: 'worklog.draft',
    })
    const note = text.trim()
    if (!note) return err('No draft came back — try again')
    // activityCount travels back so the UI can say the day looked empty,
    // rather than letting a "describe it yourself" draft read as the model
    // having failed.
    return ok({ note, activityCount: activity.length })
  } catch (error) {
    if (error instanceof GeminiError) return err(error.message)
    return err('Could not draft that right now — write it yourself or try again')
  }
}
