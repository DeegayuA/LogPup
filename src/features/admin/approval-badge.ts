/**
 * How many things are waiting on this person's signature, and what the sidebar
 * puts beside the word.
 *
 * PURE — no db, no clock, no React. The counts arrive already read and already
 * scoped by whoever was allowed to see them (approval-queries.ts), so
 * everything here is arithmetic a test can pin.
 *
 * THREE KINDS, ONE NUMBER, summed rather than shown separately because the
 * sidebar row is a prompt, not a report: it exists to say "go look", and three
 * numbers in a 60px column would say it three times. The breakdown survives in
 * the type so the row's accessible name can spell it out, and /admin/approvals
 * shows all three as their own sections.
 */

export type ApprovalCounts = {
  /** Signups waiting for a decision. Only counted for a seat holding `user.approve`. */
  users: number
  /** Leave requests this actor may act on — already scoped by the reader. */
  absences: number
  /** Change requests addressed to this actor's signature. */
  requests: number
}

export const NO_APPROVALS: ApprovalCounts = { users: 0, absences: 0, requests: 0 }

export function approvalTotal(counts: ApprovalCounts): number {
  return counts.users + counts.absences + counts.requests
}

/**
 * Whether the row appears at all.
 *
 * NOTHING WAITING MEANS NO ROW. A permanent "Approvals 0" teaches people to
 * stop reading that part of the sidebar, which is exactly the habit a badge
 * needs them not to have — and every seat that can approve anything spends most
 * of its time at zero. The row is an interruption, so it earns its place only
 * when it has something to interrupt about.
 */
export function showApprovals(counts: ApprovalCounts): boolean {
  return approvalTotal(counts) > 0
}

/**
 * The badge's own limit, so a number cannot widen a fixed-width column.
 *
 * Ninety-nine pending approvals and a hundred and forty are the same message —
 * "this has got away from you" — and the exact figure is one click away on the
 * page the row leads to.
 */
export const APPROVAL_BADGE_MAX = 99

export function approvalBadgeText(counts: ApprovalCounts): string {
  const total = approvalTotal(counts)
  return total > APPROVAL_BADGE_MAX ? `${APPROVAL_BADGE_MAX}+` : String(total)
}

/**
 * What a screen reader hears instead of a bare digit.
 *
 * "Approvals, 3" says a number without saying what it counts, and a badge is
 * the one place a sighted reader gets context from position that a screen
 * reader does not get at all. This spells out the kinds that are actually
 * non-zero, in the order the approvals page lists them.
 */
export function approvalBadgeLabel(counts: ApprovalCounts): string {
  const parts: string[] = []
  if (counts.users > 0) {
    parts.push(`${counts.users} ${counts.users === 1 ? 'person' : 'people'} waiting to join`)
  }
  if (counts.requests > 0) {
    parts.push(`${counts.requests} change ${counts.requests === 1 ? 'request' : 'requests'}`)
  }
  if (counts.absences > 0) {
    parts.push(`${counts.absences} leave ${counts.absences === 1 ? 'request' : 'requests'}`)
  }
  if (parts.length === 0) return 'Approvals, nothing waiting'
  return `Approvals: ${parts.join(', ')}`
}
