import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { db } from '@/db'
import { ssoRedemptions } from '@/db/schema'

/**
 * The receiving half of the Attendance Web App's sign-in handoff.
 *
 * Attendance mints a short-lived HS256 JWT and sends the person to
 * /sso/attendance with it in the query string; this module decides whether
 * that token is real and whether it has already been spent. Who the person is
 * ALLOWED to be is decided by the provider in src/lib/auth.ts, which owns
 * every refusal — see docs/attendance-task-bridge.md, Part two.
 *
 * A SINGLE-SIGN-ON LINK IS A CONVENIENCE, NEVER A WAY IN. Nothing here
 * provisions anybody, and nothing here reads a role: the token says WHO, and
 * LogPup decides WHAT. A role claim shipped from another application would be
 * a second, weaker source of truth for every permission in this repo.
 *
 * WHY THIS VERIFIES THE JWT BY HAND rather than importing `jose`. The same
 * reason google-one-tap.ts gives for going through Google's tokeninfo endpoint:
 * jose is in node_modules only as a transitive dependency of next-auth, so
 * importing it directly makes LogPup break the day next-auth changes its
 * dependency tree. The difference is that One Tap had a third option and this
 * has none — so the choice was a lockfile write or thirty lines of HMAC. HS256
 * is a plain keyed hash, not JWKS: there is no key discovery, no certificate
 * chain and no algorithm negotiation to get wrong. The one classic JWT
 * mistake that DOES apply here is trusting the token's own `alg` header, and
 * the check below refuses anything that is not exactly HS256 before it
 * computes anything.
 */

/** What a valid token establishes. Deliberately three fields — see `name` below. */
export type AttendanceIdentity = {
  /** Lowercased. The only handle LogPup has for a person. */
  email: string
  /** The replay key. */
  jti: string
  /** The token's own expiry, stored on the redemption row so it can be swept. */
  expiresAt: Date
}

/**
 * Clock skew allowed on `exp` and `iat`, in seconds.
 *
 * Two deployments, two clocks, and a token that lives three minutes. Zero
 * tolerance turns a few seconds of ordinary NTP drift into "signing you in…"
 * followed by a failure nobody can reproduce. Thirty seconds is small against
 * the lifetime and large against the drift.
 */
const CLOCK_SKEW_SECONDS = 30

/**
 * The longest lifetime this side will honour, whatever the token claims.
 *
 * The contract says three minutes (Attendance mints with `.setExpirationTime('3m')`).
 * This is not a restatement of that: it is the receiver refusing to be bound
 * by the sender's arithmetic. The token rides in a URL and URLs outlive the
 * page, so a minting side misconfigured to a day — or one re-pointed at a
 * different Attendance deployment — must not turn browser history into a
 * standing session. Generous enough that moving 3m to 5m needs no change here.
 */
const MAX_LIFETIME_SECONDS = 600

type Claims = {
  sub?: unknown
  email?: unknown
  jti?: unknown
  iat?: unknown
  exp?: unknown
}

/**
 * base64url -> Buffer, refusing anything that is not already canonical.
 *
 * `Buffer.from(…, 'base64url')` is lenient: it skips characters it does not
 * recognise, so 'abc!!' and 'abc' decode alike. Re-encoding and comparing
 * rejects a signature that was padded, whitespaced or otherwise dressed up to
 * look different while decoding to the same bytes.
 */
function decodeStrict(part: string): Buffer | null {
  if (part === '') return null
  const buf = Buffer.from(part, 'base64url')
  if (buf.toString('base64url') !== part) return null
  return buf
}

