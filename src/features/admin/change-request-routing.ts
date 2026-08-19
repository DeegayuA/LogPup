import { can, type Actor } from '@/features/auth/capabilities'

export type ReviewableRequest = {
  requesterId: string
  appId: string | null
  entityType: string
  status: string
  /** Only set for worklog corrections: the owner of the row being corrected. */
  ownerId?: string
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
 */
export function mayReview(actor: Actor, request: ReviewableRequest): boolean {
  if (request.status !== 'pending') return false

  if (request.entityType === 'worklog') {
    return request.ownerId === actor.id
  }

  if (request.requesterId === actor.id) {
    return can(actor, 'request.review.self', { ownerId: actor.id })
  }

  return can(actor, 'request.review', { appId: request.appId })
}
