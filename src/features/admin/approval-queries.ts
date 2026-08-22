import { cache } from 'react'

import { can, type Actor } from '@/features/auth/capabilities'
import { listPendingUsers } from '@/features/admin/queries'
import { getApprovalsInbox } from '@/features/admin/change-request-queries'
import { listPendingAbsences } from '@/features/worklog/absence-queries'
import { NO_APPROVALS, type ApprovalCounts } from '@/features/admin/approval-badge'

/**
 * How much is waiting on this person, for the sidebar badge.
 *
 * THE SAME READERS /admin/approvals USES, not a parallel set of COUNT queries.
 * Each of those three carries its own scoping — which leave requests this actor
 * may act on, which change requests are addressed to their signature, whether
 * signups are theirs to see at all — and a second implementation built for
 * speed would be a second implementation of AUTHORISATION. When the two
 * drifted, the badge would promise a number the page then would not show, or
 * worse, count rows the reader may not open.
 *
 * The cost of that choice is three list reads rather than three counts. It is
 * paid only by seats that can approve something, because of the gate below, and
 * the lists are of things awaiting a decision — a queue nobody lets grow to
 * thousands, by construction.
 *
 * ZERO QUERIES FOR MOST PEOPLE. `request.review` is the same predicate
 * /admin/approvals guards itself with, so a seat without it does no work here
 * and gets no row: a member navigating the app pays nothing for a feature they
 * cannot use.
 *
 * `cache()` because the app layout runs on every navigation, and the dashboard's
 * approvals zone asks adjacent questions in the same render.
 */
export const countPendingApprovals = cache(async function countPendingApprovals(
  actor: Actor | null,
): Promise<ApprovalCounts> {
  // The row leads to /admin/approvals, and that page refuses anybody without
  // `request.review`. Asking the identical question here is what stops the
  // sidebar ever offering a door that answers with a 404.
  if (!actor || !can(actor, 'request.review')) return NO_APPROVALS

  const [users, absences, requests] = await Promise.all([
    // Signups are a narrower grant than the queue itself: a reviewer who may
    // sign change requests does not necessarily decide who joins.
    can(actor, 'user.approve') ? listPendingUsers() : Promise.resolve([]),
    listPendingAbsences(actor),
    getApprovalsInbox(actor),
  ])

  return { users: users.length, absences: absences.length, requests: requests.length }
})
