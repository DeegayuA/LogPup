import { can, effectiveGrant, type Actor } from '@/features/auth/capabilities'

export type ReviewableRequest = {
  requesterId: string
  appId: string | null
  entityType: string
  status: string
  /** Only set for worklog corrections: the owner of the row being corrected. */
  ownerId?: string
  /** Only set for app-entity requests: the app's current tech lead. */
  leadId?: string | null
}

/**
 * Who may sign this request. Pure.
 *
 * Two rules here are not capability lookups, and both are deliberate:
 *
 * 1. A WORKLOG CORRECTION routes to the row's owner and nobody else. Worklog
 *    writes are self-only — there is no `worklog.write.any` action for any
 *    seat, superadmin included — so a correction applied by anyone else would
 *    convert a self-report into a managed metric, at which point it stops
 *    measuring anything. The correction is a proposal to the person; they
 *    accept it with their own hand.
 *
 * 2. NOBODY REVIEWS THEIR OWN REQUEST, except a superadmin. Separation of
 *    duties is the entire point of an approval queue, and a scoped seat
 *    signing its own paperwork defeats it. The superadmin exception exists
 *    because the alternative is a sole-superadmin workspace that can never
 *    approve anything; those approvals are logged with selfApproved = true so
 *    a review can list them in one query.
 *
 * 3. An APP-ENTITY request signs through its own lead, never the generic
 *    scoped tail below. That tail is `can(actor,'request.review',{appId})`,
 *    and `request.review` is `manager:S` — so on the generic path ANY
 *    manager scoped to the app (a co-PM, a manager sharing the project for
 *    an unrelated reason) could sign another PM's request. Sign-off exists
 *    to put ONE named person, the lead, on the hook for the project's shape;
 *    widening that to every scoped manager defeats the feature it belongs
 *    to. Everyone who is not the lead falls back to the unscoped 'all'
 *    grant — the admin family — not the scoped one.
 */
export function mayReview(actor: Actor, request: ReviewableRequest): boolean {
  if (request.status !== 'pending') return false

  if (request.entityType === 'worklog') {
    return request.ownerId === actor.id
  }

  if (request.requesterId === actor.id) {
    return can(actor, 'request.review.self', { ownerId: actor.id })
  }

  if (request.entityType === 'app') {
    if (request.leadId === actor.id) return can(actor, 'request.review', { appId: request.appId })
    return effectiveGrant(actor.role, actor.employmentType, 'request.review') === 'all'
  }

  return can(actor, 'request.review', { appId: request.appId })
}
