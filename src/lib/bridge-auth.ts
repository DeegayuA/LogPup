import { createHash, timingSafeEqual } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { canHoldWork } from '@/features/people/removal-queries'

/**
 * The door the Attendance Web App comes through.
 *
 * Two gates, and they answer different questions. `bridgeKeyValid` asks "is this the Attendance
 * app?" — it authenticates the CALLING APPLICATION and nothing more. `bridgeEmailAllowed` plus
 * `resolveBridgeUser` ask "may this person's work be read?" — the acting user is named
 * explicitly on every request and re-derived here, so holding the key never means "act as
 * anyone".
 *
 * See docs/attendance-task-bridge.md for the whole contract.
 */

/**
 * Whether this is an address the bridge will look up at all.
 *
 * NO DOMAIN GATE. There used to be one (`LOGPUP_BRIDGE_DOMAINS`, default `altavision.lk`), and it
 * refused people who use LogPup every day: Google sign-in is open to any verified account behind
 * admin approval (see the DECISION note in auth.ts), so plenty of approved accounts hold a
 * personal address. Who may be read is decided where it always really was — resolveBridgeUser's
 * canHoldWork(), and the SSO provider's own row lookup — and the variable is deliberately no
 * longer read, so a value left on a server cannot quietly bring the gate back.
 *
 * What remains is shape only: one `@`, something either side, no whitespace. Callers normalise
 * (trim + lowercase) before calling.
 */
export function bridgeEmailAllowed(email: string): boolean {
  return /^[^\s@]+@[^\s@]+$/.test(email)
}

/**
 * Whether the caller presented the shared key.
 *
 * Timing-safe, and hashed to a fixed 32 bytes first for the reason the cron route already
 * documents: `timingSafeEqual` throws on a length mismatch, so comparing raw strings would leak
 * the expected secret's LENGTH through the throw, and `===` short-circuits at the first
 * differing byte, which is measurable across enough requests.
 *
 * FAILS CLOSED when `LOGPUP_EXTERNAL_API_KEY` is unset. An unauthenticated task API is a public
 * read of everyone's work, so a forgotten variable must refuse everything rather than accept an
 * empty header.
 */
export function bridgeKeyValid(provided: string | null | undefined): boolean {
  const expected = process.env.LOGPUP_EXTERNAL_API_KEY
  if (!expected || !provided) return false
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

export type BridgeUser = { id: string; email: string; name: string }

/**
 * The person this request is acting as, or null.
 *
 * GATED ON `canHoldWork()`, NOT ON A HAND-ROLLED `active && approved`. That distinction is the
 * whole point: `removeUser` deliberately touches NEITHER `users.active` NOR `users.status` — a
 * removal opens an interval in `user_deletions` and nothing else — so a hand-written pair
 * silently admits a REMOVED person, who cannot sign in to LogPup by any of its five providers.
 * Without this, an employee removed on their last day would still have their whole task list
 * readable through the bridge, and status writes would still be attributed to them.
 *
 * removal-queries.ts documents that six of the nine call sites made exactly this mistake before
 * the predicate was centralised. This is the tenth; it composes rather than repeats.
 *
 * Returns null for every refusal — malformed, unknown, deactivated, pending, removed — and
 * the callers must answer all five identically. A distinguishable "no such user" turns the
 * endpoint into an address oracle for anyone holding the key.
 */
export async function resolveBridgeUser(email: string): Promise<BridgeUser | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized || !bridgeEmailAllowed(normalized)) return null

  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    // `users.email` is unique and stored lowercase by every provisioning path.
    .where(and(eq(users.email, normalized), canHoldWork()))
    .limit(1)

  return user ?? null
}

/**
 * resolveBridgeUser for many addresses in ONE query — for the team worklog batch. Same rule for
 * every address: shape-checked, then an existing row passing canHoldWork(). Addresses that fail
 * are simply absent from the result, so the caller answers them exactly like an unknown person.
 */
export async function resolveBridgeUsers(emails: string[]): Promise<BridgeUser[]> {
  const normalized = [...new Set(emails.map((e) => e.trim().toLowerCase()))].filter(
    (e) => e && bridgeEmailAllowed(e),
  )
  if (normalized.length === 0) return []
  return db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(and(inArray(users.email, normalized), canHoldWork()))
}
