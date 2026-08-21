'use server'

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { maintenanceWindow } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'
import { requireCapability } from '@/features/auth/actor'
import { getSession } from '@/lib/session'
import { announceScheduled } from './lifecycle'
import { readMaintenanceWindow } from './freeze'
import { noteMaintenanceArmed } from './freeze-snapshot'
import {
  MAINTENANCE_KINDS,
  MAINTENANCE_MODES,
  MAINTENANCE_SINGLETON_ID,
  formatWindowRange,
  type MaintenanceWindow,
} from './window'

const armInput = z
  .object({
    startAtMs: z.number().int(),
    endAtMs: z.number().int(),
    message: z.string().trim().max(1000),
    mode: z.enum([...MAINTENANCE_MODES]),
    kind: z.enum([...MAINTENANCE_KINDS]),
    notifyNow: z.boolean(),
  })
  .refine((value) => value.endAtMs > value.startAtMs, {
    message: 'The window has to end after it starts.',
    path: ['endAtMs'],
  })

/**
 * Arm, or re-arm, the one maintenance window.
 *
 * AN UPSERT ON A SINGLETON, so "schedule tonight" and "push the end back by an
 * hour" are the same call. That is why the notification stamps are NOT reset
 * here: extending a running window keeps its startAtMs, so the stamps still
 * match and nobody is told a second time that maintenance has started. A
 * genuinely new window has a new startAtMs, the stamps stop matching, and it
 * announces itself. One rule, both behaviours.
 *
 * THE PASSWORD IN THE BROWSER IS NOT WHAT GATES THIS. It keeps the console
 * command out of the way of somebody idly typing; this line is the gate.
 */
export async function armMaintenance(
  raw: z.input<typeof armInput>,
): Promise<ActionResult<void>> {
  const parsed = armInput.safeParse(raw)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const actor = await requireCapability('maintenance.manage')
  if (!actor) return err('Not allowed')

  const session = await getSession()
  const createdByName = session?.user?.name?.trim() || 'an admin'
  const { notifyNow, ...window } = parsed.data

  try {
    await db
      .insert(maintenanceWindow)
      .values({
        id: MAINTENANCE_SINGLETON_ID,
        enabled: true,
        ...window,
        createdBy: actor.id,
        createdByName,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: maintenanceWindow.id,
        set: {
          enabled: true,
          ...window,
          createdBy: actor.id,
          createdByName,
          updatedAt: new Date(),
        },
      })
  } catch (error) {
    console.error('[maintenance] arm', error)
    return err('That window could not be saved — try again')
  }

  // This process now knows a window is armed, without waiting for its next
  // read. Without it the write gate would keep short-circuiting on a stale
  // "nothing is armed" until something else happened to read the row.
  noteMaintenanceArmed(true)

  await logActivity({
    actorId: actor.id,
    verb: 'updated',
    entityType: 'maintenance_window',
    entityId: MAINTENANCE_SINGLETON_ID,
    entityLabel: formatWindowRange(window.startAtMs, window.endAtMs),
    detail: `${window.kind} · ${window.mode}`,
  })

  if (notifyNow) {
    await announceScheduled({
      ...window,
      enabled: true,
      createdBy: actor.id,
      createdByName,
    } satisfies MaintenanceWindow)
  }

  revalidatePath('/', 'layout')
  return ok(undefined)
}

/**
 * Call the whole thing off.
 *
 * Announces NOTHING, deliberately: a window that never started has no "we're
 * back online" to send, and telling everyone the app has returned from an
 * outage it never had is worse than saying nothing.
 */
export async function cancelMaintenance(): Promise<ActionResult<void>> {
  const actor = await requireCapability('maintenance.manage')
  if (!actor) return err('Not allowed')

  try {
    await db
      .update(maintenanceWindow)
      .set({ enabled: false, updatedAt: new Date() })
      .where(eq(maintenanceWindow.id, MAINTENANCE_SINGLETON_ID))
  } catch (error) {
    console.error('[maintenance] cancel', error)
    return err('That could not be cancelled — try again')
  }

  noteMaintenanceArmed(false)
  await logActivity({
    actorId: actor.id,
    verb: 'deleted',
    entityType: 'maintenance_window',
    entityId: MAINTENANCE_SINGLETON_ID,
    entityLabel: 'Maintenance cancelled',
  })
  revalidatePath('/', 'layout')
  return ok(undefined)
}

/**
 * The work finished early.
 *
 * Moves the END to now rather than switching `enabled` off, which looks like
 * the long way round and is not: an ended-but-enabled window is exactly the
 * state the lifecycle already knows how to finish, so ending early sends the
 * same "we're back online" everyone would have got at 06:00, through the same
 * code path, and the lifecycle flips `enabled` off as it claims it. Switching
 * `enabled` off here instead would unlock the app silently.
 */
export async function endMaintenanceNow(): Promise<ActionResult<void>> {
  const actor = await requireCapability('maintenance.manage')
  if (!actor) return err('Not allowed')

  const current = await readMaintenanceWindow()
  if (!current || !current.enabled) return err('There is no maintenance window running')

  const now = Date.now()
  try {
    await db
      .update(maintenanceWindow)
      // Never earlier than the start: a zero-length window fails the parser's
      // `end > start` rule, which would make the row unreadable rather than
      // finished, and an unreadable row never announces that it is over.
      .set({ endAtMs: Math.max(now, current.startAtMs + 1_000), updatedAt: new Date() })
      .where(eq(maintenanceWindow.id, MAINTENANCE_SINGLETON_ID))
  } catch (error) {
    console.error('[maintenance] end now', error)
    return err('That could not be ended — try again')
  }

  await logActivity({
    actorId: actor.id,
    verb: 'updated',
    entityType: 'maintenance_window',
    entityId: MAINTENANCE_SINGLETON_ID,
    entityLabel: 'Maintenance ended early',
  })
  revalidatePath('/', 'layout')
  return ok(undefined)
}

/**
 * The window, for the client to poll.
 *
 * NO CAPABILITY CHECK, and no session requirement. Everyone who can reach the
 * app has to be told it is closing, including the person still on /sign-in —
 * and the row says nothing an announcement would not have said out loud.
 */
export async function fetchMaintenanceWindow(): Promise<MaintenanceWindow | null> {
  return readMaintenanceWindow()
}
