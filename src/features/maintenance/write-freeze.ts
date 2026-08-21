import { getSession } from '@/lib/session'
import { ROLE_GRANTS, type UserRole } from '@/features/auth/capabilities'
import { maintenanceActiveNow, readMaintenanceWindow } from './freeze'
import { formatClock } from './window'
import { LK_TIMEZONE } from '@/lib/lk-holidays'

/**
 * Thrown by the database gate when a write lands inside an active window.
 *
 * A named class rather than a bare Error so a call site that wants to say
 * something better than its own generic catch message can tell this apart from
 * a genuine failure — `error instanceof MaintenanceFreezeError`.
 */
export class MaintenanceFreezeError extends Error {
  readonly code = 'MAINTENANCE_FREEZE'
  constructor(message: string) {
    super(message)
    this.name = 'MaintenanceFreezeError'
  }
}

/**
 * The spec's `canWrite()`, in the only two things it can depend on: is a
 * window active, and does this session hold the seat that outranks it.
 *
 * ROLE, NOT ACTOR. A seat lookup in the matrix answers "may this person manage
 * maintenance" with no query at all, where loadActor() costs one or two. On a
 * gate that runs in front of every write, that difference is the whole budget.
 * The narrower per-resource questions are still asked by requireCapability;
 * this only decides whether the door is open at all.
 *
 * NO SESSION MEANS FROZEN. Everything that legitimately writes without one —
 * sign-in, the activity log, the lifecycle announcements — writes to a table
 * the gate exempts by name, so failing closed here costs nothing and stops an
 * unauthenticated path from being the hole in the freeze.
 */
export function canManageMaintenance(role: string | undefined | null): boolean {
  if (!role) return false
  return ROLE_GRANTS['maintenance.manage'][role as UserRole] === 'all'
}

export async function maintenanceWriteFrozen(): Promise<boolean> {
  if (!(await maintenanceActiveNow())) return false
  const session = await getSession()
  return !canManageMaintenance(session?.user?.role)
}

/** The sentence a frozen write reports. Names the time, so it is actionable. */
export async function maintenanceFreezeMessage(): Promise<string> {
  const window = await readMaintenanceWindow()
  const back = window ? formatClock(window.endAtMs, LK_TIMEZONE) : null
  return back
    ? `LogPup is in maintenance — nothing can be changed until ${back}.`
    : 'LogPup is in maintenance — nothing can be changed right now.'
}

/** Throws when the current request may not write. The database gate's guard. */
export async function assertWritable(): Promise<void> {
  if (!(await maintenanceWriteFrozen())) return
  throw new MaintenanceFreezeError(await maintenanceFreezeMessage())
}
