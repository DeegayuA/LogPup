'use server'

import { z } from 'zod'
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
      note: noteValue,
    })
    .onConflictDoUpdate({
      target: [dailyWorklogs.userId, dailyWorklogs.day],
      set: { percent: parsed.data.percent, note: noteValue, updatedAt: new Date() },
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

  return ok({ day: parsed.data.day })
}
