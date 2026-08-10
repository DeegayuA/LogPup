import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'

const emailAllowed = (email: string) =>
  email.endsWith('@' + process.env.ALLOWED_EMAIL_DOMAIN)

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
    // E2E-only bypass; disabled unless E2E_TEST_MODE=1 (used in Task 18)
    ...(process.env.E2E_TEST_MODE === '1'
      ? [Credentials({
          credentials: { email: {} },
          async authorize(creds) {
            const email = String(creds?.email ?? '')
            if (!emailAllowed(email)) return null
            const [u] = await db.select().from(users).where(eq(users.email, email))
            return u ? { id: u.id, email: u.email, name: u.name } : null
          },
        })]
      : []),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/sign-in' },
  callbacks: {
    async signIn({ profile, account, user }) {
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
