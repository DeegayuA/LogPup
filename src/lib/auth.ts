import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Notion from 'next-auth/providers/notion'
import GitHub from 'next-auth/providers/github'
import { createHash } from 'node:crypto'
import Credentials from 'next-auth/providers/credentials'
import { and, isNull, gt, eq, type SQL } from 'drizzle-orm'
import { db } from '@/db'
import { webauthnLoginTokens, users } from '@/db/schema'
import { emailAllowed, allowedDomains } from '@/lib/allowed-domains'
import { mayHoldSession } from '@/lib/access-gate'
import { orgForEmail } from '@/lib/org-from-domain'
import { verifyPassword } from '@/lib/password'
import { verifyGoogleIdToken } from '@/features/auth/google-one-tap'
import { loginRateLimiter, RateLimitError, LOCKOUT_MESSAGE } from '@/lib/rate-limit'
import {
  ACCOUNT_REMOVED_MESSAGE,
  ACCOUNT_REMOVED_REDIRECT,
  AccountRemovedError,
  isRemoved,
} from '@/features/people/removal-queries'

// REMOVAL IS NOT DEACTIVATION, and every refusal below now carries one of
// each. They answer to different admin actions and are written as separate
// statements everywhere so they stay independently editable:
//   users.active === false  — DEACTIVATED. The account still signs in and is
//   shown /deactivated; `mayHoldSession` deliberately does not consult it.
//   an OPEN user_deletions row — REMOVED. Somebody who is no longer part of
//   the workspace: no session at all, from any provider, until an admin
//   restores them from admin Trash (restorePerson).
// The removal checks are the isRemoved() ones. Never fold either into the
// other, and never into mayHoldSession — that predicate is about `status`.

const MAX_PASSWORD_LENGTH = 200

const authBaseUrl = process.env.AUTH_URL ?? 'http://localhost:3000'

// DECISION — what ALLOWED_EMAIL_DOMAINS / emailAllowed() now gates:
// Google sign-in used to be a two-gate system — the domain allowlist decided
// who could sign in at all, and AUTO_PROVISION_EMAIL_DOMAINS (now removed)
// decided who could self-register a brand-new row. Open signup + admin
// approval collapses that into one gate: ANY Google account with a verified
// email may sign in (see the signIn callback below), and a first-time signer
// lands as status='pending' — locked out of the app by src/proxy.ts until an
// admin approves them. The allowlist stops being a sign-in gate for Google;
// it no longer blocks anything there. It's kept — unchanged — for the
// password and Notion providers below, which have no self-signup flow of
// their own and still require an admin-provisioned row up front, so the
// allowlist is still doing real work for them (keeping an admin from typing
// in a domain that could never actually sign in).

// Fail closed: the passwordless provider must NEVER be reachable in a production
// runtime. Crash at boot rather than silently accept a leaked test flag.
if (process.env.NODE_ENV === 'production' && process.env.E2E_TEST_MODE === '1') {
  throw new Error('E2E_TEST_MODE must not be set in a production build')
}

// Passwordless login for local dev + E2E only. The `NODE_ENV !== 'production'`
// conjunct is statically inlined by the bundler, so this whole branch is
// dead-code-eliminated from production builds — verified in the compiled chunk.
const testLoginEnabled =
  process.env.NODE_ENV !== 'production' &&
  (process.env.E2E_TEST_MODE === '1' || !!process.env.DEV_LOGIN_EMAIL)

// Defensive: checks `.code` narrowly and walks `.cause` in case the driver's
// error arrives wrapped (e.g. by a pooling/proxy layer) — never assumes the
// shape, so anything else just falls through to `false`. Mirrors the
// `.cause`-walking helpers in trash-actions.ts / task-actions.ts.
function isMissingColumnError(error: unknown): boolean {
  let current: unknown = error
  const seen = new Set<unknown>()
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const e = current as { code?: unknown; cause?: unknown }
    if (e.code === '42703') return true
    current = e.cause
  }
  return false
}

