'use server'

import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { appGrants } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'
import { requireCapability } from '@/features/auth/actor'

const grantInput = z.object({
  userId: z.string().uuid(),
  appId: z.string().uuid(),
})

/** The stakeholder seat's reach: explicit, per-app, read-only. */
export async function grantAppAccess(raw: z.input<typeof grantInput>): Promise<ActionResult<void>> {
  const parsed = grantInput.safeParse(raw)
  if (!parsed.success) return err('Check the request and try again')

  const actor = await requireCapability('app.grant.stakeholder', { appId: parsed.data.appId })
  if (!actor) return err('Not allowed')

  try {
    await db.insert(appGrants).values({ ...parsed.data, grantedBy: actor.id })
    await logActivity({
      actorId: actor.id,
      verb: 'assigned',
      entityType: 'app_grant',
      entityId: parsed.data.appId,
      entityLabel: 'stakeholder access',
      appId: parsed.data.appId,
      metadata: { userId: parsed.data.userId },
    })
    revalidatePath('/admin', 'layout')
    return ok(undefined)
  } catch {
    return err('That person already has access to this project')
  }
}

/**
 * A PLAIN DELETE, deliberately, and named in live.test.ts's
 * DELETE_ALLOWED_FUNCTIONS.
 *
 * This is an access key, exactly like webauthn_credentials. Revocation must be
 * absolute: a restorable grant is a key that can come back from the dead, and
 * "we thought we removed that client's access" is not a sentence anyone wants
 * to say. The activity_log row is the record that it existed.
 */
export async function revokeAppGrant(raw: z.input<typeof grantInput>): Promise<ActionResult<void>> {
  const parsed = grantInput.safeParse(raw)
  if (!parsed.success) return err('Check the request and try again')

  const actor = await requireCapability('app.grant.stakeholder', { appId: parsed.data.appId })
  if (!actor) return err('Not allowed')

  try {
    await db
      .delete(appGrants)
      .where(and(eq(appGrants.userId, parsed.data.userId), eq(appGrants.appId, parsed.data.appId)))
    await logActivity({
      actorId: actor.id,
      verb: 'unassigned',
      entityType: 'app_grant',
      entityId: parsed.data.appId,
      entityLabel: 'stakeholder access',
      appId: parsed.data.appId,
      metadata: { userId: parsed.data.userId },
    })
    revalidatePath('/admin', 'layout')
    return ok(undefined)
  } catch (error) {
    console.error('[app-grants] revoke', error)
    return err('Something went wrong — try again')
  }
}
