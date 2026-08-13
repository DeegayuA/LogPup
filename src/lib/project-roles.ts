/**
 * What a person's PER-PROJECT role means, derived from the free text in
 * assignments.role.
 *
 * Free text is deliberate (see job-roles.ts — suggestions, not an enum), so
 * meaning has to be derived by pattern rather than equality. The studio's
 * working rule: a project MANAGER runs the project and its meetings; a LEAD
 * or ARCHITECT is a busy reviewer — they read and give feedback, they do
 * not carry the admin burden. Everyone else is hands-on.
 *
 * Pure and dependency-free so the same test-pinned patterns serve both the
 * UI badge and the server-side permission check — two private copies of
 * "who counts as a manager" would drift, and the person it drifts on is the
 * one locked out of their own meeting.
 */

export type ProjectRoleTone = 'manager' | 'reviewer' | 'member'

/** Runs the project: Project/Product/Delivery/Program/Engineering Manager, PM, Product Owner, Scrum Master. */
export function isProjectManagerRole(role: string | null | undefined): boolean {
  if (!role) return false
  const r = role.trim()
  return (
    /\bmanager\b/i.test(r) ||
    /^pm\b/i.test(r) ||
    /\bproduct owner\b/i.test(r) ||
    /\bscrum master\b/i.test(r)
  )
}

/** Reviews and gives feedback: leads, architects, principals, C-level. */
export function isReviewerRole(role: string | null | undefined): boolean {
  if (!role) return false
  const r = role.trim()
  return (
    /\blead\b/i.test(r) ||
    /architect/i.test(r) ||
    /\bprincipal\b/i.test(r) ||
    /\b(cto|ceo|coo|director)\b/i.test(r)
  )
}

/** Which visual weight a role badge carries. Manager wins over reviewer. */
export function roleBadgeTone(role: string | null | undefined): ProjectRoleTone {
  if (isProjectManagerRole(role)) return 'manager'
  if (isReviewerRole(role)) return 'reviewer'
  return 'member'
}
