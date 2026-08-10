import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'

const emailAllowed = (email: string) =>
  email.endsWith('@' + process.env.ALLOWED_EMAIL_DOMAIN)

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
            const [created] = await db.insert(users)
              .values({ email, name: email.split('@')[0], role: 'admin' })
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
      // Reject Google accounts whose email isn't verified by the IdP.
      if (profile && (profile as { email_verified?: boolean }).email_verified === false) return false
      const email = profile?.email ?? user?.email
      if (!email || !emailAllowed(email)) return false
      const [existing] = await db.select().from(users).where(eq(users.email, email))
      if (existing) {
        if (!existing.active) return false
        if (account?.refresh_token) {
          await db.update(users)
            .set({ googleRefreshToken: account.refresh_token })
            .where(eq(users.id, existing.id))
        }
        return true
      }
      await db.insert(users).values({
        email,
        name: profile?.name ?? email,
        avatarUrl: (profile as { picture?: string } | undefined)?.picture,
        googleRefreshToken: account?.refresh_token,
      })
      return true
    },
    async jwt({ token }) {
      if (!token.email) return token
      const [u] = await db.select().from(users).where(eq(users.email, token.email))
      if (!u?.active) return null
      token.userId = u.id
      token.role = u.role
      return token
    },
    async session({ session, token }) {
      session.user.id = token.userId as string
      session.user.role = token.role as 'admin' | 'member'
      return session
    },
  },
})
