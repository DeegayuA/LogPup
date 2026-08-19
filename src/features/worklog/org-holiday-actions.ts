'use server'

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { orgHolidays } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'
import { requireCapability } from '@/features/auth/actor'

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
 * A PLAIN DELETE, deliberately, and named in live.test.ts's
 * DELETE_ALLOWED_FUNCTIONS.
 *
 * A cancelled company holiday did not happen. A tombstone would make every
 * coverage read filter for it forever, and there is nothing here a person
 * would be distressed to lose — the activity_log row is the record.
 */
export async function revokeOrgHoliday(raw: { id: string }): Promise<ActionResult<void>> {
  const actor = await requireCapability('holiday.manage')
  if (!actor) return err('Not allowed')

  try {
    const [row] = await db
      .select({ day: orgHolidays.day, name: orgHolidays.name })
      .from(orgHolidays)
      .where(eq(orgHolidays.id, raw.id))
    if (!row) return err('That holiday no longer exists')

    await db.delete(orgHolidays).where(eq(orgHolidays.id, raw.id))
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