// Every provider below and both callbacks look up `users` through this one
// function — not because the query differs, but so there is exactly one
// place to catch the failure mode that cost this repo roughly twenty
// minutes tonight: schema.ts had declared users.employment_type and
// users.supervisor_id without their migration applied. Drizzle names every
// declared column in its SELECT, so that single unmigrated column failed
// EVERY read of `users`, for every provider, with Postgres 42703
// (undefined_column) — and Auth.js cannot distinguish a thrown lookup from a
// rejected user, so it reported `[auth][error] AccessDenied`, which points
// at permissions and says nothing about the real cause.
//
// DIAGNOSTIC ONLY — this changes no authentication behaviour. On success it
// returns exactly what the inline query would have returned. On any error
// other than 42703 it rethrows immediately, unlogged, same as before this
// existed. On 42703 specifically it logs one loud, actionable line first —
// then rethrows the *original*, unmodified error, so the failure still
// fails exactly as it always did: nothing here swallows the error or lets a
// failed lookup fall through to a successful sign-in. Only the column-
// bearing driver message is logged — never a row, credential, password
// hash, token, or connection string.
async function selectUsers(condition: SQL) {
  try {
    return await db.select().from(users).where(condition)
  } catch (error) {
    if (isMissingColumnError(error)) {
      const driverMessage = error instanceof Error ? error.message : String(error)
      console.error(
        '[auth] sign-in lookup on `users` failed with Postgres 42703 (undefined_column): ' +
          'the database is missing a column that src/db/schema.ts declares — schema.ts is ' +
          'ahead of the database. Run `npm run db:migrate` to apply the pending migration, or ' +
          '`npm run db:drift` to see exactly which column(s) are missing. ' +
          `Driver message: ${driverMessage}`,
      )
    }
    throw error
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.events',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
    // Google One Tap. The browser gets an ID token from Google without leaving
    // the page (see features/auth/components/google-one-tap.tsx) and posts it
    // here. Modelled as a Credentials provider because there is no OAuth round
    // trip left to run — the token is already signed and in hand.
    //
    // Provisioning happens here in authorize(), not in the signIn callback as
    // it does for the Google provider: the callback receives no `profile` for a
    // credentials sign-in, so a row created there would be named after the
    // email address instead of the person. Doing it here keeps the name and
    // avatar the ID token actually carries.
    //
    // A user provisioned this way has NO googleRefreshToken, so Calendar writes
    // fail for them until they sign in once through "Continue with Google" —
    // google-calendar.ts already reports that as "consent was given, but not
    // for Calendar", which is precisely what happened.
    Credentials({
      id: 'google-one-tap',
      name: 'Google One Tap',
      credentials: { credential: {} },
      async authorize(creds) {
        const identity = await verifyGoogleIdToken(String(creds?.credential ?? ''))
        if (!identity) return null

        const [existing] = await selectUsers(eq(users.email, identity.email))
        if (existing) {
          // The same refusal the Google branch of the signIn callback makes.
          // 'pending' still signs in on purpose: they need a session to reach
          // /pending at all. So does a deactivated account (active=false) —
          // see the jwt callback for why being told you are deactivated
          // requires holding a session first.
          if (existing.status === 'rejected') {
            console.warn(`[auth] one-tap denied: ${identity.email} was rejected by an admin`)
            return null
          }
          // REMOVED — separate from the rejection above, and unlike
          // deactivation it gets no session to be told anything with. A
          // credentials authorize() cannot carry a message back (null
          // collapses to CredentialsSignin), so the one-tap component's
          // generic "that account cannot sign in" stands and this console
          // line is what an admin reads.
          if (await isRemoved(existing.id)) {
            console.warn(`[auth] one-tap denied: ${identity.email} was removed from the workspace`)
            return null
          }
          // Never clobber an uploaded avatar (those are /api/avatar/ URLs) —
          // same rule as the Google branch.
          const isUploaded = existing.avatarUrl?.startsWith('/api/avatar/') ?? false
          if (identity.picture && !isUploaded && identity.picture !== existing.avatarUrl) {
            await db.update(users).set({ avatarUrl: identity.picture }).where(eq(users.id, existing.id))
          }
          return { id: existing.id, email: existing.email, name: existing.name }
        }

        const derivedOrg = orgForEmail(identity.email)
        const [created] = await db.insert(users)
          .values({
            email: identity.email,
            name: identity.name,
            avatarUrl: identity.picture,
            orgTags: derivedOrg ? [derivedOrg] : [],
            status: 'pending',
            role: 'member',
            active: true,
          })
          .returning()
        return { id: created.id, email: created.email, name: created.name }
      },
    }),
    // Username (email) + password login. Always available. Passwords are scrypt-hashed;
    // authorize returns null on any mismatch so signIn never runs for a bad credential.
    // Rate-limited per email (see src/lib/rate-limit.ts): fails closed (throws, blocking
    // the attempt) once the limit is hit, and the counter resets on a successful login.
    Credentials({
      id: 'password',
      name: 'Email & password',
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = String(creds?.email ?? '').trim().toLowerCase()
        const password = String(creds?.password ?? '').slice(0, MAX_PASSWORD_LENGTH)
        if (!email || !password || !emailAllowed(email)) return null
        if (loginRateLimiter.isBlocked(email)) throw new RateLimitError(LOCKOUT_MESSAGE)
        const [u] = await selectUsers(eq(users.email, email))
        // `active` is deliberately NOT consulted: a deactivated person signs
        // in with their real password and is then shown /deactivated. Getting
        // the password wrong and being deactivated must stay two different
        // outcomes — refusing here would report a deactivation as "wrong
        // password" and burn a rate-limit attempt for it.
        if (!u || !u.passwordHash) {
          loginRateLimiter.recordFailure(email)
          return null
        }
        if (!verifyPassword(password, u.passwordHash)) {
          loginRateLimiter.recordFailure(email)
          return null
        }
        // REMOVED — checked only AFTER the password verifies, deliberately.
        // Refusing earlier would answer "does this person still work here?"
        // to anyone typing a guess, turning the message into an enumeration
        // oracle. It is also not a rate-limiter failure: the credential was
        // correct, and locking the account would outlast a restore.
        loginRateLimiter.reset(email)
        if (await isRemoved(u.id)) throw new AccountRemovedError(ACCOUNT_REMOVED_MESSAGE)
        return { id: u.id, email: u.email, name: u.name }
      },
    }),
    // Passkeys (WebAuthn). The cryptographic verification already happened in
    // completePasskeyLogin (features/auth/webauthn-actions.ts) — what arrives
    // here is that action's single-use 60-second token, and this provider's
    // whole job is to redeem it exactly once. The redeem IS the guarded
    // UPDATE: usedAt must still be null and expiresAt in the future, so a
    // replayed token matches zero rows rather than racing a read-then-write.
    Credentials({
      id: 'passkey',
      name: 'Passkey',
      credentials: { token: {} },
      async authorize(creds) {
        const token = String(creds?.token ?? '')
        if (!token) return null
        const tokenHash = createHash('sha256').update(token).digest('base64url')
        const [row] = await db
          .update(webauthnLoginTokens)
          .set({ usedAt: new Date() })
          .where(
            and(
              eq(webauthnLoginTokens.tokenHash, tokenHash),
              isNull(webauthnLoginTokens.usedAt),
              gt(webauthnLoginTokens.expiresAt, new Date()),
            ),
          )
          .returning({ userId: webauthnLoginTokens.userId })
        if (!row) return null
        const [u] = await selectUsers(eq(users.id, row.userId))
        // Same refusal as the jwt callback — a rejected account's token
        // redeems to nothing. A deactivated one does redeem: their passkey is
        // still theirs, and the session it mints only reaches /deactivated.
        if (!u || u.status === 'rejected') return null
        // REMOVED. completePasskeyLogin refuses this with the real message
        // before a token is ever minted; this is the backstop for a token
        // minted in the sixty seconds before the removal landed.
        if (await isRemoved(u.id)) return null
        return { id: u.id, email: u.email, name: u.name }
      },
    }),
    // Notion OAuth. Requires the public integration's client id/secret and an explicit
    // redirect URI. Sign-in only succeeds for a Notion account whose email matches an
    // existing allowed user (see the signIn callback) — never auto-provisioned.
    // Only registered when both env vars are actually set — constructing it with
    // possibly-undefined credentials would register a broken "Continue with Notion"
    // option instead of simply omitting it.
    ...(process.env.NOTION_OAUTH_CLIENT_ID && process.env.NOTION_OAUTH_CLIENT_SECRET
      ? [Notion({
          clientId: process.env.NOTION_OAUTH_CLIENT_ID,
          clientSecret: process.env.NOTION_OAUTH_CLIENT_SECRET,
          redirectUri: `${authBaseUrl}/api/auth/callback/notion`,
        })]
      : []),
    // GitHub OAuth, in the NOTION shape rather than the Google one, and that
    // difference is the whole security decision here.
    //
    // Google AUTO-PROVISIONS: any verified Google address may sign in and
    // lands as status='pending' for an admin to approve. GitHub must not,
    // because a GitHub account's email is frequently personal, can be
    // unverified, and can be hidden entirely — so "has a GitHub account" is
    // not evidence of anything about who somebody is. Sign-in therefore
    // succeeds only for an address that ALREADY matches an allowed user, the
    // way Notion does; the signIn callback below enforces that and needs no
    // change. GitHub is a convenience for people who are already here, never
    // a way in.
    //
    // Registered only when both vars are set: constructing it with
    // possibly-undefined credentials would offer a broken "Continue with
    // GitHub" button rather than simply not offering one.
    ...(process.env.GITHUB_OAUTH_CLIENT_ID && process.env.GITHUB_OAUTH_CLIENT_SECRET
      ? [
          GitHub({
            clientId: process.env.GITHUB_OAUTH_CLIENT_ID,
            clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(testLoginEnabled
      ? [Credentials({
          credentials: { email: {} },
          async authorize(creds) {
            const email = String(creds?.email ?? '').trim().toLowerCase()
            if (!emailAllowed(email)) return null
            const [u] = await selectUsers(eq(users.email, email))
            // Deactivated included, so an E2E run can actually reach the
            // /deactivated screen instead of only ever seeing the refusal.
            // REMOVED is not: this door is refused too, so an E2E run that
            // removes somebody and tries to sign in as them observes the real
            // behaviour rather than a hole this provider opened.
            if (u) return (await isRemoved(u.id)) ? null : { id: u.id, email: u.email, name: u.name }
            // Only the configured dev-login identity may be auto-provisioned;
            // every other address must already exist (unchanged prior behavior).
            const devEmail = process.env.DEV_LOGIN_EMAIL?.trim().toLowerCase()
            if (email !== devEmail) return null
            const derivedOrg = orgForEmail(email)
            const [created] = await db.insert(users)
              .values({
                email,
                name: email.split('@')[0],
                role: 'admin',
                // Explicitly approved: this is the trusted, single
                // dev/E2E identity (DEV_LOGIN_EMAIL) — leaving it at the
                // 'pending' column default would immediately pin it to
                // /pending and break local dev + E2E runs.
                status: 'approved',
                orgTags: derivedOrg ? [derivedOrg] : [],
              })
              .returning()
            return { id: created.id, email: created.email, name: created.name }
          },
        })]
      : []),
  ],
  session: { strategy: 'jwt' },
  // `error` replaces Auth.js's stock white "Access Denied" page (the one a
  // rejected/deactivated/unverified sign-in used to land on) with our own
  // branded explanation — see src/app/auth-error/page.tsx. Auth.js appends
  // `?error=<code>` (AccessDenied, Configuration, Verification, ...) to
  // whatever URL is configured here.
  pages: { signIn: '/sign-in', error: '/auth-error' },
  callbacks: {
    async signIn({ profile, account, user }) {
      const provider = account?.provider

      // These providers fully validated in authorize() — including, for
      // google-one-tap, the ID token signature, audience, verified-email claim,
      // and the active/rejected refusals — so there is nothing left to check
      // here. Falling through would be wrong as well as redundant: a
      // credentials sign-in carries no `profile`, so the Google branch below
      // would re-provision against an empty one.
      if (provider === 'password' || provider === 'credentials' || provider === 'passkey' || provider === 'google-one-tap') {
        return true
      }

      // Reject Google accounts whose email isn't verified by the IdP.
      if (provider === 'google' && (profile as { email_verified?: boolean } | undefined)?.email_verified === false) {
        console.warn('[auth] denied: email not verified by Google')
        return false
      }

      const email = (profile?.email ?? user?.email)?.toLowerCase()
      if (!email) {
        console.warn('[auth] denied: no email on profile')
        return false
      }

      // Notion keeps the stricter, pre-open-signup posture: domain-gated and
      // no self-registration. Google no longer checks the allowlist at all —
      // see the DECISION comment near the top of this file.
      if (provider === 'notion' && !emailAllowed(email)) {
        console.warn(`[auth] denied: ${email} not in allowed domains [${allowedDomains().join(', ') || '(none configured)'}]`)
        return false
      }

      const [existing] = await selectUsers(eq(users.email, email))

      // Notion: never auto-provision. Only an existing, non-rejected allowed
      // user may log in — deactivation is no longer a refusal here, on the
      // same rule every other provider now follows (see the jwt callback).
      if (provider === 'notion') {
        if (!existing) {
          console.warn(`[auth] denied: Notion account ${email} has no matching user`)
          return false
        }
        if (existing.status === 'rejected') {
          console.warn(`[auth] denied: ${email} was rejected by an admin (status=rejected)`)
          return false
        }
        // REMOVED. A URL rather than `false`: `false` collapses to Auth.js's
        // generic AccessDenied, and an OAuth redirect is the one sign-in path
        // with nowhere else to put a message.
        if (await isRemoved(existing.id)) {
          console.warn(`[auth] denied: ${email} was removed from the workspace`)
          return ACCOUNT_REMOVED_REDIRECT
        }
        return true
      }

      // Google: open self-signup. Sign in an existing user (refreshing the
      // token) or provision a brand-new one — status gates what happens
      // next, not this callback. A 'pending' user still returns true here:
      // they need a session to reach /pending and finish onboarding (see the
      // jwt callback and src/proxy.ts), they just can't reach anything else
      // yet. Nor does a deactivated one: same reasoning, different
      // destination (/deactivated).
      if (existing) {
        if (existing.status === 'rejected') {
          console.warn(`[auth] denied: ${email} was rejected by an admin (status=rejected)`)
          return false
        }
        // REMOVED — refused BEFORE the token/avatar refresh below, or a
        // removed person's account would keep silently re-storing a working
        // Google refresh token on every attempt.
        if (await isRemoved(existing.id)) {
          console.warn(`[auth] denied: ${email} was removed from the workspace`)
          return ACCOUNT_REMOVED_REDIRECT
        }

        const updates: { googleRefreshToken?: string; avatarUrl?: string } = {}
        if (account?.refresh_token) updates.googleRefreshToken = account.refresh_token

        // Keep the Google profile picture in sync on every sign-in — but never
        // clobber a picture the user uploaded themselves (those are Vercel Blob
        // URLs; see features/auth/avatar-actions.ts). Removing an uploaded
        // avatar sets the column NULL, so the next sign-in re-adopts Google's.
        const picture = (profile as { picture?: string } | undefined)?.picture
        const isUploaded = existing.avatarUrl?.startsWith('/api/avatar/') ?? false
        if (picture && !isUploaded && picture !== existing.avatarUrl) {
          updates.avatarUrl = picture
        }

        if (Object.keys(updates).length > 0) {
          await db.update(users).set(updates).where(eq(users.id, existing.id))
        }
        return true
      }

      // No user row yet: create one, pending admin approval. orgTags is
      // seeded from the email domain when it maps to a known company (see
      // src/lib/org-from-domain.ts); otherwise the person fills it in
      // themselves on /pending. role/active/status are written explicitly
      // even though they match the column defaults — this is the one place
      // that decision is actually being made, so it shouldn't be implicit.
      const derivedOrg = orgForEmail(email)
      await db.insert(users).values({
        email,
        name: profile?.name ?? email,
        avatarUrl: (profile as { picture?: string } | undefined)?.picture,
        googleRefreshToken: account?.refresh_token,
        orgTags: derivedOrg ? [derivedOrg] : [],
        status: 'pending',
        role: 'member',
        active: true,
      })
      return true
    },
    async jwt({ token }) {
      if (!token.email) return token
      // Provisioning always stores emails lowercase (see signIn/authorize
      // above); normalize here too so a provider that hands back mixed-case
      // email casing (observed from some OAuth IdPs) still matches the row.
      const email = token.email.toLowerCase()
      const [u] = await selectUsers(eq(users.email, email))
      // Rejected: no session, full stop. That is the one outcome of admin
      // review that should never see anything.
      //
      // DEACTIVATION IS NOT THAT, and used to be treated as if it were.
      // Killing the token here meant a deactivated person bounced off
      // /sign-in with an "Access denied" they could neither read an
      // explanation for nor act on — they could not even sign out, because
      // there was nothing to sign out of. A deactivated account now MUST get
      // a token, for the same reason 'pending' always has: being told what
      // happened to your account requires being signed in to be told. What
      // stops them going anywhere else is `token.active`, which the proxy,
      // the (app) layout and every capability check read (see src/proxy.ts,
      // src/app/(app)/layout.tsx, src/features/auth/actor.ts).
      if (!u || !mayHoldSession(u.status)) return null
      // REMOVED: no session, which is the whole difference from deactivation
      // three lines up. Here rather than only at the provider doors because
      // this callback runs on every session read — so an admin removing
      // somebody mid-session ends that session on their next navigation,
      // instead of leaving them signed in until the token expires.
      //
      // One extra indexed single-row lookup per request, accepted for the
      // same reason loadActor pays for one: a permission input that only
      // takes effect at re-login is not a permission input.
      if (await isRemoved(u.id)) return null
      token.userId = u.id
      token.role = u.role
      token.status = u.status
      // Re-read per request like everything else here, which is what makes
      // deactivation take effect on the next navigation of an already-open
      // tab — and reactivation likewise, with no re-login.
      token.active = u.active
      // This callback hits the DB on every session read (not just at sign-in),
      // so the flag refreshes per request: the moment setOwnPassword clears it
      // on the users row, the very next request unsticks — no re-login needed.
      // Same holds for status: the moment an admin approves/rejects, the next
      // request picks it up.
      token.mustChangePassword = u.mustChangePassword
      return token
    },
    async session({ session, token }) {
      session.user.id = token.userId as string
      session.user.role = token.role as 'admin' | 'member'
      session.user.status = token.status as 'pending' | 'approved' | 'rejected'
      // Normalized to a real boolean HERE and nowhere else, so no reader
      // downstream has to decide what a missing claim means. Absent only on a
      // token the jwt callback returned early for (no email on it), which
      // carries no userId either and so fails every id-based check anyway.
      session.user.active = token.active !== false
      session.user.mustChangePassword = token.mustChangePassword === true
      return session
    },
  },
})
