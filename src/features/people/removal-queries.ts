// Who is no longer part of the workspace — the read side of `user_deletions`.
//
// Read the long comment on userDeletions in src/db/schema.ts first: removal is
// a tombstone BESIDE the user, not a deletedAt column on it, because `users`
// is joined by roughly a hundred reads whose job is attribution. This module
// exists so that split stays visible in one file — attribution joins never
// call anything here, and the short list of reads that hand out work all
// compose notRemoved().
//
// DELIBERATELY NOT a src/db/live.ts subquery. A live* subquery replaces its
// table everywhere, and src/db/live.test.ts enforces that every read goes
// through it, because for apps/tasks/meetings the filter is universal. Here
// the opposite holds: nearly every read of `users` must NOT filter, so the
// exclusion is opt-in per query. A liveUsers subquery would make forgetting
// the filter the safe default and remembering it the exception — exactly
// backwards, and it would silently blank the name off every past comment.
//
// NOT deactivation (users.active). A deactivated account still signs in and
// is told it is deactivated; a removed one gets no session at all.

import { QueryBuilder, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { and, eq, isNull, notExists, sql, type SQL } from 'drizzle-orm'
import { db } from '@/db'
import { userDeletions, users } from '@/db/schema'

// Connection-free, same reason as src/db/live.ts: QueryBuilder builds SQL
// without a client, so a module-level predicate never touches the lazy db
// Proxy at import time.
const qb = new QueryBuilder()

/**
 * The correlated "this person has an OPEN removal interval" subquery every
 * export below is built from — one definition, so the predicate and the
 * selectable flag can never disagree about what "removed" means.
 *
 * Open means restored_at IS NULL, which the partial unique index
 * user_deletions_one_open_idx allows at most one of per person.
 */
function openRemovalOf(userIdColumn: AnyPgColumn | SQL) {
  return qb
    .select({ one: sql`1` })
    .from(userDeletions)
    .where(and(eq(userDeletions.userId, userIdColumn), isNull(userDeletions.restoredAt)))
}

/**
 * The reusable exclusion. Compose it into the WHERE of any read that HANDS
 * OUT WORK — the people directory, member/assignee pickers, assignment
 * targets, meeting-attendee pickers, the admin people table's default view.
 *
 * Never into a read that ATTRIBUTES work. `notRemoved(users.id)` on a join
 * that resolves "who wrote this comment" does not hide the removed person,
 * it blanks the authorship of something that really happened.
 */
export function notRemoved(userIdColumn: AnyPgColumn | SQL): SQL {
  return notExists(openRemovalOf(userIdColumn))
}

export type OpenRemoval = {
  removedAt: Date
  /** The admin who removed them, or null if that account is itself gone. */
  removedBy: string | null
  reason: string | null
}

export type OpenRemovalRow = OpenRemoval & { userId: string }

/**
 * Pure, so the keying is testable without a database. Split out for the same
 * reason trash-grouping.ts is split from trash-queries.ts.
 */
export function toRemovalMap(rows: readonly OpenRemovalRow[]): Map<string, OpenRemoval> {
  return new Map(
    rows.map((row) => [
      row.userId,
      { removedAt: row.removedAt, removedBy: row.removedBy, reason: row.reason },
    ]),
  )
}

/**
 * Every open removal, keyed by user id — the batch form, for a surface that
 * has already loaded a list of people and needs to annotate it. One query for
 * the whole page rather than one isRemoved() per row.
 *
 * Unbounded on purpose: this is "everyone who has left and not come back",
 * which is a workspace-sized number, not a work-sized one.
 */
export async function openRemovals(): Promise<Map<string, OpenRemoval>> {
  const rows = await db
    .select({
      userId: userDeletions.userId,
      removedAt: userDeletions.removedAt,
      removedBy: userDeletions.removedBy,
      reason: userDeletions.reason,
    })
    .from(userDeletions)
    .where(isNull(userDeletions.restoredAt))
  return toRemovalMap(rows)
}

/**
 * One person — the question every sign-in path asks. Also the jwt callback's,
 * which asks it on every session read rather than only at the door, so an
 * admin removing somebody mid-session ends that session on their next
 * navigation instead of at token expiry.
 */
export async function isRemoved(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: userDeletions.id })
    .from(userDeletions)
    .where(and(eq(userDeletions.userId, userId), isNull(userDeletions.restoredAt)))
    .limit(1)
  return row !== undefined
}

/**
 * What every sign-in path says. One string, because a person locked out by
 * removal should get the same sentence whether they tried a password, Google,
 * or a passkey — three different phrasings would read as three different
 * faults and send them to three different places for help.
 *
 * Says "no longer active" rather than "removed": the person on the other side
 * of it needs to know who to ask, not the shape of our tombstone table.
 */
export const ACCOUNT_REMOVED_MESSAGE =
  'This account is no longer active — contact an admin if that is a mistake.'

/**
 * Thrown out of the password provider's authorize() so loginWithPassword can
 * show ACCOUNT_REMOVED_MESSAGE instead of the generic "Invalid email or
 * password". Exactly the RateLimitError idiom in src/lib/rate-limit.ts — a
 * Credentials provider has no other way to distinguish a refusal, since
 * returning null collapses every reason into CredentialsSignin.
 *
 * Lives here rather than beside the sign-in code because the message and the
 * query that decides to send it are one fact; splitting them is how the two
 * drift.
 */
export class AccountRemovedError extends Error {}

/**
 * Where the OAuth providers land a removed person. They have no way to carry
 * a message back through the redirect, so they hand Auth.js a URL instead of
 * `false` (which would collapse to the generic AccessDenied copy) — see
 * ERROR_COPY in src/app/auth-error/page.tsx for the matching entry.
 */
export const ACCOUNT_REMOVED_REDIRECT = '/auth-error?error=AccountRemoved'

/**
 * THE roster predicate — "may this person be handed work right now".
 *
 * Every directory, picker, assignment target and speaker list in the app was
 * already spelling out `active && approved` by hand, and the removal work
 * then had to remember to add `notRemoved` to each of them separately. It did
 * not: six of the nine forgot, and in every one of those a REMOVED person —
 * who cannot sign in at all — still ranked as more employable than a merely
 * DEACTIVATED one, who is excluded by the `active` half. Removal is strictly
 * heavier than deactivation, so any read where deactivation disqualifies you
 * must disqualify removal too; the two can only stay in that order if one
 * expression says so.
 *
 * Compose this instead of the three conditions. Never into a join that
 * ATTRIBUTES work — see notRemoved above, and the comment on userDeletions in
 * src/db/schema.ts.
 */
export function canHoldWork(): SQL {
  return and(
    eq(users.active, true),
    // Excludes self-signed-up accounts still awaiting admin approval.
    eq(users.status, 'approved'),
    notRemoved(users.id),
  ) as SQL
}
