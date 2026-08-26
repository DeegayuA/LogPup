import { and, eq, gt, isNull, inArray } from 'drizzle-orm'
import { db } from '@/db'
import {
  absences,
  appGrants,
  appRoleHistory,
  assignments,
  changeRequests,
  users,
} from '@/db/schema'
import { liveApps, liveMeetings, liveTasks } from '@/db/live'
import { can, type Actor } from '@/features/auth/capabilities'
import { NON_TRANSFERABLE, type TransferableGroup } from '@/features/people/handover-inventory'
import { OPEN_STATUSES } from '@/features/sprints/board-view'

export type HandoverItem = {
  id: string
  label: string
  appId: string | null
  /** Only set for assignments: the percentage that must be preserved on split. */
  allocationPct?: number
  /**
   * Only set for assignments: the leaver's own free-text project role,
   * carried across on transfer rather than invented — applyHandover requires
   * it, and the form used to have no way to supply it (which is how
   * allocations ended up hardcoded to [] on submit).
   */
  role?: string
  /** Only set for app_roles: the structural pm/lead kind, straight from the
   *  row — the form used to GUESS it from the display label's suffix. */
  roleKind?: 'pm' | 'lead'
}

export type HandoverGroup = {
  group: TransferableGroup
  label: string
  items: HandoverItem[]
}

export type HandoverInventory = {
  user: { id: string; name: string; email: string }
  groups: HandoverGroup[]
  total: number
  nonTransferable: typeof NON_TRANSFERABLE
}

/**
 * Everything a departing person still holds.
 *
 * Grouped and counted so the operator can transfer one kind at a time — "all
 * of it to one person" is the common case, but a leaver's twelve tasks and
 * their two PM roles rarely belong to the same successor.
 */
export async function getHandoverInventory(
  actor: Actor,
  userId: string,
): Promise<HandoverInventory | null> {
  if (!can(actor, 'user.offboard', { ownerId: userId })) return null

  const [person] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
  if (!person) return null

  const [assignmentRows, roleRows, taskRows, meetingRows, requestRows, absenceRows, grantRows] =
    await Promise.all([
      db
        .select({
          id: assignments.id,
          appId: assignments.appId,
          appName: liveApps.name,
          pct: assignments.allocationPct,
          role: assignments.role,
        })
        .from(assignments)
        .innerJoin(liveApps, eq(liveApps.id, assignments.appId))
        .where(eq(assignments.userId, userId)),
      db
        .select({ id: appRoleHistory.id, appId: appRoleHistory.appId, appName: liveApps.name, role: appRoleHistory.role })
        .from(appRoleHistory)
        .innerJoin(liveApps, eq(liveApps.id, appRoleHistory.appId))
        .where(and(eq(appRoleHistory.userId, userId), isNull(appRoleHistory.effectiveTo))),
      db
        .select({ id: liveTasks.id, title: liveTasks.title, appId: liveTasks.appId })
        .from(liveTasks)
        .where(and(eq(liveTasks.assigneeId, userId), inArray(liveTasks.status, OPEN_STATUSES))),
      db
        // liveMeetings, not meetings: a trashed meeting is not open work, and
        // handing one over would resurrect it into somebody's list.
        .select({ id: liveMeetings.id, title: liveMeetings.title, startsAt: liveMeetings.startsAt })
        .from(liveMeetings)
        .where(and(eq(liveMeetings.createdBy, userId), gt(liveMeetings.startsAt, new Date()))),
      db
        .select({ id: changeRequests.id, label: changeRequests.entityLabel, appId: changeRequests.appId })
        .from(changeRequests)
        .where(and(eq(changeRequests.requesterId, userId), eq(changeRequests.status, 'pending'))),
      db
        .select({ id: absences.id, kind: absences.kind, startDate: absences.startDate })
        .from(absences)
        .where(and(eq(absences.userId, userId), eq(absences.status, 'pending'))),
      db
        .select({ id: appGrants.id, appId: appGrants.appId, appName: liveApps.name })
        .from(appGrants)
        .innerJoin(liveApps, eq(liveApps.id, appGrants.appId))
        .where(eq(appGrants.userId, userId)),
    ])

  const groups: HandoverGroup[] = [
    {
      group: 'assignments',
      label: 'Project allocations',
      items: assignmentRows.map((r) => ({
        id: r.id, label: r.appName, appId: r.appId, allocationPct: r.pct ?? 0, role: r.role,
      })),
    },
    {
      group: 'app_roles',
      label: 'PM and lead roles',
      items: roleRows.map((r) => ({
        id: r.id,
        label: `${r.appName} — ${r.role}`,
        appId: r.appId,
        roleKind: r.role,
      })),
    },
    {
      group: 'tasks',
      label: 'Open tasks',
      items: taskRows.map((r) => ({ id: r.id, label: r.title, appId: r.appId })),
    },
    {
      group: 'meetings',
      label: 'Upcoming meetings they created',
      items: meetingRows.map((r) => ({ id: r.id, label: r.title, appId: null })),
    },
    {
      group: 'followups',
      label: 'Unresolved follow-ups',
      items: [],
    },
    {
      group: 'change_requests',
      label: 'Change requests they filed',
      items: requestRows.map((r) => ({ id: r.id, label: r.label, appId: r.appId })),
    },
    {
      group: 'absences',
      label: 'Leave awaiting approval',
      items: absenceRows.map((r) => ({ id: r.id, label: `${r.kind} from ${r.startDate}`, appId: null })),
    },
    {
      group: 'app_grants',
      label: 'Stakeholder access',
      items: grantRows.map((r) => ({ id: r.id, label: r.appName, appId: r.appId })),
    },
  ]

  return {
    user: person,
    groups: groups.filter((g) => g.items.length > 0),
    total: groups.reduce((sum, g) => sum + g.items.length, 0),
    nonTransferable: NON_TRANSFERABLE,
  }
}

/** Just the count, for the deactivation gate. */
export async function countTransferableWork(userId: string): Promise<number> {
  const [a, r, t] = await Promise.all([
    db.select({ id: assignments.id }).from(assignments).where(eq(assignments.userId, userId)),
    db
      .select({ id: appRoleHistory.id })
      .from(appRoleHistory)
      .where(and(eq(appRoleHistory.userId, userId), isNull(appRoleHistory.effectiveTo))),
    db
      .select({ id: liveTasks.id })
      .from(liveTasks)
      .where(and(eq(liveTasks.assigneeId, userId), inArray(liveTasks.status, OPEN_STATUSES))),
  ])
  return a.length + r.length + t.length
}
