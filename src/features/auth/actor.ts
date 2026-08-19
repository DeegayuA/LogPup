import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { appGrants, appRoleHistory, assignments } from '@/db/schema'
import { cache } from 'react'
import { getSession } from '@/lib/session'
import {
  ROLE_GRANTS,
  can,
  scopeSourceFor,
  type Action,
  type Actor,
  type Resource,
  type UserRole,
} from '@/features/auth/capabilities'

export { scopeSourceFor, type ScopeSource } from '@/features/auth/capabilities'

const EMPTY_SCOPE: ReadonlySet<string> = new Set()

/**
 * ONE query per request. Every `can()` call afterwards is a pure lookup
 * against the set this returns — which is why `can` stays synchronous and can
 * be imported by client components.
 */
export const loadActor = cache(async function loadActor(): Promise<Actor | null> {
  // Deduplicated per request, for the same reason getSession exists: auth()'s
  // jwt callback hits the database on EVERY call, and the (app) layout has
  // already paid for it. Without this, every page that asks a capability
  // question buys a second identical `select … from users where email = ?`,
  // and a Suspense-split page buys one per streamed zone.
  const session = await getSession()
  const user = session?.user
  if (!user?.id) return null

  const role = user.role as UserRole
  const source = scopeSourceFor(role)
  if (source === 'none') {
    return { id: user.id, role, scopeAppIds: new Set() }
  }

  const rows =
    source === 'app_role_history'
      ? await db
          .select({ appId: appRoleHistory.appId })
          .from(appRoleHistory)
          .where(
            and(
              eq(appRoleHistory.userId, user.id),
              isNull(appRoleHistory.effectiveTo),
              inArray(appRoleHistory.role, ['pm', 'lead']),
            ),
          )
      : source === 'assignments'
        ? await db
            .select({ appId: assignments.appId })
            .from(assignments)
            .where(eq(assignments.userId, user.id))
        : await db
            .select({ appId: appGrants.appId })
            .from(appGrants)
            .where(eq(appGrants.userId, user.id))

  return { id: user.id, role, scopeAppIds: new Set(rows.map((r) => r.appId)) }
})

/**
 * The guard every server action uses.
 *
 * Returns the actor on success and null on refusal — the same contract the
 * seven duplicated `requireAdmin()` copies had, so their call sites keep their
 * `if (!x) return err(...)` shape unchanged.
 */
export async function requireCapability(
  action: Action,
  resource?: Resource,
): Promise<Actor | null> {
  const session = await getSession()
  const user = session?.user
  if (!user?.id) return null
  const role = user.role as UserRole

  // Resolve the scope set ONLY when the grant actually depends on it. A
  // refusal, a workspace-wide 'all', and an ownership check are all decidable
  // from the session alone, so the common paths never touch the database —
  // and a denied action no longer pays for a query whose answer it discards.
  const level = ROLE_GRANTS[action][role]
  if (level === 'none') return null
  if (level === 'all' || level === 'own') {
    const actor: Actor = { id: user.id, role, scopeAppIds: EMPTY_SCOPE }
    return can(actor, action, resource) ? actor : null
  }

  const actor = await loadActor()
  if (!actor) return null
  return can(actor, action, resource) ? actor : null
}
