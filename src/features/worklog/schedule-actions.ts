'use server'

import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { workSchedules } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'
import { requireCapability } from '@/features/auth/actor'

const fraction = z.number().min(0).max(1)
const patternInput = z.object({
  mon: fraction, tue: fraction, wed: fraction, thu: fraction,
  fri: fraction, sat: fraction, sun: fraction,
})

const setInput = z.object({
  userId: z.string().uuid(),
  pattern: patternInput,
  note: z.string().trim().max(200).optional(),
})

/**
 * Change what a person is expected to log.
 *
 * Closes the open row and opens a new one in ONE db.batch, never an in-place
 * update: moving someone to part-time in June must not rewrite what was
 * expected of them in May. The one-open-row unique index enforces that only
 * one interval is ever open, so the close and the open must land together.
 */
export async function setWorkSchedule(
  raw: z.input<typeof setInput>,
): Promise<ActionResult<void>> {
  const parsed = setInput.safeParse(raw)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { userId, pattern, note } = parsed.data

  const actor = await requireCapability('user.schedule.edit', { ownerId: userId })
  if (!actor) return err('Not allowed')

  try {
    const now = new Date()
    await db.batch([
      db
        .update(workSchedules)
        .set({ effectiveTo: now })
        .where(and(eq(workSchedules.userId, userId), isNull(workSchedules.effectiveTo))),
      db.insert(workSchedules).values({
        userId,
        pattern,
        effectiveFrom: now,
        changedBy: actor.id,
        note: note ?? null,
      }),
    ])

    await logActivity({
      actorId: actor.id,
      verb: 'updated',
      entityType: 'work_schedule',
      entityId: userId,
      entityLabel: 'working days',
      metadata: { pattern },
    })

    revalidatePath('/admin', 'layout')
    revalidatePath('/worklog')
    return ok(undefined)
  } catch (error) {
    console.error('[schedules] setWorkSchedule', error)
    return err('Something went wrong — try again')
  }
}
