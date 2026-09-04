'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { dailyWorklogs } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'
import { PERCENT_MAX, PERCENT_MIN, WORK_DAY_PATTERN, isFutureWorkDay } from './worklog-day'

const worklogInput = z.object({
  // Taken from the client so somebody can still fill in yesterday, but never
  // trusted as free-form text — it reaches a `date` column.
  day: z.string().regex(WORK_DAY_PATTERN, 'That is not a day'),
  percent: z
    .number()
    .int()
    .min(PERCENT_MIN, 'Percent must be 0–100')
    .max(PERCENT_MAX, 'Percent must be 0–100'),
  note: z.string().trim().max(4000, 'That note is too long').nullable(),
})

/**
 * Records — or corrects — one person's own day.
 *
 * Self only. There is deliberately no `targetUserId` here, unlike
 * upsertSprintCheckin: a work log is a first-person statement about your own
 * day that a manager then reads back, so an admin writing one "on behalf of"
 * somebody would be putting words in their mouth in the one record that is
 * supposed to be theirs.
 *
 * Upsert rather than insert, keyed on the (user, day) unique index: revising
 * the number late in the afternoon is normal, and a second row for the same
 * day would silently double-count in every average.
 */
export async function upsertDailyWorklog(
  day: string,
  percent: number,
  note: string | null,
): Promise<ActionResult<{ day: string }>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const parsed = worklogInput.safeParse({ day, percent, note })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  if (isFutureWorkDay(parsed.data.day, new Date())) return err('That day has not happened yet')

  const noteValue = parsed.data.note?.trim() ? parsed.data.note.trim() : null

  await db
    .insert(dailyWorklogs)
    .values({
      userId: session.user.id,
      day: parsed.data.day,
      percent: parsed.data.percent,
      // 'self' — A PERSON IS TYPING. This is the stamp that makes auto-scoring
      // safe: syncAutoScore refuses to touch a row marked 'self', so the moment
      // somebody scores their own day by hand, the derived score stops
      // competing with them for that number — permanently, and for every later
      // hour they log against it. Set on BOTH paths, so correcting a derived
      // score also claims it.
      scoreSource: 'self',
      note: noteValue,
    })
    .onConflictDoUpdate({
      target: [dailyWorklogs.userId, dailyWorklogs.day],
      set: {
        percent: parsed.data.percent,
        scoreSource: 'self',
        note: noteValue,
        updatedAt: new Date(),
      },
    })

  // The percentage goes into the metadata but the NOTE never does: the
  // activity feed is read by the whole team, and the note is what someone
  // wrote about their own day. Name the day, not its contents.
  await logActivity({
    actorId: session.user.id,
    verb: 'updated',
    entityType: 'worklog',
    entityId: session.user.id,
    entityLabel: `Work log for ${parsed.data.day}`,
    pagePath: '/worklog',
    metadata: { day: parsed.data.day, percent: parsed.data.percent },
  })

  // The page tells the reader their entry appears in the list below and
  // that a filled day leaves the catch-up panel. Both of those are server
  // renders, so without this the form flips to "Saved" while the rest of
  // the page still reads "Not logged" — the one place a user concludes the
  // save failed. revalidatePath re-renders the route in the action's own
  // response, so the correction lands in the same roundtrip.
  revalidatePath('/worklog')

  return ok({ day: parsed.data.day })
}

const noteInput = z.object({
  day: z.string().regex(WORK_DAY_PATTERN, 'That is not a day'),
  note: z.string().trim().max(4000, 'That note is too long').nullable(),
})

/**
 * Write a day's NOTE without saying anything about its score.
 *
 * WHY THIS EXISTS SEPARATELY FROM upsertDailyWorklog. Since scores can be
 * derived from hours, a person can legitimately describe a day in words and
 * never state a number for it — the number comes from the hours they logged.
 * `upsertDailyWorklog` cannot serve that: it requires a percent (the column is
 * NOT NULL) and it stamps `score_source = 'self'`, which would mark a derived
 * number as the person's own claim and permanently stop it being recomputed.
 *
 * So this touches ONE column. It also deliberately does NOT insert: a row with
 * a note and no percent cannot exist, and inventing a percent here to make one
 * would be the exact fabrication `score_source` was added to prevent. The
 * caller writes the day's hours first — which creates the row through
 * auto-scoring — and then writes the note onto it.
 *
 * Self only, like every other write in this file. No `targetUserId`, ever: the
 * note is what somebody wrote about their own day.
 */
export async function setDayNote(
  day: string,
  note: string | null,
): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const parsed = noteInput.safeParse({ day, note })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const noteValue = parsed.data.note?.trim() ? parsed.data.note.trim() : null

  const updated = await db
    .update(dailyWorklogs)
    .set({ note: noteValue, updatedAt: new Date() })
    .where(and(eq(dailyWorklogs.userId, session.user.id), eq(dailyWorklogs.day, parsed.data.day)))
    .returning({ day: dailyWorklogs.day })

  // Zero rows means the day has no record yet — no hours were saved and no
  // score was given — so there is nothing for a note to hang on. Said plainly
  // rather than silently succeeding, because a lost note is invisible.
  if (updated.length === 0) return err('That day has nothing recorded to attach a note to')

  revalidatePath('/worklog')
  return ok(undefined)
}
