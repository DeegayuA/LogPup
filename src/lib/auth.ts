import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Notion from 'next-auth/providers/notion'
import Credentials from 'next-auth/providers/credentials'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { emailAllowed, allowedDomains } from '@/lib/allowed-domains'
import { orgForEmail } from '@/lib/org-from-domain'
import { verifyPassword } from '@/lib/password'
import { loginRateLimiter, RateLimitError, LOCKOUT_MESSAGE } from '@/lib/rate-limit'

const MAX_PASSWORD_LENGTH = 200

const authBaseUrl = process.env.AUTH_URL ?? 'http://localhost:3000'

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
        const [u] = await db.select().from(users).where(eq(users.email, email))
        if (!u || !u.active || !u.passwordHash) {
          loginRateLimiter.recordFailure(email)
          return null
        }
        if (!verifyPassword(password, u.passwordHash)) {
          loginRateLimiter.recordFailure(email)
          return null
        }
        loginRateLimiter.reset(email)
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
    ...(testLoginEnabled
      ? [Credentials({
          credentials: { email: {} },
          async authorize(creds) {
            const email = String(creds?.email ?? '').trim().toLowerCase()
            if (!emailAllowed(email)) return null
            const [u] = await db.select().from(users).where(eq(users.email, email))
            if (u) return u.active ? { id: u.id, email: u.email, name: u.name } : null
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
                orgTags: derivedOrg ? [derivedOrg] : [],
              })
              .returning()
            return { id: created.id, email: created.email, name: created.name }
          },
        })]
      : []),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/sign-in' },
  callbacks: {
    async signIn({ profile, account, user }) {
      const provider = account?.provider

      // The password provider already fully validated in authorize(); allow it through.
      if (provider === 'password' || provider === 'credentials') return true

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
      if (!emailAllowed(email)) {
        console.warn(`[auth] denied: ${email} not in allowed domains [${allowedDomains().join(', ') || '(none configured)'}]`)
        return false
      }

      const [existing] = await db.select().from(users).where(eq(users.email, email))

      // Notion: never auto-provision. Only an existing, active allowed user may log in.
      if (provider === 'notion') {
        if (!existing) {
          console.warn(`[auth] denied: Notion account ${email} has no matching user`)
          return false
        }
        if (!existing.active) {
          console.warn(`[auth] denied: ${email} is deactivated (active=false)`)
          return false
        }
        return true
      }

      // Google: sign in existing user (refreshing the token) or provision a new one.
      if (existing) {
        if (!existing.active) {
          console.warn(`[auth] denied: ${email} is deactivated (active=false)`)
          return false
        }
        if (account?.refresh_token) {
          await db.update(users)
            .set({ googleRefreshToken: account.refresh_token })
            .where(eq(users.id, existing.id))
        }
        return true
      }
      const derivedOrg = orgForEmail(email)
      await db.insert(users).values({
        email,
        name: profile?.name ?? email,
        avatarUrl: (profile as { picture?: string } | undefined)?.picture,
        googleRefreshToken: account?.refresh_token,
        orgTags: derivedOrg ? [derivedOrg] : [],
      })
      return true
    },
    async jwt({ token }) {
      if (!token.email) return token
      // Provisioning always stores emails lowercase (see signIn/authorize
      // above); normalize here too so a provider that hands back mixed-case
      // email casing (observed from some OAuth IdPs) still matches the row.
      const email = token.email.toLowerCase()
      const [u] = await db.select().from(users).where(eq(users.email, email))
      if (!u?.active) return null
      token.userId = u.id
      token.role = u.role
      // This callback hits the DB on every session read (not just at sign-in),
      // so the flag refreshes per request: the moment setOwnPassword clears it
      // on the users row, the very next request unsticks — no re-login needed.
      token.mustChangePassword = u.mustChangePassword
      return token
    },
    async session({ session, token }) {
      session.user.id = token.userId as string
      session.user.role = token.role as 'admin' | 'member'
      session.user.mustChangePassword = token.mustChangePassword === true
      return session
    },
  },
})
