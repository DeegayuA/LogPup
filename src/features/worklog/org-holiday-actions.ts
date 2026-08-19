'use server'

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { orgHolidays } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'
import { requireCapability } from '@/features/auth/actor'
import { toIsoDateInTimeZone } from '@/lib/lk-holidays'

const addInput = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(1).max(120),
  note: z.string().trim().max(200).optional(),
})

/** A company shutdown day, composed on top of the gazetted calendar. */
export async function addOrgHoliday(raw: z.input<typeof addInput>): Promise<ActionResult<void>> {
  const parsed = addInput.safeParse(raw)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const actor = await requireCapability('holiday.manage')
  if (!actor) return err('Not allowed')

  try {
    await db.insert(orgHolidays).values({ ...parsed.data, note: parsed.data.note ?? null, createdBy: actor.id })
    await logActivity({
      actorId: actor.id,
      verb: 'created',
      entityType: 'org_holiday',
      entityId: parsed.data.day,
      entityLabel: parsed.data.name,
    })
    revalidatePath('/admin', 'layout')
    revalidatePath('/worklog')
    return ok(undefined)
  } catch (error) {
    console.error('[org-holidays] add', error)
    return err('That day may already be a company holiday')
  }
}

/**
 * Cancel a company holiday WITHOUT rewriting the past.
 *
 * Not a delete. `isHoliday` is evaluated at read time from this table, so
 * removing the row would make that day recompute as owed for everyone,
 * retroactively — somebody correctly excused in August would acquire a
 * missing day in November, with nothing on screen to explain it. That is the
 * silent history rewrite the whole absence feature exists to prevent.
 *
 * `revokedFrom` is the day the cancellation takes effect, so a holiday people
 * have already taken stays taken. Cancelling one that has not happened yet
 * works exactly as an operator expects.
 */
export async function revokeOrgHoliday(raw: { id: string }): Promise<ActionResult<void>> {
  const actor = await requireCapability('holiday.manage')
  if (!actor) return err('Not allowed')

  try {
    const [row] = await db
      .select({ day: orgHolidays.day, name: orgHolidays.name, revokedFrom: orgHolidays.revokedFrom })
      .from(orgHolidays)
      .where(eq(orgHolidays.id, raw.id))
    if (!row) return err('That holiday no longer exists')
    if (row.revokedFrom) return err('That holiday is already cancelled')

    // Today in Colombo — never a UTC slice, which would cancel a day early or
    // late for half the working week.
    const today = toIsoDateInTimeZone(new Date())
    await db
      .update(orgHolidays)
      .set({ revokedFrom: today, revokedBy: actor.id })
      .where(eq(orgHolidays.id, raw.id))
    await logActivity({
      actorId: actor.id,
      verb: 'deleted',
      entityType: 'org_holiday',
      entityId: row.day,
      entityLabel: row.name,
    })
    revalidatePath('/admin', 'layout')
    revalidatePath('/worklog')
    return ok(undefined)
  } catch (error) {
    console.error('[org-holidays] revoke', error)
    return err('Something went wrong — try again')
  }
}
