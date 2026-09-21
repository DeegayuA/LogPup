import type { Action, Actor, AppChangePolicy } from '@/features/auth/capabilities'
import { needsSignoff } from '@/features/auth/capabilities'
import { createChangeRequest } from '@/features/admin/change-request-actions'

/**
 * Where an already-authorised `app.edit`/`app.archive` write gets routed to
 * the project's tech lead instead of landing directly.
 *
 * INTERCEPT POINT: called from inside the server action, AFTER
 * `requireCapability` and AFTER the row read/parse, BEFORE the `db.batch`
 * that writes `apps` — so deactivation, the employment cap and the
 * maintenance freeze all win first. A maintenance freeze REFUSES the write
 * outright (`requireCapability` throws before this ever runs); it never
 * queues, per Decision 16 — auto-approving a queue when a freeze lifts is a
 * mass write on the requester's behalf, exactly what the row exists to
 * prevent.
 *
 * RESULT SHAPE at the two call sites (`updateApp`, `archiveApp`): `null`
 * means "proceed with your own direct write, exactly as today" — the caller
 * keeps writing `apps` itself. `{ id }` means the caller must NOT write
 * `apps`; it returns `ok({ queued: id })` instead. `ActionResult` itself is
 * unchanged — the UI tells the two apart with `'queued' in res.data`.
 *
 * STALE-PRE-IMAGE TRAP: `req.before` must be the FULL live row, not just the
 * fields the caller happens to touch. `detectConflict` (run when this
 * request is later approved) diffs only the fields PRESENT in `before` — a
 * partial `before` makes every field left out of it invisible to that
 * check, so a concurrent edit to a field this request never touched is
 * silently clobbered on approval.
 *
 * NOTHING CALLS THIS YET. `updateApp`/`archiveApp` still write `apps`
 * directly. The wiring step lands together with the `schema.ts`
 * `changePolicy` column, once migration 0072 is applied — a declared column
 * on an unapplied migration is a live 42703 on every read of `apps` for
 * every parallel session (memory: logpup-schema-declaration-is-live), so
 * `gate` stays a caller-supplied PARAMETER here rather than a `db` read.
 */
export async function routeForSignoff(
  actor: Actor,
  req: {
    action: Action
    entityId: string
    entityLabel: string
    appId: string
    gate: { changePolicy: AppChangePolicy; leadId: string | null }
    operation: 'edit'
    before: Record<string, unknown>
    after: Record<string, unknown>
    reason: string
  },
): Promise<{ id: string } | null> {
  if (!needsSignoff(actor, req.action, req.gate)) return null

  // Files through the SAME internal path createChangeRequest uses — no
  // duplicate insert here. entityType 'app' + the app-only field allowlist
  // are enforced inside createChangeRequest itself (change-request-actions.ts,
  // APP_REQUESTABLE_FIELDS), not re-checked in this file.
  const filed = await createChangeRequest({
    entityType: 'app',
    entityId: req.entityId,
    entityLabel: req.entityLabel,
    operation: req.operation,
    appId: req.appId,
    reason: req.reason,
    payload: { before: req.before, after: req.after },
  })

  // needsSignoff already established the actor holds a SCOPED grant on
  // req.action, and request.create is granted at least 'own' to every seat
  // that can reach 'scoped' here, so filing failing is not a permission edge
  // case — it is a bug (an entityType the appliers don't support yet, or
  // createChangeRequest's own shape drifting). Returning null on that would
  // read to the caller as "proceed with the direct write", exactly the
  // bypass sign-off exists to close, so this throws instead.
  if (!filed.ok) throw new Error(`routeForSignoff: filing failed — ${filed.error}`)
  return { id: filed.data.id }
}