function decodeJson(part: string): Record<string, unknown> | null {
  const buf = decodeStrict(part)
  if (!buf) return null
  try {
    const parsed: unknown = JSON.parse(buf.toString('utf8'))
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Verify the handoff token's signature and claims. Null for every refusal.
 *
 * FAILS CLOSED when `LOGPUP_SSO_SECRET` is unset. The provider is not even
 * registered in that case (src/lib/auth.ts), so this is the backstop for a
 * variable that disappears from one instance's environment rather than all.
 *
 * `now` is injected so the expiry rules are testable without waiting.
 */
export function verifyAttendanceToken(
  token: string | null | undefined,
  now: Date = new Date(),
): AttendanceIdentity | null {
  const secret = process.env.LOGPUP_SSO_SECRET
  if (!secret || !token) return null

  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerPart, payloadPart, signaturePart] = parts

  const header = decodeJson(headerPart)
  if (!header) return null
  // THE ALGORITHM IS PINNED, AND THIS LINE IS WHY THE REST IS SAFE. A verifier
  // that honours whatever the token's header claims will honour `alg: none`,
  // at which point anybody can mint a session for anybody.
  if (header.alg !== 'HS256') return null
  // An extension we are required to understand and do not. Refuse rather than
  // ignore — that is what `crit` means.
  if (header.crit !== undefined) return null

  const signature = decodeStrict(signaturePart)
  // HMAC-SHA256 is 32 bytes. Checked before the compare because
  // timingSafeEqual THROWS on a length mismatch, and a throw here would be an
  // unhandled rejection rather than a refusal.
  if (!signature || signature.length !== 32) return null

  const expected = createHmac('sha256', secret).update(`${headerPart}.${payloadPart}`).digest()
  if (!timingSafeEqual(expected, signature)) return null

  // Past this point the token is authentic. Everything below is about whether
  // it is still USABLE, which is a different question.
  const claims = decodeJson(payloadPart) as Claims | null
  if (!claims) return null

  const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : ''
  if (!email) return null
  // The contract says the email IS the subject. A token whose `sub` names
  // someone other than its `email` is either a bug or an attempt to make the
  // two ends disagree about who signed in; there is no reading of it that is
  // safe to guess at.
  if (typeof claims.sub === 'string' && claims.sub.trim().toLowerCase() !== email) return null

  const jti = typeof claims.jti === 'string' ? claims.jti : ''
  // No jti, no replay guard. A token without one is not a token this side can
  // spend exactly once, so it is not one this side accepts at all.
  if (!jti) return null

  if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)) return null
  if (typeof claims.iat !== 'number' || !Number.isFinite(claims.iat)) return null

  const nowSeconds = Math.floor(now.getTime() / 1000)
  if (claims.exp <= nowSeconds - CLOCK_SKEW_SECONDS) return null
  // Issued in the future by more than the skew: a clock this wrong is not one
  // whose expiry means anything.
  if (claims.iat > nowSeconds + CLOCK_SKEW_SECONDS) return null
  if (claims.exp - claims.iat > MAX_LIFETIME_SECONDS) return null

  // `name` is in the token and is deliberately NOT returned. It is display
  // text from another application; LogPup renders the name on its own `users`
  // row, and a claim nobody reads is a claim somebody eventually starts
  // reading — at which point another app is editing this one's user records.
  return { email, jti, expiresAt: new Date(claims.exp * 1000) }
}

/**
 * The lifetime LogPup mints with, matching what Attendance mints for the other
 * direction. Three minutes is long enough for a slow phone to follow a link and
 * short enough that a URL sitting in history is usually already dead.
 */
const HANDOFF_LIFETIME_SECONDS = 180

/**
 * Mint a handoff token naming ONE person: whoever the caller's session says.
 *
 * THE EMAIL IS THE CALLER'S OWN, ALWAYS. This function takes it as an argument
 * and the one route that calls it reads it from the session — never from a
 * request body. A handoff endpoint that accepts a target email is an
 * impersonation endpoint, and it looks exactly like this one until you read
 * where the argument came from.
 *
 * Symmetric with verifyAttendanceToken above and hand-rolled for the same
 * reason (see this file's header). The claim shape is fixed by the far end:
 * Attendance's /api/auth/logpup-sso reads `email` (falling back to `sub`) and
 * `jti`, and verifies with jose's jwtVerify pinned to HS256, which enforces
 * `exp` itself.
 *
 * Returns null when LOGPUP_SSO_SECRET is unset — the same fail-closed answer
 * the verifier gives, so an unconfigured deployment mints nothing rather than
 * handing out tokens signed with an empty string.
 */
export function signAttendanceHandoff(
  email: string,
  name: string,
  now: Date = new Date(),
): string | null {
  const secret = process.env.LOGPUP_SSO_SECRET
  if (!secret) return null

  const issuedAt = Math.floor(now.getTime() / 1000)
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const head = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
    // The email IS the subject: it is the only handle the two systems share.
    sub: email,
    email,
    // Display only, and the far side treats it that way — Attendance resolves
    // its own user row and never writes this.
    name,
    jti: randomUUID(),
    iat: issuedAt,
    exp: issuedAt + HANDOFF_LIFETIME_SECONDS,
  })}`

  return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`
}

/**
 * Spend the token exactly once. True if this call is the one that spent it.
 *
 * THE WRITE IS THE CHECK. Redemption is an INSERT against a primary key, so
 * two tabs opening the same link race in the database and exactly one wins. A
 * read-then-insert would let both through — which is the entire failure this
 * table exists to prevent, and it is invisible in testing because it needs two
 * requests in flight at once.
 *
 * `onConflictDoNothing().returning()` rather than catching the constraint
 * violation: same atomicity, no driver error-message matching. Zero rows back
 * means the jti was already spent.
 *
 * NOT best-effort. A failure to record the redemption must propagate, because
 * "we could not write the replay guard" has to mean "the sign-in does not
 * happen" — swallowing it would silently turn the guard off.
 */
export async function redeemAttendanceToken(identity: AttendanceIdentity): Promise<boolean> {
  const [row] = await db
    .insert(ssoRedemptions)
    .values({
      jti: identity.jti,
      email: identity.email,
      expiresAt: identity.expiresAt,
    })
    .onConflictDoNothing()
    .returning({ jti: ssoRedemptions.jti })

  return row !== undefined
}
