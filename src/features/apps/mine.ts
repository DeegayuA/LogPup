/**
 * Whether an app is one of YOUR projects, and how.
 *
 * Pure, and computed from the portfolio row the page already has — members,
 * leadId and pmId all arrive on `AppPortfolioEntry`, so "mine" costs no extra
 * query and cannot disagree with the avatars rendered beside it.
 *
 * WHY NOT `actor.scopeAppIds`. That set is the PERMISSION scope, built
 * differently per seat (features/auth/actor.ts: app_role_history for managers,
 * assignments for editors, app_grants for stakeholders). It answers "what may
 * this person see", which is a different question from "what is this person
 * working on" — an admin's scope is every app in the studio, and a page that
 * marked all of them as theirs would be telling them nothing. Membership is
 * about involvement; scope is about authority. They must not be conflated.
 */

export type MineKind = 'pm' | 'lead' | 'member' | null

export type MembershipRow = {
  leadId: string | null
  pmId: string
  members: readonly { userId: string; role: string }[]
}

/**
 * How this person is attached to this app, or null when they are not.
 *
 * Ordered by seniority, so somebody who is both PM and assigned reads as PM:
 * the stronger relationship is the true one, and showing "you're on this" to
 * the person running the project would be wrong rather than merely partial.
 */
export function mineKind(app: MembershipRow, userId: string | null | undefined): MineKind {
  if (!userId) return null
  if (app.pmId === userId) return 'pm'
  if (app.leadId === userId) return 'lead'
  return app.members.some((m) => m.userId === userId) ? 'member' : null
}

export function isMine(app: MembershipRow, userId: string | null | undefined): boolean {
  return mineKind(app, userId) !== null
}

/** The word on the card. Colour never carries this alone (WCAG 1.4.1). */
export const MINE_LABEL: Record<Exclude<MineKind, null>, string> = {
  pm: 'You run this',
  lead: 'You lead this',
  member: "You're on this",
}
