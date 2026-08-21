import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { appGrants, appRoleHistory, assignments, users } from '@/db/schema'
import { cache } from 'react'
import { getSession } from '@/lib/session'
import {
  ROLE_GRANTS,
  can,
  effectiveGrant,
  isCappable,
  scopeSourceFor,
  type Action,
  type Actor,
  type Resource,
  type UserRole,
} from '@/features/auth/capabilities'
import { maintenanceActiveNow } from '@/features/maintenance/freeze'
import { isFrozenByMaintenance } from '@/features/maintenance/write-actions'

export { scopeSourceFor, type ScopeSource } from '@/features/auth/capabilities'

const EMPTY_SCOPE: ReadonlySet<string> = new Set()

/**
 * ONE query per request. Every `can()` call afterwards is a pure lookup
 * against the set this returns — which is why `can` stays synchronous and can
 * be imported by client components.
 *
 * DEACTIVATION IS CHECKED HERE, at construction, and again in
 * `requireCapability` below — the only two places an `Actor` is ever made.
 * A deactivated person holds a real session on purpose (src/lib/auth.ts: it
 * is the only way to tell them why, and to let them sign out), so "signed in"
 * stopped implying "may act" the moment that changed. No Actor means every
 * `can()` in the app answers no, without any of the ~90 server actions having
 * to remember the rule. Putting it in the actions instead would mean the next
 * action somebody writes is one deactivation forgot about.
 *
 * `user.active` is not a stale copy of the column: the jwt callback re-reads
 * users.active on every request, so this is per-request truth and costs no
 * query of its own.
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
  // `=== false` for the reason spelled out on requireCapability below: the
  // session callback normalises this to a boolean with `token.active !==
  // false`, so absent means "no claim", not "deactivated".
  if (user.active === false) return null

  const role = user.role as UserRole
  // Not on the session: employment type changes rarely but must take effect on
  // the next request like every other permission input, and threading it
  // through the JWT would mean a stale cap until re-login.
  const [row] = await db
    .select({ employmentType: users.employmentType })
    .from(users)
    .where(eq(users.id, user.id))
  const employmentType = row?.employmentType

  const source = scopeSourceFor(role)
  if (source === 'none') {
    return { id: user.id, role, employmentType, scopeAppIds: new Set() }
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

  return { id: user.id, role, employmentType, scopeAppIds: new Set(rows.map((r) => r.appId)) }
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
  // Before the matrix is consulted at all: deactivation is not a narrower
  // seat, it is the absence of one. See the note on loadActor above.
  //
  // `=== false`, not `!active`: the session callback in src/lib/auth.ts writes
  // `active = token.active !== false`, so an explicit false is the only signal
  // meaning deactivated. Treating absent-or-undefined as deactivated would
  // read a token minted before the field existed as a locked-out account.
  if (user.active === false) return null
  const role = user.role as UserRole

  // MAINTENANCE FREEZE, before the matrix and before any query.
  //
  // The database gate in src/db/write-gate.ts is the one that cannot be
  // bypassed; this is the one that refuses politely. Coming through here means
  // the ~100 actions that call this guard turn a frozen write into their
  // existing `if (!actor) return err(...)` path — a refused action rather than
  // a thrown error surfacing as "something went wrong". The fourteen write
  // paths that never call this guard are exactly why the database gate exists
  // as well; neither layer is sufficient alone.
  //
  // Reads are untouched. A window that blanked the pages explaining itself
  // would be a worse outage than the maintenance.
  if (isFrozenByMaintenance(action) && ROLE_GRANTS['maintenance.manage'][role] === 'none') {
    if (await maintenanceActiveNow()) return null
  }

  // Resolve the scope set ONLY when the grant actually depends on it. A
  // refusal, a workspace-wide 'all', and an ownership check are all decidable
  // from the session alone, so the common paths never touch the database —
  // and a denied action no longer pays for a query whose answer it discards.
  // The seat's own answer first: a refusal needs nothing else, and most
  // actions cannot be capped by any employment stage, so they need no read.
  if (ROLE_GRANTS[action][role] === 'none') return null

  // Only a cappable action pays for the employment type. Skipping the read
  // when no stage withholds the action is what keeps the cap from putting a
  // query in front of every permission question in the app.
  const employmentType = isCappable(action)
    ? (await db
        .select({ employmentType: users.employmentType })
        .from(users)
        .where(eq(users.id, user.id)))[0]?.employmentType
    : undefined

  const level = effectiveGrant(role, employmentType, action)
  if (level === 'none') return null
  if (level === 'all' || level === 'own') {
    const actor: Actor = { id: user.id, role, employmentType, scopeAppIds: EMPTY_SCOPE }
    return can(actor, action, resource) ? actor : null
  }

  const actor = await loadActor()
  if (!actor) return null
  return can(actor, action, resource) ? actor : null
}
