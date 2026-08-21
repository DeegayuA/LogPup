import { after } from 'next/server'
import { getSession } from '@/lib/session'
import type { UserRole } from '@/features/auth/capabilities'
import { readMaintenanceWindow } from '../freeze'
import { runMaintenanceLifecycle } from '../lifecycle'
import { MaintenanceGate } from './maintenance-gate'

/**
 * Reads the window once per request and hands it to the client gate.
 *
 * MOUNTED IN THE ROOT LAYOUT, not the (app) one, because two of the four
 * surfaces belong outside the authenticated shell: the slim notice on
 * /sign-in, and the console command an admin needs when the shell is exactly
 * what has stopped working.
 *
 * THE LIFECYCLE RIDES THIS REQUEST. `after` runs it once the response has been
 * sent, so announcing "maintenance has started" never delays a page — and it
 * is scheduled ONLY when a window is actually armed, so the ordinary request
 * pays nothing at all. See lifecycle.ts for why this is request-driven rather
 * than a cron job.
 */
export async function MaintenanceMount() {
  const [state, session] = await Promise.all([readMaintenanceWindow(), getSession()])
  if (state?.enabled) after(runMaintenanceLifecycle)
  return (
    <MaintenanceGate
      initialWindow={state}
      role={(session?.user?.role as UserRole | undefined) ?? null}
    />
  )
}
