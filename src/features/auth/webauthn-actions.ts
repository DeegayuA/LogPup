'use server'

import { createHash, randomBytes } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/types'
import { db } from '@/db'
import { users, webauthnCredentials, webauthnLoginTokens } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { ACCOUNT_REMOVED_MESSAGE, isRemoved } from '@/features/people/removal-queries'

/**
 * Passkeys — biometric sign-in for the PWA. First sign-in stays Google or
 * password; after that, a registered passkey (Touch ID, Face ID, Windows
 * Hello, a phone) is one tap.
 *
 * The bridge to NextAuth: WebAuthn proves possession HERE, but the session is
 * NextAuth's to mint. completePasskeyLogin therefore issues a single-use,
 * 60-second token whose sha256 is stored; the client trades the raw token
 * through the 'passkey' Credentials provider (src/lib/auth.ts), which marks
 * it used. Replay shows up as "already used", not "never existed".
 *
 * The challenge lives in an httpOnly cookie between the two halves of each
 * ceremony — the server must compare against a challenge the CLIENT never
 * chose, and a cookie scopes it to this browser without a table of pending
 * challenges to sweep.
 */

const CHALLENGE_COOKIE = 'logpup-webauthn-challenge'
const CHALLENGE_TTL_SECONDS = 300
const LOGIN_TOKEN_TTL_MS = 60_000
const RP_NAME = 'LogPup'

async function relyingParty(): Promise<{ rpID: string; origin: string }> {
  const hdrs = await headers()
  // Origin is present on every server-action POST; host is the fallback for
  // anything unusual. localhost and the deployed domain both derive cleanly.
  const origin =
    hdrs.get('origin') ??
    `${hdrs.get('x-forwarded-proto') ?? 'https'}://${hdrs.get('host') ?? 'localhost'}`
  return { rpID: new URL(origin).hostname, origin }
}

async function setChallengeCookie(challenge: string) {
  const jar = await cookies()
  jar.set(CHALLENGE_COOKIE, challenge, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: CHALLENGE_TTL_SECONDS,
    path: '/',
  })
}

/** Read once and clear — a challenge answers exactly one ceremony. */
async function takeChallengeCookie(): Promise<string | null> {
  const jar = await cookies()
  const value = jar.get(CHALLENGE_COOKIE)?.value ?? null
  jar.delete(CHALLENGE_COOKIE)
  return value
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('base64url')

// ---------------------------------------------------------------------------
// Registration — signed in already; adds a passkey to the account.
// ---------------------------------------------------------------------------

export async function beginPasskeyRegistration(): Promise<
  ActionResult<PublicKeyCredentialCreationOptionsJSON>
> {
  const session = await auth()
  if (!session?.user) return err('Sign in required')

  const existing = await db
    .select({ id: webauthnCredentials.id, transports: webauthnCredentials.transports })
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.userId, session.user.id))

  const { rpID } = await relyingParty()
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: session.user.id,
    userName: session.user.email ?? session.user.name ?? 'LogPup user',
    userDisplayName: session.user.name ?? undefined,
    attestationType: 'none',
    // Resident key: the credential itself remembers who it belongs to, which
    // is what makes login ONE tap — no email typed first, the authenticator
    // offers the account.
    //
    // `platform` is what makes this Touch ID / Face ID rather than "a passkey":
    // without it the browser opens the full chooser — security key, phone via
    // QR, another laptop — and the built-in sensor is one option among several.
    // The cost is real and deliberate: a machine with no biometric sensor can
    // no longer enrol at all. It filters REGISTRATION only, so anyone who
    // already enrolled a roaming key keeps signing in with it.
    //
    // `required` over `preferred` for the same reason. Preferred lets an
    // authenticator skip the biometric and still return a valid credential, so
    // the account could end up protected by possession of an unlocked laptop —
    // which is exactly the guarantee Touch ID was asked for.
    authenticatorSelection: {
      residentKey: 'preferred',
      authenticatorAttachment: 'platform',
      userVerification: 'required',
    },
    // Re-registering the same authenticator would orphan the old row and
    // confuse "which of these is my MacBook" forever.
    excludeCredentials: existing.map((cred) => ({
      id: isoBase64URL.toBuffer(cred.id),
      type: 'public-key',
      transports: (cred.transports?.split(',') ?? undefined) as
        | AuthenticatorTransportFuture[]
        | undefined,
    })),
  })

  await setChallengeCookie(options.challenge)
  return ok(options)
}

