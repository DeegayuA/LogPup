import { createHash, timingSafeEqual } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
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
 * Email domains the bridge will resolve. Default `altavision.lk`.
 *
 * DELIBERATELY NOT `ALLOWED_EMAIL_DOMAINS`, which decides who may SIGN IN and currently carries
 * four domains. Widening sign-in must never silently widen what a shared API key can read —
 * they are two different questions and they get two different variables.
 */
export function bridgeDomains(): string[] {
  const raw = process.env.LOGPUP_BRIDGE_DOMAINS ?? 'altavision.lk'
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean)
}

/**
 * Whether this address is in scope for the bridge.
 *
 * Whole-domain equality, never a suffix test: `endsWith('altavision.lk')` would also accept
 * `notaltavision.lk` and `altavision.lk.attacker.com`. A subdomain is a different domain and is
 * not covered unless it is listed. Same shape as lib/allowed-domains.ts, which this mirrors.
 */
export function bridgeEmailAllowed(email: string): boolean {
  const at = email.lastIndexOf('@')
  if (at === -1) return false
  return bridgeDomains().includes(email.slice(at + 1).toLowerCase())
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
 * Returns null for every refusal — out of domain, unknown, deactivated, pending, removed — and
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
