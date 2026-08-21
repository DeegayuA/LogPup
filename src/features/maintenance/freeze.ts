import { cache } from 'react'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { maintenanceWindow } from '@/db/schema'
import {
  MAINTENANCE_SINGLETON_ID,
  maintenancePhase,
  parseMaintenanceWindow,
  type MaintenancePhase,
  type MaintenanceWindow,
} from './window'
import { maintenanceMightBeArmed, noteMaintenanceArmed } from './freeze-snapshot'

/** The row as stored, stamps included. Unvalidated — parse before acting. */
export type MaintenanceRow = {
  enabled: unknown
  startAtMs: unknown
  endAtMs: unknown
  message: unknown
  mode: unknown
  kind: unknown
  createdBy: unknown
  createdByName: unknown
  startNotifiedAtMs: number | null
  endNotifiedAtMs: number | null
}

/**
 * The one read of the maintenance row, deduplicated per request.
 *
 * React.cache for the same reason getSession has it: the root layout, the
 * write gate, the lifecycle and the capability guard all want this answer
 * inside one request, and four identical primary-key lookups for one page
 * render is three too many. Nothing survives the request, so one viewer's
 * window can never be handed to another's render.
 *
 * THE STAMPS COME BACK WITH IT so the lifecycle can decide "already announced"
 * without buying a second query on every request that renders the app.
 *
 * A FAILED READ IS "NO MAINTENANCE", NOT AN ERROR. If this table is missing —
 * a deploy that ran ahead of its migration — throwing here would take down
 * every page in the app rather than the feature that needs it. The whole
 * design of this feature is that its absence, its malformation and its failure
 * all read the same as nobody having armed anything.
 */
export const readMaintenanceRow = cache(async function readMaintenanceRow(): Promise<MaintenanceRow | null> {
  try {
    const rows = await db
      .select({
        enabled: maintenanceWindow.enabled,
        startAtMs: maintenanceWindow.startAtMs,
        endAtMs: maintenanceWindow.endAtMs,
        message: maintenanceWindow.message,
        mode: maintenanceWindow.mode,
        kind: maintenanceWindow.kind,
        createdBy: maintenanceWindow.createdBy,
        createdByName: maintenanceWindow.createdByName,
        startNotifiedAtMs: maintenanceWindow.startNotifiedAtMs,
        endNotifiedAtMs: maintenanceWindow.endNotifiedAtMs,
      })
      .from(maintenanceWindow)
      .where(eq(maintenanceWindow.id, MAINTENANCE_SINGLETON_ID))
    return (rows[0] as MaintenanceRow | undefined) ?? null
  } catch (error) {
    console.error('[maintenance] window read', error)
    return null
  }
})

/** The validated window, or null for "no maintenance". */
export async function readMaintenanceWindow(): Promise<MaintenanceWindow | null> {
  const parsed = parseMaintenanceWindow(await readMaintenanceRow())
  // 'enabled', not 'active': a window scheduled for tonight must keep this
  // process paying for real checks, or it would skip every read right up to
  // the moment it was supposed to start and never notice that it had.
  noteMaintenanceArmed(parsed?.enabled === true)
  return parsed
}

/** The window and its phase, as one request-scoped answer. */
export async function readMaintenancePhase(): Promise<{
  window: MaintenanceWindow | null
  phase: MaintenancePhase
}> {
  const window = await readMaintenanceWindow()
  return { window, phase: maintenancePhase(window, Date.now()) }
}

/**
 * Is a window ACTIVE this instant — not scheduled, not ended.
 *
 * Skips the read entirely when this process has already proven nothing is
 * armed, which is what keeps the write gate off the database on every ordinary
 * day. See freeze-snapshot.ts.
 */
export async function maintenanceActiveNow(): Promise<boolean> {
  if (!maintenanceMightBeArmed()) return false
  const window = await readMaintenanceWindow()
  return maintenancePhase(window, Date.now()) === 'active'
}