export async function completePasskeyRegistration(
  response: RegistrationResponseJSON,
  label?: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return err('Sign in required')

  const expectedChallenge = await takeChallengeCookie()
  if (!expectedChallenge) return err('The sign-up attempt expired — try again')

  const { rpID, origin } = await relyingParty()
  let verified = false
  let registrationInfo: Awaited<
    ReturnType<typeof verifyRegistrationResponse>
  >['registrationInfo']
  try {
    ;({ verified, registrationInfo } = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    }))
  } catch (error) {
    console.error('[webauthn] registration verify failed:', error)
    return err('That passkey could not be verified')
  }
  if (!verified || !registrationInfo) return err('That passkey could not be verified')

  const id = isoBase64URL.fromBuffer(registrationInfo.credentialID)
  await db
    .insert(webauthnCredentials)
    .values({
      id,
      userId: session.user.id,
      publicKey: isoBase64URL.fromBuffer(registrationInfo.credentialPublicKey),
      counter: registrationInfo.counter,
      transports: response.response.transports?.join(',') ?? null,
      label: label?.trim().slice(0, 60) || null,
    })
    // The same authenticator re-registered lands on the same credential id —
    // refresh rather than fail, so "add it again" repairs a broken row.
    .onConflictDoUpdate({
      target: webauthnCredentials.id,
      set: {
        userId: session.user.id,
        publicKey: isoBase64URL.fromBuffer(registrationInfo.credentialPublicKey),
        counter: registrationInfo.counter,
      },
    })

  return ok({ id })
}

// ---------------------------------------------------------------------------
// Authentication — no session; this IS the login.
// ---------------------------------------------------------------------------

export async function beginPasskeyLogin(): Promise<
  ActionResult<PublicKeyCredentialRequestOptionsJSON>
> {
  const { rpID } = await relyingParty()
  // No allowCredentials: discoverable credentials let the authenticator name
  // the account, so the page needs no email field before the biometric.
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
  })
  await setChallengeCookie(options.challenge)
  return ok(options)
}

export async function completePasskeyLogin(
  response: AuthenticationResponseJSON,
): Promise<ActionResult<{ token: string }>> {
  const expectedChallenge = await takeChallengeCookie()
  if (!expectedChallenge) return err('The sign-in attempt expired — try again')

  const [credential] = await db
    .select()
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.id, response.id))
  if (!credential) return err('That passkey isn’t registered here')

  // The same refusals the jwt callback applies — checked BEFORE a token is
  // minted, so a deactivated account cannot hold a valid login token even
  // for sixty seconds.
  const [user] = await db.select().from(users).where(eq(users.id, credential.userId))
  if (!user || !user.active || user.status === 'rejected') return err('This account is not active')
  // REMOVED from the workspace — a different state from the deactivation
  // above (see the comment on userDeletions in src/db/schema.ts). Refused
  // here as well as in the 'passkey' provider's authorize() because this is
  // the only half of the passkey flow that can return a MESSAGE: the button
  // toasts whatever this err() says, while the provider can only return null.
  if (await isRemoved(user.id)) return err(ACCOUNT_REMOVED_MESSAGE)

  const { rpID, origin } = await relyingParty()
  let verified = false
  let newCounter = credential.counter
  try {
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: isoBase64URL.toBuffer(credential.id),
        credentialPublicKey: isoBase64URL.toBuffer(credential.publicKey),
        counter: credential.counter,
        transports: (credential.transports?.split(',') ?? undefined) as
          | AuthenticatorTransportFuture[]
          | undefined,
      },
    })
    verified = result.verified
    newCounter = result.authenticationInfo.newCounter
  } catch (error) {
    console.error('[webauthn] authentication verify failed:', error)
    return err('That passkey could not be verified')
  }
  if (!verified) return err('That passkey could not be verified')

  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  await db.batch([
    db
      .update(webauthnCredentials)
      .set({ counter: newCounter, lastUsedAt: now })
      .where(eq(webauthnCredentials.id, credential.id)),
    db.insert(webauthnLoginTokens).values({
      tokenHash: sha256(token),
      userId: credential.userId,
      expiresAt: new Date(now.getTime() + LOGIN_TOKEN_TTL_MS),
    }),
  ])

  return ok({ token })
}

// ---------------------------------------------------------------------------
// Management — the settings card.
// ---------------------------------------------------------------------------

export type PasskeySummary = {
  id: string
  label: string | null
  createdAt: Date
  lastUsedAt: Date | null
}

export async function listPasskeys(): Promise<ActionResult<PasskeySummary[]>> {
  const session = await auth()
  if (!session?.user) return err('Sign in required')
  const rows = await db
    .select({
      id: webauthnCredentials.id,
      label: webauthnCredentials.label,
      createdAt: webauthnCredentials.createdAt,
      lastUsedAt: webauthnCredentials.lastUsedAt,
    })
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.userId, session.user.id))
    .orderBy(webauthnCredentials.createdAt)
  return ok(rows)
}

/**
 * Removes a passkey — a hard delete, exempted by name in live.test.ts:
 * "this device is gone" is a security statement and must be absolute. Scoped
 * to the caller's own credentials by the WHERE, so no id probing can touch
 * another account's keys.
 */
export async function deletePasskey(id: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return err('Sign in required')
  const removed = await db
    .delete(webauthnCredentials)
    .where(and(eq(webauthnCredentials.id, id), eq(webauthnCredentials.userId, session.user.id)))
    .returning({ id: webauthnCredentials.id })
  if (removed.length === 0) return err('That passkey is already gone')
  return ok(undefined)
}
