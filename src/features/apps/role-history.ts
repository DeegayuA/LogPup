/**
 * Pure "as of" logic for app_role_history (src/db/schema.ts) — the
 * assignment_history pattern (features/people/allocation-history.ts) applied
 * to apps.pmId / apps.leadId. No database import here on purpose: the SQL
 * layer (features/apps/queries.ts for the per-app read, features/people/
 * queries.ts for the per-person one) pre-filters with the same predicate and
 * routes its rows through these functions anyway, so the whole rule is
 * unit-tested without a database and cannot drift between the two call
 * sites.
 */

export type AppRoleKind = 'pm' | 'lead'

/** The half-open interval a history row describes: [effectiveFrom, effectiveTo). */
export type AppRoleInterval = {
  effectiveFrom: Date
  effectiveTo: Date | null
}

/**
 * The sentinel `note` migration 0034 stamps on every row it backfills — a
 * fixed, exact-match string rather than a description, so a consumer can tell
 * "we watched this happen" from "we assumed this at migration time" with a
 * plain equality check (see `isBackfilled` below, and the migration's own
 * comment for the incident that made this non-negotiable: migration 0015
 * backfilled assignment_history with an effective_from indistinguishable
 * from an observed one, and a whole planned feature had to drop as-of
 * allocation as untrustworthy as a result).
 */
export const BACKFILLED_APP_ROLE_NOTE = 'backfilled at migration'

/** True for a row this project assumed at migration time, not one it watched happen. */
export function isBackfilled(note: string | null): boolean {
  return note === BACKFILLED_APP_ROLE_NOTE
}

/**
 * Whoever held `role` at instant `at`, using the half-open interval
 * [effectiveFrom, effectiveTo) — identical convention to assignment_history /
 * selectRowsAsOf in features/people/allocation-history.ts: a change closes
 * the old row and opens the new one from the SAME instant, so at exactly that
 * instant the new row wins and never both.
 *
 * `rows` is expected to already be scoped to one app (the SQL layer filters
 * on appId), so at most one row can ever match: app_role_history_one_open_idx
 * guarantees at most one open row per (appId, role), and closed intervals for
 * that pairing never overlap for the same reason. Returns null both before
 * any history exists and after a lead is cleared with nobody appointed since
 * — the same row, a closed interval with nothing reopened, describes both.
 */
export function appRoleAsOf<T extends AppRoleInterval & { role: AppRoleKind }>(
  rows: T[],
  role: AppRoleKind,
  at: Date,
): T | null {
  const t = at.getTime()
  const match = rows.find(
    (row) =>
      row.role === role &&
      row.effectiveFrom.getTime() <= t &&
      (row.effectiveTo === null || row.effectiveTo.getTime() > t),
  )
  return match ?? null
}

/**
 * Newest-first, with a `backfilled` flag so the UI can say "assumed at
 * migration time" instead of presenting a backfilled date as an observed
 * fact. Generic over the row shape so the same function serves both the
 * per-app timeline (features/apps/queries.ts, one row per holder, needs the
 * holder's name) and the per-person view (features/people/queries.ts, one row
 * per app the person has held a role on, needs the app's name) without
 * duplicating the sort-and-flag step in each.
 */
export function buildRoleTimeline<T extends { effectiveFrom: Date; note: string | null }>(
  rows: T[],
): (T & { backfilled: boolean })[] {
  return [...rows]
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())
    .map((row) => ({ ...row, backfilled: isBackfilled(row.note) }))
}

export type AppRoleEntryInput = {
  appId: string
  userId: string
  role: AppRoleKind
  changedBy: string
  at: Date
  note?: string | null
}

export type AppRoleEntry = {
  appId: string
  userId: string
  role: AppRoleKind
  effectiveFrom: Date
  effectiveTo: null
  changedBy: string
  note: string | null
}

/**
 * Builds the row a PM/lead change appends. Always opens a new interval
 * (`effectiveTo: null`) — closing the previous one, when there is one, is a
 * separate statement in the same db.batch, driven by the same `at` (see
 * createApp / updateApp in features/apps/actions.ts).
 */
export function buildAppRoleEntry(input: AppRoleEntryInput): AppRoleEntry {
  return {
    appId: input.appId,
    userId: input.userId,
    role: input.role,
    effectiveFrom: input.at,
    effectiveTo: null,
    changedBy: input.changedBy,
    note: input.note ?? null,
  }
}
