import { and, eq, inArray, isNull, type SQL } from 'drizzle-orm'
import { db } from '@/db'
import { appGrants, appRoleHistory, assignments, users } from '@/db/schema'
import { can, scopeSourceFor, type UserRole } from '@/features/auth/capabilities'

/**
 * The approved, active people who can open ONE project — answered by the
 * capability matrix itself rather than by a hand-written team rule.
 *
 * WHY NOT getTeamForApp. That is the assignments roster, and app.view is
 * wider: a PM/lead reaches the app through app_role_history, a stakeholder
 * through app_grants, and admin/manager/auditor reach every app with no row
 * at all. A pool built from assignments alone would refuse a perfectly
 * visible PM as a reporter and hide them from @-mentions.
 *
 * So each candidate is turned into the same Actor shape loadActor builds —
 * their seat plus "is this app in the scope their seat draws from" — and
 * `can(…, 'app.view', …)` decides. A future change to who sees an app lands
 * here without anybody remembering this file. Employment type is left off on
 * purpose: app.view is not cappable (isCappable), so it cannot change the
 * answer.
 *
 * Not a server action (no 'use server'): callers have already authorised the
 * request, and exporting this from an action module would make it callable
 * from the browser with any appId.
 *
 * Sorted by name in JS rather than ORDER BY, so the result order does not
 * depend on which reads ran; the pool is a studio's headcount, not a table
 * scan worth pushing down.
 */
export async function appViewers(
  appId: string,
  onlyUserIds?: readonly string[],
): Promise<{ id: string; name: string }[]> {
  if (onlyUserIds && onlyUserIds.length === 0) return []
  const filters: SQL[] = [eq(users.active, true), eq(users.status, 'approved')]
  if (onlyUserIds) filters.push(inArray(users.id, [...onlyUserIds]))

  const [people, assigned, granted, managing] = await Promise.all([
    db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(and(...filters)),
    db.select({ userId: assignments.userId }).from(assignments).where(eq(assignments.appId, appId)),
    db.select({ userId: appGrants.userId }).from(appGrants).where(eq(appGrants.appId, appId)),
    db
      .select({ userId: appRoleHistory.userId })
      .from(appRoleHistory)
      .where(
        and(
          eq(appRoleHistory.appId, appId),
          isNull(appRoleHistory.effectiveTo),
          inArray(appRoleHistory.role, ['pm', 'lead']),
        ),
      ),
  ])

  const members = {
    assignments: new Set(assigned.map((r) => r.userId)),
    app_grants: new Set(granted.map((r) => r.userId)),
    app_role_history: new Set(managing.map((r) => r.userId)),
  }

  return people
    .filter((person) => {
      const role = person.role as UserRole
      const source = scopeSourceFor(role)
      const inScope = source !== 'none' && members[source].has(person.id)
      return can({ id: person.id, role, scopeAppIds: new Set(inScope ? [appId] : []) }, 'app.view', { appId })
    })
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
